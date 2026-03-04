# =============================================================
# 5. Attendance Trend Prediction  (ai-server/models/trend_prediction.py)
# =============================================================
"""
Two methods:
  1. Linear Regression:  y = mx + c
  2. ARIMA time-series forecasting (statsmodels)

Predicts future attendance rate over the next N weeks / semester.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("campusai.trend")


# ── Linear Regression (simple) ──────────────────────────────

def linear_trend(weekly_rates: list[float], forecast_weeks: int = 4) -> dict:
    """
    Fit y = mx + c on weekly attendance rates.
    Returns slope, intercept, predicted values, and R².
    """
    if len(weekly_rates) < 2:
        return {"error": "Need ≥2 data points", "predictions": []}

    x = np.arange(len(weekly_rates), dtype=np.float64)
    y = np.array(weekly_rates, dtype=np.float64)

    # y = mx + c  via least-squares
    n = len(x)
    sum_x = np.sum(x)
    sum_y = np.sum(y)
    sum_xy = np.sum(x * y)
    sum_x2 = np.sum(x ** 2)
    denom = n * sum_x2 - sum_x ** 2
    if denom == 0:
        m, c = 0.0, float(np.mean(y))
    else:
        m = float((n * sum_xy - sum_x * sum_y) / denom)
        c = float((sum_y - m * sum_x) / n)

    # R²
    y_pred = m * x + c
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # Forecast
    future_x = np.arange(n, n + forecast_weeks)
    predictions = [round(max(0, min(100, m * xi + c)), 2) for xi in future_x]

    return {
        "method": "linear_regression",
        "slope": round(m, 4),
        "intercept": round(c, 4),
        "r_squared": round(r2, 4),
        "predictions": predictions,
        "trend": "improving" if m > 0.5 else ("declining" if m < -0.5 else "stable"),
    }


# ── ARIMA ────────────────────────────────────────────────────

def arima_trend(weekly_rates: list[float], forecast_weeks: int = 4) -> dict:
    """
    ARIMA(1,1,1) time-series forecast.
    Falls back to linear if series too short or statsmodels unavailable.
    """
    if len(weekly_rates) < 8:
        return linear_trend(weekly_rates, forecast_weeks)

    try:
        from statsmodels.tsa.arima.model import ARIMA

        series = pd.Series(weekly_rates, dtype=np.float64)
        model = ARIMA(series, order=(1, 1, 1))
        fitted = model.fit()
        fc = fitted.forecast(steps=forecast_weeks)
        predictions = [round(max(0, min(100, v)), 2) for v in fc.values]

        return {
            "method": "arima",
            "order": [1, 1, 1],
            "aic": round(fitted.aic, 2),
            "predictions": predictions,
            "trend": _classify_trend(weekly_rates, predictions),
        }
    except Exception as e:
        logger.warning(f"ARIMA failed, falling back to linear: {e}")
        return linear_trend(weekly_rates, forecast_weeks)


def _classify_trend(hist: list[float], pred: list[float]) -> str:
    avg_hist = np.mean(hist[-4:]) if hist else 0
    avg_pred = np.mean(pred) if pred else 0
    diff = avg_pred - avg_hist
    if diff > 2:
        return "improving"
    elif diff < -2:
        return "declining"
    return "stable"


# ── Convenience ──────────────────────────────────────────────

def predict_trend(weekly_rates: list[float], forecast_weeks: int = 4) -> dict:
    """Auto-select best method based on data length."""
    if len(weekly_rates) >= 8:
        return arima_trend(weekly_rates, forecast_weeks)
    return linear_trend(weekly_rates, forecast_weeks)
