"""FormulaRanker — one transparent formula (stands in for the learning-to-rank model).

    cold     = 0.55·editor + 0.45·specialty_popularity
    personal = 0.35·content_match(L2) + 0.30·ta_affinity(L1) + 0.20·peer_popularity(L3) + 0.15·freshness
    score    = (1 − α)·cold + α·personal,     α = min(actions / 5, 1)

Every component is normalised to 0..1 inside the request. The largest weighted contribution
picks the fixed reason template, so every "Why this?" is the honest top signal.
"""
from __future__ import annotations

from datetime import date

import numpy as np

from app.config import (BECAUSE_MIN_COSINE, COLD_WEIGHTS, FRESHNESS_HALF_LIFE_DAYS, MODEL_VERSION,
                        PERSONAL_WEIGHTS, TA_RANK_WEIGHT)
from app.ports import Ranker, Scored
from app.reasons import COMPONENT_LEVEL


def _norm(d: dict[str, float], keys: list[str]) -> dict[str, float]:
    vals = [d.get(k, 0.0) for k in keys]
    m = max(vals) if vals else 0.0
    return {k: (d.get(k, 0.0) / m if m > 0 else 0.0) for k in keys}


class FormulaRanker(Ranker):
    version = MODEL_VERSION

    def score(self, ctx, candidates: list[dict], slot: str) -> list[Scored]:
        st = ctx.store
        ids = [c["item_id"] for c in candidates]
        if not ids:
            return []
        a = ctx.alpha
        today = date.today()

        # ── cold-start signals ──
        ta_pos = {t: i for i, t in enumerate(ctx.ta_order)}
        ta_w = {t: TA_RANK_WEIGHT[min(i, len(TA_RANK_WEIGHT) - 1)] for t, i in ta_pos.items()}
        use_ta_weight = slot in ("home_recommended",)
        editor = {}
        for c in candidates:
            pick = c.get("editor_pick")
            editor[c["item_id"]] = ((4 - pick) / 3.0 if pick else 0.0) * (ta_w[c["therapy_area"]] if use_ta_weight else 1.0)
        spop = _norm(ctx.specialty_pop, ids)
        if use_ta_weight:
            spop = {k: v * ta_w[st.items[k]["therapy_area"]] for k, v in spop.items()}

        # ── personal signals ──
        content = {k: 0.0 for k in ids}
        because: dict[str, str] = {}
        if ctx.content_weights:
            pos = {k: w for k, w in ctx.content_weights.items() if w > 0 and k in st.emb_index}
            neg = [k for k, w in ctx.content_weights.items() if w < 0 and k in st.emb_index]
            if pos:
                pv = sum(w * st.vec(k) for k, w in pos.items())
                if neg:
                    pv = pv - 0.5 * sum(st.vec(k) for k in neg) * (sum(pos.values()) / len(pos))
                pv = pv / (np.linalg.norm(pv) or 1.0)
                cand_idx = [st.emb_index[k] for k in ids]
                sims = st.emb[cand_idx] @ pv
                lo, hi = float(sims.min()), float(sims.max())
                for k, s in zip(ids, sims):
                    content[k] = (float(s) - lo) / (hi - lo) if hi > lo else 0.0
                    # "Because you read X" only when X is in the same therapy area and genuinely similar
                    # (raw cosine). Embeddings rate most medical text as alike, so cosine alone linked
                    # hypertension to intraocular pressure (QA D-05); reps see these reasons too.
                    k_ta = st.items[k]["therapy_area"]
                    same = [e for e in pos if e != k and e in st.items and st.items[e]["therapy_area"] == k_ta]
                    if same:
                        src = max(same, key=lambda e: st.similarity(e, k))
                        if st.similarity(src, k) >= BECAUSE_MIN_COSINE:
                            because[k] = src
        aff = _norm(ctx.ta_affinity, st.ta_ids)
        ta_aff = {k: aff.get(st.items[k]["therapy_area"], 0.0) for k in ids}
        peer = _norm(ctx.peer_pop, ids) if ctx.peer_pop else {k: 0.0 for k in ids}
        fresh = {}
        for c in candidates:
            age = (today - date.fromisoformat(c["published_date"])).days
            fresh[c["item_id"]] = 0.5 ** (max(age, 0) / FRESHNESS_HALF_LIFE_DAYS)

        pw = dict(PERSONAL_WEIGHTS)
        if slot == "ta_page":  # inside one TA, TA affinity is the same for every item
            pw.pop("ta_affinity")
            s = sum(pw.values())
            pw = {k: v / s for k, v in pw.items()}

        out = []
        for c in candidates:
            k = c["item_id"]
            comp = {
                "editor": (1 - a) * COLD_WEIGHTS["editor"] * editor[k],
                "specialty_pop": (1 - a) * COLD_WEIGHTS["specialty_pop"] * spop.get(k, 0.0),
                "content": a * pw["content"] * content[k],
                "peer_pop": a * pw["peer_pop"] * peer.get(k, 0.0),
                "freshness": a * pw["freshness"] * fresh[k],
            }
            if "ta_affinity" in pw:
                comp["ta_affinity"] = a * pw["ta_affinity"] * ta_aff[k]
            score = sum(comp.values())
            top = max(comp, key=lambda x: comp[x]) if score > 0 else None
            # prefer the specific "Because you read X" when content is a close second
            if top and k in because and comp["content"] >= 0.75 * comp[top]:
                top = "content"
            if top == "content" and k not in because:
                rest = {x: v for x, v in comp.items() if x != "content"}
                top = max(rest, key=lambda x: rest[x]) if any(rest.values()) else "freshness"
            tpl, params = self._reason(top, c, ctx, because) if top else ("more_in_ta", {"ta": c["therapy_area"]})
            out.append(Scored(item_id=k, score=round(score, 5), components={x: round(v, 5) for x, v in comp.items()},
                              level=COMPONENT_LEVEL[top] if top else "editor", reason_template=tpl, reason_params=params))
        out.sort(key=lambda s: (-s.score, s.item_id))
        return out

    @staticmethod
    def _reason(top: str, item: dict, ctx, because: dict) -> tuple[str, dict]:
        ta = item["therapy_area"]
        if top == "editor":
            return ("start_here", {"ta": ta}) if item.get("editor_pick") else ("editor_pick", {})
        if top == "specialty_pop":
            if not ctx.specialty:
                return "popular_market", {"country": ctx.country}
            return "specialty_popular", {"specialty": ctx.specialty, "country": ctx.country}
        if top == "content" and item["item_id"] in because:
            src = because[item["item_id"]]
            kind = ctx.store.items[src]["type"]
            return ("because_watched" if kind == "video" else "because_read"), {"item_id": src}
        if top == "ta_affinity":
            return "ta_affinity", {"ta": ta}
        if top == "peer_pop":
            return "peers", {"cluster_id": ctx.cluster_id}
        return "fresh", {"ta": ta}
