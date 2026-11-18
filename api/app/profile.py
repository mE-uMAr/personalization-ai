"""HCP real-time profile: pure functions, no I/O.

The same fold is used live (one event at a time) and when rebuilding a profile from its
event history (seed, reset), so both always agree.

Profile shape (JSON-serialisable):
  ta:           {ta_id: decayed engagement points}
  prior_ta:     TA mapped from declared specialty (gets SPECIALTY_BONUS, never decays)
  landing_ta:   current landing TA (sticky: switches only past the 15% margin)
  actions:      count of actions (opens, dismissals, searches) — drives the cold→warm blend
  items:        {item_id: {w, progress, completed, dismissed, opened, last, type}}
  recent:       last 25 events [{item_id, event_type, value, ts}]
  switches:     [{from, to, at_action, ts}]
  as_of:        timestamp the decayed values refer to
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from app.config import (ACTION_EVENTS, ACTION_VIDEO_MILESTONE, COLD_START_ACTIONS, HALF_LIFE_DAYS, POINTS, SPECIALTY_BONUS,
                        TA_SWITCH_MARGIN)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ts(v) -> datetime:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def new_profile(prior_ta: str, ta_ids: list[str]) -> dict:
    return {
        "ta": {t: 0.0 for t in ta_ids},
        "prior_ta": prior_ta,
        "landing_ta": prior_ta,
        "actions": 0,
        "items": {},
        "recent": [],
        "switches": [],
        "as_of": None,
    }


def event_points(event_type: str, value) -> float:
    p = POINTS.get(event_type)
    if p is None:
        return 0.0
    if isinstance(p, dict):
        try:
            return float(p.get(int(float(value)), 0.0))
        except (TypeError, ValueError):
            return 0.0
    return float(p)


def decay_factor(prev, now: datetime) -> float:
    if not prev:
        return 1.0
    days = max(0.0, (now - _ts(prev)).total_seconds() / 86400.0)
    return 0.5 ** (days / HALF_LIFE_DAYS)


def ta_scores(p: dict) -> dict[str, float]:
    """Affinity incl. the specialty prior — what Level 1 ranks on."""
    s = dict(p["ta"])
    s[p["prior_ta"]] = s.get(p["prior_ta"], 0.0) + SPECIALTY_BONUS
    return s


def ta_order(p: dict) -> list[str]:
    """All TAs, landing TA first, then by affinity. Reorders, never hides."""
    s = ta_scores(p)
    rest = sorted((t for t in s if t != p["landing_ta"]), key=lambda t: (-s[t], t))
    return [p["landing_ta"], *rest]


def alpha(p: dict) -> float:
    return min(p["actions"] / COLD_START_ACTIONS, 1.0)


def apply_event(p: dict, ev: dict, item_ta: str | None, item_type: str | None) -> dict:
    """Fold one event into the profile (mutates and returns it)."""
    ts = _ts(ev["ts"])
    f = decay_factor(p.get("as_of"), ts)
    if f < 1.0:
        for t in p["ta"]:
            p["ta"][t] *= f
        for st in p["items"].values():
            st["w"] *= f
    if p.get("as_of") is None or ts > _ts(p["as_of"]):
        p["as_of"] = ts.isoformat()

    et, val, iid = ev["event_type"], ev.get("value"), ev.get("item_id")
    if et in ACTION_EVENTS or (et == "video_progress" and _int(val) == ACTION_VIDEO_MILESTONE):
        p["actions"] += 1

    pts = event_points(et, val)
    if iid:
        st = p["items"].setdefault(iid, {"w": 0.0, "progress": 0, "completed": False, "dismissed": False,
                                         "opened": False, "last": None, "type": item_type})
        st["w"] += pts
        st["last"] = ts.isoformat()
        if et == "item_open":
            st["opened"] = True
        elif et == "article_scroll":
            st["progress"] = max(st["progress"], _int(val))
        elif et == "article_read":
            st["completed"] = True
            st["progress"] = max(st["progress"], 60)
        elif et == "video_progress":
            st["progress"] = max(st["progress"], _int(val))
            if _int(val) >= 100:
                st["completed"] = True
        elif et == "dismiss":
            st["dismissed"] = True
        if item_ta and pts:
            p["ta"][item_ta] = max(0.0, p["ta"].get(item_ta, 0.0) + pts)

    p["recent"] = ([{"item_id": iid, "event_type": et, "value": val, "ts": ts.isoformat()}] + p["recent"])[:25]
    _maybe_switch(p, ts)
    return p


def _maybe_switch(p: dict, ts: datetime) -> None:
    s = ta_scores(p)
    cur = p["landing_ta"]
    best = max(s, key=lambda t: (s[t], t == cur))
    if best != cur and s[best] > s[cur] * (1.0 + TA_SWITCH_MARGIN):
        p["switches"].append({"from": cur, "to": best, "at_action": p["actions"], "ts": ts.isoformat()})
        p["landing_ta"] = best


def switch_threshold(p: dict) -> dict:
    """How far each other TA is from taking over the landing spot (for the engine lens)."""
    s = ta_scores(p)
    need = s[p["landing_ta"]] * (1.0 + TA_SWITCH_MARGIN)
    return {t: round(max(0.0, need - v), 2) for t, v in s.items() if t != p["landing_ta"]}


def _int(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def content_weights(p: dict) -> dict[str, float]:
    """Item weights for the content-match vector: positive engagement only, dismissed negative."""
    out = {}
    for iid, st in p["items"].items():
        if st["dismissed"]:
            out[iid] = -1.0
        elif st["w"] > 0:
            out[iid] = st["w"]
    return out


def is_finite(x: float) -> bool:
    return not (math.isnan(x) or math.isinf(x))
