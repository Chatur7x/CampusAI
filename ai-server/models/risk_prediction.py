# =============================================================
# 5. Predictive Attendance Intelligence
#    (ai-server/models/risk_prediction.py)
# =============================================================
"""
Subsystem 5: Predictive Attendance Intelligence

Features:
  - attendance_percentage
  - consecutive_absences
  - late_count
  - monthly_trend (slope of last 4 weekly rates)

Models:
  - Isolation Forest (unsupervised anomaly detection)
  - Logistic Regression (supervised classification)
  - Random Forest (ensemble — multiple decision trees)
  - Gradient Boosting (sequential ensemble)

Risk Score ∈ [0, 1] → LOW / MEDIUM / HIGH / CRITICAL

Advanced Features:
  ✔ Early warning alerts
  ✔ Weekly risk prediction
  ✔ Multi-model ensemble
  ✔ Automatic faculty notifications trigger
  ✔ SHAP feature importance (explainable AI)
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("campusai.risk")

# ── Model holders ────────────────────────────────────────────
_iso_forest: Optional[IsolationForest] = None
_scaler: Optional[StandardScaler] = None
_logreg: Optional[LogisticRegression] = None
_lr_scaler: Optional[StandardScaler] = None
_rf: Optional[RandomForestClassifier] = None
_rf_scaler: Optional[StandardScaler] = None
_gb: Optional[GradientBoostingClassifier] = None
_gb_scaler: Optional[StandardScaler] = None

# SHAP (optional)
_shap_available = False
try:
    import shap
    _shap_available = True
except ImportError:
    pass

FEATURE_NAMES = ["attendance_pct", "consecutive_absences", "late_count", "monthly_trend"]


def _extract_features(record: dict) -> np.ndarray:
    """
    Bio-Net v4: Feature Extraction with Temporal Context.
    Subtracts the 30-day average from the current rate to detect sudden drops.
    """
    pct = record.get("attendance_pct", 75)
    hist_avg = record.get("historical_avg", pct)
    shift = pct - hist_avg # Negative = declining
    
    return np.array([
        pct,
        record.get("consecutive_absences", 0),
        record.get("late_count", 0),
        record.get("monthly_trend", 0),
        shift, # v4 behavioral shift feature
    ], dtype=np.float64).reshape(1, -1)


FEATURE_NAMES = ["attendance_pct", "consecutive_absences", "late_count", "monthly_trend", "behavioral_shift"]


# ── Isolation Forest (unsupervised) ──────────────────────────

def train_isolation_forest(records: list[dict]):
    global _iso_forest, _scaler
    if not records:
        logger.warning("No records for Isolation Forest training")
        return
    X = np.vstack([_extract_features(r) for r in records])
    _scaler = StandardScaler().fit(X)
    X_scaled = _scaler.transform(X)
    _iso_forest = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    _iso_forest.fit(X_scaled)
    logger.info(f"Isolation Forest trained on {len(records)} records")


def predict_risk_unsupervised(record: dict) -> dict:
    if _iso_forest is None or _scaler is None:
        return _heuristic_risk(record)
    X = _extract_features(record)
    X_scaled = _scaler.transform(X)
    raw_score = _iso_forest.decision_function(X_scaled)[0]
    risk = float(np.clip(0.5 - raw_score, 0, 1))
    return {"risk_score": round(risk, 4), "method": "isolation_forest", "category": _cat(risk)}


# ── Logistic Regression (supervised) ─────────────────────────

def train_logistic_regression(records: list[dict], labels: list[int]):
    global _logreg, _lr_scaler
    X = np.vstack([_extract_features(r) for r in records])
    y = np.array(labels)
    _lr_scaler = StandardScaler().fit(X)
    X_scaled = _lr_scaler.transform(X)
    _logreg = LogisticRegression(random_state=42)
    _logreg.fit(X_scaled, y)
    logger.info(f"Logistic Regression trained on {len(records)} records")


def predict_risk_supervised(record: dict) -> dict:
    if _logreg is None or _lr_scaler is None:
        return _heuristic_risk(record)
    X = _extract_features(record)
    X_scaled = _lr_scaler.transform(X)
    prob = _logreg.predict_proba(X_scaled)[0][1]
    return {"risk_score": round(float(prob), 4), "method": "logistic_regression", "category": _cat(float(prob))}


# ── Random Forest (ensemble) ─────────────────────────────────

def train_random_forest(records: list[dict], labels: list[int]):
    """Train Random Forest classifier for risk prediction."""
    global _rf, _rf_scaler
    X = np.vstack([_extract_features(r) for r in records])
    y = np.array(labels)
    _rf_scaler = StandardScaler().fit(X)
    X_scaled = _rf_scaler.transform(X)
    _rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    _rf.fit(X_scaled, y)
    logger.info(f"Random Forest trained on {len(records)} records")


def predict_risk_random_forest(record: dict) -> dict:
    """Predict risk using Random Forest."""
    if _rf is None or _rf_scaler is None:
        return _heuristic_risk(record)
    X = _extract_features(record)
    X_scaled = _rf_scaler.transform(X)
    prob = _rf.predict_proba(X_scaled)[0][1]
    result = {"risk_score": round(float(prob), 4), "method": "random_forest", "category": _cat(float(prob))}

    # Feature importance
    result["feature_importance"] = {
        name: round(float(imp), 4)
        for name, imp in zip(FEATURE_NAMES, _rf.feature_importances_)
    }
    return result


# ── Gradient Boosting ─────────────────────────────────────────

def train_gradient_boosting(records: list[dict], labels: list[int]):
    """Train Gradient Boosting classifier for risk prediction."""
    global _gb, _gb_scaler
    X = np.vstack([_extract_features(r) for r in records])
    y = np.array(labels)
    _gb_scaler = StandardScaler().fit(X)
    X_scaled = _gb_scaler.transform(X)
    _gb = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
    _gb.fit(X_scaled, y)
    logger.info(f"Gradient Boosting trained on {len(records)} records")


def predict_risk_gradient_boosting(record: dict) -> dict:
    """Predict risk using Gradient Boosting."""
    if _gb is None or _gb_scaler is None:
        return _heuristic_risk(record)
    X = _extract_features(record)
    X_scaled = _gb_scaler.transform(X)
    prob = _gb.predict_proba(X_scaled)[0][1]
    return {"risk_score": round(float(prob), 4), "method": "gradient_boosting", "category": _cat(float(prob))}


# ── Ensemble Prediction ──────────────────────────────────────

def predict_risk_ensemble(record: dict) -> dict:
    """
    Ensemble prediction combining all available models.
    Averages predictions from: IsolationForest, LogReg, RandomForest, GradientBoosting.
    """
    predictions = []
    methods = []

    if _iso_forest is not None:
        pred = predict_risk_unsupervised(record)
        predictions.append(pred["risk_score"])
        methods.append("isolation_forest")

    if _logreg is not None:
        pred = predict_risk_supervised(record)
        predictions.append(pred["risk_score"])
        methods.append("logistic_regression")

    if _rf is not None:
        pred = predict_risk_random_forest(record)
        predictions.append(pred["risk_score"])
        methods.append("random_forest")

    if _gb is not None:
        pred = predict_risk_gradient_boosting(record)
        predictions.append(pred["risk_score"])
        methods.append("gradient_boosting")

    if not predictions:
        return _heuristic_risk(record)

    avg_risk = float(np.mean(predictions))
    
    # v4 Sigmoid Sharpening for Risk
    # We want to be very certain before flagging a student as CRITICAL
    sharpened_risk = 1.0 / (1.0 + np.exp(-10 * (avg_risk - 0.6)))
    sharpened_risk = round(float(np.clip(sharpened_risk, 0, 1)), 4)

    return {
        "risk_score": sharpened_risk,
        "raw_avg_score": round(avg_risk, 4),
        "method": "ensemble_v4",
        "models_used": methods,
        "individual_scores": {m: round(s, 4) for m, s in zip(methods, predictions)},
        "category": _cat(sharpened_risk),
        "intervention_needed": sharpened_risk > 0.65
    }


# ── SHAP Explainability ──────────────────────────────────────

def explain_risk(record: dict) -> dict:
    """Generate SHAP feature importance for a risk prediction."""
    if not _shap_available or _rf is None or _rf_scaler is None:
        return {"error": "SHAP requires trained Random Forest model"}

    X = _extract_features(record)
    X_scaled = _rf_scaler.transform(X)

    explainer = shap.TreeExplainer(_rf)
    shap_values = explainer.shap_values(X_scaled)

    # For binary classification, use class 1 (at-risk)
    if isinstance(shap_values, list):
        sv = shap_values[1][0]
    else:
        sv = shap_values[0]

    return {
        "shap_values": {name: round(float(v), 4) for name, v in zip(FEATURE_NAMES, sv)},
        "base_value": round(float(explainer.expected_value[1] if isinstance(explainer.expected_value, list) else explainer.expected_value), 4),
        "prediction": predict_risk_random_forest(record),
    }


# ── Heuristic fallback ──────────────────────────────────────

def _heuristic_risk(record: dict) -> dict:
    pct = record.get("attendance_pct", 75)
    streak = record.get("consecutive_absences", 0)
    risk = 0.0
    risk += max(0, (75 - pct)) / 75 * 0.5
    risk += min(streak / 10, 1.0) * 0.3
    risk += min(record.get("late_count", 0) / 20, 1.0) * 0.2
    risk = min(risk, 1.0)
    return {"risk_score": round(risk, 4), "method": "heuristic", "category": _cat(risk)}


def _cat(r: float) -> str:
    if r >= 0.75:
        return "CRITICAL"
    if r >= 0.50:
        return "HIGH"
    if r >= 0.25:
        return "MEDIUM"
    return "LOW"


# ── Convenience ──────────────────────────────────────────────

def predict_risk(record: dict) -> dict:
    """Use best available model (or ensemble if multiple available)."""
    available = sum([
        _iso_forest is not None,
        _logreg is not None,
        _rf is not None,
        _gb is not None,
    ])
    if available >= 2:
        return predict_risk_ensemble(record)
    if _gb is not None:
        return predict_risk_gradient_boosting(record)
    if _rf is not None:
        return predict_risk_random_forest(record)
    if _logreg is not None:
        return predict_risk_supervised(record)
    if _iso_forest is not None:
        return predict_risk_unsupervised(record)
    return _heuristic_risk(record)


def train_all_risk_models(records: list[dict], labels: Optional[list[int]] = None):
    """Train all available risk models at once."""
    train_isolation_forest(records)
    if labels is not None and len(labels) == len(records):
        train_logistic_regression(records, labels)
        train_random_forest(records, labels)
        train_gradient_boosting(records, labels)
    logger.info("All risk models trained")
