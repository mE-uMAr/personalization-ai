"""API contracts — field for field with the requirements (§3 event schema, §9 recommendation API)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Lang = Literal["en", "ar"]
Slot = Literal["home_recommended", "start_here", "continue_watching", "peers", "ta_page", "next"]


class EventIn(BaseModel):
    """One event schema for every event (§3): event ID, pseudonymous HCP ID, item ID, event type,
    value (seconds, % watched or query text), session ID, device, country, language, timestamp."""
    event_id: str | None = None
    hcp_id: str
    item_id: str | None = None
    event_type: str
    value: str | int | float | None = None
    session_id: str
    device: str | None = None
    country: str | None = None   # taken from the HCP record server-side
    language: Lang | None = None
    timestamp: str | None = None


class RecommendationRequest(BaseModel):
    """§9 request: pseudonymous HCP ID (or anonymous session ID), country, language, verification
    status, slot, current page or item, number of items."""
    hcp_id: str | None = None
    session_id: str | None = None
    country: str | None = None
    language: Lang = "en"
    verification_status: Literal["anonymous", "registered", "verified"] | None = None  # server is authoritative
    slot: Slot = "home_recommended"
    therapy_area: str | None = None
    current_item_id: str | None = None
    n: int = Field(6, ge=1, le=24)


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str | None = None
    specialty: str
    profession: str = "physician"
    country: str
    language: Lang = "en"
    licence_no: str | None = None
    # Analytics demo: new accounts have personalisation and CRM sharing on. A production build asks for both
    # as explicit, opt-in consents (prepared personas still show the no-consent paths).
    tracking_consent: bool = True
    crm_consent: bool = True


class OverrideIn(BaseModel):
    action: Literal["pin", "block"]
    country: str = "*"
    therapy_area: str | None = None
    item_id: str


class SwitchIn(BaseModel):
    engine_down: bool | None = None
    paused: bool | None = None
