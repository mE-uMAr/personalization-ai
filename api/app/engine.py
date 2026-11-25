"""Recommendation engine: the order every request goes through.

    1. Rules-based eligibility filter            (app/rules.py — always first)
    2. Scoring                                   (Ranker — FormulaRanker in the demo)
    3. Drop completed and dismissed items
    4. Admin overrides (pins win; blocks already removed in step 1)
    5. Diversity: max 3 per topic in a row of 6
    6. ~10% exploration, seeded random choice (repeatable)
    7. Pick the reason (fixed templates)
    8. Log every impression

If the engine is switched off, paused, or over its latency budget, the site gets
editor-curated lists instead — a recommendation failure never breaks the page.
"""
from __future__ import annotations

import hashlib
import threading
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np

from app import profile as P
from app.behaviour import behaviour_matrix
from app.adapters import MockOceAdapter, PostgresEventSink, PostgresProfileStore
from app.config import (CLUSTER_ASSIGN_ACTIONS, EXPLORATION_PROBABILITY, MAX_PER_TA_IN_ROW, PEER_MIN_LIFT,
                        PEER_MIN_ROW, PEER_MIN_SCORE,
                        RELATED_MIN_COSINE, DIVERSITY_MAX_PER_TOPIC, EXPLORATION_POSITION,
                        LATENCY_BUDGET_MS, MIN_CLUSTER_SIZE, MODEL_VERSION, ROW_SIZE, HOME_RECOMMENDED_SIZE)
from app.db import db, j
from app.ports import Scored
from app.ranker import FormulaRanker
from app.reasons import COMPONENT_LABEL, render
from app.rules import Viewer, check, filter_items
from app.store import store

profiles = PostgresProfileStore()
sink = PostgresEventSink()
crm = MockOceAdapter()
ranker = FormulaRanker()

EXPERIMENT_ID = None  # live A/B experiments are not part of the demo (example results screen only)


# ── runtime switches (demo launcher / admin) ────────────────────────────────────
SYNC_SECONDS = 2.0  # how stale an instance's view of switches and content may get


class Switches:
    """Runtime switches and the content version, shared through the database.

    The API may run as several instances (serverless functions, autoscaled replicas) that start and stop at
    will, so nothing an admin changes may live only in one process's memory. Each instance re-reads these
    settings at most every SYNC_SECONDS and reloads the catalogue and overrides when the content version moved.
    """

    def __init__(self):
        self.engine_down = False
        self.paused = False
        self.demo_run = "run-1"
        self.content_version = 0
        self._synced_at = 0.0
        self._first = True  # the store was just loaded at startup: nothing to reload on the first sync
        self._lock = threading.Lock()

    def sync(self, force: bool = False) -> None:
        if not force and time.monotonic() - self._synced_at < SYNC_SECONDS:
            return
        with self._lock:
            if not force and time.monotonic() - self._synced_at < SYNC_SECONDS:
                return
            with db() as c:
                rows = c.all("SELECT key, value FROM settings WHERE key IN "
                             "('engine_down', 'paused', 'demo_run', 'content_version')")
            vals = {r["key"]: r["value"] for r in rows}
            self.engine_down = bool(vals.get("engine_down", False))
            self.paused = bool(vals.get("paused", False))
            self.demo_run = vals.get("demo_run") or "run-1"
            version = int(vals.get("content_version") or 0)
            if version != self.content_version:
                if not self._first:  # another instance changed content or overrides: reload them here
                    store.reload_items()
                    store.reload_overrides()
                    store.reload_impression_counts()
                self.content_version = version
            self._first = False
            self._synced_at = time.monotonic()

    def load(self):
        self.sync(force=True)

    def set(self, key: str, value):
        setattr(self, key, value)
        with db() as c:
            c.run("INSERT INTO settings (key, value) VALUES (:k, CAST(:v AS jsonb)) "
                  "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", k=key, v=j(value))

    def content_changed(self) -> None:
        """Call after changing items or overrides (this instance has already reloaded them)."""
        with db() as c:
            v = c.scalar("INSERT INTO settings (key, value) VALUES ('content_version', CAST('1' AS jsonb)) "
                         "ON CONFLICT (key) DO UPDATE SET value = to_jsonb(COALESCE((settings.value #>> '{}')::int, 0) + 1) "
                         "RETURNING value")
        self.content_version = int(v)


switches = Switches()


@dataclass
class Ctx:
    store: object
    hcp: dict
    profile: dict
    viewer: Viewer
    alpha: float
    ta_order: list[str]
    ta_affinity: dict[str, float]
    content_weights: dict[str, float]
    specialty_pop: dict[str, float]
    peer_pop: dict[str, float]
    cluster_id: int | None
    cluster_source: str | None
    specialty: str
    country: str
    lang: str
    session_id: str | None
    eligible: list[dict] = field(default_factory=list)
    removed: dict[str, str] = field(default_factory=dict)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── HCP + profile loading ────────────────────────────────────────────────────────
