"""Production seams. Each interface has a small demo stand-in behind it:

    ProfileStore  → PostgresProfileStore   (production: Redis)
    EventSink     → PostgresEventSink      (production: Kafka → warehouse)
    CrmAdapter    → MockOceAdapter         (production: IQVIA OCE / Salesforce LSC connector)
    Ranker        → FormulaRanker          (production: learning-to-rank model)

Swapping a stand-in for the real thing means writing one class; nothing else changes.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ProfileStore(ABC):
    @abstractmethod
    def get(self, hcp_id: str) -> dict | None: ...

    @abstractmethod
    def put(self, hcp_id: str, profile: dict) -> None: ...

    @abstractmethod
    def update(self, hcp_id: str, default: dict, fn) -> dict:
        """Atomically apply fn(profile) -> profile. Concurrent events for one HCP never overwrite each other."""


class EventSink(ABC):
    @abstractmethod
    def write(self, event: dict) -> None: ...

    @abstractmethod
    def write_impressions(self, rows: list[dict]) -> None: ...


class CrmAdapter(ABC):
    """Separate, replaceable adapter with retry and a failed-message queue (requirements §9)."""

    name: str

    @abstractmethod
    def enqueue(self, hcp_id: str, kind: str, payload: dict) -> None: ...

    @abstractmethod
    def deliver_batch(self, limit: int = 200) -> int:
        """Send queued messages; return number delivered. Failures stay queued with attempts++."""


@dataclass
class Scored:
    item_id: str
    score: float
    components: dict[str, float] = field(default_factory=dict)  # weighted contribution per signal
    level: str = "L2"
    reason_template: str = ""
    reason_params: dict = field(default_factory=dict)


class Ranker(ABC):
    version: str

    @abstractmethod
    def score(self, ctx, candidates: list[dict], slot: str) -> list[Scored]:
        """Score eligible candidates for a slot. Never sees ineligible items."""
