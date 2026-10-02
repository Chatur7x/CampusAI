"""Shared fixtures for the AI-server test suites.

Makes ``ai-server`` importable so the tests exercise the real modules rather
than a copy, and skips live-HTTP suites when no server is reachable.
"""
from __future__ import annotations

import os
import pathlib
import socket
import sys
import urllib.error
import urllib.request

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
AI_SERVER = REPO_ROOT / "ai-server"

# The AI server does absolute-ish imports (`from utils.auth import ...`,
# `from config import ...`), so it has to be on sys.path, not just importable
# as a package.
if str(AI_SERVER) not in sys.path:
    sys.path.insert(0, str(AI_SERVER))


def _default_base_url() -> str:
    return os.environ.get("AI_BASE_URL", "http://127.0.0.1:8011")


@pytest.fixture(scope="session")
def repo_root() -> pathlib.Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def base_url() -> str:
    return _default_base_url()


def server_is_up(base: str) -> bool:
    try:
        with urllib.request.urlopen(f"{base}/health", timeout=3):
            return True
    except (urllib.error.URLError, OSError, ValueError):
        return False


@pytest.fixture(scope="session")
def live_server(base_url: str) -> str:
    """Skip the test when the AI server is not running."""
    if not server_is_up(base_url):
        pytest.skip(
            f"AI server not reachable at {base_url}. "
            f"Start it with:  cd ai-server && uvicorn main:app --port 8011"
        )
    return base_url