def get_hcp(hcp_id: str) -> dict | None:
    with db() as c:
        return c.one("SELECT * FROM hcps WHERE hcp_id = :h", h=hcp_id)


def viewer_state(hcp: dict | None) -> str:
    if hcp is None:
        return "anonymous"
    return "verified" if hcp["verified"] else "registered"


def load_profile(hcp: dict) -> dict:
    p = profiles.get(hcp["hcp_id"])
    if p is None:
        p = P.new_profile(store.specialty_ta(hcp["specialty"]), store.ta_ids)
    return p


def decayed_view(p: dict) -> dict:
    """Profile values decayed to now (stored values refer to `as_of`)."""
    f = P.decay_factor(p.get("as_of"), now_utc())
    if f >= 0.999:
        return p
    q = {**p, "ta": {k: v * f for k, v in p["ta"].items()},
         "items": {k: {**v, "w": v["w"] * f} for k, v in p["items"].items()}}
    return q


def effective_cluster(hcp: dict) -> tuple[int | None, str | None]:
    """Real cluster if assigned; otherwise nearest cluster by specialty and country (§5)."""
    if not hcp["tracking_consent"]:
        return None, None
    cid = hcp.get("cluster_id")
    if cid is not None and cid >= 0 and cid in store.clusters and store.clusters[cid]["size"] >= MIN_CLUSTER_SIZE:
        return cid, hcp.get("cluster_source") or "seed"
    return nearest_by_specialty_country(hcp["specialty"], hcp["country"]), "provisional"


def nearest_by_specialty_country(specialty: str, country: str) -> int | None:
    with db() as c:
        r = c.one("SELECT cluster_id, count(*) n FROM hcps WHERE synthetic AND cluster_id >= 0 AND specialty = :s "
                  "AND country = :c GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1", s=specialty, c=country)
        if not r:
            r = c.one("SELECT cluster_id, count(*) n FROM hcps WHERE synthetic AND cluster_id >= 0 AND specialty = :s "
                      "GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1", s=specialty)
    if r:
        return r["cluster_id"]
    ta = store.specialty_ta(specialty)
    best = [c for c in store.clusters.values() if c["top_tas"][0]["ta"] == ta]
    return max(best, key=lambda c: c["size"])["cluster_id"] if best else None


def build_ctx(hcp: dict | None, lang: str | None = None, session_id: str | None = None,
              country: str | None = None) -> Ctx:
    if hcp is None:  # anonymous visitor: public, non-promotional only; no tracking
        ctry = country if country in store.cfg["countries"] else next(iter(store.cfg["countries"]))
        p = P.new_profile(store.ta_ids[0], store.ta_ids)
        viewer = Viewer("anonymous", ctry)
        ctx = Ctx(store, {"hcp_id": "anonymous", "specialty": None, "country": ctry, "tracking_consent": False},
                  p, viewer, 0.0, P.ta_order(p), P.ta_scores(p), {}, store.overall_pop(ctry), {}, None, None, None,
                  ctry, lang or "en", session_id)
    else:
        p = decayed_view(load_profile(hcp))
        tracking = hcp["tracking_consent"]
        cid, csrc = effective_cluster(hcp)
        viewer = Viewer(viewer_state(hcp), hcp["country"])
        ctx = Ctx(
            store, hcp, p, viewer,
            alpha=P.alpha(p) if tracking else 0.0,
            ta_order=P.ta_order(p),
            ta_affinity=P.ta_scores(p),
            content_weights=P.content_weights(p) if tracking else {},
            specialty_pop=store.specialty_pop(hcp["specialty"], hcp["country"]),
            peer_pop=store.pop_cluster.get(cid, {}) if cid is not None else {},
            cluster_id=cid, cluster_source=csrc,
            specialty=hcp["specialty"], country=hcp["country"], lang=lang or hcp["language"], session_id=session_id,
        )
    items = [store.items[i] for i in store.order]
    ctx.eligible, ctx.removed = filter_items(items, ctx.viewer, store.rule_ctx())  # step 1 — always first
    return ctx


# ── list shaping ────────────────────────────────────────────────────────────────
def _drop_done(ctx: Ctx, scored: list[Scored]) -> list[Scored]:
    st = ctx.profile["items"]
    return [s for s in scored if not (st.get(s.item_id, {}).get("completed") or st.get(s.item_id, {}).get("dismissed"))]


def _apply_pins(ctx: Ctx, scored: list[Scored], slot: str, ta: str | None) -> list[Scored]:
    eligible_ids = {i["item_id"] for i in ctx.eligible}
    pins = [p for p in store.pins if p["country"] in ("*", ctx.country) and p["item_id"] in eligible_ids
            and (p["ta"] in (None, ta) or slot == "home_recommended")]
    if not pins:
        return scored
    pinned_ids = [p["item_id"] for p in pins]
    rest = [s for s in scored if s.item_id not in pinned_ids]
    head = [Scored(item_id=i, score=1.0, components={}, level="editor", reason_template="pinned") for i in pinned_ids]
    return head + rest


