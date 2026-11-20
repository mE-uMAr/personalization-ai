"""FastAPI modular monolith — one process, each module can become its own service later.

    /api/v1/...   versioned REST/JSON (requirements §9)
    /media/...    self-hosted videos, captions, posters
"""
from __future__ import annotations

import threading
import time
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app import analytics, demo, oce
from app import engine as E
from app.config import (CRM_SYNC_SECONDS, MODEL_VERSION, ROOT, TA_SWITCH_MARGIN, SPECIALTY_BONUS, POINTS,
                        COLD_WEIGHTS, PERSONAL_WEIGHTS, COLD_START_ACTIONS)
from app.contracts import EventIn, Lang, OverrideIn, RecommendationRequest, RegisterIn, SwitchIn
from app.db import db
from app.reasons import COMPONENT_LABEL
from app.rules import RULE_TEXT, Viewer, check
from app.store import store

_stop = threading.Event()


def _crm_worker():
    """Batched delivery to the CRM (demo: every few seconds; production: 15-minute batches).

    Serverless hosts may freeze this thread between requests, so the rep view also delivers on read."""
    while not _stop.wait(CRM_SYNC_SECONDS):
        try:
            E.crm.deliver_batch()
        except Exception:  # noqa: BLE001 — keep the worker alive; failures stay queued
            pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.load()
    E.switches.load()
    t = threading.Thread(target=_crm_worker, daemon=True)
    t.start()
    yield
    _stop.set()


def _sync_state():
    """Every API request sees switches and content no older than a couple of seconds, whichever instance
    made the change (instances share nothing but the database)."""
    E.switches.sync()


app = FastAPI(title="HCP Personalization Engine — demo", version="1.0.0", lifespan=lifespan,
              dependencies=[Depends(_sync_state)])
app.add_middleware(GZipMiddleware, minimum_size=800)
# No CORS: the site and API are served from one origin (the Vite proxy locally; a reverse proxy in production).
# Videos, captions and posters are static files: the web app serves them (web/public/media). Mounted here
# only when a local copy exists, for running the API on its own.
_media = ROOT.parent / "web" / "public" / "media"
if _media.is_dir():
    app.mount("/media", StaticFiles(directory=_media), name="media")


def _hcp_or_404(hcp_id: str) -> dict:
    h = E.get_hcp(hcp_id)
    if h is None:
        raise HTTPException(404, "unknown HCP")
    return h


def _ctx(hcp_id: str | None, lang: str | None, session_id: str | None, country: str | None = None):
    hcp = _hcp_or_404(hcp_id) if hcp_id else None
    return E.build_ctx(hcp, lang, session_id, country)


# ── platform ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/health")
def health():
    t = time.perf_counter()
    with db() as c:
        c.scalar("SELECT 1")
    return {"ok": True, "db_ms": round((time.perf_counter() - t) * 1000, 2), "model_version": MODEL_VERSION,
            "items": len(store.items), "clusters": len(store.clusters)}


@app.get("/api/v1/config")
def config():
    with db() as c:
        meta = c.scalar("SELECT value FROM settings WHERE key = 'seed_meta'") or {}
    return {
        "therapy_areas": store.cfg["therapy_areas"], "specialties": store.cfg["specialties"],
        "countries": store.cfg["countries"], "topics": store.cfg["topics"], "country_rules": store.cfg["country_rules"],
        "model_version": MODEL_VERSION, "embedding": store.embed_meta.get("model"),
        "embedding_dim": store.embed_meta.get("dim"), "clustering": meta.get("clustering"),
        "engine": {"specialty_bonus": SPECIALTY_BONUS, "switch_margin": TA_SWITCH_MARGIN, "points": POINTS,
                   "cold_weights": COLD_WEIGHTS, "personal_weights": PERSONAL_WEIGHTS,
                   "cold_start_actions": COLD_START_ACTIONS},
        "component_labels": COMPONENT_LABEL, "rule_text": RULE_TEXT,
        "switches": {"engine_down": E.switches.engine_down, "paused": E.switches.paused, "demo_run": E.switches.demo_run},
    }


