from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.db import Dataset, Run, WeatherRecord, get_datasets_dir
from app.schemas import DatasetOut, ExplainOut, RunOut


def _row_count(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def create_dataset_from_bytes(
    db, filename: str, content: bytes, user_id: int | None = None
) -> Dataset:
    if not content:
        raise ValueError("CSV upload is empty.")

    dataset_id = uuid4().hex
    target_path = get_datasets_dir() / f"{dataset_id}.csv"
    target_path.write_bytes(content)

    dataset = Dataset(
        id=dataset_id,
        user_id=user_id,
        filename=filename or f"{dataset_id}.csv",
        stored_path=str(target_path),
        sha256=_sha256(content),
        row_count=_row_count(target_path),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


def create_weather_record(
    db, lat: float, lon: float, points: list[dict[str, Any]]
) -> WeatherRecord:
    """Persist a list of weather data points fetched from MET Norway."""
    # Timestamps are datetime objects — convert to ISO strings for JSON storage
    serialisable = [
        {**p, "timestamp": p["timestamp"].isoformat()} for p in points
    ]
    record = WeatherRecord(
        lat=lat,
        lon=lon,
        data_json=json.dumps(serialisable),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def dataset_to_out(dataset: Dataset) -> DatasetOut:
    return DatasetOut(
        dataset_id=dataset.id,
        filename=dataset.filename,
        sha256=dataset.sha256,
        row_count=dataset.row_count,
        created_at=dataset.created_at,
    )


def run_to_out(run: Run) -> RunOut:
    lat: float | None = None
    lon: float | None = None
    if run.weather_record is not None:
        lat = run.weather_record.lat
        lon = run.weather_record.lon

    return RunOut(
        run_id=run.id,
        dataset_id=run.dataset_id,
        risk_score=run.risk_score,
        risk_level=run.risk_level,
        params=json.loads(run.params_json),
        explain=ExplainOut.model_validate(json.loads(run.explain_json)),
        created_at=run.created_at,
        source=run.source,
        lat=lat,
        lon=lon,
    )