def _diversify(scored: list[Scored], n: int, max_per_ta: int | None = None) -> list[Scored]:
    """Greedy: no more than 3 items from one topic in each slot of 6 (§7 rule 5); optionally cap per TA.

    The topic cap is a hard rule: when the pool runs short the row is shorter, never padded with a 4th
    item of the same topic (QA D-02). The per-TA breadth cap is softer and may be relaxed to fill the row.
    """
    out, ta_deferred = [], []
    topics: dict[str, int] = defaultdict(int)
    tas: dict[str, int] = defaultdict(int)
    for s in scored:
        it = store.items[s.item_id]
        if topics[it["topics"][0]] >= DIVERSITY_MAX_PER_TOPIC:
            continue
        if max_per_ta is not None and tas[it["therapy_area"]] >= max_per_ta:
            ta_deferred.append(s)
            continue
        out.append(s)
        topics[it["topics"][0]] += 1
        tas[it["therapy_area"]] += 1
        if len(out) >= n:
            return out
    for s in ta_deferred:  # top up with the best remaining items that still respect the topic cap
        t = store.items[s.item_id]["topics"][0]
        if topics[t] < DIVERSITY_MAX_PER_TOPIC:
            out.append(s)
            topics[t] += 1
            if len(out) >= n:
                break
    return out


def topic_cap_ok(row: list[Scored]) -> bool:
    c: dict[str, int] = defaultdict(int)
    for s in row:
        c[store.items[s.item_id]["topics"][0]] += 1
    return max(c.values(), default=0) <= DIVERSITY_MAX_PER_TOPIC


