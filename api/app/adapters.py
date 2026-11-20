"""Demo stand-ins for the production seams (see app/ports.py)."""
from __future__ import annotations

import json
import random
import uuid

from app.db import db, j
from app.ports import CrmAdapter, EventSink, ProfileStore


class PostgresProfileStore(ProfileStore):
    """Stands in for Redis. One JSONB row per HCP, written in the same request as the event."""

    def get(self, hcp_id: str) -> dict | None:
        with db() as c:
            v = c.scalar("SELECT profile FROM profiles WHERE hcp_id = :h", h=hcp_id)
        if v is None:
            return None
        return v if isinstance(v, dict) else json.loads(v)

    def put(self, hcp_id: str, profile: dict) -> None:
        with db() as c:
            c.run("INSERT INTO profiles (hcp_id, profile, updated_at) VALUES (:h, CAST(:p AS jsonb), now()) "
                  "ON CONFLICT (hcp_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now()",
                  h=hcp_id, p=j(profile))


    def update(self, hcp_id: str, default: dict, fn) -> dict:
        with db(tx=True) as c:
            c.run("SELECT pg_advisory_xact_lock(hashtext(:h))", h=hcp_id)  # serialise per HCP
            v = c.scalar("SELECT profile FROM profiles WHERE hcp_id = :h", h=hcp_id)
            p = (v if isinstance(v, dict) else json.loads(v)) if v is not None else default
            p = fn(p)
            c.run("INSERT INTO profiles (hcp_id, profile, updated_at) VALUES (:h, CAST(:p AS jsonb), now()) "
                  "ON CONFLICT (hcp_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now()",
                  h=hcp_id, p=j(p))
        return p


class PostgresEventSink(EventSink):
    """Stands in for Kafka. Events land in Postgres synchronously (well inside the 2 s target)."""

    def write(self, e: dict) -> None:
        with db() as c:
            c.run("INSERT INTO events (event_id, hcp_id, item_id, event_type, value, session_id, device, country, "
                  "language, ts, synthetic, demo_run) VALUES (CAST(:event_id AS uuid), :hcp_id, :item_id, :event_type, "
                  ":value, :session_id, :device, :country, :language, CAST(:ts AS timestamptz), false, :demo_run)",
                  **{k: e.get(k) for k in ("event_id", "hcp_id", "item_id", "event_type", "value", "session_id",
                                           "device", "country", "language", "ts", "demo_run")})

    COLS = ("impression_id", "request_id", "hcp_id", "session_id", "item_id", "slot", "rank", "score", "level",
            "reason_template", "reason_params", "signals", "model_version", "experiment_id", "experiment_variant",
            "ts", "demo_run")

    def write_impressions(self, rows: list[dict]) -> None:
        """One round trip per request, however many items were shown."""
        if not rows:
            return
        params, values = {}, []
        for n, r in enumerate(rows):
            ph = []
            for col in self.COLS:
                k = f"{col}_{n}"
                v = r[col]
                if col in ("reason_params", "signals"):
                    v = j(v)
                    ph.append(f"CAST(:{k} AS jsonb)")
                elif col in ("impression_id", "request_id"):
                    ph.append(f"CAST(:{k} AS uuid)")
                elif col == "ts":
                    ph.append(f"CAST(:{k} AS timestamptz)")
                else:
                    ph.append(f":{k}")
                params[k] = v
            values.append("(" + ", ".join(ph) + ")")
        with db() as c:
            c.run(f"INSERT INTO impressions ({', '.join(self.COLS)}) VALUES {', '.join(values)}", **params)


class MockOceAdapter(CrmAdapter):
    """Stands in for the IQVIA OCE connector.

    Messages go to an outbox and are delivered in batches by a background worker (demo: every
    few seconds; production: 15-minute batches). Only HCPs with CRM-sharing consent are ever
    enqueued. `failure_rate` simulates transient CRM errors to exercise retry.
    """

    name = "mock-oce"

    def __init__(self, failure_rate: float = 0.0, max_attempts: int = 5):
        self.failure_rate = failure_rate
        self.max_attempts = max_attempts

    def enqueue(self, hcp_id: str, kind: str, payload: dict, demo_run: str | None = None) -> None:
        with db() as c:
            ok = c.scalar("SELECT crm_consent FROM hcps WHERE hcp_id = :h", h=hcp_id)
            if not ok:
                return  # no CRM-sharing consent → never leaves the platform
            c.run("INSERT INTO crm_outbox (hcp_id, kind, payload, demo_run) VALUES (:h, :k, CAST(:p AS jsonb), :r)",
                  h=hcp_id, k=kind, p=j({"message_id": str(uuid.uuid4()), **payload}), r=demo_run)

    def deliver_batch(self, limit: int = 200) -> int:
        with db(tx=True) as c:
            rows = c.all("SELECT o.id FROM crm_outbox o JOIN hcps h USING (hcp_id) WHERE o.status = 'queued' "
                         "AND h.crm_consent ORDER BY o.id LIMIT :n FOR UPDATE OF o SKIP LOCKED", n=limit)
            delivered = 0
            for r in rows:
                if random.random() < self.failure_rate:
                    c.run("UPDATE crm_outbox SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= :m "
                          "THEN 'failed' ELSE 'queued' END WHERE id = :i", i=r["id"], m=self.max_attempts)
                    continue
                c.run("UPDATE crm_outbox SET status = 'delivered', attempts = attempts + 1, delivered_at = now() "
                      "WHERE id = :i", i=r["id"])
                delivered += 1
        return delivered
