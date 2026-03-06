# =============================================================
# 6. Attendance Trend Forecasting
#    (ai-server/models/trend_prediction.py)
# =============================================================
"""
Subsystem 6: Attendance Trend Forecasting

Models:
  1. Linear Regression:  y = mx + c
  2. ARIMA(1,1,1) time-series (statsmodels)
  3. Prophet (Facebook/Meta) — seasonal decomposition
  4. Moving Average — smoothed trend

Advanced Features:
  ✔ Semester attendance forecasting
  ✔ Attendance trajectory graph
  ✔ Intervention suggestions
  ✔ Multi-method comparison
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("campusai.trend")


# ── Linear Regression ────────────────────────────────────────

def linear_trend(weekly_rates: list[float], forecast_weeks: int = 4) -> dict:
    """Fit y = mx + c on weekly attendance rates."""
    if len(weekly_rates) < 2:
        return {"error": "Need ≥2 data points", "predictions": []}

    x = np.arange(len(weekly_rates), dtype=np.float64)
    y = np.array(weekly_rates, dtype=np.float64)

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

    y_pred = m * x + c
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

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
    """ARIMA(1,1,1) time-series forecast."""
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


# ── Prophet (Facebook/Meta) ──────────────────────────────────

def prophet_trend(weekly_rates: list[float], forecast_weeks: int = 4) -> dict:
    """
    Facebook Prophet time-series forecast with automatic seasonality.
    Best for data with strong seasonal patterns.
    """
    if len(weekly_rates) < 10:
        return linear_trend(weekly_rates, forecast_weeks)

    try:
        from prophet import Prophet

        # Prophet expects DataFrame with 'ds' and 'y' columns
        dates = pd.date_range(end=pd.Timestamp.now(), periods=len(weekly_rates), freq="W")
        df = pd.DataFrame({"ds": dates, "y": weekly_rates})

        model = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
        )
        model.fit(df)

        future = model.make_future_dataframe(periods=forecast_weeks, freq="W")
        forecast = model.predict(future)

        predictions = forecast.tail(forecast_weeks)["yhat"].tolist()
        predictions = [round(max(0, min(100, v)), 2) for v in predictions]

        return {
            "method": "prophet",
            "predictions": predictions,
            "trend": _classify_trend(weekly_rates, predictions),
            "changepoints": len(model.changepoints),
        }
    except ImportError:
        logger.warning("Prophet not installed, falling back to ARIMA")
        return arima_trend(weekly_rates, forecast_weeks)
    except Exception as e:
        logger.warning(f"Prophet failed: {e}")
        return arima_trend(weekly_rates, forecast_weeks)


# ── Moving Average ───────────────────────────────────────────

def moving_average_trend(weekly_rates: list[float], forecast_weeks: int = 4, window: int = 3) -> dict:
    """
    Simple/Exponential Moving Average forecast.
    Smooths noise and extrapolates recent trend.
    """
    if len(weekly_rates) < window:
        return linear_trend(weekly_rates, forecast_weeks)

    series = np.array(weekly_rates, dtype=np.float64)

    # Simple Moving Average
    sma = np.convolve(series, np.ones(window) / window, mode="valid")

    # Exponential Moving Average (more weight to recent values)
    alpha = 2.0 / (window + 1)
    ema = [series[0]]
    for val in series[1:]:
        ema.append(alpha * val + (1 - alpha) * ema[-1])
    ema = np.array(ema)

    # Forecast using EMA momentum
    last_ema = ema[-1]
    momentum = (ema[-1] - ema[-min(window, len(ema))]) / min(window, len(ema))
    predictions = []
    for i in range(forecast_weeks):
        pred = last_ema + momentum * (i + 1)
        predictions.append(round(max(0, min(100, pred)), 2))

    return {
        "method": "moving_average",
        "window": window,
        "last_sma": round(float(sma[-1]), 2),
        "last_ema": round(float(last_ema), 2),
        "momentum": round(float(momentum), 4),
        "predictions": predictions,
        "trend": _classify_trend(weekly_rates, predictions),
    }


# ── Multi-Method Comparison ──────────────────────────────────

def compare_methods(weekly_rates: list[float], forecast_weeks: int = 4) -> dict:
    """Run all available methods and compare predictions."""
    results = {}
    results["linear"] = linear_trend(weekly_rates, forecast_weeks)
    results["moving_average"] = moving_average_trend(weekly_rates, forecast_weeks)

    if len(weekly_rates) >= 8:
        results["arima"] = arima_trend(weekly_rates, forecast_weeks)

    if len(weekly_rates) >= 10:
        results["prophet"] = prophet_trend(weekly_rates, forecast_weeks)

    # Average of all method predictions
    all_predictions = [r["predictions"] for r in results.values() if "predictions" in r and r["predictions"]]
    if all_predictions:
        ensemble = []
        for i in range(forecast_weeks):
            vals = [p[i] for p in all_predictions if i < len(p)]
            ensemble.append(round(np.mean(vals), 2))
        results["ensemble"] = {
            "method": "ensemble_average",
            "predictions": ensemble,
            "methods_used": list(results.keys()),
            "trend": _classify_trend(weekly_rates, ensemble),
        }

    return results


# ── Intervention Suggestions ─────────────────────────────────

def suggest_intervention(weekly_rates: list[float]) -> dict:
    """Generate attendance intervention suggestions based on trend analysis."""
    if len(weekly_rates) < 3:
        return {"suggestion": "Insufficient data for analysis"}

    current_avg = float(np.mean(weekly_rates[-3:]))
    overall_avg = float(np.mean(weekly_rates))
    trend = linear_trend(weekly_rates, 2)
    slope = trend.get("slope", 0)

    suggestions: list[str] = []
    severity = "LOW"

    if current_avg < 60:
        suggestions.append("CRITICAL: Attendance below 60% — immediate intervention required")
        severity = "CRITICAL"
    elif current_avg < 75:
        suggestions.append("WARNING: Attendance below 75% — faculty notification recommended")
        severity = "HIGH"

    if slope < -2:
        suggestions.append("Declining trend detected — early warning alert")
        severity = max(severity, "MEDIUM")

    if current_avg < overall_avg - 10:
        suggestions.append("Recent drop from historical average — check for issues")

    if not suggestions:
        suggestions.append("Attendance on track — no intervention needed")

    return {
        "current_3week_avg": round(current_avg, 1),
        "overall_avg": round(overall_avg, 1),
        "trend_slope": round(slope, 4),
        "severity": severity,
        "suggestions": suggestions,
    }


# ── Helpers ──────────────────────────────────────────────────

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
    if len(weekly_rates) >= 10:
        return prophet_trend(weekly_rates, forecast_weeks)
    if len(weekly_rates) >= 8:
        return arima_trend(weekly_rates, forecast_weeks)
    if len(weekly_rates) >= 3:
        return moving_average_trend(weekly_rates, forecast_weeks)
    return linear_trend(weekly_rates, forecast_weeks)
