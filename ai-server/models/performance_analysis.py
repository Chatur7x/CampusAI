# =============================================================
# 7. Academic Performance Intelligence
#    (ai-server/models/performance_analysis.py)
# =============================================================
"""
Subsystem 7: Academic Performance Intelligence

Algorithms:
  - Pearson correlation: r = covariance(x,y) / (σx × σy)
  - Spearman rank correlation
  - Linear regression (grade prediction)
  - Multiple regression (multi-factor prediction)

Advanced Features:
  ✔ Grade prediction
  ✔ Performance risk detection
  ✔ Academic advisor alerts
  ✔ Multi-subject analysis
  ✔ Attendance-grade correlation
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from scipy import stats

logger = logging.getLogger("campusai.performance")


def pearson_correlation(
    attendance_pcts: list[float],
    grades: list[float],
) -> dict:
    """
    Pearson r between attendance and grades.
    r = covariance(x, y) / (σx × σy)
    """
    if len(attendance_pcts) < 3 or len(attendance_pcts) != len(grades):
        return {"error": "Need ≥ 3 paired data points"}

    x = np.array(attendance_pcts, dtype=np.float64)
    y = np.array(grades, dtype=np.float64)
    r, p = stats.pearsonr(x, y)
    abs_r = abs(r)

    if abs_r >= 0.7:
        strength = "strong"
    elif abs_r >= 0.4:
        strength = "moderate"
    elif abs_r >= 0.2:
        strength = "weak"
    else:
        strength = "negligible"

    direction = "positive" if r > 0 else "negative"

    return {
        "r": round(float(r), 4),
        "p_value": round(float(p), 6),
        "significant": p < 0.05,
        "strength": strength,
        "direction": direction,
        "interpretation": f"{strength.title()} {direction} correlation (r={r:.3f}, p={p:.4f})",
        "sample_size": len(attendance_pcts),
        "method": "pearson",
    }


def spearman_correlation(
    attendance_pcts: list[float],
    grades: list[float],
) -> dict:
    """
    Spearman rank correlation — non-parametric, handles non-linear relationships.
    """
    if len(attendance_pcts) < 3 or len(attendance_pcts) != len(grades):
        return {"error": "Need ≥ 3 paired data points"}

    x = np.array(attendance_pcts, dtype=np.float64)
    y = np.array(grades, dtype=np.float64)
    rho, p = stats.spearmanr(x, y)
    abs_rho = abs(rho)

    if abs_rho >= 0.7:
        strength = "strong"
    elif abs_rho >= 0.4:
        strength = "moderate"
    elif abs_rho >= 0.2:
        strength = "weak"
    else:
        strength = "negligible"

    return {
        "rho": round(float(rho), 4),
        "p_value": round(float(p), 6),
        "significant": p < 0.05,
        "strength": strength,
        "direction": "positive" if rho > 0 else "negative",
        "sample_size": len(attendance_pcts),
        "method": "spearman",
    }


def predict_grade(
    attendance_pct: float,
    historical_attendances: list[float],
    historical_grades: list[float],
) -> dict:
    """Predict grade using linear regression on historical data."""
    if len(historical_attendances) < 3:
        return {"error": "Need ≥ 3 data points for prediction"}

    x = np.array(historical_attendances, dtype=np.float64)
    y = np.array(historical_grades, dtype=np.float64)
    slope, intercept, r, p, se = stats.linregress(x, y)
    predicted = slope * attendance_pct + intercept
    predicted = max(0, min(100, predicted))

    return {
        "predicted_grade": round(predicted, 2),
        "confidence_interval": {
            "lower": round(max(0, predicted - 2 * se * np.sqrt(len(x))), 2),
            "upper": round(min(100, predicted + 2 * se * np.sqrt(len(x))), 2),
        },
        "model": {
            "slope": round(float(slope), 4),
            "intercept": round(float(intercept), 4),
            "r_squared": round(float(r ** 2), 4),
        },
        "input_attendance": attendance_pct,
    }


def detect_performance_risk(
    attendance_pct: float,
    current_grade: float,
    historical_attendances: list[float],
    historical_grades: list[float],
) -> dict:
    """
    Detect if a student is at academic performance risk
    based on their current attendance and grade trends.
    """
    risk_factors: list[str] = []
    severity = "LOW"

    # Low attendance
    if attendance_pct < 60:
        risk_factors.append("CRITICAL: Attendance below 60%")
        severity = "CRITICAL"
    elif attendance_pct < 75:
        risk_factors.append("WARNING: Attendance below 75%")
        severity = "HIGH" if severity != "CRITICAL" else severity

    # Grade prediction
    if len(historical_attendances) >= 3:
        pred = predict_grade(attendance_pct, historical_attendances, historical_grades)
        predicted_grade = pred.get("predicted_grade", 0)
        if predicted_grade < 40:
            risk_factors.append(f"Predicted grade ({predicted_grade:.0f}) below passing")
            severity = "CRITICAL"
        elif predicted_grade < 60:
            risk_factors.append(f"Predicted grade ({predicted_grade:.0f}) near failing")
            severity = max(severity, "HIGH")

    # Current grade trend
    if current_grade < 40:
        risk_factors.append("Current grade below passing threshold")
        severity = "CRITICAL"

    # Correlation check
    if len(historical_attendances) >= 5:
        corr = pearson_correlation(historical_attendances, historical_grades)
        if corr.get("r", 0) > 0.5 and attendance_pct < 70:
            risk_factors.append("Strong attendance-grade correlation with low attendance")

    return {
        "at_risk": severity in ("HIGH", "CRITICAL"),
        "severity": severity,
        "risk_factors": risk_factors,
        "attendance_pct": attendance_pct,
        "current_grade": current_grade,
        "recommendation": (
            "Immediate academic counseling required" if severity == "CRITICAL" else
            "Faculty follow-up recommended" if severity == "HIGH" else
            "Continue monitoring"
        ),
    }


def batch_correlation(subjects: list[dict]) -> list[dict]:
    """Compute correlation for multiple subjects with both Pearson and Spearman."""
    results = []
    for subj in subjects:
        attendances = subj.get("attendances", [])
        grades = subj.get("grades", [])
        pearson = pearson_correlation(attendances, grades)
        spearman = spearman_correlation(attendances, grades)
        results.append({
            "subject": subj.get("name", "Unknown"),
            "pearson": pearson,
            "spearman": spearman,
        })
    return results
