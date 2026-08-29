"""
Pytest suite for PrismAI's QR-based, passwordless auth flow
(register -> create QR session -> mobile scan -> desktop poll -> JWT).

Run with:
    cd backend
    pip install -r requirements.txt
    pytest tests/test_auth_flow.py -v

Uses httpx.AsyncClient against the ASGI app directly (see tests/conftest.py) —
no server process needs to be running. asyncio_mode=auto (pytest.ini) means
`async def test_...` just works without individual @pytest.mark.asyncio marks.
"""

from datetime import datetime, timedelta, timezone

import pytest

from auth.security import decode_access_token
from auth.store import auth_store

AUTH = "/api/auth"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register(client, email="alice@example.com", name="Alice") -> dict:
    response = await client.post(f"{AUTH}/register", json={"email": email, "name": name})
    assert response.status_code == 201, response.text
    return response.json()


async def create_qr_session(client) -> dict:
    response = await client.post(f"{AUTH}/qr-session/create")
    assert response.status_code == 201, response.text
    return response.json()


async def scan(client, session: dict, user_id: str, nonce: str | None = None):
    return await client.post(
        f"{AUTH}/qr-session/scan",
        json={"session_id": session["session_id"], "nonce": nonce or session["nonce"], "user_id": user_id},
    )


async def poll(client, session_id: str):
    return await client.get(f"{AUTH}/qr-session/poll", params={"sessionId": session_id})


def expire(session: dict) -> None:
    """Reach into the shared in-memory store and force a session into the past — no real sleeping."""
    stored = auth_store.get_qr_session(session["session_id"])
    stored.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)


# ---------------------------------------------------------------------------
# 1. User registration
# ---------------------------------------------------------------------------


class TestRegistration:
    async def test_register_success(self, client):
        body = await register(client, email="new.user@prismai.dev", name="New User")
        assert body["email"] == "new.user@prismai.dev"
        assert body["name"] == "New User"
        assert body["user_id"]
        assert "created_at" in body

    async def test_register_duplicate_email_rejected(self, client):
        await register(client, email="dupe@prismai.dev", name="First")
        response = await client.post(f"{AUTH}/register", json={"email": "dupe@prismai.dev", "name": "Second"})
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"].lower()

    async def test_register_duplicate_email_is_case_insensitive(self, client):
        await register(client, email="Case@Prismai.dev", name="First")
        response = await client.post(f"{AUTH}/register", json={"email": "case@prismai.dev", "name": "Second"})
        assert response.status_code == 409

    @pytest.mark.parametrize(
        "payload",
        [
            {"email": "not-an-email", "name": "Someone"},  # malformed email
            {"email": "missing-name@prismai.dev"},  # missing required field
            {"name": "No Email"},  # missing required field
            {"email": "empty-name@prismai.dev", "name": ""},  # empty name
            {},  # empty payload
        ],
        ids=["bad-email-format", "missing-name", "missing-email", "empty-name", "empty-payload"],
    )
    async def test_register_invalid_payload_rejected(self, client, payload):
        response = await client.post(f"{AUTH}/register", json=payload)
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# 2. QR session lifecycle
# ---------------------------------------------------------------------------


