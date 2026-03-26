from __future__ import annotations

import datetime
import sys
from pathlib import Path
from typing import Any

# Try to import the provided FRCM library.
# In Docker the src folder is copied and PYTHONPATH is set.
# In local dev we locate the submodule and add it to the path.
try:
    from frcm.datamodel.model import FireRiskPrediction, WeatherData, WeatherDataPoint
    from frcm.fireriskmodel.compute import compute as _frcm_compute
except ImportError:
    # __file__ is backend/app/frcm_service.py → parents[2] is the project root
    _frcm_src = (
        Path(__file__).resolve().parents[2]
        / "third_party"
        / "dynamic-frcm-simple"
        / "src"
    )
    if not _frcm_src.exists():
        raise ImportError(
            f"FRCM library not found. Expected at: {_frcm_src}\n"
            "Run: pip install third_party/dynamic-frcm-simple"
        )
    sys.path.insert(0, str(_frcm_src))
    from frcm.datamodel.model import FireRiskPrediction, WeatherData, WeatherDataPoint
    from frcm.fireriskmodel.compute import compute as _frcm_compute


# TTF (time to flashover) thresholds in hours.
# Lower TTF = higher fire risk. These are tuned to the model's typical output range.
_TTF_HIGH = 3.0    # below this -> high risk
_TTF_MEDIUM = 5.0  # below this -> medium risk
_TTF_MAX = 10.0    # used to normalise score to [0, 1]


def run_frcm(weather_points: list[dict[str, Any]]) -> dict[str, Any]:
    """Run the provided FRCM model on a list of weather data points.

    Each point must have: timestamp (datetime), temperature (°C),
    humidity (% relative), wind_speed (m/s).

    Returns a dict with: risk_score, risk_level, explain.
    """
    if len(weather_points) < 2:
        raise ValueError("At least 2 weather data points are required for FRCM.")

    # Build the WeatherData object the model expects
    data_points = [
        WeatherDataPoint(
            timestamp=p["timestamp"],
            temperature=p["temperature"],
            humidity=p["humidity"],
            wind_speed=p["wind_speed"],
        )
        for p in weather_points
    ]
    weather_data = WeatherData(data=data_points)

    prediction: FireRiskPrediction = _frcm_compute(weather_data)

    if not prediction.firerisks:
        raise ValueError("FRCM returned an empty prediction.")

    ttf_values = [fr.ttf for fr in prediction.firerisks]
    min_ttf = min(ttf_values)
    mean_ttf = sum(ttf_values) / len(ttf_values)

    # Map TTF to a 0–1 risk score (higher score = higher risk)
    risk_score = max(0.0, min(1.0, 1.0 - (min_ttf / _TTF_MAX)))

    if min_ttf < _TTF_HIGH:
        risk_level = "high"
    elif min_ttf < _TTF_MEDIUM:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Build a short summary of the TTF series for the explain field
    ttf_preview = [
        {"timestamp": fr.timestamp.isoformat(), "ttf": round(fr.ttf, 3)}
        for fr in prediction.firerisks[:6]
    ]

    explain: dict[str, Any] = {
        "record_count": len(weather_points),
        "top_factors": [],  # FRCM is a physics model; factor breakdown not applicable
        "model": "dynamic-frcm-simple",
        "min_ttf_hours": round(min_ttf, 3),
        "mean_ttf_hours": round(mean_ttf, 3),
        "ttf_preview": ttf_preview,
    }

    return {
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "explain": explain,
    }
