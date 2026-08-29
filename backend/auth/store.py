"""
auth/store.py

In-memory data store for PrismAI's QR-based auth demo: registered users and
QR login sessions.

Deliberately NOT backed by a real database — this is a 12-hour hackathon
feature. Swap this module for Postgres/SQLite/Redis later without touching
router.py's business logic, since everything else only talks to AuthStore's
methods. A single shared instance (`auth_store`) is used app-wide; tests call
`.reset()` between runs (see tests/conftest.py) and reach directly into
`get_qr_session(...)` to mutate `expires_at` for expiry simulation.
"""

import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DuplicateEmailError(Exception):
    """Raised on POST /api/auth/register when the email is already taken."""


class SessionNotFoundError(Exception):
    """Raised when a session_id doesn't correspond to any known QR session."""


class SessionExpiredError(Exception):
    """Raised when trying to approve a QR session past its expires_at."""


class SessionAlreadyApprovedError(Exception):
    """Raised when trying to approve a QR session a second time (replay)."""


class InvalidNonceError(Exception):
    """Raised when the scan's nonce doesn't match the session's — tampering/wrong QR."""


@dataclass
class User:
    user_id: str
    email: str
    name: str
    created_at: datetime


@dataclass
class QRSession:
    session_id: str
    nonce: str
    status: str  # "WAITING_SCAN" | "APPROVED" | "EXPIRED"
    created_at: datetime
    expires_at: datetime
    user_id: str | None = None
    access_token: str | None = None
    approved_at: datetime | None = None


class AuthStore:
    """Thread-safe in-memory store for users + QR sessions."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._users_by_id: dict[str, User] = {}
        self._users_by_email: dict[str, str] = {}  # normalized email -> user_id
        self._sessions: dict[str, QRSession] = {}

    def reset(self) -> None:
        """Wipe all state. Used between test cases for isolation."""
        with self._lock:
            self._users_by_id.clear()
            self._users_by_email.clear()
            self._sessions.clear()

    # --- users ---------------------------------------------------------

    def create_user(self, email: str, name: str) -> User:
        email_key = email.strip().lower()
        with self._lock:
            if email_key in self._users_by_email:
                raise DuplicateEmailError(f"Email '{email}' is already registered.")
            user = User(user_id=str(uuid.uuid4()), email=email, name=name, created_at=utcnow())
            self._users_by_id[user.user_id] = user
            self._users_by_email[email_key] = user.user_id
            return user

    def get_user(self, user_id: str) -> User | None:
        return self._users_by_id.get(user_id)

    # --- QR sessions -----------------------------------------------------

    def create_qr_session(self, ttl_seconds: int) -> QRSession:
        now = utcnow()
        session = QRSession(
            session_id=str(uuid.uuid4()),
            nonce=token_urlsafe(24),
            status="WAITING_SCAN",
            created_at=now,
            expires_at=now + timedelta(seconds=ttl_seconds),
        )
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def get_qr_session(self, session_id: str) -> QRSession | None:
        """Fetch a session, lazily flipping it to EXPIRED if its TTL has passed."""
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if session.status == "WAITING_SCAN" and utcnow() >= session.expires_at:
            session.status = "EXPIRED"
        return session

    def approve_qr_session(self, session_id: str, nonce: str, user_id: str, access_token: str) -> QRSession:
        """
        Mark a session APPROVED for `user_id`, attaching the already-issued
        access_token. Raises on any state that shouldn't be approvable:
        unknown session, expired session, already-approved session (replay),
        or a nonce that doesn't match what /qr-session/create handed out.
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)
            if session.status == "WAITING_SCAN" and utcnow() >= session.expires_at:
                session.status = "EXPIRED"
            if session.status == "EXPIRED":
                raise SessionExpiredError(session_id)
            if session.status == "APPROVED":
                raise SessionAlreadyApprovedError(session_id)
            if session.nonce != nonce:
                raise InvalidNonceError(session_id)

            session.status = "APPROVED"
            session.user_id = user_id
            session.access_token = access_token
            session.approved_at = utcnow()
            return session


# Single shared instance for the whole app. For a multi-worker deployment,
# replace this with a real datastore (Redis/Postgres) behind the same
# interface — router.py never needs to change.
auth_store = AuthStore()
