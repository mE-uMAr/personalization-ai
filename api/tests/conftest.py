"""Tests run against their own database (`<db>_test`), loaded from the same seed artifacts,
so running the suite never touches a live demo."""
from __future__ import annotations

import os
from urllib.parse import urlparse, urlunparse

import pytest

_live = urlparse(os.environ.get("DATABASE_URL", "postgresql://demo@127.0.0.1:5433/hcp"))
_test_db = _live.path.lstrip("/") + "_test"
os.environ["DATABASE_URL"] = urlunparse(_live._replace(path="/" + _test_db))


@pytest.fixture(scope="session", autouse=True)
def test_database():
    import pg8000.native

    admin = pg8000.native.Connection(_live.username or "postgres", password=_live.password, host=_live.hostname,
                                     port=_live.port or 5432, database=_live.path.lstrip("/"))
    if not admin.run("SELECT 1 FROM pg_database WHERE datname = :d", d=_test_db):
        admin.run(f'CREATE DATABASE "{_test_db}"')
    admin.close()
    from seed import load

    load.main()
    yield