# ── HCPs ──────────────────────────────────────────────────────────────────────
@app.post("/api/v1/hcps", status_code=201)
def register(body: RegisterIn):
    try:
        return demo.register(body)
    except demo.AccountExists as e:
        raise HTTPException(409, {"code": "account_exists", "hcp_id": e.hcp_id, "name": e.name}) from e
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@app.get("/api/v1/hcps/{hcp_id}")
def get_hcp(hcp_id: str):
    h = _hcp_or_404(hcp_id)
    with db() as c:
        ident = c.one("SELECT full_name FROM identities WHERE hcp_id = :h", h=hcp_id)
    out = {k: h[k] for k in ("hcp_id", "specialty", "profession", "country", "language", "verified",
                             "tracking_consent", "crm_consent", "synthetic")}
    out["name"] = ident["full_name"] if ident else None
    out["state"] = E.viewer_state(h)
    return out


@app.get("/api/v1/hcps/{hcp_id}/therapy-areas")
def therapy_areas(hcp_id: str, lang: Lang = "en"):
    """Level 1: the five TAs in order, landing TA first (separate endpoint per §9)."""
    ctx = _ctx(hcp_id, lang, None)
    return {"hcp_id": hcp_id, "therapy_areas": E.ta_list(ctx), "model_version": MODEL_VERSION}


# ── recommendations ───────────────────────────────────────────────────────────
@app.post("/api/v1/recommendations")
def recommendations(req: RecommendationRequest):
    ctx = _ctx(req.hcp_id, req.language, req.session_id, req.country)
    return E.recommend(ctx, req.slot, n=req.n, ta=req.therapy_area, context_item=req.current_item_id)


@app.get("/api/v1/home")
def home(hcp_id: str | None = None, lang: Lang = "en", session_id: str | None = None, country: str | None = None):
    ctx = _ctx(hcp_id, lang, session_id, country)
    out = E.home(ctx)
    rec = next((r for r in out["rows"] if r["slot"] == "home_recommended"), None)
    if rec and hcp_id and not rec["fallback"]:
        E.push_recs_to_crm(ctx, rec)
    return out


@app.get("/api/v1/ta/{ta}")
def ta_page(ta: str, hcp_id: str | None = None, lang: Lang = "en", session_id: str | None = None,
            country: str | None = None):
    if ta not in store.ta_ids:
        raise HTTPException(404, "unknown therapy area")
    ctx = _ctx(hcp_id, lang, session_id, country)
    ranked = E.recommend(ctx, "ta_page", n=6, ta=ta)
    browse = sorted((i for i in ctx.eligible if i["therapy_area"] == ta), key=lambda i: i["published_date"], reverse=True)
    return {"ta": {**store.ta(ta), "name": store.ta(ta)[ctx.lang]}, "ranked": ranked,
            "browse": [E.card(i, ctx.lang, ctx) for i in browse], "therapy_areas": E.ta_list(ctx)}


@app.get("/api/v1/items/{item_id}")
def item(item_id: str, hcp_id: str | None = None, lang: Lang = "en", session_id: str | None = None,
         country: str | None = None):
    it = store.items.get(item_id)
    if it is None:
        raise HTTPException(404, "unknown item")
    ctx = _ctx(hcp_id, lang, session_id, country)
    rule = check(it, ctx.viewer, store.rule_ctx())
    if rule:  # the filter applies to direct access too, not only to lists
        raise HTTPException(403, {"rule": rule, "text": RULE_TEXT[rule]})
    nxt = E.recommend(ctx, "next", n=4, context_item=item_id)
    full = {**E.card(it, ctx.lang, ctx), "body": (it.get("body") or {}).get(ctx.lang),
            "transcript": (it.get("transcript") or {}).get(ctx.lang), "topics": it["topics"],
            "approval_date": it["approval_date"], "expiry_date": it["expiry_date"],
            "allowed_countries": it["allowed_countries"]}
    if it["type"] == "video":
        v = it["media"]["versions"][ctx.lang]
        full["video"] = {**v, "poster": it["media"]["poster"], "language": ctx.lang,
                         "captions_alt": it["media"]["versions"]["ar" if ctx.lang == "en" else "en"]["captions"],
                         "source": it["media"]["source"], "pipeline": it["media"]["pipeline"]}
    return {"item": full, "next": nxt}


@app.post("/api/v1/events", status_code=202)
def events(e: EventIn):
    data = e.model_dump()
    data["ts"] = data.pop("timestamp")
    if data["value"] is not None:
        v = data["value"]
        data["value"] = str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)
    return E.ingest(data)


# ── engine console ─────────────────────────────────────────────────────────────
@app.get("/api/v1/lens/{hcp_id}")
def lens(hcp_id: str, lang: Lang = "en"):
    out = E.lens(hcp_id, lang)
    if out is None:
        raise HTTPException(404, "unknown HCP")
    return out


