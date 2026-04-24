"""Auth middleware.

Accepts either:
  - Authorization: Bearer <jwt>        (user-level, issued by /auth/login)
  - X-API-Key: <FIREGUARD_API_KEY>     (service-level, legacy)

Fails closed: if auth is enabled but no API key is configured AND the request
doesn't carry a valid JWT, the request is rejected (never silently allowed).
"""
from __future__ import annotations

import os

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.types import ASGIApp

from app.security import verify_token

# Paths that remain reachable without any credential.
#   /health               — container orchestrator / CI health checks
#   /docs, /redoc, ...    — interactive API browser
#   /events               — SSE stream (EventSource cannot set custom headers)
#   /auth/register, /login — obviously must be reachable to create a session
EXEMPT_PATHS: frozenset[str] = frozenset({
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/events",
    "/auth/register",
    "/auth/login",
    "/watchlist",
})


def auth_enabled() -> bool:
    value = os.getenv("FIREGUARD_AUTH_ENABLED", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def expected_api_key() -> str:
    return os.getenv("FIREGUARD_API_KEY", "")


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Accepts Bearer JWT or X-API-Key. Named for history; now dual-purpose."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: StarletteRequest, call_next):
        if not auth_enabled():
            return await call_next(request)

        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        # --- 1. Bearer JWT --------------------------------------------------
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            payload = verify_token(token)
            if payload is not None:
                # Attach the verified user id to the request for downstream handlers.
                request.state.user_id = int(payload["sub"])
                request.state.username = payload.get("username")
                return await call_next(request)

        # --- 2. Legacy X-API-Key --------------------------------------------
        configured = expected_api_key()
        provided = request.headers.get("X-API-Key")
        if configured and provided == configured:
            return await call_next(request)

        # --- 3. Fail closed --------------------------------------------------
        if not configured and not auth_header:
            # No JWT and no API key configured on the server -> misconfigured server.
            return JSONResponse(
                status_code=500,
                content={
                    "detail": (
                        "Server misconfigured: neither JWT nor X-API-Key accepted. "
                        "Set FIREGUARD_API_KEY or log in via /auth/login."
                    )
                },
            )
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing credentials"},
        )
