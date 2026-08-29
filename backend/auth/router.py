"""
auth/router.py

QR-based, passwordless auth flow (WhatsApp-Web-style "scan to log in"):

  1. POST /api/auth/register            — create a user account (email + name).
  2. POST /api/auth/qr-session/create     — desktop asks for a login QR (session_id + nonce, WAITING_SCAN).
  3. POST /api/auth/qr-session/scan        — mobile "scans" the QR and approves it as a known user.
  4. GET  /api/auth/qr-session/poll         — desktop polls until APPROVED, then receives a JWT.
"""

from fastapi import APIRouter, HTTPException

from .schemas import (
    QRSessionCreateResponse,
    QRSessionPollResponse,
    QRSessionScanRequest,
    QRSessionScanResponse,
    RegisterRequest,
    UserOut,
)
from .security import QR_SESSION_TTL_SECONDS, create_access_token
from .store import (
    DuplicateEmailError,
    InvalidNonceError,
    SessionAlreadyApprovedError,
    SessionExpiredError,
    SessionNotFoundError,
    auth_store,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(user) -> UserOut:
    return UserOut(user_id=user.user_id, email=user.email, name=user.name, created_at=user.created_at)


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: RegisterRequest) -> UserOut:
    """Create a user account. 409 on duplicate email; 422 on a malformed payload (handled by Pydantic)."""
    try:
        user = auth_store.create_user(email=payload.email, name=payload.name)
    except DuplicateEmailError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _user_out(user)


@router.post("/qr-session/create", response_model=QRSessionCreateResponse, status_code=201)
async def create_qr_session() -> QRSessionCreateResponse:
    """Desktop calls this to start a login attempt; render session_id+nonce as a QR code."""
    session = auth_store.create_qr_session(ttl_seconds=QR_SESSION_TTL_SECONDS)
    return QRSessionCreateResponse(
        session_id=session.session_id,
        nonce=session.nonce,
        status=session.status,
        expires_at=session.expires_at,
    )


@router.post("/qr-session/scan", response_model=QRSessionScanResponse)
async def scan_qr_session(payload: QRSessionScanRequest) -> QRSessionScanResponse:
    """
    Mobile calls this after scanning the QR, approving the login as `user_id`.
    Issues the JWT immediately so a session maps to exactly one token.
    """
    user = auth_store.get_user(payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User '{payload.user_id}' not found.")

    access_token = create_access_token(user_id=user.user_id, session_id=payload.session_id)
    try:
        session = auth_store.approve_qr_session(
            session_id=payload.session_id,
            nonce=payload.nonce,
            user_id=user.user_id,
            access_token=access_token,
        )
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="QR session not found.") from exc
    except SessionExpiredError as exc:
        raise HTTPException(status_code=410, detail="QR session has expired.") from exc
    except SessionAlreadyApprovedError as exc:
        raise HTTPException(status_code=409, detail="QR session was already approved.") from exc
    except InvalidNonceError as exc:
        raise HTTPException(status_code=400, detail="Invalid session nonce.") from exc

    return QRSessionScanResponse(session_id=session.session_id, status=session.status)


@router.get("/qr-session/poll", response_model=QRSessionPollResponse)
async def poll_qr_session(sessionId: str) -> QRSessionPollResponse:
    """Desktop polls this on an interval. Returns the JWT + user once status is APPROVED."""
    session = auth_store.get_qr_session(sessionId)
    if session is None:
        raise HTTPException(status_code=404, detail="QR session not found.")

    if session.status == "APPROVED":
        user = auth_store.get_user(session.user_id)
        return QRSessionPollResponse(
            status="APPROVED",
            access_token=session.access_token,
            token_type="bearer",
            user=_user_out(user),
            expires_at=session.expires_at,
        )

    return QRSessionPollResponse(status=session.status, expires_at=session.expires_at)
