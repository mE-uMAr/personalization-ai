"""Load catalogue + seed artifacts into Postgres (idempotent: drops and recreates demo data).

    python -m seed.load
"""
from __future__ import annotations

import csv
import io
import json
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from app import profile as P
from app.config import ARTIFACTS, ROOT, catalogue_file, site_config
from app.db import db, j

NS = uuid.UUID("6f1c2a52-7d0e-4b8e-9d3c-1f2a3b4c5d6e")
LEVEL_TEMPLATE = {"L1": "specialty_popular", "L2": "ta_affinity", "L3": "peers", "editor": "start_here",
                  "exploration": "exploration"}


def _copy(c, table: str, cols: list[str], rows: list[list]) -> None:
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in rows:
        w.writerow(["\\N" if v is None else v for v in r])
    buf.seek(0)
    c.raw.run(f"COPY {table} ({', '.join(cols)}) FROM STDIN WITH (FORMAT csv, NULL '\\N')", stream=buf)


def main() -> None:
    t0 = time.time()
    cfg = site_config()
    items = catalogue_file()["items"]
    item_by = {i["item_id"]: i for i in items}
    syn = json.loads((ARTIFACTS / "synthetic.json").read_text(encoding="utf-8"))
    cl = json.loads((ARTIFACTS / "clusters.json").read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).replace(microsecond=0)
    ta_ids = [t["id"] for t in cfg["therapy_areas"]]

    with db() as c:
        c.raw.run("DROP TABLE IF EXISTS settings, items, identities, hcps, events, impressions, profiles, clusters, "
                  "pop_cluster, pop_specialty, crm_outbox, overrides, cache CASCADE")
        sql = "\n".join(l.split("--")[0] for l in (ROOT / "app" / "schema.sql").read_text(encoding="utf-8").splitlines())
        for stmt in sql.split(";"):
            if stmt.strip():
                c.raw.run(stmt)

        for it in items:
            c.run("INSERT INTO items (item_id, data, status, expiry_date) VALUES (:i, CAST(:d AS jsonb), :s, :e)",
                  i=it["item_id"], d=j(it), s=it["status"], e=it["expiry_date"])

        assign = {a["hcp_id"]: a for a in cl["assignments"]}
        _copy(c, "hcps", ["hcp_id", "specialty", "profession", "country", "language", "verified", "tracking_consent",
                          "crm_consent", "synthetic", "persona", "cluster_id", "cluster_source", "map_x", "map_y"],
              [[h["hcp_id"], h["specialty"], h["profession"], h["country"], h["language"], h["verified"],
                h["tracking_consent"], h["crm_consent"], True, h["persona"], assign[h["hcp_id"]]["cluster_id"], "seed",
                assign[h["hcp_id"]]["x"], assign[h["hcp_id"]]["y"]] for h in syn["hcps"]])
        _copy(c, "identities", ["hcp_id", "full_name", "email", "licence_no", "oce_id"],
              [[i["hcp_id"], i["full_name"], i["email"], i["licence_no"], i["oce_id"]] for i in syn["identities"]])

        ev_rows = []
        for e in syn["events"]:
            ts = now - timedelta(seconds=e["t"])
            ev_rows.append([str(uuid.uuid5(NS, f"e{e['n']}")), e["hcp_id"], e["item_id"], e["event_type"], e["value"],
                            e["session_id"], e["device"], e["country"], e["language"], ts.isoformat(), True])
        _copy(c, "events", ["event_id", "hcp_id", "item_id", "event_type", "value", "session_id", "device", "country",
                            "language", "ts", "synthetic"], ev_rows)

        imp_rows = []
        for r in syn["impressions"]:
            arm_a = r["experiment_variant"] == "A"
            level = "editor" if arm_a else r["level"]
            imp_rows.append([str(uuid.uuid5(NS, f"i{r['n']}")), str(uuid.uuid5(NS, r["request_id"])), r["hcp_id"],
                             r["session_id"], r["item_id"], r["slot"], r["rank"], 0.0, level,
                             "editor_pick" if arm_a else LEVEL_TEMPLATE[level], "{}", "{}",
                             "editor-curated" if arm_a else "formula-1.0.0", r["experiment_id"],
                             r["experiment_variant"], (now - timedelta(seconds=r["t"])).isoformat(), True])
        _copy(c, "impressions", ["impression_id", "request_id", "hcp_id", "session_id", "item_id", "slot", "rank",
                                 "score", "level", "reason_template", "reason_params", "signals", "model_version",
                                 "experiment_id", "experiment_variant", "ts", "synthetic"], imp_rows)

        for k in cl["clusters"]:
            c.run("INSERT INTO clusters (cluster_id, label_en, label_ar, size, defining, top_items, top_tas, centroid, x, y) "
                  "VALUES (:i, :le, :la, :s, CAST(:d AS jsonb), CAST(:ti AS jsonb), CAST(:tt AS jsonb), "
                  "CAST(:ce AS jsonb), :x, :y)",
                  i=k["cluster_id"], le=k["label_en"], la=k["label_ar"], s=k["size"],
                  d=j({"behaviours": k["defining"], "specialties": k["specialties"], "countries": k["countries"],
                       "format": k["format"]}),
                  ti=j(k["top_items"]), tt=j(k["top_tas"]), ce=j(k["centroid"]), x=k["x"], y=k["y"])
        _copy(c, "pop_cluster", ["cluster_id", "item_id", "score"],
              [[int(cid), iid, s] for cid, d in cl["pop_cluster"].items() for iid, s in d.items()])
        _copy(c, "pop_specialty", ["specialty", "country", "item_id", "score"],
              [[r["specialty"], r["country"], r["item_id"], r["score"]] for r in cl["pop_specialty"]])

        # profiles: the same fold the live API uses
        by_hcp = defaultdict(list)
        for e, row in zip(syn["events"], ev_rows):
            by_hcp[e["hcp_id"]].append({"item_id": e["item_id"], "event_type": e["event_type"], "value": e["value"],
                                        "ts": row[9]})
        hmap = {h["hcp_id"]: h for h in syn["hcps"]}
        prof_rows = []
        for hid, evs in by_hcp.items():
            h = hmap[hid]
            p = P.new_profile(cfg["specialties"][h["specialty"]]["ta"], ta_ids)
            for e in sorted(evs, key=lambda x: x["ts"]):
                it = item_by.get(e["item_id"])
                P.apply_event(p, e, it["therapy_area"] if it else None, it["type"] if it else None)
            prof_rows.append([hid, json.dumps(p, ensure_ascii=False)])
        _copy(c, "profiles", ["hcp_id", "profile"], prof_rows)

        # CRM history for consented sample HCPs, so the rep view is not empty before the demo
        hist = []
        recent = sorted(ev_rows, key=lambda r: r[9], reverse=True)
        seen: dict[str, int] = defaultdict(int)
        for r in recent:
            hid = r[1]
            if not hmap[hid]["crm_consent"] or r[3] not in ("item_open", "article_read", "video_progress"):
                continue
            if seen[hid] >= 12:
                continue
            seen[hid] += 1
            it = item_by[r[2]]
            hist.append([hid, "engagement", json.dumps({
                "message_id": str(uuid.uuid5(NS, "m" + r[0])), "hcp_id": hid, "item_id": r[2],
                "item_title": it["title"]["en"], "type": it["type"], "event_type": r[3], "value": r[4],
                "therapy_area": it["therapy_area"], "timestamp": r[9]}), "delivered", 1, r[9], r[9]])
        _copy(c, "crm_outbox", ["hcp_id", "kind", "payload", "status", "attempts", "created_at", "delivered_at"], hist)

        meta = {"loaded_at": now.isoformat(), "embedding": json.loads((ARTIFACTS / "item_embeddings.json").read_text())["model"],
                "clustering": cl["implementation"], "n_clusters": cl["n_clusters"], "noise": cl["noise"],
                "ab": {"experiment_id": syn["ab_experiment"], "attribution": syn["ab_attribution"]},
                "prepared": syn["prepared"]}
        for k, v in {"engine_down": False, "paused": False, "demo_run": "run-1", "content_version": 0, "seed_meta": meta}.items():
            c.run("INSERT INTO settings (key, value) VALUES (:k, CAST(:v AS jsonb))", k=k, v=j(v))
        c.raw.run("ANALYZE")

    print(f"loaded: {len(items)} items, {len(syn['hcps'])} HCPs, {len(ev_rows)} events, {len(imp_rows)} impressions, "
          f"{len(cl['clusters'])} clusters, {len(hist)} CRM records in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
