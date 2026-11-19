"""Demo operations: live registration, prepared personas, reset.

Reset deletes only rows tagged with the current demo run, rebuilds the profiles those rows
touched, and restores any item an admin expired on stage. Seeded data is never touched.
"""
from __future__ import annotations

import json
import secrets

from app import engine as E
from app import profile as P
from app.config import ARTIFACTS, catalogue_file
from app.contracts import RegisterIn
from app.db import db
from app.store import store


class AccountExists(Exception):
    def __init__(self, hcp_id: str, name: str):
        super().__init__(hcp_id)
        self.hcp_id, self.name = hcp_id, name


def register(r: RegisterIn) -> dict:
    if r.specialty not in store.cfg["specialties"]:
        raise ValueError("unknown specialty")
    if r.country not in store.cfg["countries"]:
        raise ValueError("unknown country")
    email = (r.email or "").strip().lower() or None
    licence = (r.licence_no or "").strip().upper() or None
    if email or licence:  # one account per person: OCE matching relies on licence + email (§9)
        with db() as c:
            ex = c.one("SELECT hcp_id, full_name FROM identities WHERE (CAST(:e AS text) IS NOT NULL AND lower(email) = :e) "
                       "OR (CAST(:l AS text) IS NOT NULL AND upper(trim(licence_no)) = :l) ORDER BY hcp_id LIMIT 1",
                       e=email, l=licence)
        if ex:
            raise AccountExists(ex["hcp_id"], ex["full_name"])
    hcp_id = "hcp_" + secrets.token_hex(5)  # pseudonymous ID; identity kept in a separate table
    verified = verify_licence(r.licence_no)
    # temporary cluster by specialty and country until there is enough behaviour (§5)
    cid = E.nearest_by_specialty_country(r.specialty, r.country) if r.tracking_consent else None
    x, y = E.provisional_position(cid)
    with db() as c:
        c.run("INSERT INTO hcps (hcp_id, specialty, profession, country, language, verified, tracking_consent, "
              "crm_consent, synthetic, cluster_id, cluster_source, map_x, map_y, demo_run) VALUES (:h, :s, :p, :c, :l, "
              ":v, :t, :crm, false, :cid, :src, :x, :y, :run)",
              h=hcp_id, s=r.specialty, p=r.profession, c=r.country, l=r.language, v=verified,
              t=r.tracking_consent, crm=r.crm_consent, cid=cid, src="provisional" if cid is not None else None,
              x=x, y=y, run=E.switches.demo_run)
        c.run("INSERT INTO identities (hcp_id, full_name, email, licence_no, oce_id) VALUES (:h, :n, :e, :l, :o)",
              h=hcp_id, n=r.full_name, e=r.email, l=r.licence_no,
              o=f"OCE-{r.country}-{secrets.randbelow(9_000_000) + 1_000_000}")
    hcp = E.get_hcp(hcp_id)
    p = P.new_profile(store.specialty_ta(r.specialty), store.ta_ids)
    E.profiles.put(hcp_id, p)
    if r.crm_consent:
        E.push_profile_to_crm(hcp, p)
    return {"hcp_id": hcp_id, "landing_ta": p["landing_ta"], "cluster": E.cluster_brief(cid, "provisional", r.language)}


def verify_licence(licence_no: str | None) -> bool:
    """Stand-in for the professional-register lookup. Production calls the market's registry service;
    until it confirms, the account is 'registered, not verified' and sees non-promotional content only."""
    return bool(licence_no and len(licence_no.strip()) >= 6)