@app.get("/api/v1/analytics")
def analytics_overview():
    return analytics.overview()


@app.get("/api/v1/ab/example")
def ab():
    return analytics.ab_example()


@app.get("/api/v1/clusters")
def clusters(lang: Lang = "en"):
    with db() as c:
        pts = c.all("SELECT hcp_id, cluster_id, cluster_source, map_x x, map_y y, synthetic, demo_run IS NOT NULL live, "
                    "persona, specialty, country FROM hcps WHERE map_x IS NOT NULL")
        meta = c.scalar("SELECT value FROM settings WHERE key = 'seed_meta'") or {}
        names = {r["hcp_id"]: r["full_name"] for r in c.all(
            "SELECT h.hcp_id, i.full_name FROM hcps h JOIN identities i USING (hcp_id) "
            "WHERE h.demo_run IS NOT NULL OR h.persona LIKE 'prepared:%'")}
    out = []
    for cid, cl in sorted(store.clusters.items()):
        d = cl["defining"]
        out.append({
            "cluster_id": cid, "label": cl["label_ar"] if lang == "ar" else cl["label_en"],
            "label_en": cl["label_en"], "label_ar": cl["label_ar"], "size": cl["size"],
            "behaviours": [b[lang] for b in d["behaviours"]], "specialties": d["specialties"], "countries": d["countries"],
            "format": d["format"], "x": cl["x"], "y": cl["y"],
            "top_tas": [{**t, "name": store.ta(t["ta"])[lang], "color": store.ta(t["ta"])["color"]} for t in cl["top_tas"]],
            "top_items": [{"item_id": t["item_id"], "title": store.items[t["item_id"]]["title"][lang],
                           "type": store.items[t["item_id"]]["type"], "score": t["score"]} for t in cl["top_items"][:5]
                          if t["item_id"] in store.items],
        })
    total = len([p for p in pts if p["synthetic"]])
    return {
        "clusters": out,
        "points": [{**p, "name": names.get(p["hcp_id"])} for p in pts],
        "stats": {"hcps": total, "noise": sum(1 for p in pts if p["synthetic"] and p["cluster_id"] == -1),
                  "min_cluster_size": 20, "implementation": meta.get("clustering"),
                  "features": ["TA mix", "topic mix", "format preference", "engagement depth", "recency", "visit cadence"]},
    }


@app.get("/api/v1/oce/accounts")
def oce_accounts(q: str | None = None, lang: Lang = "en"):
    E.crm.deliver_batch()  # deliver what is due before reading (no reliance on a background thread)
    return {"accounts": oce.accounts(q, lang=lang), "adapter": E.crm.name, "sync_seconds": CRM_SYNC_SECONDS}


@app.get("/api/v1/oce/accounts/{hcp_id}")
def oce_account(hcp_id: str, lang: Lang = "en"):
    h = E.get_hcp(hcp_id)
    if h is not None and h["crm_consent"]:
        last = E.last_crm_recs(hcp_id)
        if last is not None and last.get("content_version") != E.switches.content_version:
            E.refresh_crm_for(h)  # content or overrides changed since this list was sent
    E.crm.deliver_batch()
    a = oce.account(hcp_id, lang)
    if a is None:
        raise HTTPException(404, "Not shared with the CRM (no CRM-sharing consent) or unknown account")
    return a


# ── admin: content & rules, inspector ─────────────────────────────────────────
@app.get("/api/v1/admin/content")
def admin_content(country: str = "SA", state: str = Query("verified", pattern="^(anonymous|registered|verified)$"),
                  lang: Lang = "en"):
    v = Viewer(state, country)
    ctx = store.rule_ctx()
    rows = []
    for iid in store.order:
        it = store.items[iid]
        rule = check(it, v, ctx)
        rows.append({"item_id": iid, "title": it["title"][lang], "type": it["type"], "therapy_area": it["therapy_area"],
                     "topic": it["topics"][0], "status": it["status"], "promotional": it["promotional"],
                     "gated": it["gated"], "allowed_countries": it["allowed_countries"], "expiry_date": it["expiry_date"],
                     "approval_code": it["approval_code"], "eligible": rule is None, "rule": rule,
                     "rule_text": RULE_TEXT.get(rule) if rule else None, "impressions": store.imp_count.get(iid, 0),
                     "pipeline": (it.get("media") or {}).get("pipeline")})
    return {"viewer": {"country": country, "state": state}, "items": rows,
            "overrides": [dict(r) for r in store.pins] + [{"action": "block", "country": c, "item_id": i} for c, i in store.blocks],
            "eligible": sum(1 for r in rows if r["eligible"]), "country_rules": store.cfg["country_rules"]}


