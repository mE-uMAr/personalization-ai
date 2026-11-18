"""Write data/catalogue.json, data/config.json from seed/catalogue_src.py.

The output follows the item metadata contract in requirements §4, field for field.
Run:  python -m seed.build_catalogue
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

from seed.catalogue_src import (ALL, COUNTRIES, COUNTRY_RULES, ITEMS, SPECIALTIES, THERAPY_AREAS,
                                TOPICS)
from seed.content_src import SECTIONS, SUMMARIES
from seed.content_unique import UNIQUE_BODIES

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ANCHOR = date(2026, 11, 18)  # fixed so every rebuild produces the same catalogue

TA_PREFIX = {"ophthalmology": "OPH", "cardiometabolic": "CMD", "respiratory": "RES",
             "neuroscience": "NEU", "womens_health": "WMH"}

def audience_for(ta: str) -> list[str]:
    s = [k for k, v in SPECIALTIES.items() if v["ta"] == ta]
    if ta != "cardiometabolic":
        s += ["general_practitioner", "internist"]
    return sorted(set(s))


def build() -> dict:
    mpath = DATA / "media_manifest.json"
    manifest = json.loads(mpath.read_text(encoding="utf-8")) if mpath.exists() else {}
    items = []
    counters: dict[str, int] = {}
    topic_n: dict[str, int] = {}
    for ta, topic, typ, en_title, ar_title, f in ITEMS:
        counters[ta] = counters.get(ta, 0) + 1
        item_id = f"{TA_PREFIX[ta]}-{counters[ta]:03d}"
        s_en, s_ar = SUMMARIES[en_title]
        k = topic_n.get(topic, 0)
        topic_n[topic] = k + 1
        pool = SECTIONS[topic]
        picked = UNIQUE_BODIES.get(en_title) or [pool[(k + j) % len(pool)] for j in range(min(3, len(pool)))]
        pub = ANCHOR - timedelta(days=f.get("pub", 30))
        approval = pub - timedelta(days=14)
        expiry = ANCHOR + timedelta(days=f["expiry"]) if "expiry" in f else approval + timedelta(days=730)
        promo = bool(f.get("promo"))
        body_en = [{"heading": h, "text": t} for h, t, _, _ in picked]
        body_ar = [{"heading": h, "text": t} for _, _, h, t in picked]
        item = {
            "item_id": item_id,
            "type": typ,
            "title": {"en": en_title, "ar": ar_title},
            "summary": {"en": s_en, "ar": s_ar},
            "body": {"en": body_en, "ar": body_ar} if typ == "article" else None,
            "transcript": ({"en": " ".join([s_en] + [t for _, t, _, _ in picked[:3]]),
                            "ar": " ".join([s_ar] + [t for _, _, _, t in picked[:3]])} if typ == "video" else None),
            "therapy_area": ta,
            "topics": [topic],
            "product": "Product X" if promo else None,
            "promotional": promo,
            "allowed_countries": f.get("countries", ALL),
            "audience_specialties": audience_for(ta),
            "gated": not f.get("public", False),
            "status": f.get("status", "published"),
            "approval_code": f"APR-{TA_PREFIX[ta]}-2026-{counters[ta]:04d}",
            "approval_date": approval.isoformat(),
            "expiry_date": expiry.isoformat(),
            "duration_seconds": f.get("seconds") if typ == "video" else None,
            "word_count": (len(s_en.split()) + sum(len(t.split()) + len(h.split()) for h, t, _, _ in picked))
            if typ == "article" else None,
            "published_date": pub.isoformat(),
            "editor_pick": f.get("pick"),  # 1..3 = "Start here" order for the TA
            "media": {"poster": f"/media/posters/{item_id}.jpg"},
            "sample": True,
        }
        m = manifest.get(item_id)
        if m and typ == "video":  # output of the video pipeline (seed/media.py + seed/narrate.py)
            item["duration_seconds"] = round(m["duration_seconds"])
            item["transcript"] = m["transcript"]
            # one item ID, one version per language (§4 bilingual linking)
            item["media"] = {"poster": m["poster"], "versions": m["versions"], "source": m["source"],
                             "pipeline": m["pipeline"]}
        elif m:
            item["media"]["source"] = m["poster_source"]
        items.append(item)
    return {"anchor_date": ANCHOR.isoformat(), "items": items}


def main() -> None:
    DATA.mkdir(exist_ok=True)
    cat = build()
    (DATA / "catalogue.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding="utf-8")
    topics = {tid: {"en": v[0], "ar": v[1], "ta": ta} for ta, tt in TOPICS.items() for tid, v in tt.items()}
    config = {
        "therapy_areas": THERAPY_AREAS,
        "topics": topics,
        "specialties": SPECIALTIES,
        "countries": COUNTRIES,
        "country_rules": COUNTRY_RULES,
    }
    (DATA / "config.json").write_text(json.dumps(config, ensure_ascii=False, indent=1), encoding="utf-8")
    n = len(cat["items"])
    by_ta = {}
    for it in cat["items"]:
        by_ta[it["therapy_area"]] = by_ta.get(it["therapy_area"], 0) + 1
    print(f"catalogue: {n} items {by_ta}")


if __name__ == "__main__":
    main()
