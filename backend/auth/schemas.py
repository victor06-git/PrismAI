"""
auth/schemas.py

Pydantic contracts for PrismAI's QR-based, passwordless auth flow:
register -> create QR session -> mobile scan/approve -> desktop poll -> JWT.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

QRSessionStatus = Literal["WAITING_SCAN", "APPROVED", "EXPIRED"]


class RegisterRequest(BaseModel):
    email: EmailStr = Field(description="Unique account identifier.")
    name: str = Field(min_length=1, description="Display name.")


class UserOut(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    created_at: datetime


class QRSessionCreateResponse(BaseModel):
    session_id: str
    nonce: str = Field(description="Embed this (with session_id) in the rendered QR code.")
    status: QRSessionStatus
    expires_at: datetime


class QRSessionScanRequest(BaseModel):
    session_id: str
    nonce: str = Field(description="Nonce read from the scanned QR payload — proves a genuine scan.")
    user_id: str = Field(description="The authenticated mobile user approving this login.")


class QRSessionScanResponse(BaseModel):
    session_id: str
    status: QRSessionStatus


class QRSessionPollResponse(BaseModel):
    status: QRSessionStatus
    access_token: str | None = Field(default=None, description="Set only once status is APPROVED.")
    token_type: Literal["bearer"] | None = None
    user: UserOut | None = Field(default=None, description="Set only once status is APPROVED.")
    expires_at: datetime
