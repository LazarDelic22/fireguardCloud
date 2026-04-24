from __future__ import annotations

import asyncio
import datetime
from unittest.mock import patch


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


def test_scheduler_runs_all_cities_and_broadcasts(client) -> None:
    """The scheduler job should persist one run per city with source='scheduled'
    and broadcast one SSE event per city."""
    from app.main import compute_and_store_location_run
    from app.scheduler import CITIES, _run_all_cities

    broadcasts: list[dict] = []

    async def capture_broadcast(event):
        broadcasts.append(event)

    with patch("app.main.fetch_forecast", return_value=_fake_forecast()):
        with patch("app.main.broadcast", side_effect=capture_broadcast):
            asyncio.run(_run_all_cities(compute_and_store_location_run))

    resp = client.get("/runs")
    assert resp.status_code == 200
    runs = resp.json()
    scheduled = [r for r in runs if r["source"] == "scheduled"]
    assert len(scheduled) == len(CITIES)
    assert len(broadcasts) == len(CITIES)
    for event in broadcasts:
        assert event["source"] == "scheduled"
        assert event["event"] == "run_created"


def test_watchlist_returns_latest_city_snapshot(client) -> None:
    from app.db import open_db
    from app.main import compute_and_store_location_run

    with patch("app.main.fetch_forecast", return_value=_fake_forecast()):
        db = open_db()
        try:
            asyncio.run(compute_and_store_location_run(db, 60.39, 5.32, source="scheduled"))
        finally:
            db.close()

    resp = client.get("/watchlist")
    assert resp.status_code == 200
    cities = resp.json()
    bergen = next(city for city in cities if city["name"] == "Bergen")
    assert bergen["risk_level"] == "low"
    assert bergen["risk_score"] is not None
    assert bergen["updated_at"] is not None


def test_watchlist_bootstrap_seeds_missing_cities(client) -> None:
    from app.main import bootstrap_watchlist
    from app.scheduler import CITIES

    with patch("app.main.fetch_forecast", return_value=_fake_forecast()):
        asyncio.run(bootstrap_watchlist())

    resp = client.get("/watchlist")
    assert resp.status_code == 200
    cities = resp.json()
    ready = [city for city in cities if city["risk_score"] is not None]
    assert len(ready) == len(CITIES)
