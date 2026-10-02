"""Auth-gate tests for the AI server.

Covers the dependency that every `/api/*` router mounts, plus the ownership
helpers used inside the face and session endpoints. These are the regression
net for the earlier finding where the routers were reachable anonymously.

Run:  pytest tests/ai/test_auth.py
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

import utils.auth as auth


def run(coro):
    return asyncio.run(coro)


class FakeRequest:
    def __init__(self, authorization: str | None) -> None:
        self.headers = {"authorization": authorization} if authorization else {}
        self.state = type("S", (), {"auth_user": None})()


class TestRequireUser:
    def test_rejects_missing_header(self):
        with pytest.raises(HTTPException) as exc:
            run(auth.require_user(FakeRequest(None)))
        assert exc.value.status_code == 401

    def test_rejects_non_bearer_scheme(self):
        with pytest.raises(HTTPException) as exc:
            run(auth.require_user(FakeRequest("Basic dXNlcjpwYXNz")))
        assert exc.value.status_code == 401

    def test_rejects_empty_bearer_token(self):
        with pytest.raises(HTTPException) as exc:
            run(auth.require_user(FakeRequest("Bearer    ")))
        assert exc.value.status_code == 401

    def test_rejects_invalid_token(self, monkeypatch):
        async def _reject(_token: str):
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        monkeypatch.setattr(auth, "_auth_user", _reject)
        with pytest.raises(HTTPException) as exc:
            run(auth.require_user(FakeRequest("Bearer bad.token")))
        assert exc.value.status_code == 401

    def test_accepts_valid_token_and_caches_subject(self, monkeypatch):
        async def _ok(_token: str):
            return {"id": "user-42"}

        monkeypatch.setattr(auth, "_auth_user", _ok)
        request = FakeRequest("Bearer good.token")
        user = run(auth.require_user(request))
        assert user["id"] == "user-42"
        # Stashed so the rate limiter can key on the subject.
        assert request.state.auth_user == {"id": "user-42"}

    def test_auth_outage_is_503_not_401(self, monkeypatch):
        """A Supabase outage must not read as 'your token is invalid'."""

        async def _down(_token: str):
            raise HTTPException(status_code=503, detail="Authentication service unreachable")

        monkeypatch.setattr(auth, "_auth_user", _down)
        with pytest.raises(HTTPException) as exc:
            run(auth.require_user(FakeRequest("Bearer any.token")))
        assert exc.value.status_code == 503


class TestRoleLookup:
    def test_caches_result(self, monkeypatch):
        auth._ROLE_CACHE.clear()
        calls = {"n": 0}

        class FakeTable:
            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                calls["n"] += 1
                return type("R", (), {"data": {"role": "FACULTY"}})()

        class FakeSB:
            table = lambda self, _name: FakeTable()  # noqa: E731

        class FakeDB:
            get_supabase = staticmethod(lambda: FakeSB())

        monkeypatch.setitem(
            __import__("sys").modules, "utils.db", FakeDB
        )
        monkeypatch.setattr(
            auth, "_ROLE_CACHE", {}, raising=True
        )
        assert auth._role_of("u1") == "FACULTY"
        assert auth._role_of("u1") == "FACULTY"
        assert calls["n"] == 1, "second lookup should be served from cache"

    def test_lookup_failure_yields_no_role(self, monkeypatch):
        """Fail closed: an unreachable DB must not grant a role."""
        auth._ROLE_CACHE.clear()

        class FakeDB:
            @staticmethod
            def get_supabase():
                raise RuntimeError("db down")

        monkeypatch.setitem(__import__("sys").modules, "utils.db", FakeDB)
        assert auth._role_of("u-nope") is None


class TestOwnership:
    def test_self_is_allowed(self, monkeypatch):
        monkeypatch.setattr(auth, "_role_of", lambda _id: "STUDENT")
        user = {"id": "u1"}
        assert run(auth.require_self_or_staff("u1", user)) == user

    def test_other_student_is_denied(self, monkeypatch):
        monkeypatch.setattr(auth, "_role_of", lambda _id: "STUDENT")
        with pytest.raises(HTTPException) as exc:
            run(auth.require_self_or_staff("victim", {"id": "attacker"}))
        assert exc.value.status_code == 403

    def test_staff_may_act_for_others(self, monkeypatch):
        monkeypatch.setattr(auth, "_role_of", lambda _id: "FACULTY")
        user = {"id": "f1"}
        assert run(auth.require_self_or_staff("s1", user)) == user

    def test_admin_may_act_for_others(self, monkeypatch):
        monkeypatch.setattr(auth, "_role_of", lambda _id: "SUPER_ADMIN")
        user = {"id": "a1"}
        assert run(auth.require_self_or_staff("s1", user)) == user

    def test_unknown_role_is_denied(self, monkeypatch):
        """A role lookup that returns None must not fall through to allow."""
        monkeypatch.setattr(auth, "_role_of", lambda _id: None)
        with pytest.raises(HTTPException) as exc:
            run(auth.require_self_or_staff("s1", {"id": "f1"}))
        assert exc.value.status_code == 403


class TestRequireStaff:
    def test_rejects_student(self, monkeypatch):
        monkeypatch.setattr(auth, "_role_of", lambda _id: "STUDENT")
        with pytest.raises(HTTPException) as exc:
            run(auth.require_staff(user={"id": "s1"}))
        assert exc.value.status_code == 403

    def test_rejects_unknown_role(self, monkeypatch):
        monkeypatch.setattr(auth, "_role_of", lambda _id: None)
        with pytest.raises(HTTPException) as exc:
            run(auth.require_staff(user={"id": "x1"}))
        assert exc.value.status_code == 403

    @pytest.mark.parametrize("role", ["ADMIN", "SUPER_ADMIN", "FACULTY", "CLASS_INCHARGE"])
    def test_accepts_staff_roles(self, monkeypatch, role):
        monkeypatch.setattr(auth, "_role_of", lambda _id: role)
        assert run(auth.require_staff(user={"id": "x1"})) == {"id": "x1"}
