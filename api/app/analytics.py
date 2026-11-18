"""Built-in reporting (requirements §8): computed from recorded events and impressions only.

Click = an `item_open` for the impressed item in the same session after the impression.
Completion = article read past threshold, or video watched to 100%, in that session.
"""
from __future__ import annotations

import math
import time

from app import engine as E
from app.db import db
from app.store import store

_cache: dict[str, tuple[float, dict]] = {}
TTL = 8.0


def _cached(key: str, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    v = fn()
    _cache[key] = (time.time(), v)
    return v


IMP_CTE = """
WITH imp AS (
  SELECT i.impression_id, i.hcp_id, i.session_id, i.item_id, i.slot, i.level, i.model_version, i.experiment_variant,
         i.ts, i.synthetic, i.demo_run,
         EXISTS (SELECT 1 FROM events e WHERE e.session_id = i.session_id AND e.item_id = i.item_id
                 AND e.event_type = 'item_open' AND e.ts >= i.ts - interval '5 seconds') AS clicked,
         EXISTS (SELECT 1 FROM events e WHERE e.session_id = i.session_id AND e.item_id = i.item_id
                 AND (e.event_type = 'article_read' OR (e.event_type = 'video_progress' AND e.value = '100'))
                 AND e.ts >= i.ts - interval '5 seconds') AS completed
  FROM impressions i
  WHERE i.ts > now() - interval '30 days' AND i.hcp_id <> 'anonymous'
)
"""


def overview() -> dict:
    return _cached("overview", _overview)


def _overview() -> dict:
    with db() as c:
        k = c.one(IMP_CTE + """
            SELECT count(*) impressions, count(*) FILTER (WHERE clicked) clicks,
                   count(*) FILTER (WHERE completed) completions,
                   count(DISTINCT item_id) items_recommended, count(DISTINCT session_id) sessions,
                   count(DISTINCT session_id) FILTER (WHERE clicked) sessions_with_rec_click
            FROM imp""")
        ev = c.one("""SELECT count(*) events, count(DISTINCT hcp_id) active_hcps,
                      count(DISTINCT session_id) sessions FROM events WHERE ts > now() - interval '30 days'""")
        ret = c.one("""WITH d AS (SELECT hcp_id, count(DISTINCT date_trunc('day', ts)) days FROM events
                       WHERE ts > now() - interval '30 days' GROUP BY 1)
                       SELECT count(*) FILTER (WHERE days >= 2)::float / greatest(count(*), 1) share FROM d""")
        by_level = c.all(IMP_CTE + """
            SELECT level, count(*) impressions, count(*) FILTER (WHERE clicked) clicks,
                   count(*) FILTER (WHERE completed) completions FROM imp GROUP BY 1 ORDER BY 2 DESC""")
        by_slot = c.all(IMP_CTE + """
            SELECT slot, count(*) impressions, count(*) FILTER (WHERE clicked) clicks,
                   count(*) FILTER (WHERE completed) completions FROM imp GROUP BY 1 ORDER BY 2 DESC""")
        daily = c.all(IMP_CTE + """,
            d AS (SELECT generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') AS day),
            ie AS (SELECT date_trunc('day', ts) AS day, count(*) imps, count(*) FILTER (WHERE clicked) clicks FROM imp GROUP BY 1),
            ee AS (SELECT date_trunc('day', ts) AS day, count(*) events, count(DISTINCT hcp_id) hcps FROM events
                   WHERE ts > now() - interval '30 days' GROUP BY 1)
            SELECT d.day, coalesce(ie.imps, 0) impressions, coalesce(ie.clicks, 0) clicks,
                   coalesce(ee.events, 0) events, coalesce(ee.hcps, 0) hcps
            FROM d LEFT JOIN ie USING (day) LEFT JOIN ee USING (day) ORDER BY d.day""")
        top = c.all("""
            SELECT item_id, count(*) FILTER (WHERE event_type = 'item_open') opens,
                   count(*) FILTER (WHERE event_type = 'article_read' OR (event_type = 'video_progress' AND value = '100')) completions,
                   count(DISTINCT hcp_id) hcps
            FROM events WHERE ts > now() - interval '30 days' AND item_id IS NOT NULL
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10""")
        by_ta = c.all("""SELECT i.data->>'therapy_area' ta, count(*) FILTER (WHERE e.event_type = 'item_open') opens,
                         count(DISTINCT e.hcp_id) hcps
                         FROM events e JOIN items i USING (item_id) WHERE e.ts > now() - interval '30 days'
                         GROUP BY 1 ORDER BY 2 DESC""")
        by_country = c.all("""SELECT h.country, h.language, count(DISTINCT e.hcp_id) hcps,
                              count(*) FILTER (WHERE e.event_type = 'item_open') opens
                              FROM events e JOIN hcps h USING (hcp_id) WHERE e.ts > now() - interval '30 days'
                              GROUP BY 1, 2 ORDER BY 3 DESC""")
        formats = c.one("""SELECT count(*) FILTER (WHERE i.data->>'type' = 'video' AND e.event_type = 'item_open') video_opens,
                           count(*) FILTER (WHERE i.data->>'type' = 'article' AND e.event_type = 'item_open') article_opens,
                           count(*) FILTER (WHERE e.event_type = 'video_progress' AND e.value = '100') video_completions,
                           count(*) FILTER (WHERE e.event_type = 'article_read') article_reads
                           FROM events e JOIN items i USING (item_id) WHERE e.ts > now() - interval '30 days'""")
        live = c.one("""SELECT count(*) events, count(DISTINCT hcp_id) hcps, max(ts) last_ts FROM events WHERE demo_run = :r""",
                     r=E.switches.demo_run)
        live_imps = c.scalar("SELECT count(*) FROM impressions WHERE demo_run = :r", r=E.switches.demo_run)
    published = sum(1 for i in store.items.values() if i["status"] == "published")
    for r in by_level + by_slot:
        r["ctr"] = round(r["clicks"] / r["impressions"], 4) if r["impressions"] else 0
        r["completion_after_click"] = round(r["completions"] / r["clicks"], 4) if r["clicks"] else 0
    for r in daily:
        r["day"] = r["day"].date().isoformat()
        r["ctr"] = round(r["clicks"] / r["impressions"], 4) if r["impressions"] else 0
    for r in top:
        it = store.items.get(r["item_id"], {})
        r["title"] = it.get("title")
        r["therapy_area"] = it.get("therapy_area")
        r["type"] = it.get("type")
    return {
        "window_days": 30,
        "kpis": {
            "impressions": k["impressions"], "clicks": k["clicks"],
            "ctr": round(k["clicks"] / k["impressions"], 4) if k["impressions"] else 0,
            "completion_after_click": round(k["completions"] / k["clicks"], 4) if k["clicks"] else 0,
            "return_visits": round(ret["share"], 4),
            "session_coverage": round(k["sessions_with_rec_click"] / k["sessions"], 4) if k["sessions"] else 0,
            "catalogue_coverage": round(k["items_recommended"] / published, 4) if published else 0,
            "events": ev["events"], "active_hcps": ev["active_hcps"], "sessions": ev["sessions"],
        },
        "by_level": by_level, "by_slot": by_slot, "daily": daily, "top_content": top, "by_ta": by_ta,
        "by_country": by_country, "formats": formats,
        "live_run": {"run": E.switches.demo_run, "events": live["events"], "hcps": live["hcps"], "impressions": live_imps,
                     "last_ts": live["last_ts"].isoformat() if live["last_ts"] else None},
    }


def ab_example() -> dict:
    return _cached("ab", _ab)


def _ab() -> dict:
    with db() as c:
        meta = c.scalar("SELECT value FROM settings WHERE key = 'seed_meta'") or {}
        exp = meta.get("ab", {}).get("experiment_id")
        rows = c.all("""
            WITH imp AS (
              SELECT i.experiment_variant v, i.hcp_id,
                     EXISTS (SELECT 1 FROM events e WHERE e.session_id = i.session_id AND e.item_id = i.item_id
                             AND e.event_type = 'item_open') clicked
              FROM impressions i WHERE i.experiment_id = :x)
            SELECT v, count(*) n, count(*) FILTER (WHERE clicked) clicks, count(DISTINCT hcp_id) hcps
            FROM imp GROUP BY 1 ORDER BY 1""", x=exp)
    arms = {r["v"]: r for r in rows}
    a, b = arms.get("A"), arms.get("B")
    result = {"experiment_id": exp, "simulated": True, "attribution": meta.get("ab", {}).get("attribution"),
              "slot": "home_recommended", "metric": "Click-through rate",
              "arms": [{"variant": v, "label": "Editor-curated (control)" if v == "A" else "Personalised ranker",
                        "impressions": r["n"], "clicks": r["clicks"], "hcps": r["hcps"],
                        "ctr": round(r["clicks"] / r["n"], 4) if r["n"] else 0} for v, r in sorted(arms.items())]}
    if a and b and a["n"] and b["n"]:
        p1, p2 = a["clicks"] / a["n"], b["clicks"] / b["n"]
        se = math.sqrt(p1 * (1 - p1) / a["n"] + p2 * (1 - p2) / b["n"])
        diff = p2 - p1
        lo, hi = diff - 1.96 * se, diff + 1.96 * se
        pooled = (a["clicks"] + b["clicks"]) / (a["n"] + b["n"])
        z = diff / math.sqrt(pooled * (1 - pooled) * (1 / a["n"] + 1 / b["n"])) if 0 < pooled < 1 else 0
        pval = math.erfc(abs(z) / math.sqrt(2))
        result.update({
            "lift": round(diff / p1, 4) if p1 else None,
            "lift_ci": [round(lo / p1, 4), round(hi / p1, 4)] if p1 else None,
            "diff_ci": [round(lo, 4), round(hi, 4)], "z": round(z, 2), "p_value": float(f"{pval:.3g}"),
            "small_sample": min(a["hcps"], b["hcps"]) < 100,
        })
    return result
