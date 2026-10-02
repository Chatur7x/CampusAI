# =============================================================
# Rate limiting  (ai-server/utils/ratelimit.py)
# =============================================================
"""In-process fixed-window rate limiting for the AI server.

Written in-house rather than pulling in ``slowapi`` so the server keeps its
current dependency set. The store is per-process, which is correct for a
single-worker uvicorn deployment; a multi-replica deployment would need a
shared backend (Redis) instead.

Keyed by authenticated user id when a token is present, falling back to the
client IP, so one noisy student cannot exhaust the budget of everyone behind
the same NAT.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable

from fastapi import HTTPException, Request, status

logger = logging.getLogger("campusai.ratelimit")

_MAX_KEYS = 10_000


class FixedWindowLimiter:
    """Thread-safe fixed-window counter keyed by string."""

    def __init__(self, limit: int, window_seconds: int, name: str) -> None:
        self.limit = limit
        self.window = window_seconds
        self.name = name
        self._hits: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()

    def _prune(self, now: float) -> None:
        if len(self._hits) <= _MAX_KEYS:
            return
        for key, (_, reset) in list(self._hits.items()):
            if now > reset:
                del self._hits[key]

    def check(self, key: str) -> tuple[bool, int]:
        """Return ``(allowed, retry_after_seconds)`` and count the hit."""
        now = time.time()
        with self._lock:
            self._prune(now)
            entry = self._hits.get(key)

            # No entry, or the window has elapsed: open a fresh one. The reset
            # must be anchored to `now` here, otherwise a brand-new key keeps a
            # stale (already-elapsed) reset timestamp and its first hit is
            # silently discarded by the next call.
            if entry is None or now >= entry[1]:
                entry = (0, now + self.window)

            count = entry[0] + 1
            self._hits[key] = (count, entry[1])

            if count > self.limit:
                return False, max(1, int(entry[1] - now))
        return True, 0


def _identity(request: Request) -> str:
    """Prefer the authenticated subject; fall back to the caller IP."""
    state = getattr(request.state, "auth_user", None)
    if isinstance(state, dict) and state.get("id"):
        return f"user:{state['id']}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def limiter(limit: int, window_seconds: int, name: str) -> Callable:
    """Build a FastAPI dependency enforcing ``limit`` hits per window."""

    gate = FixedWindowLimiter(limit, window_seconds, name)

    async def dependency(request: Request) -> None:
        allowed, retry_after = gate.check(_identity(request))
        if not allowed:
            logger.warning(
                "[ratelimit] %s exceeded for %s (%d/%d per %ds)",
                name, _identity(request), gate.limit, gate.limit, gate.window,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests — please slow down",
                headers={"Retry-After": str(retry_after)},
            )

    # Expose the gate so operators and tests can inspect the configured budget.
    dependency.gate = gate  # type: ignore[attr-defined]
    return dependency


# Face verify/identify are the expensive, abuse-prone endpoints (each call can
# run InsightFace). Staff-facing analytics and model operations get a looser
# budget; the health check is exempt (registered without this dependency).
face_rate_limit = limiter(10, 60, "face")            # 10 req/min per user
analytics_rate_limit = limiter(60, 60, "analytics")  # 60 req/min per user
session_rate_limit = limiter(20, 60, "session")      # 20 req/min per user
