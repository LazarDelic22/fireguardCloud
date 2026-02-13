from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DatasetOut(BaseModel):
    dataset_id: str
    filename: str
    sha256: str
    row_count: int
    created_at: datetime


class RiskJsonRequest(BaseModel):
    dataset_id: str
    params: dict[str, Any] = Field(default_factory=dict)


class LocationRiskRequest(BaseModel):
    """Request body for the location-based fire risk endpoint."""
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude")


class TopFactor(BaseModel):
    column: str
    contribution: float
    weight: float
    normalized_mean: float


class ExplainOut(BaseModel):
    record_count: int
    top_factors: list[TopFactor]
    # Extra fields populated for FRCM/location runs
    model: str | None = None
    min_ttf_hours: float | None = None
    mean_ttf_hours: float | None = None
    ttf_preview: list[dict[str, Any]] | None = None


class RunOut(BaseModel):
    run_id: int
    dataset_id: str | None  # None for location-based (MET) runs
    risk_score: float
    risk_level: str
    params: dict[str, Any]
    explain: ExplainOut
    created_at: datetime
    # Present for location-based runs
    lat: float | None = None
    lon: float | None = None
