# =============================================================
# 10. Model Monitoring & Retraining  (ai-server/models/monitoring.py)
# =============================================================
"""
Tracks model performance via MLflow-style metrics.
Detects:
  - Accuracy drift (moving window)
  - Prediction drift (PSI – Population Stability Index)
  - Data drift (feature distribution shift)
Auto-retraining trigger when drift exceeds threshold.
"""
from __future__ import annotations

import logging, time, json, os
from typing import Optional
from collections import deque

import numpy as np

logger = logging.getLogger("campusai.monitoring")

# ── MLflow integration (optional) ────────────────────────────
_mlflow_available = False
try:
    import mlflow
    _mlflow_available = True
except ImportError:
    logger.info("mlflow not installed — monitoring will use local storage")


# ── In-memory metric store (fallback) ────────────────────────
_metrics: dict[str, deque] = {}
_WINDOW = 100


def _store(model_name: str, metric: str, value: float):
    key = f"{model_name}.{metric}"
    if key not in _metrics:
        _metrics[key] = deque(maxlen=_WINDOW)
    _metrics[key].append({"value": value, "ts": time.time()})


# ── Public API ───────────────────────────────────────────────

def log_prediction(
    model_name: str,
    input_data: dict,
    prediction: dict,
    actual: Optional[dict] = None,
):
    """Log a single prediction (and optionally the ground truth)."""
    _store(model_name, "predictions", 1)

    if _mlflow_available:
        try:
            with mlflow.start_run(run_name=f"{model_name}_pred", nested=True):
                mlflow.log_param("model", model_name)
                for k, v in prediction.items():
                    if isinstance(v, (int, float)):
                        mlflow.log_metric(f"pred_{k}", v)
                if actual:
                    for k, v in actual.items():
                        if isinstance(v, (int, float)):
                            mlflow.log_metric(f"actual_{k}", v)
        except Exception as e:
            logger.debug(f"MLflow log failed: {e}")


def log_accuracy(model_name: str, accuracy: float):
    """Log accuracy metric for drift detection."""
    _store(model_name, "accuracy", accuracy)
    if _mlflow_available:
        try:
            mlflow.log_metric(f"{model_name}_accuracy", accuracy)
        except Exception:
            pass


def check_drift(model_name: str) -> dict:
    """
    Check for accuracy drift using a moving window.
    Returns {"drift_detected": bool, "current_avg": float, "baseline_avg": float}
    """
    key = f"{model_name}.accuracy"
    vals = _metrics.get(key, deque())
    if len(vals) < 20:
        return {"drift_detected": False, "reason": "Insufficient data", "samples": len(vals)}

    values = [v["value"] for v in vals]
    half = len(values) // 2
    baseline = np.mean(values[:half])
    current = np.mean(values[half:])
    drop = baseline - current

    return {
        "drift_detected": drop > 0.05,   # >5% accuracy drop = drift
        "baseline_avg": round(float(baseline), 4),
        "current_avg": round(float(current), 4),
        "drop": round(float(drop), 4),
        "samples": len(values),
        "recommendation": "retrain" if drop > 0.05 else "ok",
    }


def psi(expected: list[float], actual: list[float], bins: int = 10) -> float:
    """
    Population Stability Index.
    PSI < 0.1  → no shift
    PSI 0.1-0.2 → moderate shift
    PSI > 0.2  → significant shift
    """
    e = np.array(expected)
    a = np.array(actual)
    breakpoints = np.linspace(min(e.min(), a.min()), max(e.max(), a.max()), bins + 1)

    e_counts = np.histogram(e, bins=breakpoints)[0] + 1
    a_counts = np.histogram(a, bins=breakpoints)[0] + 1

    e_pct = e_counts / e_counts.sum()
    a_pct = a_counts / a_counts.sum()

    return float(np.sum((a_pct - e_pct) * np.log(a_pct / e_pct)))


def check_data_drift(model_name: str, baseline_features: list[float], current_features: list[float]) -> dict:
    """Check for data drift using PSI."""
    psi_val = psi(baseline_features, current_features)
    return {
        "psi": round(psi_val, 4),
        "drift_detected": psi_val > 0.1,
        "severity": "significant" if psi_val > 0.2 else ("moderate" if psi_val > 0.1 else "none"),
        "model": model_name,
    }


def get_model_health(model_name: str) -> dict:
    """Aggregate health report for a model."""
    drift = check_drift(model_name)
    key_pred = f"{model_name}.predictions"
    pred_count = len(_metrics.get(key_pred, []))

    return {
        "model": model_name,
        "total_predictions": pred_count,
        "accuracy_drift": drift,
        "status": "healthy" if not drift["drift_detected"] else "degraded",
    }


def get_all_models_health() -> list[dict]:
    """Health report for all tracked models."""
    model_names = set()
    for key in _metrics:
        model_names.add(key.split(".")[0])
    return [get_model_health(m) for m in sorted(model_names)]


def jensen_shannon_divergence(p: np.ndarray, q: np.ndarray) -> float:
    """
    Bio-Net v4: Advanced Drift Metric (JSD).
    Symmetric and smoother than KL Divergence.
    """
    m = 0.5 * (p + q)
    return 0.5 * (stats.entropy(p, m) + stats.entropy(q, m))


def check_advanced_drift(model_name: str, baseline: list[float], current: list[float]) -> dict:
    """
    Bio-Net v4: JSD-based drift detection.
    """
    from scipy import stats # imported here if not global
    
    # Normalize to probability distributions
    hist_b, bin_edges = np.histogram(baseline, bins=10, density=True)
    hist_c, _ = np.histogram(current, bins=bin_edges, density=True)
    
    # Add epsilon to avoid log(0)
    hist_b += 1e-10
    hist_c += 1e-10
    
    jsd_val = jensen_shannon_divergence(hist_b, hist_c)
    
    return {
        "jsd_score": round(float(jsd_val), 4),
        "drift_detected": jsd_val > 0.05,
        "severity": "CRITICAL" if jsd_val > 0.1 else ("MODERATE" if jsd_val > 0.05 else "LOW"),
        "timestamp": time.time()
    }


def get_system_health_hud() -> dict:
    """
    Bio-Net v4: Unified Model Health HUD.
    Aggregates metrics across all optimized modules.
    """
    health = get_all_models_health()
    status = "OPTIMAL"
    
    for m in health:
        if m["status"] == "degraded":
            status = "ATTENTION_REQUIRED"
            break
            
    return {
        "system_status": status,
        "model_reports": health,
        "last_audit": time.time(),
        "engine": "Bio-Net v4 Autonomous Overseer"
    }
