from __future__ import annotations

import datetime
from unittest.mock import patch


def _fake_weather_points() -> list[dict]:
    """Return a minimal list of weather data points that FRCM can process."""
    base = datetime.datetime(2026, 1, 7, 0, 0, 0, tzinfo=datetime.timezone.utc)
    return [
        {
            "timestamp": base + datetime.timedelta(hours=i),
            "temperature": 5.0,
            "humidity": 70.0,
            "wind_speed": 3.0,
        }
        for i in range(48)
    ]


def test_location_risk_returns_valid_result(client) -> None:
    """POST /risk/location with mocked MET data should return a valid risk run."""
    with patch("app.main.fetch_forecast", return_value=_fake_weather_points()):
        response = client.post("/risk/location", json={"lat": 60.39, "lon": 5.32})

    assert response.status_code == 201, response.text
    data = response.json()

    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_level"] in {"low", "medium", "high"}
    assert data["run_id"] > 0
    assert data["dataset_id"] is None  # location runs have no dataset
    assert data["lat"] == 60.39
    assert data["lon"] == 5.32
    assert data["explain"]["model"] == "dynamic-frcm-simple"
    assert data["explain"]["min_ttf_hours"] is not None


def test_location_risk_run_appears_in_history(client) -> None:
    """A location-based run should show up in GET /runs."""
    with patch("app.main.fetch_forecast", return_value=_fake_weather_points()):
        client.post("/risk/location", json={"lat": 60.39, "lon": 5.32})

    runs = client.get("/runs").json()
    assert len(runs) == 1
    assert runs[0]["lat"] == 60.39


def test_location_risk_met_error_returns_502(client) -> None:
    """If MET Norway is unreachable, the endpoint returns 502."""
    from app.met_service import MetServiceError

    with patch("app.main.fetch_forecast", side_effect=MetServiceError("timeout")):
        response = client.post("/risk/location", json={"lat": 60.39, "lon": 5.32})

    assert response.status_code == 502


def test_location_risk_invalid_coords_returns_422(client) -> None:
    """Coordinates outside valid range should be rejected."""
    response = client.post("/risk/location", json={"lat": 999.0, "lon": 5.32})
    assert response.status_code == 422


def _make_csv(tmp_path_factory) -> bytes:
    """Minimal CSV with 48 rows that FRCM can process."""
    lines = ["temperature,humidity,wind_speed"]
    for _ in range(48):
        lines.append("5.0,70.0,3.0")
    return "\n".join(lines).encode()


def test_csv_risk_uses_frcm(client, tmp_path) -> None:
    """POST /risk with a CSV dataset should use FRCM and return TTF explain data."""
    csv_bytes = b"temperature,humidity,wind_speed\n" + b"5.0,70.0,3.0\n" * 48

    upload = client.post(
        "/datasets",
        files={"file": ("test.csv", csv_bytes, "text/csv")},
    )
    assert upload.status_code == 201, upload.text
    dataset_id = upload.json()["dataset_id"]

    response = client.post("/risk", json={"dataset_id": dataset_id, "params": {}})
    assert response.status_code == 200, response.text
    data = response.json()

    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_level"] in {"low", "medium", "high"}
    assert data["explain"]["model"] == "dynamic-frcm-simple"
    assert data["explain"]["min_ttf_hours"] is not None
    assert data["dataset_id"] == dataset_id


def test_events_endpoint_is_reachable(client) -> None:
    """GET /events should return a streaming text/event-stream response."""
    async def _finite_stream():
        yield "data: {}\n\n"

    with patch("app.main.event_stream", return_value=_finite_stream()):
        response = client.get("/events")

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
