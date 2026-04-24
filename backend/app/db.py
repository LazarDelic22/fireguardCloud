from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


def get_data_dir() -> Path:
    return Path(os.getenv("FIREGUARD_DATA_DIR", "data")).resolve()


def get_datasets_dir() -> Path:
    return get_data_dir() / "datasets"


def get_database_url() -> str:
    return os.getenv("FIREGUARD_DATABASE_URL", "sqlite:///./data/fireguard.db")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    """A registered user. Passwords are stored as bcrypt hashes — never plaintext."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    datasets: Mapped[list["Dataset"]] = relationship(back_populates="user")
    runs: Mapped[list["Run"]] = relationship(back_populates="user")


class WeatherRecord(Base):
    """Stores a snapshot of weather data fetched from MET Norway for a location."""

    __tablename__ = "weather_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    # Raw weather points stored as a JSON array
    data_json: Mapped[str] = mapped_column(Text, nullable=False)

    runs: Mapped[list["Run"]] = relationship(back_populates="weather_record")


class Dataset(Base):
    """Stores metadata for an uploaded CSV dataset."""

    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["User | None"] = relationship(back_populates="datasets")
    runs: Mapped[list["Run"]] = relationship(back_populates="dataset")


class Run(Base):
    """A single fire-risk computation run.

    Linked to a Dataset (CSV upload) or a WeatherRecord (MET location run).
    """

    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # One of these two will be set depending on how the run was triggered
    dataset_id: Mapped[str | None] = mapped_column(ForeignKey("datasets.id"), nullable=True)
    weather_record_id: Mapped[int | None] = mapped_column(
        ForeignKey("weather_records.id"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    params_json: Mapped[str] = mapped_column(Text, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    explain_json: Mapped[str] = mapped_column(Text, nullable=False)
    # "manual" when triggered by an HTTP request, "scheduled" when added by the
    # background scheduler. Used by the frontend to style markers differently.
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    dataset: Mapped["Dataset | None"] = relationship(back_populates="runs")
    user: Mapped["User | None"] = relationship(back_populates="runs")
    weather_record: Mapped["WeatherRecord | None"] = relationship(back_populates="runs")


_engine = None
_session_factory = None


def _build_engine():
    database_url = get_database_url()
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, future=True, connect_args=connect_args)


def get_engine():
    global _engine
    if _engine is None:
        _engine = _build_engine()
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            class_=Session,
        )
    return _session_factory


def _ensure_schema_compatibility() -> None:
    """Apply lightweight additive migrations for older databases.

    The project still uses `create_all()` instead of a full migration tool. This
    helper makes new nullable/additive columns appear on an existing DB so local
    upgrades and the deployed Postgres instance do not require a manual reset.
    """
    engine = get_engine()
    with engine.begin() as conn:
        dialect = conn.dialect.name
        inspector = inspect(conn)
        table_names = set(inspector.get_table_names())

        if "runs" in table_names:
            run_columns = {column["name"] for column in inspector.get_columns("runs")}
            if "source" not in run_columns:
                conn.execute(
                    text("ALTER TABLE runs ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'manual'")
                )
            if "user_id" not in run_columns:
                if dialect == "postgresql":
                    conn.execute(
                        text("ALTER TABLE runs ADD COLUMN user_id INTEGER REFERENCES users(id)")
                    )
                else:
                    conn.execute(text("ALTER TABLE runs ADD COLUMN user_id INTEGER"))

        if "datasets" in table_names:
            dataset_columns = {column["name"] for column in inspector.get_columns("datasets")}
            if "user_id" not in dataset_columns:
                if dialect == "postgresql":
                    conn.execute(
                        text("ALTER TABLE datasets ADD COLUMN user_id INTEGER REFERENCES users(id)")
                    )
                else:
                    conn.execute(text("ALTER TABLE datasets ADD COLUMN user_id INTEGER"))


def init_db() -> None:
    get_data_dir().mkdir(parents=True, exist_ok=True)
    get_datasets_dir().mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=get_engine())
    _ensure_schema_compatibility()


def reset_db_for_tests() -> None:
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None


def open_db() -> Session:
    return get_session_factory()()
