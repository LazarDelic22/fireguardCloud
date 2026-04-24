from __future__ import annotations

import datetime
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import ApiKeyMiddleware
from app.db import Dataset, Run, User, init_db, open_db
from app.events import broadcast, event_stream
from app.frcm_service import run_frcm
from app.met_service import MetServiceError, fetch_forecast
from app.risk_engine import RiskEngineError, parse_csv
from app.scheduler import CITIES, shutdown_scheduler, start_scheduler
from app.schemas import (
    AuthRequest,
    AuthResponse,
    DatasetOut,
    LocationRiskRequest,
    RiskJsonRequest,
    RunOut,
    UserOut,
    WatchlistCity,
)
from app.security import hash_password, issue_token, verify_password
from app.storage import (
    create_dataset_from_bytes,
    create_weather_record,
    dataset_to_out,
    run_to_out,
)

logger = logging.getLogger(__name__)


def scheduler_enabled() -> bool:
    value = os.getenv("FIREGUARD_SCHEDULER_ENABLED", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


async def compute_and_store_location_run(
    db: Session, lat: float, lon: float, source: str = "manual", user_id: int | None = None
) -> Run:
    """Shared pipeline for location-based risk runs.

    Used by both the HTTP route and the background scheduler so the two paths
    always agree on model, persistence, and event shape.
    """
    weather_points = fetch_forecast(lat, lon)
    weather_record = create_weather_record(db, lat, lon, weather_points)
    result = run_frcm(weather_points)
    run = Run(
        weather_record_id=weather_record.id,
        user_id=user_id,
        params_json=json.dumps({"lat": lat, "lon": lon}),
        risk_score=float(result["risk_score"]),
        risk_level=str(result["risk_level"]),
        explain_json=json.dumps(result["explain"]),
        source=source,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    await broadcast({
        "event": "run_created",
        "run_id": run.id,
        "risk_level": run.risk_level,
        "lat": lat,
        "lon": lon,
        "source": source,
    })
    return run


def _seed_demo_user() -> None:
    """Create a 'demo/demo123' user if the users table is empty.

    Lets peer reviewers log in without having to register first.
    """
    db = open_db()
    try:
        any_user = db.execute(select(User).limit(1)).scalar_one_or_none()
        if any_user is not None:
            return
        db.add(User(username="demo", password_hash=hash_password("demo123")))
        db.commit()
    finally:
        db.close()


def _request_user_id(request: Request) -> int | None:
    user_id = getattr(request.state, "user_id", None)
    return int(user_id) if user_id is not None else None


def _dataset_visible_to_user(dataset: Dataset, user_id: int | None) -> bool:
    return user_id is None or dataset.user_id is None or dataset.user_id == user_id


def _run_visible_to_user(run: Run, user_id: int | None) -> bool:
    return user_id is None or run.source == "scheduled" or run.user_id is None or run.user_id == user_id


def _coords_key(lat: float, lon: float) -> str:
    return f"{lat:.4f}:{lon:.4f}"


def _existing_watchlist_keys() -> set[str]:
    """Return the coords already persisted for any location-based run.

    This keeps startup cheap on subsequent boots: we only fetch weather for
    cities that have never been seeded before.
    """
    db = open_db()
    try:
        keys: set[str] = set()
        runs = db.execute(select(Run).where(Run.weather_record_id.is_not(None))).scalars().all()
        for run in runs:
            if run.weather_record is None:
                continue
            keys.add(_coords_key(run.weather_record.lat, run.weather_record.lon))
        return keys
    finally:
        db.close()


async def bootstrap_watchlist() -> None:
    """Seed missing watchlist cities once at boot.

    The hourly scheduler keeps the cities fresh afterward. This initial pass
    exists purely so the public home page has real numbers instead of a wall of
    empty cards on first deploy.
    """
    existing = _existing_watchlist_keys()
    missing = [(name, country, lat, lon) for name, country, lat, lon in CITIES if _coords_key(lat, lon) not in existing]

    if not missing:
        return

    logger.info("Bootstrapping %d watchlist cities", len(missing))
    for name, _country, lat, lon in missing:
        db = open_db()
        try:
            await compute_and_store_location_run(db, lat, lon, source="scheduled")
            logger.info("Watchlist bootstrap ok: %s (%s, %s)", name, lat, lon)
        except Exception:  # noqa: BLE001
            logger.exception("Watchlist bootstrap failed for %s", name)
        finally:
            db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    _seed_demo_user()
    if scheduler_enabled():
        await bootstrap_watchlist()
        start_scheduler(compute_and_store_location_run)
    try:
        yield
    finally:
        if scheduler_enabled():
            shutdown_scheduler()


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
# Auth — register, login, current user
# ---------------------------------------------------------------------------

def _user_to_out(user: User) -> UserOut:
    return UserOut(id=user.id, username=user.username, created_at=user.created_at)


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: AuthRequest) -> AuthResponse:
    db = open_db()
    try:
        existing = db.execute(select(User).where(User.username == body.username)).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=409, detail="Username already taken.")

        user = User(username=body.username, password_hash=hash_password(body.password))
        db.add(user)
        db.commit()
        db.refresh(user)
        token = issue_token(user.id, user.username)
        return AuthResponse(user=_user_to_out(user), access_token=token)
    finally:
        db.close()


