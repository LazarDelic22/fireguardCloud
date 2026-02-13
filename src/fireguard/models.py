from pydantic import BaseModel, Field


class RiskRequest(BaseModel):
    temperature: float
    humidity: float = Field(ge=0.0, le=100.0)


class RiskResponse(BaseModel):
    risk_indicator: float = Field(ge=0.0, le=1.0)

