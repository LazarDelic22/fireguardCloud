from __future__ import annotations

from pathlib import Path

import pytest

from app.risk_engine import RiskEngineError, compute_risk, parse_csv


def _write_csv(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def test_parse_csv_valid_file(tmp_path: Path) -> None:
    csv_path = tmp_path / "weather.csv"
    _write_csv(
        csv_path,
        (
            "timestamp,temperature,humidity,wind_speed\n"
            "2026-01-01T00:00:00+00:00,10,70,4\n"
            "2026-01-01T01:00:00+00:00,14,65,6\n"
        ),
    )
    records = parse_csv(csv_path)
    assert len(records) == 2
    assert records[0]["temperature"] == 10.0


def test_parse_csv_missing_required_column(tmp_path: Path) -> None:
    csv_path = tmp_path / "missing.csv"
    _write_csv(
        csv_path,
        "timestamp,temperature,humidity\n2026-01-01T00:00:00+00:00,10,70\n",
    )
    with pytest.raises(RiskEngineError):
        parse_csv(csv_path)


def test_compute_risk_is_deterministic() -> None:
    records = [
        {"temperature": 10.0, "humidity": 70.0, "wind_speed": 4.0},
        {"temperature": 14.0, "humidity": 65.0, "wind_speed": 6.0},
        {"temperature": 20.0, "humidity": 55.0, "wind_speed": 7.0},
    ]
    first = compute_risk(records, params={"weights": {"temperature": 0.5, "humidity": 0.3, "wind_speed": 0.2}})
    second = compute_risk(records, params={"weights": {"temperature": 0.5, "humidity": 0.3, "wind_speed": 0.2}})

    assert first["risk_score"] == second["risk_score"]
    assert 0.0 <= first["risk_score"] <= 1.0
    assert first["risk_level"] in {"low", "medium", "high"}
    assert len(first["explain"]["top_factors"]) > 0

