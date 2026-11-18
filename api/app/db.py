"""Tiny Postgres access layer on pg8000 (pure Python driver, no native extensions).

`with db() as c:` yields a pooled connection. `c.run(sql, **params)` uses :name parameters.
Each `with` block is one transaction: committed on success, rolled back on error.
"""
from __future__ import annotations

import json
import queue
import threading
from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import urlparse

import pg8000.native

from app.config import DATABASE_URL, DB_POOL_SIZE

_pool: queue.LifoQueue | None = None
_lock = threading.Lock()


def _connect() -> pg8000.native.Connection:
    u = urlparse(DATABASE_URL)
    c = pg8000.native.Connection(
        user=u.username or "postgres", password=u.password, host=u.hostname or "127.0.0.1",
        port=u.port or 5432, database=(u.path or "/postgres").lstrip("/"), application_name="hcp-engine",
    )
    c.run("SET TIME ZONE 'UTC'")
    return c


def _get_pool() -> queue.LifoQueue:
    global _pool
    with _lock:
        if _pool is None:
            _pool = queue.LifoQueue(maxsize=DB_POOL_SIZE)
            for _ in range(DB_POOL_SIZE):
                _pool.put(None)
    return _pool


class Conn:
    def __init__(self, raw: pg8000.native.Connection):
        self.raw = raw

    def run(self, sql: str, **params: Any) -> list[list]:
        return self.raw.run(sql, **params) or []

    def all(self, sql: str, **params: Any) -> list[dict]:
        rows = self.raw.run(sql, **params) or []
        cols = [c["name"] for c in (self.raw.columns or [])]
        return [dict(zip(cols, r)) for r in rows]

    def one(self, sql: str, **params: Any) -> dict | None:
        r = self.all(sql, **params)
        return r[0] if r else None

    def scalar(self, sql: str, **params: Any) -> Any:
        r = self.run(sql, **params)
        return r[0][0] if r else None


@contextmanager
def db() -> Iterator[Conn]:
    pool = _get_pool()
    raw = pool.get()
    try:
        if raw is None:
            raw = _connect()
        raw.run("BEGIN")
        try:
            yield Conn(raw)
            raw.run("COMMIT")
        except Exception:
            try:
                raw.run("ROLLBACK")
            except Exception:
                raw.close()
                raw = None
            raise
    except (pg8000.native.InterfaceError, OSError):
        raw = None
        raise
    finally:
        pool.put(raw)


def j(v: Any) -> str:
    """Serialize to JSON for a ::jsonb parameter."""
    return json.dumps(v, ensure_ascii=False, default=str)