def personas() -> list[dict]:
    with db() as c:
        meta = c.scalar("SELECT value FROM settings WHERE key = 'seed_meta'") or {}
        out = []
        for p in meta.get("prepared", []):
            h = c.one("SELECT h.*, i.full_name FROM hcps h JOIN identities i USING (hcp_id) WHERE hcp_id = :h", h=p["hcp_id"])
            if h:
                out.append({"hcp_id": h["hcp_id"], "name": h["full_name"], "label": p["label"],
                            "specialty": h["specialty"], "country": h["country"], "language": h["language"],
                            "verified": h["verified"], "tracking_consent": h["tracking_consent"],
                            "crm_consent": h["crm_consent"]})
        live = c.all("SELECT h.hcp_id, i.full_name name, h.specialty, h.country, h.language, h.verified, "
                     "h.tracking_consent, h.crm_consent, h.created_at FROM hcps h JOIN identities i USING (hcp_id) "
                     "WHERE h.demo_run = :r ORDER BY h.created_at DESC LIMIT 10", r=E.switches.demo_run)
    for l in live:
        l["label"] = "Registered live"
        l["created_at"] = l["created_at"].isoformat()
    return live + out


def rebuild_profile(hcp_id: str) -> None:
    hcp = E.get_hcp(hcp_id)
    if hcp is None:
        return
    p = P.new_profile(store.specialty_ta(hcp["specialty"]), store.ta_ids)
    with db() as c:
        rows = c.all("SELECT item_id, event_type, value, ts FROM events WHERE hcp_id = :h ORDER BY ts", h=hcp_id)
    for e in rows:
        it = store.items.get(e["item_id"])
        P.apply_event(p, e, it["therapy_area"] if it else None, it["type"] if it else None)
    E.profiles.put(hcp_id, p)


def reset() -> dict:
    run = E.switches.demo_run
    seed_assign = {a["hcp_id"]: a for a in json.loads((ARTIFACTS / "clusters.json").read_text(encoding="utf-8"))["assignments"]}
    with db() as c:
        touched = [r[0] for r in c.run("SELECT DISTINCT hcp_id FROM events WHERE demo_run = :r", r=run)]
        counts = {
            "events": c.scalar("WITH d AS (DELETE FROM events WHERE demo_run = :r RETURNING 1) SELECT count(*) FROM d", r=run),
            "impressions": c.scalar("WITH d AS (DELETE FROM impressions WHERE demo_run = :r RETURNING 1) SELECT count(*) FROM d", r=run),
            "crm": c.scalar("WITH d AS (DELETE FROM crm_outbox WHERE demo_run = :r RETURNING 1) SELECT count(*) FROM d", r=run),
            "overrides": c.scalar("WITH d AS (DELETE FROM overrides WHERE demo_run = :r RETURNING 1) SELECT count(*) FROM d", r=run),
        }
        live = [r[0] for r in c.run("SELECT hcp_id FROM hcps WHERE demo_run = :r", r=run)]
        if live:
            c.run("DELETE FROM profiles WHERE hcp_id = ANY(:ids)", ids=live)
            c.run("DELETE FROM hcps WHERE hcp_id = ANY(:ids)", ids=live)
        counts["hcps"] = len(live)
        for h in touched:
            if h in seed_assign:
                a = seed_assign[h]
                c.run("UPDATE hcps SET cluster_id = :c, cluster_source = 'seed', map_x = :x, map_y = :y WHERE hcp_id = :h",
                      c=a["cluster_id"], x=a["x"], y=a["y"], h=h)
        # restore items an admin changed on stage
        for it in catalogue_file()["items"]:
            c.run("UPDATE items SET status = :s, expiry_date = :e WHERE item_id = :i AND (status <> :s OR expiry_date <> CAST(:e AS date))",
                  s=it["status"], e=it["expiry_date"], i=it["item_id"])
    for h in touched:
        if h not in live:
            rebuild_profile(h)
    n = int(run.split("-")[-1]) + 1 if run.split("-")[-1].isdigit() else 1
    E.switches.set("demo_run", f"run-{n}")
    E.switches.set("engine_down", False)
    E.switches.set("paused", False)
    E.last_requests.clear()
    E.crm_last_top.clear()
    store.reload_items()
    store.reload_impression_counts()  # same exploration picks every rehearsal
    store.reload_overrides()
    return {"reset": run, "new_run": E.switches.demo_run, "deleted": counts, "profiles_rebuilt": len(touched) - len(live)}
