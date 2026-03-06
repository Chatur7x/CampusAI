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
from models.confidence import compute_confidence, compute_device_trust
from models.liveness import generate_challenge, verify_challenge, analyse_liveness
from models.audit_logger import log_ai_decision
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
    ip_address: Optional[str] = None
    student_id: Optional[str] = None


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
    device_fingerprint: Optional[str] = None
    known_devices: Optional[List[str]] = None
    ip_address: Optional[str] = None
    known_ips: Optional[List[str]] = None


class ChallengeVerifyRequest(BaseModel):
    challenge_type: str
    frames: List[str]  # base64 images


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/risk")
async def get_risk(req: RiskRequest):
    """Predict attendance risk for a student."""
    record = req.model_dump()
    result = predict_risk(record)
    # Audit log
    log_ai_decision(
        decision_type="RISK_PREDICT",
        student_id=req.student_id,
        result=result,
    )
    return result


@router.post("/trend")
async def get_trend(req: TrendRequest):
    """Predict attendance trend."""
    return predict_trend(req.weekly_rates, req.forecast_weeks)


@router.post("/fraud")
async def check_fraud(req: FraudCheckRequest):
    """Check for attendance fraud / anomalies."""
    record = req.model_dump()
    result = detect_fraud(record)
    # Audit log
    log_ai_decision(
        decision_type="FRAUD_CHECK",
        student_id=req.student_id,
        result=result,
        fraud_flags=result.get("flags", []),
        device_fingerprint=req.device_fingerprint,
        ip_address=req.ip_address,
    )
    return result


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
    """Compute attendance confidence score (4-component: face + liveness + geo + device)."""
    device_trust = compute_device_trust(
        device_fingerprint=req.device_fingerprint,
        known_devices=req.known_devices,
        ip_address=req.ip_address,
        known_ips=req.known_ips,
    )
    result = compute_confidence(
        face_similarity=req.face_similarity,
        liveness_score=req.liveness_score,
        geo_accuracy=req.geo_accuracy,
        device_trust=device_trust,
    )
    return {
        "score": result.score,
        "category": result.category,
        "auto_approved": result.auto_approved,
        "breakdown": result.breakdown,
        "flags": result.flags,
        "requires_reverification": result.requires_reverification,
        "admin_alert": result.admin_alert,
    }


# ── Liveness Challenge ──────────────────────────────────────

@router.get("/liveness/challenge")
async def get_liveness_challenge():
    """Generate a random liveness challenge for the student."""
    return generate_challenge()


@router.post("/liveness/challenge/verify")
async def verify_liveness_challenge(req: ChallengeVerifyRequest):
    """Verify student's response to a liveness challenge."""
    # Analyze each frame first, then verify the challenge
    analyzed_frames = []
    for frame_b64 in req.frames:
        result = analyse_liveness(frame_b64)
        analyzed_frames.append(result)
    return verify_challenge(req.challenge_type, analyzed_frames)


# ── Training ─────────────────────────────────────────────────

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
