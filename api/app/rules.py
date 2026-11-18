"""Eligibility filter (requirements §7 rule 1).

Rule-based code, separate from ranking, run FIRST on every request. Experiments and
model output can never relax it. Country rules are read from config (the client's rule
sheet), never hard-coded.

Each rule returns a stable rule id so the console can show *which* rule removed an item.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal

ViewerState = Literal["anonymous", "registered", "verified"]

ELIGIBLE_STATUS = "published"

RULE_TEXT = {
    "not_published": "Not published (status is draft, in review, approved-not-published, expired or withdrawn)",
    "not_yet_live": "Approval or publish date is in the future",
    "expired": "Past its expiry date",
    "country_blocked": "Not allowed in the viewer's country",
    "promo_not_verified": "Promotional item and the viewer is not a verified HCP",
    "promo_country": "Promotional item and the viewer's country does not permit promotional content",
    "gated_anonymous": "Gated item and the viewer is anonymous",
    "admin_block": "Blocked by an admin override for this country and therapy area",
}


@dataclass(frozen=True)
class Viewer:
    state: ViewerState
    country: str


@dataclass
class RuleContext:
    country_rules: dict
    blocks: set[tuple[str, str]] = field(default_factory=set)  # (country, item_id); country "*" = all
    today: date | None = None

    def now(self) -> date:
        return self.today or datetime.now().date()


def _d(v: str | date | None) -> date | None:
    if v is None or isinstance(v, date):
        return v
    return date.fromisoformat(v[:10])


def check(item: dict, viewer: Viewer, ctx: RuleContext) -> str | None:
    """Return None if the item is eligible, else the id of the first rule that removes it."""
    if item.get("status") != ELIGIBLE_STATUS:
        return "not_published"
    today = ctx.now()
    pub = _d(item.get("published_date"))
    appr = _d(item.get("approval_date"))
    if (pub and pub > today) or (appr and appr > today):
        return "not_yet_live"
    exp = _d(item.get("expiry_date"))
    if exp is None or exp <= today:  # no expiry date = not approved for use
        return "expired"
    if viewer.country not in item.get("allowed_countries", []):
        return "country_blocked"
    if item.get("promotional"):
        if viewer.state != "verified":
            return "promo_not_verified"
        rules = ctx.country_rules.get(viewer.country)
        if not rules or not rules.get("promotional_allowed", False):  # unknown country = deny
            return "promo_country"
    if item.get("gated", True) and viewer.state == "anonymous":
        return "gated_anonymous"
    if ("*", item["item_id"]) in ctx.blocks or (viewer.country, item["item_id"]) in ctx.blocks:
        return "admin_block"
    return None


def filter_items(items: list[dict], viewer: Viewer, ctx: RuleContext) -> tuple[list[dict], dict[str, str]]:
    """Split items into (eligible, {item_id: rule_id}) for everything removed."""
    keep, removed = [], {}
    for it in items:
        r = check(it, viewer, ctx)
        if r is None:
            keep.append(it)
        else:
            removed[it["item_id"]] = r
    return keep, removed
