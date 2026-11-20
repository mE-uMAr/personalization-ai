"""Regression tests for the QA report of 18 Nov 2026 (defect IDs D-xx in each docstring).

Each test reproduces the check QA ran by hand, across many HCPs where QA sampled them.
"""
from __future__ import annotations

import uuid
from collections import Counter

import pytest
from fastapi.testclient import TestClient

from app import engine as E
from app.config import DIVERSITY_MAX_PER_TOPIC, PEER_MIN_ROW
from app.db import db
from app.main import app
from app.store import store

TAS = ["ophthalmology", "cardiometabolic", "respiratory", "neuroscience", "womens_health"]


@pytest.fixture(scope="module")
def api():
    with TestClient(app) as c:
        c.post("/api/v1/demo/reset")
        yield c
        c.post("/api/v1/demo/switches", json={"engine_down": False, "paused": False})
        c.post("/api/v1/demo/reset")


@pytest.fixture(scope="module")
def sample_hcps():
    with db() as c:
        prepared = [r[0] for r in c.run("SELECT hcp_id FROM hcps WHERE persona LIKE 'prepared:%' ORDER BY hcp_id")]
        synth = [r[0] for r in c.run("SELECT hcp_id FROM hcps WHERE synthetic ORDER BY hcp_id")]
    return prepared + synth[::15][:40]


def rows_for(api, hid):
    """Every recommendation row QA looked at: home, the five TA pages, and Up next on a few items."""
    out = list(api.get("/api/v1/home", params={"hcp_id": hid}).json()["rows"])
    for ta in TAS:
        out.append(api.get(f"/api/v1/ta/{ta}", params={"hcp_id": hid}).json()["ranked"])
    for item in ("CMD-002", "OPH-002", "RES-001"):
        r = api.get(f"/api/v1/items/{item}", params={"hcp_id": hid})
        if r.status_code == 200:
            out.append({**r.json()["next"], "context": item})
    return out


def test_d02_topic_cap_holds_in_every_slot(api, sample_hcps):
    """D-02: at most 3 items per topic in a slot of 6, including after the exploration item is added."""
    bad = []
    for hid in sample_hcps:
        for r in rows_for(api, hid):
            c = Counter(store.items[i["item_id"]]["topics"][0] for i in r["items"])
            if c and max(c.values()) > DIVERSITY_MAX_PER_TOPIC:
                bad.append((hid, r["slot"], c.most_common(1)))
    assert not bad, bad


def test_d05_because_reasons_stay_in_the_same_therapy_area(api, sample_hcps):
    """D-05: "Because you read/watched X" and "Related to X" never link two therapy areas."""
    bad = []
    for hid in sample_hcps:
        for r in rows_for(api, hid):
            for i in r["items"]:
                tpl, src = i["reason"]["template"], i["reason"]["params"].get("item_id")
                if tpl in ("because_read", "because_watched", "related") and src:
                    if store.items[src]["therapy_area"] != store.items[i["item_id"]]["therapy_area"]:
                        bad.append((hid, i["item_id"], i["reason"]["text"]))
    assert not bad, bad


def test_d06_up_next_starts_in_the_same_therapy_area(api):
    """D-06: after a Cardiometabolic article, Up next is Cardiometabolic (not the HCP's favourite area)."""
    for hid in ("hcp_demo_cardio", "hcp_demo_unverified"):
        for item in ("CMD-002", "OPH-002", "RES-001", "NEU-001"):
            r = api.get(f"/api/v1/items/{item}", params={"hcp_id": hid})
            if r.status_code != 200:
                continue
            nxt = r.json()["next"]["items"]
            ta = store.items[item]["therapy_area"]
            assert nxt and [store.items[i["item_id"]]["therapy_area"] for i in nxt[:2]] == [ta, ta], (hid, item)


def test_d22_peers_row_is_hidden_rather_than_padded(api, sample_hcps):
    """D-22: a peers row is either absent or has at least 3 items with a real peer signal."""
    for hid in sample_hcps:
        h = api.get("/api/v1/home", params={"hcp_id": hid}).json()
        peers = next((r for r in h["rows"] if r["slot"] == "peers"), None)
        if peers:
            assert len(peers["items"]) >= PEER_MIN_ROW, hid


def test_d09_fallback_lists_skip_completed_and_follow_landing_ta(api):
    """D-09 / D-01: the editors' fallback list respects the landing TA and hides finished items."""
    hid = "hcp_demo_cardio"
    with db() as c:
        done = {k for k, v in (c.scalar("SELECT profile FROM profiles WHERE hcp_id = :h", h=hid) or {}).get("items", {}).items()
                if v.get("completed")}
    assert done, "the prepared persona should have finished items"
    for switch in ("paused", "engine_down"):
        api.post("/api/v1/demo/switches", json={switch: True})
        try:
            h = api.get("/api/v1/home", params={"hcp_id": hid}).json()
            items = [i for r in h["rows"] for i in r["items"]]
            assert items and all(r["fallback"] for r in h["rows"])
            assert not done & {i["item_id"] for i in items}
            assert store.items[items[0]["item_id"]]["therapy_area"] == h["landing_ta"]
        finally:
            api.post("/api/v1/demo/switches", json={switch: False})


