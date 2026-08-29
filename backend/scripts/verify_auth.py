#!/usr/bin/env python3
"""
Interactive, human-readable smoke test for PrismAI's QR-based auth flow.

Runs the full register -> create QR session -> mobile scan -> desktop poll
flow against a *running* server and prints a green/red status line per step,
ending with the final JWT so you can eyeball it.

Usage:
    # terminal 1
    cd backend && uvicorn main:app --reload --port 8000

    # terminal 2
    cd backend && python scripts/verify_auth.py

Env:
    PRISMAI_API_BASE_URL   defaults to http://localhost:8000
"""

from __future__ import annotations

import os
import sys
import time
import uuid

import httpx

BASE_URL = os.getenv("PRISMAI_API_BASE_URL", "http://localhost:8000").rstrip("/")
AUTH = f"{BASE_URL}/api/auth"

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

_failures: list[str] = []


def ok(step: str, detail: str = "") -> None:
    print(f"{GREEN}✔ {step}{RESET}" + (f"  {detail}" if detail else ""))


def fail(step: str, detail: str) -> None:
    _failures.append(step)
    print(f"{RED}✘ {step}{RESET}  {detail}")


def info(message: str) -> None:
    print(f"{YELLOW}… {message}{RESET}")


def header(title: str) -> None:
    print(f"\n{BOLD}{title}{RESET}")


def die(step: str, detail: str) -> None:
    fail(step, detail)
    print(f"\n{RED}{BOLD}Verification FAILED at: {step}{RESET}\n")
    sys.exit(1)


def main() -> None:
    print(f"{BOLD}PrismAI — QR auth flow verification{RESET}")
    print(f"Target: {BASE_URL}")

    with httpx.Client(timeout=10.0) as client:
        # 0. Health check ----------------------------------------------------
        header("0. Health check")
        try:
            response = client.get(f"{BASE_URL}/api/health")
        except httpx.RequestError as exc:
            die("GET /api/health", f"Could not reach {BASE_URL} — is uvicorn running? ({exc})")
        if response.status_code != 200:
            die("GET /api/health", f"HTTP {response.status_code}: {response.text}")
        ok("Server is up", str(response.json()))

        # 1. Register a test user --------------------------------------------
        header("1. Register test user")
        # A timestamp/uuid suffix keeps this script safely re-runnable against
        # the same live server (the in-memory store isn't reset between runs,
        # only between pytest cases) instead of always hitting 409 on the 2nd run.
        email = f"test_hackathon+{uuid.uuid4().hex[:8]}@prismai.dev"
        response = client.post(f"{AUTH}/register", json={"email": email, "name": "Hackathon Tester"})
        if response.status_code != 201:
            die("POST /api/auth/register", f"HTTP {response.status_code}: {response.text}")
        user = response.json()
        ok("User registered", f"user_id={user['user_id']}  email={user['email']}")

        # 2. Create a QR login session ---------------------------------------
        header("2. Create QR session")
        response = client.post(f"{AUTH}/qr-session/create")
        if response.status_code != 201:
            die("POST /api/auth/qr-session/create", f"HTTP {response.status_code}: {response.text}")
        session = response.json()
        if session["status"] != "WAITING_SCAN":
            die("POST /api/auth/qr-session/create", f"expected WAITING_SCAN, got {session['status']!r}")
        ok("QR session created", f"session_id={session['session_id']}")
        info("QR payload (what the desktop would render as a QR code):")
        print(f'    {{"sessionId": "{session["session_id"]}", "nonce": "{session["nonce"]}"}}')

        response = poll_once(client, session["session_id"])
        if response.status_code != 200 or response.json()["status"] != "WAITING_SCAN":
            fail("GET /api/auth/qr-session/poll (pre-scan)", f"HTTP {response.status_code}: {response.text}")
        else:
            ok("Poll confirms pending", "status=WAITING_SCAN")

        # 3. Simulate the mobile app scanning + approving --------------------
        header("3. Simulate mobile scan/approval")
        info("Pretending a phone scanned the QR and is approving as the registered user…")
        time.sleep(0.4)
        response = client.post(
            f"{AUTH}/qr-session/scan",
            json={"session_id": session["session_id"], "nonce": session["nonce"], "user_id": user["user_id"]},
        )
        if response.status_code != 200:
            die("POST /api/auth/qr-session/scan", f"HTTP {response.status_code}: {response.text}")
        scan_result = response.json()
        if scan_result["status"] != "APPROVED":
            die("POST /api/auth/qr-session/scan", f"expected APPROVED, got {scan_result['status']!r}")
        ok("Mobile approved the session", f"status={scan_result['status']}")

        # 4. Poll again — desktop should now receive the JWT -----------------
        header("4. Poll for the final token")
        response = poll_once(client, session["session_id"])
        if response.status_code != 200:
            die("GET /api/auth/qr-session/poll (post-scan)", f"HTTP {response.status_code}: {response.text}")
        final = response.json()
        if final["status"] != "APPROVED" or not final.get("access_token"):
            die("GET /api/auth/qr-session/poll (post-scan)", f"unexpected payload: {final}")
        ok("Desktop received the session", f"user={final['user']['email']}")
        print(f"\n{BOLD}Access token (JWT):{RESET}\n    {final['access_token']}\n")

        # 5. Bonus: confirm replay protection actually rejects a second scan.
        header("5. Replay-attack check")
        response = client.post(
            f"{AUTH}/qr-session/scan",
            json={"session_id": session["session_id"], "nonce": session["nonce"], "user_id": user["user_id"]},
        )
        if response.status_code == 409:
            ok("Re-scanning an approved session is correctly rejected", f"HTTP {response.status_code}")
        else:
            fail("Replay protection", f"expected HTTP 409, got {response.status_code}: {response.text}")

    print()
    if _failures:
        print(f"{RED}{BOLD}{len(_failures)} step(s) failed:{RESET} {', '.join(_failures)}\n")
        sys.exit(1)

    print(f"{GREEN}{BOLD}All auth endpoints are operational.{RESET}\n")


def poll_once(client: httpx.Client, session_id: str) -> httpx.Response:
    return client.get(f"{AUTH}/qr-session/poll", params={"sessionId": session_id})


if __name__ == "__main__":
    main()
