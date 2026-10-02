"""Rate-limiter unit tests.

Exercises the real `ai-server/utils/ratelimit.py` — budget arithmetic, per-key
isolation, the 429 + Retry-After contract, and identity resolution.

Run:  pytest tests/ai/test_ratelimit.py
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from utils.ratelimit import FixedWindowLimiter, limiter


class FakeRequest:
    """Stand-in for starlette's Request.

    The limiter only touches ``state.auth_user`` and ``client.host``.
    """

    def __init__(self, host: str = "10.0.0.9", auth_user: dict | None = None) -> None:
        self.state = type("S", (), {"auth_user": auth_user})()
        self.client = type("C", (), {"host": host})()


def run(coro):
    return asyncio.run(coro)


class TestFixedWindow:
    def test_allows_exactly_the_budget(self):
        gate = FixedWindowLimiter(limit=3, window_seconds=60, name="t")
        assert [gate.check("k")[0] for _ in range(3)] == [True, True, True]

    def test_rejects_over_budget(self):
        gate = FixedWindowLimiter(limit=3, window_seconds=60, name="t")
        for _ in range(3):
            gate.check("k")
        allowed, retry_after = gate.check("k")
        assert allowed is False
        assert retry_after > 0

    def test_first_hit_is_not_silently_discarded(self):
        """A fresh key must anchor its window, not inherit an elapsed one.

        Regression: a brand-new key kept a stale reset timestamp, so hit #1 was
        allowed and hit #2 silently reset the counter — the first request of
        every window went uncounted.
        """
        gate = FixedWindowLimiter(limit=1, window_seconds=60, name="t")
        assert gate.check("fresh")[0] is True
        assert gate.check("fresh")[0] is False, "second hit must be rejected"

    def test_budgets_are_per_key(self):
        gate = FixedWindowLimiter(limit=2, window_seconds=60, name="t")
        for _ in range(2):
            gate.check("a")
        assert gate.check("a")[0] is False
        assert gate.check("b")[0] is True

    def test_expired_window_reopens(self, monkeypatch):
        gate = FixedWindowLimiter(limit=1, window_seconds=10, name="t")
        assert gate.check("k")[0] is True
        assert gate.check("k")[0] is False

        import utils.ratelimit as rl

        real_time = rl.time.time()
        monkeypatch.setattr(rl.time, "time", lambda: real_time + 11)
        assert gate.check("k")[0] is True, "window should have rolled over"


class TestDependency:
    def test_keys_on_authenticated_subject(self):
        """One user's budget follows them across IPs, not the reverse."""
        dep = limiter(2, 60, "t")
        user = {"id": "user-1"}
        run(dep(FakeRequest("1.1.1.1", user)))
        run(dep(FakeRequest("2.2.2.2", user)))
        with pytest.raises(HTTPException) as exc:
            run(dep(FakeRequest("3.3.3.3", user)))
        assert exc.value.status_code == 429
        assert "retry-after" in {h.lower() for h in exc.value.headers}

    def test_falls_back_to_ip(self):
        dep = limiter(1, 60, "t")
        run(dep(FakeRequest("9.9.9.9")))
        with pytest.raises(HTTPException) as exc:
            run(dep(FakeRequest("9.9.9.9")))
        assert exc.value.status_code == 429
        run(dep(FakeRequest("8.8.8.8")))  # different IP, unaffected

    def test_retry_after_is_a_positive_integer(self):
        dep = limiter(1, 60, "t")
        run(dep(FakeRequest("7.7.7.7")))
        with pytest.raises(HTTPException) as exc:
            run(dep(FakeRequest("7.7.7.7")))
        retry = int(exc.value.headers["Retry-After"])
        assert 1 <= retry <= 60


class TestProductionLimits:
    """The limiters wired into main.py must stay sane.

    `limiter()` returns a FastAPI dependency; the configured budget hangs off
    it as `.gate` so these can be asserted without hitting HTTP.
    """

    def _gates(self):
        from utils.ratelimit import (
            analytics_rate_limit,
            face_rate_limit,
            session_rate_limit,
        )

        return {
            "face": face_rate_limit.gate,
            "analytics": analytics_rate_limit.gate,
            "session": session_rate_limit.gate,
        }

    def test_face_budget_is_tight(self):
        assert self._gates()["face"].limit <= 20, (
            "face verify runs InsightFace per call; keep the budget tight"
        )

    def test_every_limiter_is_configured(self):
        for name, gate in self._gates().items():
            assert gate.name == name
            assert gate.limit > 0
            assert gate.window > 0

    def test_analytics_is_looser_than_face(self):
        gates = self._gates()
        assert gates["analytics"].limit > gates["face"].limit
