from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


REQUIRED_COLUMNS = ("temperature", "humidity", "wind_speed")
DEFAULT_WEIGHTS = {"temperature": 0.5, "humidity": 0.3, "wind_speed": 0.2}


class RiskEngineError(ValueError):
    pass


def parse_csv(path: str | Path) -> list[dict[str, Any]]:
    csv_path = Path(path)
    if not csv_path.exists():
        raise RiskEngineError(f"CSV file not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise RiskEngineError("CSV file is missing a header row.")

        missing = [column for column in REQUIRED_COLUMNS if column not in reader.fieldnames]
        if missing:
            raise RiskEngineError(f"CSV is missing required columns: {', '.join(missing)}")

        records: list[dict[str, Any]] = []
        for line_number, row in enumerate(reader, start=2):
            parsed_row: dict[str, Any] = dict(row)
            for column in REQUIRED_COLUMNS:
                value = row.get(column, "")
                try:
                    parsed_row[column] = float(value)
                except (TypeError, ValueError) as exc:
                    raise RiskEngineError(
                        f"Invalid numeric value at line {line_number} for column '{column}'."
                    ) from exc
            records.append(parsed_row)

    if not records:
        raise RiskEngineError("CSV does not contain data rows.")
    return records


def compute_risk(records: list[dict[str, Any]], params: dict[str, Any] | None = None) -> dict[str, Any]:
    if not records:
        raise RiskEngineError("No records provided for risk computation.")

    params = params or {}
    selected_columns = params.get("columns") or list(REQUIRED_COLUMNS)
    if not isinstance(selected_columns, list) or not selected_columns:
        raise RiskEngineError("'columns' must be a non-empty list.")

    weights_input = params.get("weights") or {}
    if not isinstance(weights_input, dict):
        raise RiskEngineError("'weights' must be an object if provided.")

    factors: list[dict[str, float | str]] = []
    for column in selected_columns:
        if column not in records[0]:
            raise RiskEngineError(f"Column '{column}' does not exist in records.")

        values = [float(record[column]) for record in records]
        minimum = min(values)
        maximum = max(values)

        if maximum == minimum:
            normalized_values = [0.5 for _ in values]
        else:
            spread = maximum - minimum
            normalized_values = [(value - minimum) / spread for value in values]

        normalized_mean = sum(normalized_values) / len(normalized_values)
        weight = float(weights_input.get(column, DEFAULT_WEIGHTS.get(column, 1.0)))
        contribution = normalized_mean * weight

        factors.append(
            {
                "column": column,
                "weight": weight,
                "normalized_mean": normalized_mean,
                "contribution": contribution,
            }
        )

    total_weight = sum(abs(float(factor["weight"])) for factor in factors)
    if total_weight == 0:
        raise RiskEngineError("At least one weight must be non-zero.")

    risk_raw = sum(float(factor["contribution"]) for factor in factors) / total_weight
    risk_score = max(0.0, min(1.0, risk_raw))

    if risk_score < 0.33:
        risk_level = "low"
    elif risk_score < 0.66:
        risk_level = "medium"
    else:
        risk_level = "high"

    top_factors = sorted(
        factors,
        key=lambda factor: (-abs(float(factor["contribution"])), str(factor["column"])),
    )[:3]

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "explain": {"record_count": len(records), "top_factors": top_factors},
    }

