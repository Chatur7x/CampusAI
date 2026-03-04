# =============================================================
# 4. Attendance Risk Prediction  (ai-server/models/risk_prediction.py)
# =============================================================
"""
Features:
  - attendance_percentage
  - consecutive_absences (missed streak)
  - late_count
  - monthly_trend  (slope of last 4 weekly rates)

Models: Isolation Forest (unsupervised anomaly) + Logistic Regression (supervised).
Risk score ∈ [0, 1]  → LOW / MEDIUM / HIGH / CRITICAL
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("campusai.risk")

# ── Isolation Forest  (unsupervised, works without labels) ───

_iso_forest: Optional[IsolationForest] = None
_scaler: Optional[StandardScaler] = None


def _extract_features(record: dict) -> np.ndarray:
    """Extract the 4-feature vector from an attendance summary dict."""
    return np.array([
        record.get("attendance_pct", 75),
        record.get("consecutive_absences", 0),
        record.get("late_count", 0),
        record.get("monthly_trend", 0),
    ], dtype=np.float64).reshape(1, -1)


def train_isolation_forest(records: list[dict]):
    """Fit Isolation Forest on historical student summaries."""
    global _iso_forest, _scaler
    if not records:
        logger.warning("No records for Isolation Forest training")
        return

    X = np.vstack([_extract_features(r) for r in records])
    _scaler = StandardScaler().fit(X)
    X_scaled = _scaler.transform(X)

    _iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
    )
    _iso_forest.fit(X_scaled)
    logger.info(f"Isolation Forest trained on {len(records)} records")


def predict_risk_unsupervised(record: dict) -> dict:
    """
    Return anomaly score via Isolation Forest.
    Lower decision_function → more anomalous → higher risk.
    """
    if _iso_forest is None or _scaler is None:
        # Fallback: simple heuristic
        return _heuristic_risk(record)

    X = _extract_features(record)
    X_scaled = _scaler.transform(X)
    raw_score = _iso_forest.decision_function(X_scaled)[0]
    # Map raw_score (typically ≈ ‒0.5 … 0.5) → risk 0..1
    risk = float(np.clip(0.5 - raw_score, 0, 1))
    return {"risk_score": round(risk, 4), "method": "isolation_forest",
            "category": _cat(risk)}


# ── Logistic Regression (supervised) ────────────────────────

_logreg: Optional[LogisticRegression] = None
_lr_scaler: Optional[StandardScaler] = None


def train_logistic_regression(records: list[dict], labels: list[int]):
    """Train on labelled data: label 1 = at-risk, 0 = fine."""
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
    return {"risk_score": round(float(prob), 4), "method": "logistic_regression",
            "category": _cat(float(prob))}


# ── Heuristic fallback ──────────────────────────────────────

def _heuristic_risk(record: dict) -> dict:
    """Simple rule-based risk when no model is trained."""
    pct = record.get("attendance_pct", 75)
    streak = record.get("consecutive_absences", 0)
    risk = 0.0
    risk += max(0, (75 - pct)) / 75 * 0.5  # low attendance
    risk += min(streak / 10, 1.0) * 0.3      # long absence streak
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


# ── Convenience: combined ────────────────────────────────────

def predict_risk(record: dict) -> dict:
    """Use best available model."""
    if _logreg is not None:
        return predict_risk_supervised(record)
    if _iso_forest is not None:
        return predict_risk_unsupervised(record)
    return _heuristic_risk(record)
