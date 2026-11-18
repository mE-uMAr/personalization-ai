"""Eligibility filter tests (requirements §7 rule 1: 100% pass, >=80% coverage).

Includes an exhaustive sweep over the real catalogue x every country x every viewer
state, asserting the compliance invariants directly.
"""
from __future__ import annotations

import itertools
import json
from datetime import date
from pathlib import Path

import pytest

from app.rules import RULE_TEXT, RuleContext, Viewer, check, filter_items

DATA = Path(__file__).resolve().parents[1] / "data"
CONFIG = json.loads((DATA / "config.json").read_text(encoding="utf-8"))
CATALOGUE = json.loads((DATA / "catalogue.json").read_text(encoding="utf-8"))["items"]
RULES = CONFIG["country_rules"]
TODAY = date(2026, 11, 20)


def ctx(**kw):
    return RuleContext(country_rules=RULES, today=TODAY, **kw)


def item(**kw):
    base = dict(item_id="T-1", status="published", published_date="2026-01-01", approval_date="2025-12-01",
                expiry_date="2027-12-31", allowed_countries=["MA", "MB", "MG"], promotional=False, gated=True)
    base.update(kw)
    return base


V = Viewer("verified", "MA")


def test_eligible_baseline():
    assert check(item(), V, ctx()) is None


@pytest.mark.parametrize("status", ["draft", "in_review", "approved", "expired", "withdrawn"])
def test_only_published(status):
    assert check(item(status=status), V, ctx()) == "not_published"


def test_future_publish_date():
    assert check(item(published_date="2027-01-01"), V, ctx()) == "not_yet_live"


def test_future_approval_date():
    assert check(item(approval_date="2027-01-01"), V, ctx()) == "not_yet_live"


def test_expired_on_expiry_day():
    assert check(item(expiry_date=TODAY.isoformat()), V, ctx()) == "expired"


def test_missing_expiry_is_not_eligible():
    assert check(item(expiry_date=None), V, ctx()) == "expired"


def test_country_blocked():
    assert check(item(), Viewer("verified", "MH"), ctx()) == "country_blocked"


@pytest.mark.parametrize("state", ["anonymous", "registered"])
def test_promo_requires_verified(state):
    assert check(item(promotional=True, gated=False), Viewer(state, "MA"), ctx()) == "promo_not_verified"


def test_promo_country_rule():
    assert check(item(promotional=True), Viewer("verified", "MG"), ctx()) == "promo_country"


def test_promo_unknown_country_denied():
    c = RuleContext(country_rules={}, today=TODAY)
    assert check(item(promotional=True), V, c) == "promo_country"


def test_gated_anonymous():
    assert check(item(), Viewer("anonymous", "MA"), ctx()) == "gated_anonymous"
    assert check(item(gated=False), Viewer("anonymous", "MA"), ctx()) is None


def test_registered_sees_gated_non_promo():
    assert check(item(), Viewer("registered", "MA"), ctx()) is None


def test_admin_block_country_and_global():
    assert check(item(), V, ctx(blocks={("MA", "T-1")})) == "admin_block"
    assert check(item(), V, ctx(blocks={("*", "T-1")})) == "admin_block"
    assert check(item(), V, ctx(blocks={("MB", "T-1")})) is None


def test_date_objects_accepted():
    assert check(item(expiry_date=date(2030, 1, 1)), V, ctx()) is None


def test_filter_items_reports_rule():
    keep, removed = filter_items([item(), item(item_id="T-2", status="draft")], V, ctx())
    assert [i["item_id"] for i in keep] == ["T-1"]
    assert removed == {"T-2": "not_published"}


def test_every_rule_has_text():
    for rid in ["not_published", "not_yet_live", "expired", "country_blocked", "promo_not_verified",
                "promo_country", "gated_anonymous", "admin_block"]:
        assert rid in RULE_TEXT


# ── Exhaustive compliance sweep over the real catalogue ──────────────────────────
STATES = ["anonymous", "registered", "verified"]


@pytest.mark.parametrize("country,state", list(itertools.product(CONFIG["countries"], STATES)))
def test_catalogue_invariants(country, state):
    keep, _ = filter_items(CATALOGUE, Viewer(state, country), ctx())
    for it in keep:
        assert it["status"] == "published"
        assert country in it["allowed_countries"]
        assert date.fromisoformat(it["expiry_date"]) > TODAY
        if it["promotional"]:
            assert state == "verified" and RULES[country]["promotional_allowed"]
        if state == "anonymous":
            assert not it["gated"] and not it["promotional"]


def test_catalogue_has_rule_coverage():
    """The sample catalogue must exercise each content rule so the demo can show it."""
    seen = set()
    for country, state in itertools.product(CONFIG["countries"], STATES):
        _, removed = filter_items(CATALOGUE, Viewer(state, country), ctx())
        seen |= set(removed.values())
    assert {"not_published", "expired", "country_blocked", "promo_not_verified", "promo_country",
            "gated_anonymous"} <= seen
