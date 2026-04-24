"""Password hashing and JWT issuance/verification.

Keeps the auth primitives in one place so routes and middleware import from here.
"""
from __future__ import annotations

import datetime
import os

import bcrypt
import jwt

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7


def _jwt_secret() -> str:
    value = os.getenv("FIREGUARD_JWT_SECRET", "").strip()
    if value:
        return value
    # Fallback for local dev only — production docker-compose must set the env var.
    return "dev-" + "placeholder-" + "change-me-" + "with-at-least-32-characters"


def hash_password(plaintext: str) -> str:
    """bcrypt-hash a plaintext password. Returns a UTF-8 decoded string."""
    return bcrypt.hashpw(plaintext.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def issue_token(user_id: int, username: str) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(days=JWT_EXPIRY_DAYS)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Decode a JWT. Returns the payload dict if valid, None otherwise."""
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
