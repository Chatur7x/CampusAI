# =============================================================
# Attendance Routes  (ai-server/routes/attendance.py)
# =============================================================
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.risk_prediction import predict_risk, train_isolation_forest
from models.trend_prediction import predict_trend
from models.fraud_detection import detect_fraud, generate_device_fingerprint, train_fraud_model
from models.geo_validation import validate_location, detect_gps_spoof
from models.confidence import compute_confidence
from utils.db import fetch_attendance_records

logger = logging.getLogger("campusai.routes.attendance")
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────

class RiskRequest(BaseModel):
    student_id: str
    attendance_pct: float = 75
    consecutive_absences: int = 0
    late_count: int = 0
    monthly_trend: float = 0


class TrendRequest(BaseModel):
    weekly_rates: List[float]
    forecast_weeks: int = 4


class FraudCheckRequest(BaseModel):
    distance_from_campus: float = 0
    hour_of_day: int = 9
    day_of_week: int = 1
    attendance_pct: float = 75
    face_similarity: float = 0.8
    liveness_score: float = 0.7
    device_fingerprint: Optional[str] = None
    known_devices: Optional[List[str]] = None


class GeoValidateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: float = 0
    prev_latitude: Optional[float] = None
    prev_longitude: Optional[float] = None
    time_delta_s: Optional[float] = None
    is_mock: bool = False


class TrainRequest(BaseModel):
    records: List[dict]


class ConfidenceRequest(BaseModel):
    face_similarity: float
    liveness_score: float
    geo_accuracy: float


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/risk")
async def get_risk(req: RiskRequest):
    """Predict attendance risk for a student."""
    record = req.model_dump()
    return predict_risk(record)


@router.post("/trend")
async def get_trend(req: TrendRequest):
    """Predict attendance trend."""
    return predict_trend(req.weekly_rates, req.forecast_weeks)


@router.post("/fraud")
async def check_fraud(req: FraudCheckRequest):
    """Check for attendance fraud / anomalies."""
    record = req.model_dump()
    return detect_fraud(record)


@router.post("/geo/validate")
async def geo_validate(req: GeoValidateRequest):
    """Validate geolocation against campus."""
    loc = validate_location(req.latitude, req.longitude, req.accuracy_m)
    spoof = detect_gps_spoof(
        req.latitude, req.longitude,
        req.prev_latitude, req.prev_longitude,
        req.time_delta_s, req.is_mock,
    )
    return {**loc, "spoofing": spoof}


@router.post("/confidence")
async def compute_conf(req: ConfidenceRequest):
    """Compute attendance confidence score."""
    result = compute_confidence(req.face_similarity, req.liveness_score, req.geo_accuracy)
    return {
        "score": result.score,
        "category": result.category,
        "auto_approved": result.auto_approved,
        "breakdown": result.breakdown,
    }


@router.post("/train/risk")
async def train_risk(req: TrainRequest):
    """Train Isolation Forest on historical data."""
    train_isolation_forest(req.records)
    return {"success": True, "records": len(req.records)}


@router.post("/train/fraud")
async def train_fraud(req: TrainRequest):
    """Train fraud detection models on normal data."""
    train_fraud_model(req.records)
    return {"success": True, "records": len(req.records)}


@router.post("/device-fingerprint")
async def device_fp(user_agent: str = "", ip: str = "", screen_res: str = ""):
    """Generate device fingerprint hash."""
    return {"fingerprint": generate_device_fingerprint(user_agent, ip, screen_res)}
