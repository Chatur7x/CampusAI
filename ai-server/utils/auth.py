# =============================================================
# Supabase JWT auth  (ai-server/utils/auth.py)
# =============================================================
"""Fail-closed authentication for the AI server.

Every /api/* router mounts with ``require_user`` so no endpoint is
anonymous. Tokens are the frontend's Supabase access JWTs, validated
against the live Auth API (no shared secret needed)::

    GET {SUPABASE_URL}/auth/v1/user  (apikey + Bearer token)

``require_self_or_staff`` additionally binds a request's ``user_id`` body
field to the token owner, closing the victim-impersonation hole where any
caller could pass an arbitrary ``user_id``.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status

from config import SUPABASE_ANON_KEY, SUPABASE_URL

logger = logging.getLogger("campusai.auth")

STAFF_ROLES = {"ADMIN", "SUPER_ADMIN", "FACULTY", "CLASS_INCHARGE"}

# Tiny TTL cache for role lookups (attendance bursts hit verify hard).
_ROLE_CACHE: dict[str, tuple[float, str | None]] = {}
_ROLE_TTL = 60.0


async def _auth_user(token: str) -> dict[str, Any]:
    """Validate a Supabase access token, return the Auth API user object."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
            )
    except Exception as e:
        logger.warning(f"Auth API unreachable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unreachable",
        )
    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return res.json()


async def require_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency: valid Supabase JWT required.

    On success the resolved user is stashed on ``request.state.auth_user`` so
    downstream dependencies (rate limiting) can key on the subject rather than
    the IP without re-validating the token.
    """
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    user = await _auth_user(token.strip())
    request.state.auth_user = user
    return user


def _role_of(auth_user_id: str) -> str | None:
    """Look up the app role for an auth user id (service key, cached)."""
    now = time.time()
    hit = _ROLE_CACHE.get(auth_user_id)
    if hit and now - hit[0] < _ROLE_TTL:
        return hit[1]
    try:
        from utils.db import get_supabase

        sb = get_supabase()
        res = (
            sb.table("profiles")
            .select("role")
            .eq("user_id", auth_user_id)
            .maybe_single()
            .execute()
        )
        role = (res.data or {}).get("role")
    except Exception as e:
        logger.warning(f"Role lookup failed: {e}")
        role = None
    _ROLE_CACHE[auth_user_id] = (now, role)
    return role


async def require_self_or_staff(user_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """Allow only the token owner or staff to act on ``user_id``.

    Called explicitly inside endpoints (takes the body's user_id).
    For a pure FastAPI dependency, use ``require_user`` / ``require_staff``.
    """
    owner_id = user.get("id")
    if owner_id and owner_id == user_id:
        return user
    if _role_of(str(owner_id)) in STAFF_ROLES:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not permitted for this user",
    )


async def require_staff(
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Allow only faculty/admin callers (e.g. 1:N identification)."""
    if _role_of(str(user.get("id"))) in STAFF_ROLES:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Staff only",
    )
