# =============================================================
# CampusAI — FastAPI Server  (ai-server/main.py)
# =============================================================
from __future__ import annotations

import logging, os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import (
    AI_SERVER_HOST, AI_SERVER_PORT, CORS_ORIGINS, MLFLOW_TRACKING_URI,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("campusai")


# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    logger.info("🚀 CampusAI server starting …")

    # Pre-load InsightFace model at startup (avoids first-request timeout)
    try:
        from models.face_recognition_module import _get_face_app
        logger.info("Pre-loading InsightFace buffalo_l model …")
        _get_face_app()
        logger.info("✅ InsightFace model loaded and ready")
    except Exception as e:
        logger.warning(f"InsightFace pre-load skipped: {e}")

    # Optionally set MLflow tracking URI
    try:
        import mlflow
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        logger.info(f"MLflow tracking → {MLFLOW_TRACKING_URI}")
    except ImportError:
        logger.warning("mlflow not installed — model monitoring disabled")
    yield
    logger.info("🛑 CampusAI server shutting down")


# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="CampusAI",
    version="1.0.0",
    description="Python AI/ML backend for Smart Attendance System",
    lifespan=lifespan,
    # Never leak internal tracebacks / handler internals to clients.
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────
from fastapi import Depends
from routes.face import router as face_router
from routes.attendance import router as attendance_router
from routes.analytics import router as analytics_router
from routes.session import router as session_router
from utils.auth import require_user
from utils.ratelimit import analytics_rate_limit, face_rate_limit, session_rate_limit

# Every /api/* router requires a valid Supabase JWT. Rate-limit dependencies
# run after auth so they can key on the authenticated subject.
_authed = [Depends(require_user)]

app.include_router(
    face_router,
    prefix="/api/face",
    tags=["Face Recognition"],
    dependencies=[Depends(require_user), Depends(face_rate_limit)],
)
app.include_router(
    attendance_router,
    prefix="/api/attendance",
    tags=["Attendance"],
    dependencies=[Depends(require_user), Depends(face_rate_limit)],
)
app.include_router(
    analytics_router,
    prefix="/api/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_user), Depends(analytics_rate_limit)],
)
app.include_router(
    session_router,
    prefix="/api/session",
    tags=["Session Management"],
    dependencies=[Depends(require_user), Depends(session_rate_limit)],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "CampusAI"}


# ── Centralized error handling ────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    """Log with context, return a generic message.

    Starlette's default handler returns a plaintext 500 with the exception
    text in some configurations; this guarantees no stack trace, path or
    driver detail ever reaches the client.
    """
    logger.exception(
        "Unhandled error on %s %s", getattr(request, "method", "?"), getattr(request, "url", "?")
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """Return the field errors without echoing the submitted payload."""
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Invalid request",
            "errors": [
                {"field": ".".join(str(p) for p in err.get("loc", [])[1:]), "message": err.get("msg", "invalid")}
                for err in exc.errors()
            ],
        },
    )


# ── Entrypoint ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=AI_SERVER_HOST, port=AI_SERVER_PORT, reload=True)