@app.post("/api/v1/admin/items/{item_id}/expire")
def expire_now(item_id: str):
    """Expiry takes effect on the very next request — no list caches to purge (target: within 15 min)."""
    if item_id not in store.items:
        raise HTTPException(404)
    with db() as c:
        c.run("UPDATE items SET expiry_date = CAST(:d AS date), updated_at = now() WHERE item_id = :i",
              d=date.today().isoformat(), i=item_id)
    store.reload_items()
    E.switches.content_changed()  # other instances reload; CRM lists computed before this are refreshed (QA D-03)
    return {"item_id": item_id, "expiry_date": date.today().isoformat(), "effective": "next request"}


@app.post("/api/v1/admin/items/{item_id}/restore")
def restore(item_id: str):
    from app.config import catalogue_file
    orig = next((i for i in catalogue_file()["items"] if i["item_id"] == item_id), None)
    if orig is None:
        raise HTTPException(404)
    with db() as c:
        c.run("UPDATE items SET expiry_date = CAST(:d AS date), status = :s, updated_at = now() WHERE item_id = :i",
              d=orig["expiry_date"], s=orig["status"], i=item_id)
    store.reload_items()
    E.switches.content_changed()
    return {"item_id": item_id, "restored": True}


@app.post("/api/v1/admin/overrides", status_code=201)
def add_override(o: OverrideIn):
    if o.item_id not in store.items:
        raise HTTPException(404)
    with db() as c:
        c.run("INSERT INTO overrides (action, country, ta, item_id, demo_run) VALUES (:a, :c, :t, :i, :r)",
              a=o.action, c=o.country, t=o.therapy_area, i=o.item_id, r=E.switches.demo_run)
    store.reload_overrides()
    E.switches.content_changed()
    return {"ok": True}


@app.delete("/api/v1/admin/overrides")
def clear_overrides(item_id: str | None = None):
    with db() as c:
        if item_id:
            c.run("DELETE FROM overrides WHERE item_id = :i", i=item_id)
        else:
            c.run("DELETE FROM overrides")
    store.reload_overrides()
    E.switches.content_changed()
    return {"ok": True}


@app.post("/api/v1/admin/crm/refresh")
def crm_refresh():
    """Re-send every CRM list computed before the latest content change (for a scheduler, e.g. every 15 min)."""
    sent = E.refresh_crm_recommendations()
    E.crm.deliver_batch()
    return {"sent": sent, "content_version": E.switches.content_version}


@app.get("/api/v1/admin/hcps/{hcp_id}/impressions")
def inspector(hcp_id: str, limit: int = 60, lang: Lang = "en"):
    """Answer 'why did this HCP see this item?' from the impression log."""
    _hcp_or_404(hcp_id)
    with db() as c:
        rows = c.all("SELECT impression_id, request_id, item_id, slot, rank, score, level, reason_template, "
                     "reason_params, signals, model_version, experiment_variant, ts FROM impressions "
                     "WHERE hcp_id = :h ORDER BY ts DESC, rank LIMIT :n", h=hcp_id, n=limit)
    from app.reasons import render
    for r in rows:
        r["ts"] = r["ts"].isoformat()
        r["impression_id"] = str(r["impression_id"])
        r["request_id"] = str(r["request_id"])
        r["title"] = store.items[r["item_id"]]["title"][lang] if r["item_id"] in store.items else r["item_id"]
        r["reason"] = render(r["reason_template"], r["reason_params"] or {}, lang, store)
    return {"hcp_id": hcp_id, "impressions": rows}


# ── demo launcher ─────────────────────────────────────────────────────────────
@app.get("/api/v1/demo/state")
def demo_state():
    return {"switches": {"engine_down": E.switches.engine_down, "paused": E.switches.paused},
            "demo_run": E.switches.demo_run, "personas": demo.personas()}


@app.post("/api/v1/demo/switches")
def demo_switches(s: SwitchIn):
    if s.engine_down is not None:
        E.switches.set("engine_down", s.engine_down)
    if s.paused is not None:
        E.switches.set("paused", s.paused)
    return {"engine_down": E.switches.engine_down, "paused": E.switches.paused}


@app.post("/api/v1/demo/reset")
def demo_reset():
    out = demo.reset()
    analytics.clear_cache()
    return out
