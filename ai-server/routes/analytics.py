# =============================================================
# Analytics Routes  (ai-server/routes/analytics.py)
# =============================================================
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.performance_analysis import pearson_correlation, predict_grade, batch_correlation
from models.behavior_profiling import train_profiles, classify_student, batch_classify
from models.risk_prediction import train_isolation_forest, train_logistic_regression, predict_risk
from models.fraud_detection import train_fraud_model, detect_fraud
from models.monitoring import (
    get_model_health, get_all_models_health, check_drift,
    check_data_drift, log_prediction, log_accuracy,
)
from utils.db import fetch_attendance_records

logger = logging.getLogger("campusai.routes.analytics")
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────

class CorrelationRequest(BaseModel):
    attendances: List[float]
    grades: List[float]


class GradePredictionRequest(BaseModel):
    attendance_pct: float
    historical_attendances: List[float]
    historical_grades: List[float]


class BatchCorrelationRequest(BaseModel):
    subjects: List[dict]


class ProfileTrainRequest(BaseModel):
    records: List[dict]
    n_clusters: int = 3


class ClassifyRequest(BaseModel):
    attendance_pct: float = 75
    absence_streak_max: int = 0
    late_pct: float = 0
    variance_weekly: float = 5
    student_id: Optional[str] = None


class BatchClassifyRequest(BaseModel):
    records: List[dict]


class DriftCheckRequest(BaseModel):
    model_name: str


class DataDriftRequest(BaseModel):
    model_name: str
    baseline_features: List[float]
    current_features: List[float]


class LogPredictionRequest(BaseModel):
    model_name: str
    input_data: dict
    prediction: dict
    actual: Optional[dict] = None


class LogAccuracyRequest(BaseModel):
    model_name: str
    accuracy: float


# ── Performance Analysis ─────────────────────────────────────

@router.post("/correlation")
async def get_correlation(req: CorrelationRequest):
    """Pearson correlation between attendance and grades."""
    return pearson_correlation(req.attendances, req.grades)


@router.post("/predict-grade")
async def get_grade_prediction(req: GradePredictionRequest):
    """Predict grade based on attendance."""
    return predict_grade(req.attendance_pct, req.historical_attendances, req.historical_grades)


@router.post("/batch-correlation")
async def get_batch_correlation(req: BatchCorrelationRequest):
    """Correlation for multiple subjects."""
    return batch_correlation(req.subjects)


# ── Behaviour Profiling ──────────────────────────────────────

@router.post("/profiles/train")
async def train_student_profiles(req: ProfileTrainRequest):
    """Train KMeans behaviour clustering."""
    return train_profiles(req.records, req.n_clusters)


@router.post("/profiles/classify")
async def classify_student_profile(req: ClassifyRequest):
    """Classify a single student."""
    record = req.model_dump()
    return classify_student(record)


@router.post("/profiles/batch")
async def batch_classify_students(req: BatchClassifyRequest):
    """Classify many students."""
    return batch_classify(req.records)


# ── Model Monitoring ─────────────────────────────────────────

@router.get("/monitoring/health")
async def all_model_health():
    """Health report for all tracked models."""
    return get_all_models_health()


@router.get("/monitoring/health/{model_name}")
async def single_model_health(model_name: str):
    """Health report for one model."""
    return get_model_health(model_name)


@router.post("/monitoring/drift")
async def check_model_drift(req: DriftCheckRequest):
    """Check accuracy drift for a model."""
    return check_drift(req.model_name)


@router.post("/monitoring/data-drift")
async def check_data_drift_endpoint(req: DataDriftRequest):
    """Check data distribution drift (PSI)."""
    return check_data_drift(req.model_name, req.baseline_features, req.current_features)


@router.post("/monitoring/log-prediction")
async def log_pred(req: LogPredictionRequest):
    """Log a prediction for monitoring."""
    log_prediction(req.model_name, req.input_data, req.prediction, req.actual)
    return {"logged": True}


@router.post("/monitoring/log-accuracy")
async def log_acc(req: LogAccuracyRequest):
    """Log accuracy metric."""
    log_accuracy(req.model_name, req.accuracy)
    return {"logged": True}


# ── Model Training Pipeline ──────────────────────────────────

class TrainModelsRequest(BaseModel):
    """Trigger training of ML models using historical attendance data."""
    min_records: int = 50
    class_id: Optional[str] = None


@router.post("/train")
async def train_all_models(req: TrainModelsRequest):
    """
    Fetch historical attendance data from Supabase and train:
    - IsolationForest (anomaly detection)
    - Fraud detection model (One-Class SVM)
    - Behavior profiling clusters (KMeans)

    Returns training summary with record counts.
    """
    results = {}
    try:
        records = fetch_attendance_records(class_id=req.class_id)
        if len(records) < req.min_records:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough data: {len(records)} records (need {req.min_records})"
            )

        # Prepare feature dicts for training
        record_dicts = []
        for r in records:
            record_dicts.append({
                "attendance_pct": 100 if r.get("status") == "PRESENT" else 0,
                "consecutive_absences": 0,
                "late_count": 1 if r.get("status") == "LATE" else 0,
                "total_classes": 1,
                "date": r.get("date", ""),
            })

        # 1. Train Isolation Forest for risk prediction
        try:
            iso_result = train_isolation_forest(record_dicts)
            results["isolation_forest"] = {"status": "trained", **iso_result}
        except Exception as e:
            results["isolation_forest"] = {"status": "failed", "error": str(e)}

        # 2. Train fraud detection model
        try:
            fraud_result = train_fraud_model(record_dicts)
            results["fraud_detection"] = {"status": "trained", **fraud_result}
        except Exception as e:
            results["fraud_detection"] = {"status": "failed", "error": str(e)}

        # 3. Train behavior profiles
        try:
            # Aggregate per-student for profiling
            student_map: dict = {}
            for r in records:
                sid = r.get("studentId") or r.get("student_id") or "unknown"
                if sid not in student_map:
                    student_map[sid] = {"attendance_pct": 0, "total": 0, "present": 0, "late": 0}
                student_map[sid]["total"] += 1
                if r.get("status") == "PRESENT":
                    student_map[sid]["present"] += 1
                if r.get("status") == "LATE":
                    student_map[sid]["late"] += 1

            profile_records = []
            for sid, s in student_map.items():
                pct = round((s["present"] / s["total"]) * 100, 1) if s["total"] > 0 else 0
                profile_records.append({
                    "student_id": sid,
                    "attendance_pct": pct,
                    "absence_streak_max": s["total"] - s["present"],
                    "late_pct": round((s["late"] / s["total"]) * 100, 1) if s["total"] > 0 else 0,
                    "variance_weekly": 5.0,
                })

            if len(profile_records) >= 3:
                n_clusters = min(4, len(profile_records))
                profile_result = train_profiles(profile_records, n_clusters)
                results["behavior_profiles"] = {"status": "trained", **profile_result}
            else:
                results["behavior_profiles"] = {"status": "skipped", "reason": "too few students"}
        except Exception as e:
            results["behavior_profiles"] = {"status": "failed", "error": str(e)}

        return {
            "success": True,
            "total_records": len(records),
            "models": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