@app.post("/auth/login", response_model=AuthResponse)
def login(body: AuthRequest) -> AuthResponse:
    db = open_db()
    try:
        user = db.execute(select(User).where(User.username == body.username)).scalar_one_or_none()
        if user is None or not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid username or password.")
        token = issue_token(user.id, user.username)
        return AuthResponse(user=_user_to_out(user), access_token=token)
    finally:
        db.close()


@app.get("/auth/me", response_model=UserOut)
def get_me(request: Request) -> UserOut:
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    db = open_db()
    try:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="User no longer exists.")
        return _user_to_out(user)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------

@app.post("/datasets", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(request: Request, file: UploadFile = File(...)) -> DatasetOut:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    db = open_db()
    try:
        content = await file.read()
        dataset = create_dataset_from_bytes(db, file.filename, content, user_id=_request_user_id(request))
        return dataset_to_out(dataset)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()


@app.get("/datasets", response_model=list[DatasetOut])
def list_datasets(request: Request) -> list[DatasetOut]:
    db = open_db()
    try:
        user_id = _request_user_id(request)
        stmt = select(Dataset).order_by(Dataset.created_at.desc())
        if user_id is not None:
            stmt = stmt.where(or_(Dataset.user_id == user_id, Dataset.user_id.is_(None)))
        datasets = db.execute(stmt).scalars().all()
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
    user_id = _request_user_id(request)
    db = open_db()

    try:
        if content_type.startswith("application/json"):
            payload = RiskJsonRequest.model_validate(await request.json())
            params = payload.params
            dataset = db.get(Dataset, payload.dataset_id)
            if dataset is None or not _dataset_visible_to_user(dataset, user_id):
                raise HTTPException(status_code=404, detail="Dataset not found.")
        elif content_type.startswith("multipart/form-data"):
            form = await request.form()
            file = form.get("file")
            if file is None or not hasattr(file, "read"):
                raise HTTPException(status_code=400, detail="Multipart requests must include a 'file'.")
            try:
                filename = getattr(file, "filename", "upload.csv")
                content = await file.read()  # type: ignore[func-returns-value]
                dataset = create_dataset_from_bytes(
                    db,
                    filename or "upload.csv",
                    content,
                    user_id=user_id,
                )
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
            user_id=user_id,
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
async def create_risk_from_location(request: Request, body: LocationRiskRequest) -> RunOut:
    """Fetch a weather forecast from MET Norway and compute fire risk using the FRCM model.

    The weather snapshot is stored in the database for traceability.
    """
    db = open_db()
    try:
        try:
            run = await compute_and_store_location_run(
                db,
                body.lat,
                body.lon,
                source="manual",
                user_id=_request_user_id(request),
            )
        except MetServiceError as exc:
            raise HTTPException(status_code=502, detail=f"MET fetch failed: {exc}") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return run_to_out(run)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------

@app.get("/watchlist", response_model=list[WatchlistCity])
def get_watchlist() -> list[WatchlistCity]:
    db = open_db()
    try:
        wanted_keys = {_coords_key(lat, lon) for _name, _country, lat, lon in CITIES}
        latest_by_key: dict[str, Run] = {}
        runs = db.execute(
            select(Run).where(Run.weather_record_id.is_not(None)).order_by(Run.created_at.desc(), Run.id.desc())
        ).scalars().all()

        for run in runs:
            if run.weather_record is None:
                continue
            key = _coords_key(run.weather_record.lat, run.weather_record.lon)
            if key in wanted_keys and key not in latest_by_key:
                latest_by_key[key] = run
                if len(latest_by_key) == len(wanted_keys):
                    break

        cities: list[WatchlistCity] = []
        for name, country, lat, lon in CITIES:
            run = latest_by_key.get(_coords_key(lat, lon))
            if run is None:
                cities.append(WatchlistCity(name=name, country=country, lat=lat, lon=lon))
                continue
            run_out = run_to_out(run)
            cities.append(
                WatchlistCity(
                    name=name,
                    country=country,
                    lat=lat,
                    lon=lon,
                    risk_level=run_out.risk_level,
                    risk_score=run_out.risk_score,
                    min_ttf_hours=run_out.explain.min_ttf_hours,
                    updated_at=run_out.created_at,
                )
            )
        return cities
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Run history
# ---------------------------------------------------------------------------

@app.get("/runs", response_model=list[RunOut])
def list_runs(request: Request) -> list[RunOut]:
    db = open_db()
    try:
        user_id = _request_user_id(request)
        stmt = select(Run).order_by(Run.created_at.desc(), Run.id.desc())
        if user_id is not None:
            stmt = stmt.where(
                or_(Run.source == "scheduled", Run.user_id == user_id, Run.user_id.is_(None))
            )
        runs = db.execute(stmt).scalars().all()
        return [run_to_out(r) for r in runs]
    finally:
        db.close()


@app.get("/runs/{run_id}", response_model=RunOut)
def get_run(request: Request, run_id: int) -> RunOut:
    db = open_db()
    try:
        run = db.get(Run, run_id)
        if run is None or not _run_visible_to_user(run, _request_user_id(request)):
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
