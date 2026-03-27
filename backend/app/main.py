from __future__ import annotations

import datetime
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.auth import ApiKeyMiddleware
from app.db import Dataset, Run, init_db, open_db
from app.events import broadcast, event_stream
from app.frcm_service import run_frcm
from app.met_service import MetServiceError, fetch_forecast
from app.risk_engine import RiskEngineError, parse_csv
from app.schemas import DatasetOut, LocationRiskRequest, RiskJsonRequest, RunOut
from app.storage import (
    create_dataset_from_bytes,
    create_weather_record,
    dataset_to_out,
    run_to_out,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="FireGuardCloud API", version="0.4.0", lifespan=lifespan)
app.add_middleware(ApiKeyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://158.37.63.124:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------

@app.post("/datasets", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetOut:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    db = open_db()
    try:
        content = await file.read()
        dataset = create_dataset_from_bytes(db, file.filename, content)
        return dataset_to_out(dataset)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()


@app.get("/datasets", response_model=list[DatasetOut])
def list_datasets() -> list[DatasetOut]:
    db = open_db()
    try:
        datasets = db.execute(select(Dataset).order_by(Dataset.created_at.desc())).scalars().all()
        return [dataset_to_out(d) for d in datasets]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Risk — CSV/JSON upload path (original)
# ---------------------------------------------------------------------------

@app.post("/risk", response_model=RunOut)
async def create_risk_run(request: Request) -> RunOut:
    """Compute fire risk from an uploaded CSV or a previously stored dataset."""
    content_type = request.headers.get("content-type", "")
    params: dict[str, Any] = {}
    dataset = None
    db = open_db()

    try:
        if content_type.startswith("application/json"):
            payload = RiskJsonRequest.model_validate(await request.json())
            params = payload.params
            dataset = db.get(Dataset, payload.dataset_id)
            if dataset is None:
                raise HTTPException(status_code=404, detail="Dataset not found.")
        elif content_type.startswith("multipart/form-data"):
            form = await request.form()
            file = form.get("file")
            if file is None or not hasattr(file, "read"):
                raise HTTPException(status_code=400, detail="Multipart requests must include a 'file'.")
            try:
                filename = getattr(file, "filename", "upload.csv")
                content = await file.read()  # type: ignore[func-returns-value]
                dataset = create_dataset_from_bytes(db, filename or "upload.csv", content)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            raw_params = form.get("params")
            if raw_params:
                try:
                    params = json.loads(str(raw_params))
                except json.JSONDecodeError as exc:
                    raise HTTPException(status_code=400, detail="Invalid JSON in 'params' field.") from exc
        else:
            raise HTTPException(
                status_code=415,
                detail="Unsupported content type. Use application/json or multipart/form-data.",
            )

        try:
            records = parse_csv(dataset.stored_path)
        except RiskEngineError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # Convert CSV rows to weather points with synthetic hourly timestamps
        # so the FRCM model can process them the same way as live MET data.
        _base = datetime.datetime(2026, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
        weather_points = [
            {
                "timestamp": _base + datetime.timedelta(hours=i),
                "temperature": float(r["temperature"]),
                "humidity": float(r["humidity"]),
                "wind_speed": float(r["wind_speed"]),
            }
            for i, r in enumerate(records)
        ]
        try:
            result = run_frcm(weather_points)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        run = Run(
            dataset_id=dataset.id,
            params_json=json.dumps(params),
            risk_score=float(result["risk_score"]),
            risk_level=str(result["risk_level"]),
            explain_json=json.dumps(result["explain"]),
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        out = run_to_out(run)
        await broadcast({"event": "run_created", "run_id": run.id, "risk_level": run.risk_level})
        return out
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Risk — location-based path using MET Norway + FRCM model
# ---------------------------------------------------------------------------

@app.post("/risk/location", response_model=RunOut, status_code=status.HTTP_201_CREATED)
async def create_risk_from_location(body: LocationRiskRequest) -> RunOut:
    """Fetch a weather forecast from MET Norway and compute fire risk using the FRCM model.

    The weather snapshot is stored in the database for traceability.
    """
    db = open_db()
    try:
        # 1. Fetch weather forecast from MET Norway
        try:
            weather_points = fetch_forecast(body.lat, body.lon)
        except MetServiceError as exc:
            raise HTTPException(status_code=502, detail=f"MET fetch failed: {exc}") from exc

        # 2. Persist the fetched weather snapshot
        weather_record = create_weather_record(db, body.lat, body.lon, weather_points)

        # 3. Run the provided FRCM fire-risk model
        try:
            result = run_frcm(weather_points)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # 4. Persist the risk run
        run = Run(
            weather_record_id=weather_record.id,
            params_json=json.dumps({"lat": body.lat, "lon": body.lon}),
            risk_score=float(result["risk_score"]),
            risk_level=str(result["risk_level"]),
            explain_json=json.dumps(result["explain"]),
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        out = run_to_out(run)
        await broadcast({
            "event": "run_created",
            "run_id": run.id,
            "risk_level": run.risk_level,
            "lat": body.lat,
            "lon": body.lon,
        })
        return out
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Run history
# ---------------------------------------------------------------------------

@app.get("/runs", response_model=list[RunOut])
def list_runs() -> list[RunOut]:
    db = open_db()
    try:
        runs = db.execute(select(Run).order_by(Run.created_at.desc())).scalars().all()
        return [run_to_out(r) for r in runs]
    finally:
        db.close()


@app.get("/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int) -> RunOut:
    db = open_db()
    try:
        run = db.get(Run, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found.")
        return run_to_out(run)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# SSE — real-time event stream for subscribing clients
# ---------------------------------------------------------------------------

@app.get("/events")
async def subscribe_events():
    """Server-Sent Events stream.

    Connect here to receive real-time notifications when new risk runs are created.
    Each event frame is a JSON object with at minimum: event, run_id, risk_level.
    """
    return StreamingResponse(event_stream(), media_type="text/event-stream")
