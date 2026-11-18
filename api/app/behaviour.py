"""Behaviour vectors for Level 3 (shared by the offline clustering and the live API).

Per HCP: TA mix, topic mix, format preference, engagement depth, recency, visit cadence.
"""
from __future__ import annotations

from collections import defaultdict

import numpy as np

from app.profile import event_points

FEATURE_WEIGHTS = {"ta": 0.3, "topic": 3.0, "format": 1.5, "depth": 0.5, "recency": 0.3, "cadence": 0.3}


def behaviour_matrix(hcp_ids: list[str], events: list[dict], items: dict, cfg: dict) -> tuple[np.ndarray, dict]:
    tas = [t["id"] for t in cfg["therapy_areas"]]
    topics = list(cfg["topics"])
    idx = {h: i for i, h in enumerate(hcp_ids)}
    n = len(hcp_ids)
    ta_m = np.zeros((n, len(tas)))
    tp_m = np.zeros((n, len(topics)))
    vid = np.zeros(n)
    art = np.zeros(n)
    opens = np.zeros(n)
    reads = np.zeros(n)
    last = np.full(n, 90 * 86400.0)
    sessions: dict[str, set] = defaultdict(set)
    for e in events:
        i = idx.get(e["hcp_id"])
        if i is None or not e.get("item_id"):
            continue
        it = items[e["item_id"]]
        pts = max(0.0, event_points(e["event_type"], e.get("value")))
        ta_m[i, tas.index(it["therapy_area"])] += pts
        tp_m[i, topics.index(it["topics"][0])] += pts
        if e["event_type"] == "item_open":
            opens[i] += 1
            (vid if it["type"] == "video" else art)[i] += 1
        if e["event_type"] in ("article_read",) or (e["event_type"] == "video_progress" and str(e.get("value")) in ("75", "100")):
            reads[i] += 1
        last[i] = min(last[i], e.get("t", 0.0))
        sessions[e["hcp_id"]].add(e["session_id"])
    with np.errstate(invalid="ignore", divide="ignore"):
        ta_mix = np.nan_to_num(ta_m / ta_m.sum(1, keepdims=True))
        tp_mix = np.nan_to_num(tp_m / tp_m.sum(1, keepdims=True))
        fmt = np.nan_to_num(vid / np.maximum(opens, 1))
        depth = np.nan_to_num(reads / np.maximum(opens, 1)).clip(0, 1)
    recency = 1.0 - np.clip(last / (90 * 86400.0), 0, 1)
    visits = np.array([len(sessions[h]) for h in hcp_ids], dtype=float)
    cadence = np.clip(visits / 14.0, 0, 1)
    w = FEATURE_WEIGHTS
    X = np.hstack([ta_mix * w["ta"], tp_mix * w["topic"], fmt[:, None] * w["format"], depth[:, None] * w["depth"],
                   recency[:, None] * w["recency"], cadence[:, None] * w["cadence"]])
    raw = dict(ta_mix=ta_mix, tp_mix=tp_mix, fmt=fmt, depth=depth, cadence=visits, opens=opens)
    return X, raw
