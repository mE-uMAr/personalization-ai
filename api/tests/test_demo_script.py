"""The demo script, replayed through the API. Every claim made on stage is asserted here.

Run after every weight or data change:   pytest tests/test_demo_script.py -q
Needs the seeded database (python -m seed). Resets the demo run before and after.
"""
from __future__ import annotations

import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app import engine as E
from app.main import app

SWITCH_AT_ITEM = 4  # the landing TA flips on the 4th item read in the new TA (stated on stage)


@pytest.fixture(scope="module")
def api():
    with TestClient(app) as c:
        c.post("/api/v1/demo/reset")
        yield c
        c.post("/api/v1/demo/switches", json={"engine_down": False, "paused": False})
        c.post("/api/v1/demo/reset")


SID = f"test-{uuid.uuid4().hex[:8]}"


def ev(api, hcp, item, et, value=None):
    r = api.post("/api/v1/events", json={"hcp_id": hcp, "item_id": item, "event_type": et, "value": value,
                                         "session_id": SID, "device": "desktop", "language": "en"})
    assert r.status_code == 202, r.text
    return r.json()


def read_article(api, hcp, item):
    ev(api, hcp, item, "item_open")
    for m in (25, 50, 75):
        ev(api, hcp, item, "article_scroll", m)
    return ev(api, hcp, item, "article_read", 95)


def home(api, hcp, lang="en"):
    r = api.get("/api/v1/home", params={"hcp_id": hcp, "lang": lang, "session_id": SID})
    assert r.status_code == 200, r.text
    return r.json()


def row(h, slot):
    return next((r for r in h["rows"] if r["slot"] == slot), None)


def all_items(h):
    return [i for r in h["rows"] for i in r["items"]]


@pytest.fixture(scope="module")
def story(api):
    r = api.post("/api/v1/hcps", json={"full_name": "Dr. Live Demo", "specialty": "ophthalmologist", "country": "SA",
                                       "language": "en", "licence_no": "LIC-100200", "tracking_consent": True, "crm_consent": True})
    assert r.status_code == 201
    return {"hcp": r.json()["hcp_id"], "first": r.json()}


# ── Scenario 1: first visit ───────────────────────────────────────────────────
def test_1_first_visit_lands_on_specialty_ta(api, story):
    h = home(api, story["hcp"])
    assert h["landing_ta"] == "ophthalmology"
    assert [t["ta"] for t in h["therapy_areas"]][0] == "ophthalmology"
    assert len(h["therapy_areas"]) == 5  # reorders, never hides
    sh = row(h, "start_here")
    assert sh and [i["item_id"] for i in sh["items"][:3]] == ["OPH-001", "OPH-002", "OPH-005"]  # editor picks
    assert all(i["reason"]["template"] in ("start_here", "specialty_popular") for i in sh["items"])
    assert h["alpha"] == 0.0
    assert story["first"]["cluster"]["source"] == "provisional"
    story["home0"] = [i["item_id"] for i in row(h, "home_recommended")["items"]]


# ── Scenario 2: learning in action ────────────────────────────────────────────
def test_2_recommendations_change_on_next_page_with_reasons(api, story):
    hcp = story["hcp"]
    t0 = time.perf_counter()
    read_article(api, hcp, "OPH-001")
    h = home(api, hcp)
    assert (time.perf_counter() - t0) < 5.0  # reflected on the next page view, under 5 s
    rec = [i["item_id"] for i in row(h, "home_recommended")["items"]]
    assert rec != story["home0"]
    assert "OPH-001" not in [i["item_id"] for i in all_items(h)]  # completed items drop out
    assert all(i["reason"]["text"] for i in all_items(h))


def test_2b_partial_video_shows_continue_watching(api, story):
    hcp = story["hcp"]
    ev(api, hcp, "OPH-002", "item_open")
    ev(api, hcp, "OPH-002", "video_start")
    ev(api, hcp, "OPH-002", "video_progress", 25)
    ev(api, hcp, "OPH-002", "video_progress", 50)
    h = home(api, hcp)
    cw = row(h, "continue_watching")
    assert cw and cw["items"][0]["item_id"] == "OPH-002"
    assert cw["items"][0]["reason"]["params"]["pct"] == 50


