"""
auth/security.py

JWT signing/verification for PrismAI's QR-based auth flow, plus the
env-driven timing knobs (token lifetime, QR session TTL).
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

logger = logging.getLogger("prismai.auth")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
QR_SESSION_TTL_SECONDS = int(os.getenv("QR_SESSION_TTL_SECONDS", "300"))

_configured_secret = os.getenv("JWT_SECRET_KEY")
if _configured_secret:
    JWT_SECRET_KEY = _configured_secret
else:
    JWT_SECRET_KEY = secrets.token_hex(32)
    logger.warning(
        "JWT_SECRET_KEY is not set — using a random ephemeral secret for this process. "
        "Tokens won't validate after a restart or across multiple workers. "
        "Set JWT_SECRET_KEY in .env for a stable secret."
    )


def create_access_token(*, user_id: str, session_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "session_id": session_id,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError (or a subclass, e.g. ExpiredSignatureError) if invalid/expired."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
