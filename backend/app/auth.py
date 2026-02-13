from __future__ import annotations

import os

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.types import ASGIApp


def auth_enabled() -> bool:
    value = os.getenv("FIREGUARD_AUTH_ENABLED", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def expected_api_key() -> str:
    return os.getenv("FIREGUARD_API_KEY", "")


class ApiKeyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: StarletteRequest, call_next):
        if not auth_enabled():
            return await call_next(request)

        if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
            return await call_next(request)

        provided = request.headers.get("X-API-Key")
        if not expected_api_key() or provided != expected_api_key():
            return JSONResponse(status_code=401, content={"detail": "Invalid or missing X-API-Key"})
        return await call_next(request)
