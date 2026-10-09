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

# Severity ordering. String comparison is lexicographic ("L" > "H"), so the
# labels must never be compared or max()ed directly.
SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def escalate_severity(current: str, candidate: str) -> str:
    """Return the more severe of two severity labels."""
    if SEVERITY_RANK.get(candidate, 0) > SEVERITY_RANK.get(current, 0):
        return candidate
    return current


def _fit_line(x: np.ndarray, y: np.ndarray):
    """
    Least-squares fit of y on x with an explicit zero-variance fallback.

    ``stats.linregress`` returns a NaN slope/intercept when x has no variance,
    and the caller cannot clamp NaN into a valid answer. With a constant
    predictor the slope is exactly 0 and the only defensible intercept is the
    mean of y, so we return that instead of propagating NaN.
    """
    x_mean = float(np.mean(x))
    if float(np.sum((x - x_mean) ** 2)) > 0:
        slope, intercept, r, p, _se = stats.linregress(x, y)
        return float(slope), float(intercept), float(r), float(p)
    y_mean = float(np.mean(y))
    return 0.0, y_mean, 0.0, 1.0


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
    if float(np.std(x)) == 0.0 or float(np.std(y)) == 0.0:
        # Pearson r is undefined without variance; reporting NaN here would
        # surface a bogus direction ("negative") and strength to the caller.
        return {"error": "Need variance in both attendance and grades"}
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
    if float(np.std(x)) == 0.0 or float(np.std(y)) == 0.0:
        # Rank correlation is likewise undefined without variance.
        return {"error": "Need variance in both attendance and grades"}
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
    import math

    if not math.isfinite(attendance_pct):
        return {"error": "attendance_pct must be a finite number"}
    xa = [float(v) for v in (historical_attendances or [])]
    ya = [float(v) for v in (historical_grades or [])]
    if (
        len(xa) < 3
        or len(xa) != len(ya)
        or not all(math.isfinite(v) for v in xa + ya)
    ):
        return {"error": "Need at least 3 finite paired data points for prediction"}

    x = np.array(xa, dtype=np.float64)
    y = np.array(ya, dtype=np.float64)
    slope, intercept, r, p = _fit_line(x, y)
    predicted = slope * attendance_pct + intercept
    predicted = max(0, min(100, predicted))

    # Prediction interval from residual standard error (not the slope SE):
    # wider when data is noisy or the query point is far from the mean.
    n = len(x)
    residuals = y - (slope * x + intercept)
    s_err = float(np.sqrt(np.sum(residuals ** 2) / max(n - 2, 1)))
    x_mean = float(np.mean(x))
    ss_x = float(np.sum((x - x_mean) ** 2))
    if ss_x > 0 and n > 2:
        se_pred = s_err * math.sqrt(1 + 1 / n + (attendance_pct - x_mean) ** 2 / ss_x)
        margin = float(stats.t.ppf(0.975, n - 2)) * se_pred
    else:
        margin = 2 * s_err

    return {
        "predicted_grade": round(float(predicted), 2),
        "confidence_interval": {
            "lower": round(float(max(0, predicted - margin)), 2),
            "upper": round(float(min(100, predicted + margin)), 2),
        },
        "model": {
            "slope": round(float(slope), 4),
            "intercept": round(float(intercept), 4),
            "r_squared": round(float(r ** 2), 4),
        },
        "input_attendance": attendance_pct,
    }


def predict_performance_v4(
    attendance_pct: float,
    historical_attendances: list[float],
    historical_grades: list[float],
) -> dict:
    """
    Bio-Net v4: Probabilistic Performance Projection.
    Uses Bayesian linear regression logic to provide uncertainty intervals.
    """
    if len(historical_attendances) < 5:
        return predict_grade(attendance_pct, historical_attendances, historical_grades)

    x = np.array(historical_attendances, dtype=np.float64)
    y = np.array(historical_grades, dtype=np.float64)
    
    slope, intercept, r, p = _fit_line(x, y)
    
    # Calculate projection
    predicted = slope * attendance_pct + intercept
    predicted = float(np.clip(predicted, 0, 100))
    
    # Uncertainty estimation (t-distribution based)
    n = len(x)
    dof = n - 2
    t_val = stats.t.ppf(0.975, dof) # 95% CI
    
    # Standard error of prediction. Guard ss_x == 0 (constant attendance):
    # the leverage term is undefined there and would emit NaN into the
    # response body, which is not valid JSON.
    x_mean = np.mean(x)
    ss_x = float(np.sum((x - x_mean)**2))
    if ss_x > 0:
        _slope_se, _intercept_se, _r, _p, se = stats.linregress(x, y)
        s_err = se * np.sqrt(1 + 1/n + (attendance_pct - x_mean)**2 / ss_x)
    else:
        residuals = y - (slope * x + intercept)
        s_err = float(np.sqrt(np.sum(residuals**2) / max(n - 2, 1)))
    
    margin = t_val * s_err
    
    return {
        "projected_grade": round(predicted, 2),
        "uncertainty_margin": round(margin, 2),
        "range": [round(max(0, predicted - margin), 2), round(min(100, predicted + margin), 2)],
        "r_squared": round(float(r**2), 4),
        "method": "probabilistic_projection_v4",
        "stability": "stable" if margin < 10 else "volatile"
    }


def detect_performance_risk(
    attendance_pct: float,
    current_grade: float,
    historical_attendances: list[float],
    historical_grades: list[float],
    absence_streak: int = 0,
) -> dict:
    """
    Detect if a student is at academic performance risk
    based on their current attendance and grade trends.
    """
    risk_factors: list[str] = []
    severity = "LOW"

    # Consecutive-absence streak (F-5: previously dropped by the route adapter)
    try:
        streak = int(absence_streak or 0)
    except (TypeError, ValueError):
        streak = 0
    if streak >= 5:
        risk_factors.append(f"CRITICAL: {streak} consecutive absences")
        severity = "CRITICAL"
    elif streak >= 3:
        risk_factors.append(f"WARNING: {streak} consecutive absences")
        severity = escalate_severity(severity, "HIGH")

    # Low attendance
    if attendance_pct < 60:
        risk_factors.append("CRITICAL: Attendance below 60%")
        severity = "CRITICAL"
    elif attendance_pct < 75:
        risk_factors.append("WARNING: Attendance below 75%")
        severity = escalate_severity(severity, "HIGH")

    # Grade prediction
    if len(historical_attendances) >= 3:
        pred = predict_grade(attendance_pct, historical_attendances, historical_grades)
        predicted_grade = pred.get("predicted_grade", 0)
        if predicted_grade < 40:
            risk_factors.append(f"Predicted grade ({predicted_grade:.0f}) below passing")
            severity = "CRITICAL"
        elif predicted_grade < 60:
            risk_factors.append(f"Predicted grade ({predicted_grade:.0f}) near failing")
            severity = escalate_severity(severity, "HIGH")

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
