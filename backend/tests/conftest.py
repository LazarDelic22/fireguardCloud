from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    data_dir = tmp_path / "data"
    db_path = tmp_path / "fireguard_test.db"

    monkeypatch.setenv("FIREGUARD_DATA_DIR", str(data_dir))
    monkeypatch.setenv("FIREGUARD_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "false")

    from app.db import init_db, reset_db_for_tests
    from app.main import app

    reset_db_for_tests()
    init_db()

    with TestClient(app) as test_client:
        yield test_client

    reset_db_for_tests()
