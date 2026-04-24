from __future__ import annotations

import asyncio
import datetime
from unittest.mock import patch

import pytest


def _fake_forecast():
    base = datetime.datetime(2026, 4, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    return [
        {
            "timestamp": base + datetime.timedelta(hours=h),
            "temperature": 15.0,
            "humidity": 60.0,
            "wind_speed": 3.0,
        }
        for h in range(48)
    ]


def test_auth_disabled_no_header_required(client) -> None:
    """Default dev config has auth disabled; protected routes work without a key."""
    r = client.get("/runs")
    assert r.status_code == 200


def test_auth_enabled_server_key_empty_returns_500(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fail-closed guard: when auth is on but no API key is configured on the
    server, every protected request must return 500 — never silently allow."""
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "")
    r = client.get("/runs")
    assert r.status_code == 500


def test_auth_enabled_correct_header_returns_200(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "s3cret-key")
    r = client.get("/runs", headers={"X-API-Key": "s3cret-key"})
    assert r.status_code == 200


def test_auth_enabled_wrong_header_returns_401(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "s3cret-key")
    r = client.get("/runs", headers={"X-API-Key": "wrong"})
    assert r.status_code == 401


def test_auth_enabled_health_path_is_exempt(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Exempt paths (/health, /docs, /events) must stay reachable even when
    auth is enforced — CI health checks and browser SSE connections rely on it."""
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "s3cret-key")
    r = client.get("/health")
    assert r.status_code == 200


def test_watchlist_path_is_exempt(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "")
    r = client.get("/watchlist")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------------------------------------------------------------------
# JWT: register / login / me / bearer header
# ---------------------------------------------------------------------------


def test_register_creates_user_and_returns_token(client) -> None:
    r = client.post("/auth/register", json={"username": "alice", "password": "hunter22"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["username"] == "alice"
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 20


def test_register_duplicate_username_returns_409(client) -> None:
    client.post("/auth/register", json={"username": "bob", "password": "hunter22"})
    r = client.post("/auth/register", json={"username": "bob", "password": "hunter23"})
    assert r.status_code == 409


def test_login_wrong_password_returns_401(client) -> None:
    client.post("/auth/register", json={"username": "carol", "password": "rightpass"})
    r = client.post("/auth/login", json={"username": "carol", "password": "wrongpass"})
    assert r.status_code == 401


def test_login_correct_returns_valid_token(client) -> None:
    client.post("/auth/register", json={"username": "dan", "password": "hunter22"})
    r = client.post("/auth/login", json={"username": "dan", "password": "hunter22"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_bearer_jwt_is_accepted_for_protected_routes(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With auth enabled, a Bearer JWT from /auth/login must grant access to
    protected routes — even when no X-API-Key is configured."""
    # Register user while auth is disabled (conftest default)
    reg = client.post("/auth/register", json={"username": "eve", "password": "hunter22"})
    token = reg.json()["access_token"]

    # Now enable auth and retry with the token
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "")  # no legacy key configured
    r = client.get("/runs", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_me_returns_user_when_token_valid(client, monkeypatch: pytest.MonkeyPatch) -> None:
    reg = client.post("/auth/register", json={"username": "frank", "password": "hunter22"})
    token = reg.json()["access_token"]
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "frank"


def test_invalid_jwt_returns_401(client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "")
    r = client.get("/runs", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401


def test_jwt_user_history_shows_scheduled_and_own_runs_only(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.db import open_db
    from app.main import compute_and_store_location_run

    alice_token = client.post(
        "/auth/register", json={"username": "alice2", "password": "hunter22"}
    ).json()["access_token"]
    bob_token = client.post(
        "/auth/register", json={"username": "bob2", "password": "hunter22"}
    ).json()["access_token"]

    monkeypatch.setenv("FIREGUARD_AUTH_ENABLED", "true")
    monkeypatch.setenv("FIREGUARD_API_KEY", "")

    with patch("app.main.fetch_forecast", return_value=_fake_forecast()):
        alice_run = client.post(
            "/risk/location",
            json={"lat": 48.8566, "lon": 2.3522},
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        bob_run = client.post(
            "/risk/location",
            json={"lat": 34.0522, "lon": -118.2437},
            headers={"Authorization": f"Bearer {bob_token}"},
        )

        db = open_db()
        try:
            asyncio.run(
                compute_and_store_location_run(db, 60.39, 5.32, source="scheduled")
            )
        finally:
            db.close()

    assert alice_run.status_code == 201
    assert bob_run.status_code == 201

    history = client.get("/runs", headers={"Authorization": f"Bearer {alice_token}"})
    assert history.status_code == 200

    runs = history.json()
    ids = {run["run_id"] for run in runs}
    assert alice_run.json()["run_id"] in ids
    assert bob_run.json()["run_id"] not in ids
    assert any(run["source"] == "scheduled" for run in runs)
