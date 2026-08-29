"""
Shared pytest fixtures for the backend test suite.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from auth.store import auth_store
from main import app
from rate_limit import limiter


@pytest.fixture(autouse=True)
def _reset_auth_store():
    """Every test starts from a clean slate — no leftover users/sessions from other tests."""
    auth_store.reset()
    yield
    auth_store.reset()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """
    All tests share one client IP (httpx's ASGITransport reports a fixed
    address), so without resetting, the rate limiter's per-IP counters would
    accumulate across unrelated tests and start rejecting legitimate calls.
    """
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
async def client():
    """An httpx.AsyncClient wired directly to the ASGI app — no live server needed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