def test_2c_reasons_become_personal_after_step_2(api, story):
    """The stage claim for scenario 2: reasons now cite the HCP's own reading."""
    h = home(api, story["hcp"])
    assert h["alpha"] >= 0.6
    templates = [i["reason"]["template"] for i in all_items(h)]
    assert {"because_read", "because_watched"} & set(templates), templates


def test_2d_concurrent_events_are_not_lost(api):
    """Article pages send several events at once; none may overwrite another."""
    from concurrent.futures import ThreadPoolExecutor
    r = api.post("/api/v1/hcps", json={"full_name": "Dr. Race Test", "specialty": "neurologist", "country": "AE",
                                       "tracking_consent": True})
    hid = r.json()["hcp_id"]
    items = ["NEU-001", "NEU-003", "NEU-005", "NEU-007", "NEU-008", "NEU-013", "NEU-015", "NEU-011"]
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda i: ev(api, hid, i, "item_open"), items))
    assert api.get(f"/api/v1/lens/{hid}").json()["actions"] == len(items)


# ── Scenario 3: therapy areas shift with behaviour ────────────────────────────
def test_3_landing_ta_switches_after_sustained_reading(api, story):
    hcp = story["hcp"]
    cardio = ["CMD-001", "CMD-004", "CMD-007", "CMD-010", "CMD-012", "CMD-013"]
    switched_at = None
    for n, item in enumerate(cardio, start=1):
        res = read_article(api, hcp, item)
        if res["landing_ta"] == "cardiometabolic":
            switched_at = n
            break
        h = home(api, hcp)
        assert h["landing_ta"] == "ophthalmology"  # one stray click never flips it
        if n == 2:  # warm now: reasons come from the HCP's own behaviour
            assert {i["reason"]["template"] for i in all_items(h)} & {"because_read", "because_watched", "ta_affinity"}
    story["switched_at"] = switched_at
    h = home(api, hcp)
    assert h["landing_ta"] == "cardiometabolic"
    assert [t["ta"] for t in h["therapy_areas"]][:2] == ["cardiometabolic", "ophthalmology"]
    assert len(h["therapy_areas"]) == 5


def test_3b_switch_happens_on_stated_item(story):
    assert story["switched_at"] == SWITCH_AT_ITEM, f"switch moved to item {story['switched_at']} — update the script"


# ── Scenario 4: clusters ──────────────────────────────────────────────────────
def test_4_live_hcp_moves_to_real_cluster_after_5_actions(api, story):
    lens = api.get(f"/api/v1/lens/{story['hcp']}").json()
    assert lens["actions"] >= 5
    assert lens["cluster"]["source"] == "assigned"
    cl = api.get("/api/v1/clusters").json()
    assert all(c["size"] >= 20 for c in cl["clusters"])  # minimum size by construction
    assert len(cl["clusters"]) >= 5
    assert any(p["hcp_id"] == story["hcp"] and p["live"] for p in cl["points"])
    h = home(api, story["hcp"])
    peers = row(h, "peers")
    assert peers and all(i["level"] == "L3" for i in peers["items"])


# ── Scenario 5: OCE ───────────────────────────────────────────────────────────
def test_5_engagement_and_recommendations_reach_oce(api, story):
    E.crm.deliver_batch()
    acc = api.get(f"/api/v1/oce/accounts/{story['hcp']}")
    assert acc.status_code == 200
    a = acc.json()
    seen = {e["item_id"] for e in a["engagement"]}
    assert {"OPH-001", "CMD-001"} <= seen
    assert a["recommendations"]
    assert a["landing_ta"] == "cardiometabolic"


def test_5b_no_crm_consent_never_reaches_oce(api):
    E.crm.deliver_batch()
    hid = "hcp_demo_nocrm"
    ev(api, hid, "NEU-001", "item_open")
    E.crm.deliver_batch()
    assert api.get(f"/api/v1/oce/accounts/{hid}").status_code == 404
    accts = api.get("/api/v1/oce/accounts", params={"q": "Lina Nasser"}).json()["accounts"]
    assert all(x["hcp_id"] != hid for x in accts)


