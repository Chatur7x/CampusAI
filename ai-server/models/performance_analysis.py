# =============================================================
# 8. Performance Impact Analysis  (ai-server/models/performance_analysis.py)
# =============================================================
"""
Pearson correlation between attendance % and academic grades.
  r = covariance(x, y) / (σx × σy)

Also: grade prediction via simple linear regression.
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
    Compute Pearson r between attendance and grades.
    Returns {r, p_value, strength, interpretation}
    """
    if len(attendance_pcts) < 3 or len(attendance_pcts) != len(grades):
        return {"error": "Need ≥ 3 paired data points"}

    x = np.array(attendance_pcts, dtype=np.float64)
    y = np.array(grades, dtype=np.float64)

    r, p = stats.pearsonr(x, y)

    # Interpret
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
    }


def predict_grade(attendance_pct: float, historical_attendances: list[float], historical_grades: list[float]) -> dict:
    """
    Predict a grade given attendance_pct, using linear regression on historical data.
    """
    if len(historical_attendances) < 3:
        return {"error": "Need ≥ 3 data points for prediction"}

    x = np.array(historical_attendances, dtype=np.float64)
    y = np.array(historical_grades, dtype=np.float64)

    slope, intercept, r, p, se = stats.linregress(x, y)
    predicted = slope * attendance_pct + intercept
    predicted = max(0, min(100, predicted))  # clamp

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


def batch_correlation(
    subjects: list[dict],
) -> list[dict]:
    """
    Compute correlation for multiple subjects.
    subjects = [{"name": "Math", "attendances": [...], "grades": [...]}]
    """
    results = []
    for subj in subjects:
        corr = pearson_correlation(subj.get("attendances", []), subj.get("grades", []))
        corr["subject"] = subj.get("name", "Unknown")
        results.append(corr)
    return results
