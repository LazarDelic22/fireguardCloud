from __future__ import annotations

import datetime
from typing import Any

import httpx

# MET Norway Locationforecast 2.0 API
_MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
# MET requires a descriptive User-Agent — include project name and contact
_USER_AGENT = "FireGuardCloud/1.0 github.com/LazarDelic22/fireguardCloud"


class MetServiceError(RuntimeError):
    pass


def fetch_forecast(lat: float, lon: float, hours: int = 48) -> list[dict[str, Any]]:
    """Fetch weather forecast from MET Norway for the given coordinates.

    Returns a list of dicts with keys: timestamp, temperature, humidity, wind_speed.
    Raises MetServiceError if the request fails or the response is unexpected.
    """
    params = {
        "lat": round(lat, 4),
        "lon": round(lon, 4),
    }
    headers = {"User-Agent": _USER_AGENT}

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(_MET_URL, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise MetServiceError(
            f"MET API returned HTTP {exc.response.status_code}"
        ) from exc
    except httpx.RequestError as exc:
        raise MetServiceError(f"Could not reach MET API: {exc}") from exc

    try:
        timeseries = payload["properties"]["timeseries"]
    except (KeyError, TypeError) as exc:
        raise MetServiceError("Unexpected MET API response format.") from exc

    points: list[dict[str, Any]] = []
    for entry in timeseries[:hours]:
        try:
            details = entry["data"]["instant"]["details"]
            timestamp = datetime.datetime.fromisoformat(
                entry["time"].replace("Z", "+00:00")
            )
            points.append(
                {
                    "timestamp": timestamp,
                    "temperature": float(details["air_temperature"]),
                    "humidity": float(details["relative_humidity"]),
                    "wind_speed": float(details["wind_speed"]),
                }
            )
        except (KeyError, ValueError):
            # Skip entries with missing fields rather than failing the whole request
            continue

    if not points:
        raise MetServiceError("MET API returned no usable forecast data.")

    return points
