# =============================================================
# Analytics Routes  (ai-server/routes/analytics.py)
# =============================================================
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.performance_analysis import (
    pearson_correlation, predict_grade, batch_correlation,
    spearman_correlation, detect_performance_risk,
)
from models.behavior_profiling import train_profiles, classify_student, batch_classify
from models.risk_prediction import (
    train_isolation_forest, train_logistic_regression, predict_risk,
    train_random_forest, train_gradient_boosting, predict_risk_ensemble,
    explain_risk, train_all_risk_models,
)
from models.trend_prediction import (
    predict_trend, prophet_trend, moving_average_trend,
    compare_methods, suggest_intervention,
)
from models.fraud_detection import (
    train_fraud_model, detect_fraud, get_fraud_dashboard,
    track_device, check_multi_student_device, check_attendance_spike,
)
from models.monitoring import (
    get_model_health, get_all_models_health, check_drift,
    check_data_drift, log_prediction, log_accuracy,
)
from models.audit_logger import (
    get_recent_logs, get_audit_stats, get_student_audit_trail,
    search_audit_logs, generate_compliance_report,
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


class RiskExplainRequest(BaseModel):
    attendance_pct: float = 75
    consecutive_absences: int = 0
    late_count: int = 0
    monthly_trend: float = 0


class TrendCompareRequest(BaseModel):
    weekly_rates: List[float]
    forecast_weeks: int = 4


class InterventionRequest(BaseModel):
    weekly_rates: List[float]


class PerformanceRiskRequest(BaseModel):
    attendance_pct: float
    grade: float
    prev_grade: Optional[float] = None
    absence_streak: int = 0


class TrainRiskModelsRequest(BaseModel):
    records: List[dict]


class DeviceTrackRequest(BaseModel):
    device_fingerprint: str
    student_id: str


class AttendanceSpikeRequest(BaseModel):
    student_id: str
    window_seconds: float = 3600


# ── Performance Analysis ─────────────────────────────────────

@router.post("/correlation")
async def get_correlation(req: CorrelationRequest):
    """Pearson correlation between attendance and grades."""
    return pearson_correlation(req.attendances, req.grades)


@router.post("/correlation/spearman")
async def get_spearman(req: CorrelationRequest):
    """Spearman rank correlation between attendance and grades."""
    return spearman_correlation(req.attendances, req.grades)


@router.post("/predict-grade")
async def get_grade_prediction(req: GradePredictionRequest):
    """Predict grade based on attendance."""
    return predict_grade(req.attendance_pct, req.historical_attendances, req.historical_grades)


@router.post("/batch-correlation")
async def get_batch_correlation(req: BatchCorrelationRequest):
    """Correlation for multiple subjects (Pearson + Spearman)."""
    return batch_correlation(req.subjects)


@router.post("/performance-risk")
async def get_performance_risk(req: PerformanceRiskRequest):
    """Detect academic performance risk for a student."""
    return detect_performance_risk(
        req.attendance_pct, req.grade, req.prev_grade, req.absence_streak,
    )


# ── Risk Prediction (Ensemble) ───────────────────────────────

@router.post("/risk/ensemble")
async def get_risk_ensemble(req: RiskExplainRequest):
    """Predict risk using ensemble (RF + GBM + IForest + LogReg)."""
    record = req.model_dump()
    return predict_risk_ensemble(record)


@router.post("/risk/explain")
async def get_risk_explanation(req: RiskExplainRequest):
    """SHAP-based explanation for risk prediction."""
    record = req.model_dump()
    return explain_risk(record)


@router.post("/risk/train-all")
async def train_all_risk(req: TrainRiskModelsRequest):
    """Train all risk models (IForest + LogReg + RF + GBM)."""
    return train_all_risk_models(req.records)


# ── Trend Forecasting ────────────────────────────────────────

@router.post("/trend/prophet")
async def get_prophet_trend(req: TrendCompareRequest):
    """Attendance trend via Facebook Prophet."""
    return prophet_trend(req.weekly_rates, req.forecast_weeks)


@router.post("/trend/moving-average")
async def get_ma_trend(req: TrendCompareRequest):
    """Attendance trend via Exponential Moving Average."""
    return moving_average_trend(req.weekly_rates, req.forecast_weeks)


@router.post("/trend/compare")
async def compare_trend_methods(req: TrendCompareRequest):
    """Compare all forecasting methods (Prophet + ARIMA + MA + Linear)."""
    return compare_methods(req.weekly_rates, req.forecast_weeks)


@router.post("/trend/intervention")
async def get_intervention(req: InterventionRequest):
    """Suggest interventions based on attendance forecast."""
    return suggest_intervention(req.weekly_rates)


# ── Fraud Dashboard ──────────────────────────────────────────

@router.get("/fraud/dashboard")
async def fraud_dashboard():
    """Admin fraud overview dashboard."""
    return get_fraud_dashboard()


@router.post("/fraud/track-device")
async def fraud_track_device(req: DeviceTrackRequest):
    """Track device ↔ student mapping."""
    track_device(req.student_id, req.device_fingerprint)
    return {"tracked": True}


@router.post("/fraud/multi-student-device")
async def fraud_multi_student(req: DeviceTrackRequest):
    """Check if device is used by multiple students."""
    return check_multi_student_device(req.device_fingerprint)


@router.post("/fraud/attendance-spike")
async def fraud_attendance_spike(req: AttendanceSpikeRequest):
    """Check for suspicious attendance frequency spikes."""
    return check_attendance_spike(req.student_id, req.window_seconds)


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


# ── Audit & Compliance ───────────────────────────────────────

@router.get("/audit/recent")
async def audit_recent(limit: int = 50, decision_type: Optional[str] = None):
    """Get recent AI decision audit logs."""
    return get_recent_logs(limit, decision_type)


@router.get("/audit/stats")
async def audit_stats():
    """Aggregate audit statistics."""
    return get_audit_stats()


@router.get("/audit/student/{student_id}")
async def audit_student(student_id: str, limit: int = 20):
    """Audit trail for a specific student."""
    return get_student_audit_trail(student_id, limit)


@router.get("/audit/compliance-report")
async def compliance_report():
    """Generate compliance report from audit data."""
    return generate_compliance_report()


@router.post("/audit/search")
async def audit_search(
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    fraud_only: bool = False,
    rejected_only: bool = False,
):
    """Search audit logs with filters."""
    return search_audit_logs(start_time, end_time, fraud_only, rejected_only)


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
