# =============================================================
# 6. Fraud / Anomaly Detection  (ai-server/models/fraud_detection.py)
# =============================================================
"""
Three detection layers:
  1. Distance anomaly     — location far from campus
  2. Device fingerprint   — new / unrecognised device
  3. Behavioural anomaly  — One-Class SVM + Isolation Forest (PyOD)

Flags:
  - GPS_SPOOF, PROXY_ATTENDANCE, DEVICE_MISMATCH, TIME_ANOMALY, PATTERN_ANOMALY
"""
from __future__ import annotations

import logging, hashlib
from typing import Optional

import numpy as np

logger = logging.getLogger("campusai.fraud")

# ── Lazy model holders ───────────────────────────────────────
_ocsvm = None
_iso = None
_scaler = None


# ── Feature extraction ───────────────────────────────────────

def _build_features(record: dict) -> np.ndarray:
    """
    Record keys:
      distance_from_campus, hour_of_day, day_of_week,
      device_hash, attendance_pct, face_similarity, liveness_score
    """
    return np.array([
        record.get("distance_from_campus", 0),
        record.get("hour_of_day", 9),
        record.get("day_of_week", 1),
        record.get("attendance_pct", 75),
        record.get("face_similarity", 0.8),
        record.get("liveness_score", 0.7),
    ], dtype=np.float64).reshape(1, -1)


# ── One-Class SVM  (from PyOD) ───────────────────────────────

def train_fraud_model(records: list[dict]):
    """Train One-Class SVM + Isolation Forest on normal attendance data."""
    global _ocsvm, _iso, _scaler
    if not records:
        return

    from pyod.models.ocsvm import OCSVM
    from pyod.models.iforest import IForest
    from sklearn.preprocessing import StandardScaler

    X = np.vstack([_build_features(r) for r in records])
    _scaler = StandardScaler().fit(X)
    Xs = _scaler.transform(X)

    _ocsvm = OCSVM(contamination=0.05)
    _ocsvm.fit(Xs)

    _iso = IForest(contamination=0.05, random_state=42)
    _iso.fit(Xs)

    logger.info(f"Fraud models trained on {len(records)} normal records")


def detect_fraud(record: dict) -> dict:
    """
    Return anomaly flags + combined fraud score.
    """
    flags: list[str] = []
    details: dict = {}

    # 1. Distance check
    dist = record.get("distance_from_campus", 0)
    if dist > 500:
        flags.append("GPS_SPOOF")
        details["distance"] = dist

    # 2. Device fingerprint
    known_devices = record.get("known_devices", [])
    current_device = record.get("device_fingerprint", "")
    if current_device and known_devices and current_device not in known_devices:
        flags.append("DEVICE_MISMATCH")
        details["device"] = current_device[:16]

    # 3. Time anomaly
    hour = record.get("hour_of_day", 9)
    if hour < 6 or hour > 22:
        flags.append("TIME_ANOMALY")
        details["hour"] = hour

    # 4. ML-based anomaly
    ml_score = 0.0
    if _ocsvm is not None and _scaler is not None:
        X = _build_features(record)
        Xs = _scaler.transform(X)
        ocsvm_score = float(_ocsvm.decision_function(Xs)[0])
        iso_score = float(_iso.decision_function(Xs)[0])
        ml_score = (ocsvm_score + iso_score) / 2.0
        ml_score = float(np.clip(ml_score, 0, 1))
        if ml_score > 0.5:
            flags.append("PATTERN_ANOMALY")
        details["ml_ocsvm"] = round(ocsvm_score, 4)
        details["ml_iforest"] = round(iso_score, 4)
    else:
        # Heuristic
        ml_score = _heuristic_fraud(record)
        if ml_score > 0.5:
            flags.append("PATTERN_ANOMALY")

    # Combined score
    rule_score = min(len(flags) * 0.25, 1.0)
    combined = 0.5 * rule_score + 0.5 * ml_score

    return {
        "fraud_score": round(combined, 4),
        "is_fraudulent": combined > 0.5,
        "flags": flags,
        "details": details,
        "severity": "CRITICAL" if combined > 0.75 else ("HIGH" if combined > 0.5 else ("MEDIUM" if combined > 0.25 else "LOW")),
    }


def _heuristic_fraud(record: dict) -> float:
    score = 0.0
    dist = record.get("distance_from_campus", 0)
    score += min(dist / 2000, 0.4)
    if record.get("face_similarity", 1) < 0.5:
        score += 0.3
    if record.get("liveness_score", 1) < 0.4:
        score += 0.3
    return min(score, 1.0)


def generate_device_fingerprint(user_agent: str, ip: str, screen_res: str = "") -> str:
    """Create a deterministic device hash."""
    raw = f"{user_agent}|{ip}|{screen_res}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
