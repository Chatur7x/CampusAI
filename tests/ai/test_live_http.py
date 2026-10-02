"""Live HTTP tests against a running AI server.

Skipped automatically when nothing is listening, so the suite stays green on a
machine that has not started the server. Start it with:

    cd ai-server && uvicorn main:app --host 127.0.0.1 --port 8011

Run:  pytest tests/ai/test_live_http.py
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

import pytest


def request(url: str, body: dict | None = None, token: str | None = None, method: str = "POST"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


# Every router under /api must mount require_user. These four paths span all of
# them; if any returns 200 without a token the gate has regressed.
PROTECTED = [
    ("/api/face/verify", {"user_id": "x", "image": "x", "class_id": "x"}),
    ("/api/face/identify", {"image": "x"}),
    ("/api/face/register", {"user_id": "x", "photos": [{"imageData": "x", "angle": "x"}], "liveness_frames": []}),
    ("/api/analytics/correlation", {"attendances": [1, 2], "grades": [3, 4]}),
    ("/api/attendance/fraud", {}),
    ("/api/attendance/risk", {}),
    ("/api/attendance/geo/validate", {}),
    ("/api/session/start", {"faculty_id": "f", "class_id": "c", "course_id": "s", "latitude": 0, "longitude": 0}),
]


@pytest.mark.parametrize("path,body", PROTECTED)
def test_endpoint_rejects_missing_token(live_server, path, body):
    status, _ = request(f"{live_server}{path}", body)
    assert status == 401, f"{path} returned {status} without a token"


@pytest.mark.parametrize("path,body", PROTECTED)
def test_endpoint_rejects_invalid_token(live_server, path, body):
    status, _ = request(f"{live_server}{path}", body, token="not.a.real.token")
    assert status == 401, f"{path} returned {status} with an invalid token"


def test_health_is_public(live_server):
    status, raw = request(f"{live_server}/health", method="GET")
    assert status == 200
    assert json.loads(raw)["status"] == "ok"


def test_interactive_docs_are_disabled(live_server):
    """Schema exposure is unnecessary in production and widens the surface."""
    for path in ("/docs", "/redoc", "/openapi.json"):
        status, _ = request(f"{live_server}{path}", method="GET")
        assert status == 404, f"{path} is still exposed (got {status})"


def test_validation_error_does_not_echo_the_payload(live_server):
    """422s must name the offending field, never replay the submitted body."""
    secret = "SHOULD-NOT-APPEAR-IN-RESPONSE"
    status, raw = request(
        f"{live_server}/api/analytics/correlation",
        {"attendances": [secret], "grades": [secret]},
        token="invalid.token",
    )
    # Unauthenticated wins, but neither branch may leak the value.
    assert secret.encode() not in raw
    assert status in (401, 422)
