# =============================================================
# CampusAI — FastAPI Server  (ai-server/main.py)
# =============================================================
from __future__ import annotations

import logging, os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────
from routes.face import router as face_router
from routes.attendance import router as attendance_router
from routes.analytics import router as analytics_router

app.include_router(face_router, prefix="/api/face", tags=["Face Recognition"])
app.include_router(attendance_router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "CampusAI"}


# ── Entrypoint ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=AI_SERVER_HOST, port=AI_SERVER_PORT, reload=True)
