from fastapi import FastAPI

from fireguard.main import calculate_risk_indicator
from fireguard.models import RiskRequest, RiskResponse

app = FastAPI(title="FireGuard API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/risk", response_model=RiskResponse)
def risk(payload: RiskRequest) -> RiskResponse:
    indicator = calculate_risk_indicator(
        temperature_c=payload.temperature,
        humidity_pct=payload.humidity,
    )
    return RiskResponse(risk_indicator=indicator)