class TestQRSessionLifecycle:
    async def test_create_qr_session_returns_session_id_nonce_and_waiting_scan(self, client):
        body = await create_qr_session(client)
        assert body["status"] == "WAITING_SCAN"
        assert body["session_id"]
        assert body["nonce"]
        assert len(body["nonce"]) >= 16  # not a trivially guessable token
        assert "expires_at" in body

    async def test_create_qr_session_ids_and_nonces_are_unique(self, client):
        first = await create_qr_session(client)
        second = await create_qr_session(client)
        assert first["session_id"] != second["session_id"]
        assert first["nonce"] != second["nonce"]

    async def test_poll_waiting_session_returns_pending(self, client):
        session = await create_qr_session(client)
        response = await poll(client, session["session_id"])
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "WAITING_SCAN"
        assert body["access_token"] is None
        assert body["user"] is None

    async def test_poll_unknown_session_returns_404(self, client):
        response = await poll(client, "does-not-exist")
        assert response.status_code == 404

    async def test_scan_with_valid_user_approves_session(self, client):
        user = await register(client, email="scanner@prismai.dev", name="Scanner")
        session = await create_qr_session(client)

        response = await scan(client, session, user["user_id"])

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "APPROVED"
        assert body["session_id"] == session["session_id"]

    async def test_poll_after_approval_returns_jwt_and_user(self, client):
        user = await register(client, email="poller@prismai.dev", name="Poller")
        session = await create_qr_session(client)
        await scan(client, session, user["user_id"])

        response = await poll(client, session["session_id"])

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "APPROVED"
        assert body["token_type"] == "bearer"
        assert body["user"]["user_id"] == user["user_id"]
        assert body["user"]["email"] == user["email"]
        assert body["access_token"]

        # The token itself must be a real, valid JWT scoped to this user/session.
        claims = decode_access_token(body["access_token"])
        assert claims["sub"] == user["user_id"]
        assert claims["session_id"] == session["session_id"]
        assert "exp" in claims

    async def test_poll_is_idempotent_after_approval(self, client):
        """Repeated polling (e.g. a missed response) should keep returning the same token."""
        user = await register(client, email="idempotent@prismai.dev", name="Idempotent")
        session = await create_qr_session(client)
        await scan(client, session, user["user_id"])

        first = await poll(client, session["session_id"])
        second = await poll(client, session["session_id"])
        assert first.json()["access_token"] == second.json()["access_token"]


# ---------------------------------------------------------------------------
# 3. Edge cases & security
# ---------------------------------------------------------------------------


class TestExpiryAndReplayProtection:
    async def test_expired_session_poll_returns_expired(self, client):
        session = await create_qr_session(client)
        expire(session)

        response = await poll(client, session["session_id"])

        assert response.status_code == 200
        assert response.json()["status"] == "EXPIRED"

    async def test_scan_on_expired_session_rejected(self, client):
        user = await register(client, email="late.scanner@prismai.dev", name="Late Scanner")
        session = await create_qr_session(client)
        expire(session)

        response = await scan(client, session, user["user_id"])

        assert response.status_code == 410
        assert "expired" in response.json()["detail"].lower()

    async def test_replay_scan_on_already_approved_session_rejected(self, client):
        """A session that was already approved can't be approved (scanned) again."""
        user = await register(client, email="replay@prismai.dev", name="Replay")
        session = await create_qr_session(client)

        first = await scan(client, session, user["user_id"])
        assert first.status_code == 200

        second = await scan(client, session, user["user_id"])
        assert second.status_code == 409
        assert "already" in second.json()["detail"].lower()

    async def test_replayed_scan_does_not_change_the_issued_token(self, client):
        """Even if a replay slipped through, polling should keep serving the original token."""
        user = await register(client, email="replay-token@prismai.dev", name="Replay Token")
        session = await create_qr_session(client)
        await scan(client, session, user["user_id"])
        original_token = (await poll(client, session["session_id"])).json()["access_token"]

        await scan(client, session, user["user_id"])  # rejected (409), asserted elsewhere

        assert (await poll(client, session["session_id"])).json()["access_token"] == original_token

    async def test_scan_with_wrong_nonce_rejected(self, client):
        """Prevents approving a session from a QR payload that wasn't actually scanned."""
        user = await register(client, email="badnonce@prismai.dev", name="Bad Nonce")
        session = await create_qr_session(client)

        response = await scan(client, session, user["user_id"], nonce="totally-wrong-nonce")

        assert response.status_code == 400

    async def test_scan_with_unknown_user_rejected(self, client):
        session = await create_qr_session(client)
        response = await scan(client, session, user_id="ghost-user-id")
        assert response.status_code == 404

    async def test_scan_on_unknown_session_rejected(self, client):
        user = await register(client, email="noone@prismai.dev", name="No One")
        response = await client.post(
            f"{AUTH}/qr-session/scan",
            json={"session_id": "does-not-exist", "nonce": "whatever", "user_id": user["user_id"]},
        )
        assert response.status_code == 404