# ── Compliance: the claims that matter most ───────────────────────────────────
def test_promotional_never_reaches_unverified(api):
    hid = "hcp_demo_unverified"
    h = home(api, hid)
    items = all_items(h)
    for ta in ["ophthalmology", "cardiometabolic", "respiratory", "neuroscience", "womens_health"]:
        p = api.get(f"/api/v1/ta/{ta}", params={"hcp_id": hid}).json()
        items += p["ranked"]["items"]
        assert not any(c["promotional"] for c in p["browse"])
    assert items and not any(i["item"]["promotional"] for i in items)
    assert api.get("/api/v1/items/OPH-007", params={"hcp_id": hid}).status_code == 403  # direct access too


def test_market_rules_block_promo_in_iraq(api):
    r = api.post("/api/v1/hcps", json={"full_name": "Dr. Iraq Rules Test", "specialty": "cardiologist", "country": "IQ",
                                       "licence_no": "LIC-300400"})
    hid = r.json()["hcp_id"]
    p = api.get("/api/v1/ta/cardiometabolic", params={"hcp_id": hid}).json()
    assert not any(c["promotional"] for c in p["browse"])


def test_anonymous_sees_public_non_promotional_only(api):
    h = api.get("/api/v1/home", params={"country": "AE"}).json()
    items = all_items(h)
    assert items and all(not i["item"]["gated"] and not i["item"]["promotional"] for i in items)


def test_expire_now_removes_item_from_next_request(api, story):
    hcp = story["hcp"]
    target = row(home(api, hcp), "home_recommended")["items"][0]["item_id"]
    api.post(f"/api/v1/admin/items/{target}/expire")
    try:
        assert target not in [i["item_id"] for i in all_items(home(api, hcp))]
        assert api.get(f"/api/v1/items/{target}", params={"hcp_id": hcp}).status_code == 403
    finally:
        api.post(f"/api/v1/admin/items/{target}/restore")


def test_engine_down_serves_editor_lists_and_page_still_works(api, story):
    api.post("/api/v1/demo/switches", json={"engine_down": True})
    try:
        h = home(api, story["hcp"])
        assert h["rows"] and all(r["fallback"] == "engine_down" for r in h["rows"])
        assert all(i["level"] == "editor" for i in all_items(h))
    finally:
        api.post("/api/v1/demo/switches", json={"engine_down": False})


def test_every_impression_is_logged_and_explainable(api, story):
    imps = api.get(f"/api/v1/admin/hcps/{story['hcp']}/impressions").json()["impressions"]
    assert imps
    for i in imps[:20]:
        assert i["model_version"] and i["level"] and i["reason"]
        assert "components" in i["signals"] or i["level"] in ("exploration", "editor")


def test_arabic_version_of_same_item(api, story):
    en = api.get("/api/v1/items/OPH-002", params={"hcp_id": story["hcp"], "lang": "en"}).json()["item"]
    ar = api.get("/api/v1/items/OPH-002", params={"hcp_id": story["hcp"], "lang": "ar"}).json()["item"]
    assert en["item_id"] == ar["item_id"]
    assert en["video"]["file"].endswith(".en.mp4") and ar["video"]["file"].endswith(".ar.mp4")
    assert en["title"] != ar["title"]


def test_latency_p95_under_150ms(api, story):
    times = []
    for _ in range(40):
        t = time.perf_counter()
        api.post("/api/v1/recommendations", json={"hcp_id": story["hcp"], "slot": "home_recommended", "session_id": SID})
        times.append((time.perf_counter() - t) * 1000)
    times.sort()
    assert times[int(len(times) * 0.95) - 1] < 150, times[-5:]


def test_analytics_and_ab_screens_load(api):
    a = api.get("/api/v1/analytics")
    assert a.status_code == 200, a.text
    k = a.json()["kpis"]
    assert 0.02 <= k["ctr"] <= 0.12  # realistic recommendation click-through
    lv = {r["level"]: r["ctr"] for r in a.json()["by_level"]}
    assert lv["L2"] > lv["editor"]  # consistent with the A/B example
    ab = api.get("/api/v1/ab/example").json()
    assert ab["lift"] > 0


def test_exploration_is_never_promotional(api, story):
    for _ in range(5):
        h = home(api, story["hcp"])
        for i in all_items(h):
            if i["level"] == "exploration":
                assert not i["item"]["promotional"]


def test_unknown_language_is_rejected_cleanly(api):
    assert api.get("/api/v1/home", params={"lang": "fr"}).status_code == 422