def test_d01_latency_guard_ignores_time_spent_waiting(api):
    """D-01: a normal ranking never trips the 150 ms guard, even with event writes in flight."""
    import threading

    stop = threading.Event()

    def writer():
        while not stop.is_set():
            api.post("/api/v1/events", json={"hcp_id": "hcp_demo_cardio", "item_id": "CMD-003", "event_type": "item_open",
                                             "session_id": "qa-load", "device": "desktop", "language": "en"})

    ts = [threading.Thread(target=writer) for _ in range(3)]
    for t in ts:
        t.start()
    try:
        for _ in range(15):
            h = api.get("/api/v1/home", params={"hcp_id": "hcp_demo_cardio"}).json()
            assert all(r["fallback"] is None for r in h["rows"]), [(r["slot"], r["rank_ms"]) for r in h["rows"]]
    finally:
        stop.set()
        for t in ts:
            t.join()


def _register(api, **kw):
    tag = uuid.uuid4().hex[:8]
    body = {"full_name": "Dr. QA Check", "email": f"qa-{tag}@example.org", "specialty": "cardiologist", "country": "SA",
            "language": "en", "licence_no": f"LIC-{tag}", "tracking_consent": True, "crm_consent": True, **kw}
    return api.post("/api/v1/hcps", json=body), body


def test_d07_duplicate_email_or_licence_is_rejected(api):
    """D-07: one account per person; the response names the existing account."""
    r, body = _register(api)
    assert r.status_code == 201
    hid = r.json()["hcp_id"]
    same_email = api.post("/api/v1/hcps", json={**body, "licence_no": "LIC-OTHER-1", "email": body["email"].upper()})
    same_licence = api.post("/api/v1/hcps", json={**body, "email": "someone.else@example.org"})
    for dup in (same_email, same_licence):
        assert dup.status_code == 409
        assert dup.json()["detail"]["hcp_id"] == hid


def test_d03_crm_list_drops_expired_item_without_a_new_visit(api):
    """D-03: expiring an item updates the CRM list even if the HCP never comes back."""
    r, _ = _register(api)
    hid = r.json()["hcp_id"]
    for item in ("CMD-001", "CMD-002", "CMD-003", "CMD-004", "CMD-006"):
        api.post("/api/v1/events", json={"hcp_id": hid, "item_id": item, "event_type": "item_open",
                                         "session_id": "qa", "device": "desktop", "language": "en"})
    api.get("/api/v1/home", params={"hcp_id": hid})  # last visit: the CRM gets this list
    E.crm.deliver_batch()
    before = [i["item_id"] for i in api.get(f"/api/v1/oce/accounts/{hid}").json()["recommendations"]]
    target = before[0]
    api.post(f"/api/v1/admin/items/{target}/expire")
    try:
        # no page view, no background job: reading the CRM record is enough to bring it up to date
        after = [i["item_id"] for i in api.get(f"/api/v1/oce/accounts/{hid}").json()["recommendations"]]
        assert target not in after and after
    finally:
        api.post(f"/api/v1/admin/items/{target}/restore")


def test_state_is_shared_between_instances(api):
    """Serverless / multi-replica: a switch or content change made by one instance reaches the others."""
    E.switches.sync(force=True)
    v0 = E.switches.content_version
    with db() as c:  # another instance flips the switch and expires an item
        c.run("UPDATE settings SET value = 'true'::jsonb WHERE key = 'paused'")
        c.run("UPDATE items SET expiry_date = current_date WHERE item_id = 'CMD-001'")
        c.run("UPDATE settings SET value = to_jsonb((value #>> '{}')::int + 1) WHERE key = 'content_version'")
    try:
        E.switches._synced_at = 0.0  # as if SYNC_SECONDS had passed
        h = api.get("/api/v1/home", params={"hcp_id": "hcp_demo_cardio"}).json()
        assert E.switches.content_version == v0 + 1
        assert all(r["fallback"] == "paused" for r in h["rows"])
        assert api.get("/api/v1/items/CMD-001", params={"hcp_id": "hcp_demo_cardio"}).status_code == 403
    finally:
        api.post("/api/v1/demo/switches", json={"paused": False})
        api.post("/api/v1/admin/items/CMD-001/restore")


def test_insight_panel_reads_last_ranking_from_the_log(api):
    """The insight panel's 'last ranking' comes from the impression log, so any instance can serve it."""
    api.get("/api/v1/home", params={"hcp_id": "hcp_demo_cardio"})
    last = api.get("/api/v1/lens/hcp_demo_cardio").json()["last"]
    rec = last["home_recommended"]
    assert rec["items"] and rec["rank_ms"] > 0 and rec["model_version"]
    assert all(i["reason"] and isinstance(i["title"], dict) for i in rec["items"])


def test_d27_iso_country_codes(api):
    """D-27: markets use ISO 3166-1 alpha-2 codes."""
    cfg = api.get("/api/v1/config").json()
    assert set(cfg["countries"]) == {"SA", "AE", "KW", "QA", "BH", "OM", "IQ", "EG"}
    assert set(cfg["country_rules"]) == set(cfg["countries"])