def _explore(ctx: Ctx, row: list[Scored], pool: list[dict], slot: str, n: int) -> list[Scored]:
    """~10% of each list goes to less-seen approved content. Seeded → same choice every rehearsal."""
    if n < 6:
        return row
    seed = int(hashlib.sha256(f"{ctx.hcp['hcp_id']}:{slot}:{ctx.profile['actions']}".encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    if rng.random() > EXPLORATION_PROBABILITY:  # one slot in 60% of rows of 6 = about 10% of items shown
        return row
    taken = {s.item_id for s in row}
    st = ctx.profile["items"]
    near = set(ctx.ta_order[:2])
    kept = row[: n - 1] if len(row) >= n else row
    per_topic: dict[str, int] = defaultdict(int)
    for s in kept:
        per_topic[store.items[s.item_id]["topics"][0]] += 1
    cands = [i for i in pool if i["item_id"] not in taken and not i["promotional"]
             and per_topic[i["topics"][0]] < DIVERSITY_MAX_PER_TOPIC  # the topic cap holds after exploration too
             and (i["therapy_area"] in near or (ctx.specialty and ctx.specialty in i.get("audience_specialties", [])))
             and not st.get(i["item_id"], {}).get("completed") and not st.get(i["item_id"], {}).get("dismissed")
             and not st.get(i["item_id"], {}).get("opened")]
    if not cands:
        return row
    cands.sort(key=lambda i: (store.imp_count.get(i["item_id"], 0), i["item_id"]))
    pool_k = cands[: max(3, len(cands) // 4)]  # least-seen quartile
    pick = pool_k[rng.integers(len(pool_k))]
    ex = Scored(item_id=pick["item_id"], score=0.0, components={}, level="exploration", reason_template="exploration")
    pos = min(EXPLORATION_POSITION, len(row))
    row = row[: n - 1] if len(row) >= n else row
    return row[:pos] + [ex] + row[pos:]


# ── core: recommend one slot ────────────────────────────────────────────────────
def recommend(ctx: Ctx, slot: str, n: int = ROW_SIZE, ta: str | None = None, context_item: str | None = None,
              exclude: set[str] | None = None, log: bool = True) -> dict:
    t0 = time.perf_counter()
    c0 = time.thread_time()
    exclude = exclude or set()
    fallback = None
    if switches.engine_down:
        fallback = "engine_down"
    elif switches.paused:
        fallback = "paused"

    if fallback:
        rows = editor_curated(ctx, slot, n, ta, exclude)
        model_version = "editor-curated"
    else:
        rows = _rank(ctx, slot, n, ta, context_item, exclude)
        model_version = ranker.version
        # Budget on the time this request actually spent ranking. Wall-clock time also counts waiting
        # for other requests (event writes, cluster updates) under the GIL, which made the guard fire
        # on a 5 ms ranking and swap a personalised list for the editors' one (QA D-01).
        if (time.thread_time() - c0) * 1000 > LATENCY_BUDGET_MS:
            fallback = "latency_budget"
            rows = editor_curated(ctx, slot, n, ta, exclude)
            model_version = "editor-curated"

    rank_ms = round((time.perf_counter() - t0) * 1000, 2)
    req_id = str(uuid.uuid4())
    ts = now_utc().isoformat()
    tracking = bool(ctx.hcp.get("tracking_consent"))
    out_items, imp_rows = [], []
    for rank, s in enumerate(rows):
        it = store.items[s.item_id]
        reason_text = render(s.reason_template, s.reason_params, ctx.lang, store)
        signals = {"components": s.components, "alpha": round(ctx.alpha, 3), "landing_ta": ctx.ta_order[0],
                   "cluster_id": ctx.cluster_id, "fallback": fallback, "rank_ms": rank_ms}
        out_items.append({
            "item_id": s.item_id, "score": s.score, "level": s.level,
            "reason": {"template": s.reason_template, "params": s.reason_params, "text": reason_text},
            "signals": s.components, "model_version": model_version, "experiment_variant": None,
            "item": card(it, ctx.lang, ctx),
        })
        imp_rows.append({
            "impression_id": str(uuid.uuid4()), "request_id": req_id, "hcp_id": ctx.hcp["hcp_id"],
            "session_id": ctx.session_id, "item_id": s.item_id, "slot": slot, "rank": rank, "score": s.score,
            "level": s.level, "reason_template": s.reason_template, "reason_params": s.reason_params,
            "signals": signals, "model_version": model_version, "experiment_id": EXPERIMENT_ID,
            "experiment_variant": None, "ts": ts, "demo_run": switches.demo_run,
        })
    # step 8 — log every impression (full record for regulatory inspection, §7 rule 10).
    # Anonymous visitors: logged under a session pseudonym only, no profile.
    if log and imp_rows:
        sink.write_impressions(imp_rows)
        for r in imp_rows:
            store.imp_count[r["item_id"]] += 1

    resp = {
        "request_id": req_id, "slot": slot, "hcp_id": ctx.hcp["hcp_id"], "model_version": model_version,
        "experiment_variant": None, "fallback": fallback, "rank_ms": rank_ms, "items": out_items,
        "eligible_count": len(ctx.eligible), "removed_count": len(ctx.removed), "tracking": tracking,
    }
    return resp


def _rank(ctx: Ctx, slot: str, n: int, ta: str | None, context_item: str | None, exclude: set[str]) -> list[Scored]:
    pool = [i for i in ctx.eligible if i["item_id"] not in exclude]
    st = ctx.profile["items"]

    if slot == "continue_watching":
        rows = [(iid, s) for iid, s in st.items() if s.get("type") == "video" and 5 <= s.get("progress", 0) < 100
                and not s.get("completed") and not s.get("dismissed") and any(i["item_id"] == iid for i in pool)]
        rows.sort(key=lambda r: r[1].get("last") or "", reverse=True)
        return [Scored(item_id=iid, score=s["progress"] / 100, components={}, level="L2",
                       reason_template="continue_watching", reason_params={"pct": s["progress"]}) for iid, s in rows[:n]]

    if slot == "start_here":  # editor picks for the landing TA + country, then same-specialty popular
        land = ta or ctx.ta_order[0]
        in_ta = [i for i in pool if i["therapy_area"] == land]
        picks = sorted([i for i in in_ta if i.get("editor_pick")], key=lambda i: i["editor_pick"])
        out = [Scored(item_id=i["item_id"], score=round(1 - 0.1 * i["editor_pick"], 3), components={"editor": 1.0},
                      level="editor", reason_template="start_here", reason_params={"ta": land}) for i in picks]
        rest = sorted((i for i in in_ta if not i.get("editor_pick")),
                      key=lambda i: (-ctx.specialty_pop.get(i["item_id"], 0.0), i["item_id"]))
        top_pop = max((ctx.specialty_pop.get(i["item_id"], 0.0) for i in rest), default=0.0) or 1.0
        for i in rest:
            if len(out) >= n:
                break
            out.append(Scored(item_id=i["item_id"], score=round(0.6 * ctx.specialty_pop.get(i["item_id"], 0.0) / top_pop, 3),
                              components={"specialty_pop": 1.0}, level="L1",
                              reason_template="specialty_popular" if ctx.specialty else "popular_market",
                              reason_params={"specialty": ctx.specialty, "country": ctx.country} if ctx.specialty
                              else {"country": ctx.country}))
        return _drop_done(ctx, out)[:n]

    if slot == "peers":  # L3: what the cluster engages with (distinctively) that this HCP hasn't seen
        if ctx.cluster_id is None:
            return []
        unseen = [i for i in pool if not st.get(i["item_id"], {}).get("opened")]
        c_tot = sum(ctx.peer_pop.values()) or 1.0
        g_tot = sum(store.pop_global.values()) or 1.0
        raw = {}
        for i in unseen:
            c = ctx.peer_pop.get(i["item_id"], 0.0)
            if c <= 0:
                continue
            lift = (c / c_tot) / max(store.pop_global.get(i["item_id"], 0.0) / g_tot, 1e-9)
            if lift < PEER_MIN_LIFT:
                continue  # not distinctive to this cluster — it's just popular with everyone
            raw[i["item_id"]] = (c / c_tot) * np.log1p(lift)  # popular in the cluster AND distinctive to it
        top = max(raw.values(), default=0.0) or 1.0
        scored = sorted(raw.items(), key=lambda x: (-x[1], x[0]))
        # "Popular with peers" must be true: drop weak signals, and hide a row too thin to mean anything (QA D-22)
        rows = [Scored(item_id=iid, score=round(v / top, 4), components={"peer_pop": round(v / top, 4)}, level="L3",
                       reason_template="peers", reason_params={"cluster_id": ctx.cluster_id})
                for iid, v in scored if v / top >= PEER_MIN_SCORE]
        row = _diversify(_drop_done(ctx, rows), n)
        return row if len(row) >= PEER_MIN_ROW else []

    if slot == "ta_page" and ta:
        pool = [i for i in pool if i["therapy_area"] == ta]

    scored = ranker.score(ctx, pool, slot)                          # step 2
    scored = _drop_done(ctx, scored)                                 # step 3

    if slot == "next" and context_item:  # end of article / video: similar and next-step items
        # Same therapy area first, by similarity to the item just finished; other areas only fill the gap.
        # Affinity alone must never fill "Up next" with another area (QA D-06).
        ctx_ta = store.items[context_item]["therapy_area"]
        base = {s.item_id: s for s in scored if s.item_id != context_item}
        mx = max((s.score for s in base.values()), default=0) or 1
        rel = []
        for iid, s in base.items():
            sim = store.similarity(context_item, iid)
            same = store.items[iid]["therapy_area"] == ctx_ta
            sc = 0.7 * sim + 0.3 * (s.score / mx) + (1.0 if same else 0.0)
            if same and sim >= RELATED_MIN_COSINE:  # genuinely similar: say so
                rel.append(Scored(item_id=iid, score=round(sc, 5), components={**s.components, "related": round(0.7 * sim, 5)},
                                  level="L2", reason_template="related", reason_params={"item_id": context_item}))
            elif same:
                rel.append(Scored(item_id=iid, score=round(sc, 5), components=s.components, level=s.level,
                                  reason_template="more_in_ta", reason_params={"ta": ctx_ta}))
            else:  # otherwise keep the ranker's own reason
                rel.append(Scored(item_id=iid, score=round(sc, 5), components=s.components, level=s.level,
                                  reason_template=s.reason_template, reason_params=s.reason_params))
        rel.sort(key=lambda s: (-s.score, s.item_id))
        return _diversify(rel, n)

    scored = _apply_pins(ctx, scored, slot, ta)                      # step 4
    row = _diversify(scored, n, MAX_PER_TA_IN_ROW if slot == "home_recommended" else None)  # step 5
    row = _explore(ctx, row, pool, slot, n)                          # step 6
    return row[:n]


def editor_curated(ctx: Ctx, slot: str, n: int, ta: str | None, exclude: set[str]) -> list[Scored]:
    """The fallback list: editor picks for the HCP's current landing TA, then newest. No ranking model;
    it still respects the landing TA and skips what the HCP has finished or dismissed (QA D-09)."""
    land = ta or ctx.ta_order[0]
    order = [land] + [t for t in store.ta_ids if t != land]
    st = ctx.profile["items"]
    pool = [i for i in ctx.eligible if i["item_id"] not in exclude and (slot != "ta_page" or i["therapy_area"] == land)
            and not st.get(i["item_id"], {}).get("completed") and not st.get(i["item_id"], {}).get("dismissed")]
    if slot == "continue_watching":
        return []
    pool.sort(key=lambda i: (order.index(i["therapy_area"]), 0 if i.get("editor_pick") else 1,
                             i.get("editor_pick") or 9, -int(i["published_date"].replace("-", ""))))
    return [Scored(item_id=i["item_id"], score=0.0, components={}, level="editor",
                   reason_template="editor_pick" if i.get("editor_pick") else "editors_selection") for i in pool[:n]]


# ── item cards (language-resolved) ──────────────────────────────────────────────
def card(it: dict, lang: str, ctx: Ctx | None = None) -> dict:
    st = (ctx.profile["items"].get(it["item_id"], {}) if ctx else {}) or {}
    return {
        "item_id": it["item_id"], "type": it["type"], "title": it["title"][lang], "summary": it["summary"][lang],
        "therapy_area": it["therapy_area"], "topic": it["topics"][0], "promotional": it["promotional"],
        "gated": it["gated"], "duration_seconds": it.get("duration_seconds"), "word_count": it.get("word_count"),
        "published_date": it["published_date"], "media": it.get("media"), "approval_code": it["approval_code"],
        "progress": st.get("progress", 0), "completed": bool(st.get("completed")),
    }


# ── home page composition ───────────────────────────────────────────────────────
def home(ctx: Ctx, log: bool = True) -> dict:
    taken: set[str] = set()
    rows = []

    def add(slot, **kw):
        r = recommend(ctx, slot, exclude=set(taken), log=log, **kw)
        taken.update(i["item_id"] for i in r["items"])
        if r["items"]:
            rows.append(r)

    fallback = switches.engine_down or switches.paused
    if ctx.hcp.get("tracking_consent") and not fallback:
        add("continue_watching")
    # Claim order decides which row gets an item; render order is fixed below. Editor picks stay in "Start here".
    # Once the HCP has personal signal, "Recommended for you" claims first so it carries the closest content
    # matches ("Because you read ..."); before that, peers claims its distinctive items first.
    land = ctx.ta_order[0]
    picks = {i["item_id"] for i in ctx.eligible if i["therapy_area"] == land and i.get("editor_pick")}

    def claim(slot, **kw):
        r = recommend(ctx, slot, exclude=taken | picks, log=log, **kw)
        taken.update(i["item_id"] for i in r["items"])
        if r["items"]:
            rows.append(r)

    with_peers = ctx.cluster_id is not None and not fallback
    if ctx.alpha > 0 and not fallback:
        claim("home_recommended", n=HOME_RECOMMENDED_SIZE)
        if with_peers:
            claim("peers")
    else:
        if with_peers:
            claim("peers")
    if ctx.alpha < 1.0 or fallback:
        add("start_here")
    if not any(r["slot"] == "home_recommended" for r in rows):
        add("home_recommended", n=HOME_RECOMMENDED_SIZE)
    order = {"continue_watching": 0, "start_here": 1, "home_recommended": 2, "peers": 3}
    rows.sort(key=lambda r: order.get(r["slot"], 9))
    return {"rows": rows, "therapy_areas": ta_list(ctx), "alpha": ctx.alpha, "landing_ta": ctx.ta_order[0],
            "cluster": cluster_brief(ctx.cluster_id, ctx.cluster_source, ctx.lang)}


def ta_list(ctx: Ctx) -> list[dict]:
    """Level 1 output: all five TAs in order, landing TA first (separate endpoint per §9)."""
    s = ctx.ta_affinity
    total = sum(max(v, 0) for v in s.values()) or 1
    out = []
    for i, t in enumerate(ctx.ta_order):
        ta = store.ta(t)
        out.append({"ta": t, "rank": i, "name": ta[ctx.lang], "score": round(s.get(t, 0.0), 2),
                    "share": round(max(s.get(t, 0.0), 0) / total, 3), "landing": i == 0, "color": ta["color"],
                    "placeholder": ta["placeholder"],
                    "eligible_items": sum(1 for it in ctx.eligible if it["therapy_area"] == t)})
    return out


def cluster_brief(cid: int | None, source: str | None, lang: str) -> dict | None:
    if cid is None or cid not in store.clusters:
        return None
    c = store.clusters[cid]
    return {"cluster_id": cid, "label": c["label_ar"] if lang == "ar" else c["label_en"], "label_en": c["label_en"],
            "label_ar": c["label_ar"], "size": c["size"], "source": source}


# ── event ingestion ─────────────────────────────────────────────────────────────
VALID_EVENTS = {"item_open", "article_scroll", "article_read", "time_spent", "video_start", "video_progress",
                "search", "save", "dismiss", "page_view"}


def ingest(e: dict) -> dict:
    """Capture → profile update → live cluster → CRM, all in this request (well inside 2 s / 5 s)."""
    t0 = time.perf_counter()
    hcp = get_hcp(e["hcp_id"])
    if hcp is None:
        return {"stored": False, "reason": "unknown_hcp"}
    if not hcp["tracking_consent"]:
        return {"stored": False, "reason": "no_tracking_consent"}  # no behaviour stored without consent
    if e["event_type"] not in VALID_EVENTS:
        return {"stored": False, "reason": "unknown_event_type"}
    it = store.items.get(e.get("item_id")) if e.get("item_id") else None
    if e.get("item_id") and (it is None or check(it, Viewer(viewer_state(hcp), hcp["country"]), store.rule_ctx())):
        return {"stored": False, "reason": "item_not_eligible"}
    # server receive time is authoritative (client clocks are not trusted)
    e = {**e, "event_id": e.get("event_id") or str(uuid.uuid4()), "ts": now_utc().isoformat(),
         "country": hcp["country"], "demo_run": switches.demo_run}
    sink.write(e)

    before = {}

    def apply(p: dict) -> dict:
        before["land"] = p["landing_ta"]
        return P.apply_event(p, e, it["therapy_area"] if it else None, it["type"] if it else None)

    # atomic per HCP: concurrent events never overwrite each other
    p = profiles.update(hcp["hcp_id"], P.new_profile(store.specialty_ta(hcp["specialty"]), store.ta_ids), apply)
    before_land = before["land"]

    cluster_change = None
    if p["actions"] >= CLUSTER_ASSIGN_ACTIONS and (not hcp["synthetic"]):
        cluster_change = assign_live_cluster(hcp)

    if it and e["event_type"] in ("item_open", "article_read", "video_progress", "dismiss", "save"):
        crm.enqueue(hcp["hcp_id"], "engagement", {
            "oce_account": None, "hcp_id": hcp["hcp_id"], "item_id": it["item_id"], "item_title": it["title"]["en"],
            "type": it["type"], "event_type": e["event_type"], "value": e.get("value"),
            "therapy_area": it["therapy_area"], "timestamp": e["ts"]}, demo_run=switches.demo_run)
    if p["landing_ta"] != before_land or cluster_change:
        push_profile_to_crm(hcp, p)
    return {"stored": True, "event_id": e["event_id"], "capture_ms": round((time.perf_counter() - t0) * 1000, 1),
            "landing_ta": p["landing_ta"], "switched": p["landing_ta"] != before_land, "actions": p["actions"],
            "cluster_change": cluster_change}


def push_profile_to_crm(hcp: dict, p: dict) -> None:
    cid, src = effective_cluster(get_hcp(hcp["hcp_id"]))
    c = store.clusters.get(cid) if cid is not None else None
    crm.enqueue(hcp["hcp_id"], "profile", {
        "hcp_id": hcp["hcp_id"], "landing_ta": p["landing_ta"],
        "ta_affinity": {k: round(v, 2) for k, v in P.ta_scores(p).items()},
        "cluster_label": c["label_en"] if c else None, "cluster_source": src}, demo_run=switches.demo_run)


def push_recs_to_crm(ctx: Ctx, resp: dict) -> bool:
    """Top recommendations go to the CRM when they change (daily + on major change)."""
    if not ctx.hcp.get("crm_consent"):
        return False
    items = [i for i in resp["items"] if i["level"] != "exploration"][:5]  # reps get the ranked list, not probes
    top = [i["item_id"] for i in items]
    last = last_crm_recs(ctx.hcp["hcp_id"])
    if last and [i["item_id"] for i in last["items"]] == top:
        if last.get("content_version") != switches.content_version:  # same list, now confirmed for this version
            with db() as c:
                c.run("UPDATE crm_outbox SET payload = jsonb_set(payload, '{content_version}', to_jsonb(CAST(:v AS int))) "
                      "WHERE id = :i", v=switches.content_version, i=last["_id"])
        return False
    crm.enqueue(ctx.hcp["hcp_id"], "recommendations", {
        "hcp_id": ctx.hcp["hcp_id"], "model_version": resp["model_version"], "request_id": resp["request_id"],
        "content_version": switches.content_version,
        "items": [{"item_id": i["item_id"], "title": store.items[i["item_id"]]["title"]["en"], "score": i["score"],
                   "level": i["level"], "reason": render(i["reason"]["template"], i["reason"]["params"], "en", store)}
                  for i in items]}, demo_run=switches.demo_run)
    return True


def last_crm_recs(hcp_id: str) -> dict | None:
    """The newest recommendations message for this HCP (queued or delivered), with its outbox id."""
    with db() as c:
        r = c.one("SELECT id, payload FROM crm_outbox WHERE hcp_id = :h AND kind = 'recommendations' "
                  "ORDER BY id DESC LIMIT 1", h=hcp_id)
    return {**r["payload"], "_id": r["id"]} if r else None


def refresh_crm_for(hcp: dict) -> bool:
    """Content or overrides changed since this HCP's CRM list was computed: recompute it and send it if it
    differs (§4/§10: expiry, withdrawal and overrides reach the CRM whether or not the HCP visits).

    Runs on demand, so no background process is needed: the rep view calls it before reading, and a scheduler
    can call POST /api/v1/admin/crm/refresh in production. No impression is logged (no page was shown)."""
    ctx = build_ctx(hcp)
    rec = next((r for r in home(ctx, log=False)["rows"] if r["slot"] == "home_recommended"), None)
    return bool(rec and not rec["fallback"] and push_recs_to_crm(ctx, rec))


def refresh_crm_recommendations() -> int:
    """Refresh every CRM list computed before the current content version."""
    with db() as c:
        rows = c.all("SELECT DISTINCT ON (o.hcp_id) o.hcp_id, o.payload->>'content_version' v FROM crm_outbox o "
                     "JOIN hcps h USING (hcp_id) WHERE o.kind = 'recommendations' AND h.crm_consent "
                     "ORDER BY o.hcp_id, o.id DESC")
    stale = [r["hcp_id"] for r in rows if r["v"] is None or int(r["v"]) != switches.content_version]
    return sum(refresh_crm_for(h) for h in (get_hcp(i) for i in stale) if h)


# ── live cluster assignment ─────────────────────────────────────────────────────
def live_behaviour_vector(hcp_id: str) -> np.ndarray | None:
    with db() as c:
        rows = c.all("SELECT hcp_id, item_id, event_type, value, session_id, ts FROM events WHERE hcp_id = :h", h=hcp_id)
    if not rows:
        return None
    now = now_utc()
    evs = [{**r, "t": (now - r["ts"]).total_seconds()} for r in rows]
    X, _ = behaviour_matrix([hcp_id], evs, store.items, store.cfg)
    return X[0]


def assign_live_cluster(hcp: dict) -> dict | None:
    """After 5 actions the live HCP moves from the provisional cluster to the nearest real one."""
    x = live_behaviour_vector(hcp["hcp_id"])
    if x is None or not store.clusters:
        return None
    best, bd = None, 1e9
    for cid, c in store.clusters.items():
        cen = np.array(c["centroid"] if isinstance(c["centroid"], list) else [], dtype=float)
        if cen.size != x.size:
            continue
        d = float(np.linalg.norm(cen - x))
        if d < bd:
            best, bd = cid, d
    if best is None:
        return None
    # map position: mean of the 7 nearest sample HCPs in behaviour space
    mx = my = None
    if store.behaviour_X is not None:
        dist = np.linalg.norm(store.behaviour_X - x, axis=1)
        nn = np.argsort(dist)[:7]
        mx, my = (float(v) for v in store.behaviour_xy[nn].mean(0))
    prev = hcp.get("cluster_id"), hcp.get("cluster_source")
    with db() as c:
        c.run("UPDATE hcps SET cluster_id = :c, cluster_source = 'assigned', map_x = :x, map_y = :y WHERE hcp_id = :h",
              c=best, x=mx, y=my, h=hcp["hcp_id"])
    if prev != (best, "assigned"):
        return {"from": prev[0], "from_source": prev[1], "to": best, "distance": round(bd, 3)}
    return None


def provisional_position(cid: int | None) -> tuple[float | None, float | None]:
    if cid is None or store.behaviour_xy is None:
        return None, None
    m = store.behaviour_labels == cid
    if not m.any():
        return None, None
    x, y = store.behaviour_xy[m].mean(0)
    return float(x), float(y)


def last_rankings(hcp_id: str) -> dict:
    """The newest ranking per slot for this HCP, rebuilt from the impression log (not process memory, so it is
    the same on every instance and survives restarts)."""
    with db() as c:
        heads = c.all("SELECT DISTINCT ON (slot) slot, request_id, ts FROM (SELECT slot, request_id, ts FROM impressions "
                      "WHERE hcp_id = :h ORDER BY ts DESC LIMIT 200) r ORDER BY slot, ts DESC", h=hcp_id)
        ids = [str(x["request_id"]) for x in heads]
        rows = c.all("SELECT request_id, item_id, score, level, reason_template, reason_params, signals, model_version "
                     "FROM impressions WHERE hcp_id = :h AND request_id = ANY(CAST(:ids AS uuid[])) ORDER BY rank",
                     h=hcp_id, ids=ids) if ids else []
    by_req: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_req[str(r["request_id"])].append(r)
    out = {}
    for hd in heads:
        rs = [r for r in by_req.get(str(hd["request_id"]), []) if r["item_id"] in store.items]
        if not rs:
            continue
        sig = rs[0]["signals"] or {}
        out[hd["slot"]] = {
            "request_id": str(hd["request_id"]), "slot": hd["slot"], "ts": hd["ts"].isoformat(),
            "rank_ms": sig.get("rank_ms") or 0.0, "fallback": sig.get("fallback"), "model_version": rs[0]["model_version"],
            "alpha": sig.get("alpha") or 0.0,
            "items": [{"item_id": r["item_id"], "title": store.items[r["item_id"]]["title"], "score": r["score"],
                       "level": r["level"], "components": (r["signals"] or {}).get("components") or {},
                       "reason": render(r["reason_template"], r["reason_params"] or {}, "en", store)} for r in rs],
        }
    return out


# ── engine lens ─────────────────────────────────────────────────────────────────
def lens(hcp_id: str, lang: str = "en") -> dict | None:
    hcp = get_hcp(hcp_id)
    if hcp is None:
        return None
    ctx = build_ctx(hcp, lang)
    p = ctx.profile
    with db() as c:
        evs = c.all("SELECT event_id, item_id, event_type, value, ts FROM events WHERE hcp_id = :h "
                    "ORDER BY ts DESC LIMIT 14", h=hcp_id)
        crm_counts = c.one("SELECT count(*) FILTER (WHERE status='delivered') delivered, "
                           "count(*) FILTER (WHERE status='queued') queued FROM crm_outbox WHERE hcp_id = :h", h=hcp_id)
    for e in evs:
        e["ts"] = e["ts"].isoformat()
        e["title"] = store.items[e["item_id"]]["title"][lang] if e.get("item_id") in store.items else None
    return {
        "hcp": {k: hcp[k] for k in ("hcp_id", "specialty", "country", "language", "verified", "tracking_consent",
                                    "crm_consent", "synthetic")},
        "alpha": ctx.alpha, "actions": p["actions"],
        "landing_ta": p["landing_ta"], "prior_ta": p["prior_ta"],
        "ta": ta_list(ctx), "switch_gap": P.switch_threshold(p), "switches": p["switches"][-5:],
        "cluster": cluster_brief(ctx.cluster_id, ctx.cluster_source, lang),
        "cluster_assign_at": CLUSTER_ASSIGN_ACTIONS,
        "events": evs,
        "last": last_rankings(hcp_id),
        "component_labels": COMPONENT_LABEL,
        "eligible": len(ctx.eligible), "removed": ctx.removed,
        "switches_state": {"engine_down": switches.engine_down, "paused": switches.paused},
        "crm": crm_counts,
        "model_version": MODEL_VERSION,
    }
