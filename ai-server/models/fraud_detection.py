# =============================================================
# 4. Fraud & Anomaly Detection Engine
#    (ai-server/models/fraud_detection.py)
# =============================================================
"""
Subsystem 4: Fraud & Anomaly Detection

Detection Layers:
  1. Distance anomaly     — GPS spoofing
  2. Device fingerprint   — unknown device
  3. IP anomaly           — suspicious IP patterns
  4. Behavioural anomaly  — Isolation Forest + One-Class SVM (PyOD)
  5. Cluster anomaly      — K-Means attendance pattern clustering

Models:
  - Isolation Forest (unsupervised anomaly)
  - One-Class SVM (boundary-based anomaly)
  - K-Means (pattern clustering)

Fraud Score Formula:
  fraud_score =
    0.4 × device_anomaly
  + 0.3 × location_anomaly
  + 0.2 × similarity_anomaly
  + 0.1 × behavior_anomaly

Advanced Features:
  ✔ Device fingerprint detection
  ✔ IP anomaly detection
  ✔ Attendance pattern profiling
  ✔ Fraud alerts dashboard
  ✔ Multi-student device detection
"""
from __future__ import annotations

import logging, hashlib, time
from collections import defaultdict
from typing import Optional

import numpy as np

from config import FRAUD_CONTAMINATION

logger = logging.getLogger("campusai.fraud")

# ── Lazy model holders ───────────────────────────────────────
_ocsvm = None
_iso = None
_kmeans = None
_scaler = None

# ── Device & IP tracking (in-memory) ─────────────────────────
_device_student_map: dict[str, set[str]] = defaultdict(set)
_ip_student_map: dict[str, set[str]] = defaultdict(set)
_student_attendance_times: dict[str, list[float]] = defaultdict(list)


# ── Feature extraction ───────────────────────────────────────

def _build_features(record: dict) -> np.ndarray:
    return np.array([
        record.get("distance_from_campus", 0),
        record.get("hour_of_day", 9),
        record.get("day_of_week", 1),
        record.get("attendance_pct", 75),
        record.get("face_similarity", 0.8),
        record.get("liveness_score", 0.7),
    ], dtype=np.float64).reshape(1, -1)


# ── Training ─────────────────────────────────────────────────

def train_fraud_model(records: list[dict]):
    """Train Isolation Forest + One-Class SVM + K-Means on normal attendance data."""
    global _ocsvm, _iso, _kmeans, _scaler
    if not records:
        return

    from pyod.models.ocsvm import OCSVM
    from pyod.models.iforest import IForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans

    X = np.vstack([_build_features(r) for r in records])
    _scaler = StandardScaler().fit(X)
    Xs = _scaler.transform(X)

    # One-Class SVM
    _ocsvm = OCSVM(contamination=FRAUD_CONTAMINATION)
    _ocsvm.fit(Xs)

    # Isolation Forest
    _iso = IForest(contamination=FRAUD_CONTAMINATION, random_state=42)
    _iso.fit(Xs)

    # K-Means for behaviour clustering (normal vs suspicious patterns)
    n_clusters = min(4, max(2, len(records) // 20))
    _kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    _kmeans.fit(Xs)

    logger.info(f"Fraud models trained on {len(records)} records (OCSVM + IForest + KMeans)")


# ── Device & IP Tracking ─────────────────────────────────────

def track_device(student_id: str, device_fingerprint: str, ip_address: str = ""):
    """Track device and IP usage per student for anomaly detection."""
    if device_fingerprint:
        _device_student_map[device_fingerprint].add(student_id)
    if ip_address:
        _ip_student_map[ip_address].add(student_id)
    _student_attendance_times[student_id].append(time.time())


def check_multi_student_device(device_fingerprint: str) -> dict:
    """Check if a device is being used by multiple students (proxy attendance)."""
    students = _device_student_map.get(device_fingerprint, set())
    return {
        "multi_student": len(students) > 1,
        "student_count": len(students),
        "flag": "PROXY_ATTENDANCE" if len(students) > 1 else None,
    }


def check_ip_anomaly(ip_address: str, student_id: str) -> dict:
    """Check for suspicious IP patterns."""
    students_on_ip = _ip_student_map.get(ip_address, set())
    # Many students from same IP is suspicious (unless campus WiFi)
    suspicious = len(students_on_ip) > 10  # Threshold for non-campus IPs
    return {
        "ip_suspicious": suspicious,
        "students_on_ip": len(students_on_ip),
        "flag": "IP_ANOMALY" if suspicious else None,
    }


def check_attendance_spike(student_id: str, window_s: float = 3600) -> dict:
    """Check for unrealistic attendance spikes (multiple marks in short window)."""
    times = _student_attendance_times.get(student_id, [])
    recent = [t for t in times if time.time() - t < window_s]
    spike = len(recent) > 3  # More than 3 attendance marks in 1 hour
    return {
        "spike_detected": spike,
        "marks_in_window": len(recent),
        "window_seconds": window_s,
        "flag": "ATTENDANCE_SPIKE" if spike else None,
    }


# ── Core Detection ───────────────────────────────────────────

def detect_fraud(record: dict) -> dict:
    """
    Multi-layer fraud detection with composite scoring.
    Uses: rule-based + ML-based (OCSVM + IForest + KMeans)
    """
    flags: list[str] = []
    details: dict = {}

    # Layer 1: Distance / GPS spoof
    dist = record.get("distance_from_campus", 0)
    location_anomaly = min(dist / 2000, 1.0) if dist > 500 else 0.0
    if dist > 500:
        flags.append("GPS_SPOOF")
        details["distance"] = dist

    # Layer 2: Device fingerprint
    device_anomaly = 0.0
    known_devices = record.get("known_devices", [])
    current_device = record.get("device_fingerprint", "")
    if current_device and known_devices and current_device not in known_devices:
        flags.append("DEVICE_MISMATCH")
        device_anomaly = 0.6
        details["device"] = current_device[:16]

    # Multi-student device check
    if current_device:
        multi = check_multi_student_device(current_device)
        if multi["multi_student"]:
            flags.append("PROXY_ATTENDANCE")
            device_anomaly = max(device_anomaly, 0.8)
            details["multi_student_device"] = multi["student_count"]

    # Layer 3: Time anomaly
    hour = record.get("hour_of_day", 9)
    if hour < 6 or hour > 22:
        flags.append("TIME_ANOMALY")
        details["hour"] = hour

    # Layer 4: IP anomaly
    ip = record.get("ip_address", "")
    student_id = record.get("student_id", "")
    if ip and student_id:
        ip_check = check_ip_anomaly(ip, student_id)
        if ip_check["ip_suspicious"]:
            flags.append("IP_ANOMALY")
            details["ip_students"] = ip_check["students_on_ip"]

    # Layer 5: Attendance spike
    if student_id:
        spike = check_attendance_spike(student_id)
        if spike["spike_detected"]:
            flags.append("ATTENDANCE_SPIKE")
            details["marks_in_hour"] = spike["marks_in_window"]

    # Layer 6: ML-based anomaly (OCSVM + IForest + KMeans)
    similarity_anomaly = 0.0
    behavior_anomaly = 0.0
    if _ocsvm is not None and _scaler is not None:
        X = _build_features(record)
        Xs = _scaler.transform(X)

        ocsvm_score = float(np.clip(_ocsvm.decision_function(Xs)[0], 0, 1))
        iso_score = float(np.clip(_iso.decision_function(Xs)[0], 0, 1))
        similarity_anomaly = (ocsvm_score + iso_score) / 2.0

        if _kmeans is not None:
            cluster = _kmeans.predict(Xs)[0]
            dist_to_center = float(np.linalg.norm(Xs - _kmeans.cluster_centers_[cluster]))
            behavior_anomaly = min(dist_to_center / 5.0, 1.0)

        if similarity_anomaly > 0.5:
            flags.append("PATTERN_ANOMALY")
        details["ml_ocsvm"] = round(ocsvm_score, 4)
        details["ml_iforest"] = round(iso_score, 4)
        details["ml_kmeans_dist"] = round(behavior_anomaly, 4)
    else:
        similarity_anomaly = _heuristic_fraud(record)
        if similarity_anomaly > 0.5:
            flags.append("PATTERN_ANOMALY")

    # Composite fraud score (weighted formula)
    fraud_score = (
        0.4 * device_anomaly +
        0.3 * location_anomaly +
        0.2 * similarity_anomaly +
        0.1 * behavior_anomaly
    )
    fraud_score = round(min(fraud_score, 1.0), 4)

    return {
        "fraud_score": fraud_score,
        "is_fraudulent": fraud_score > 0.5,
        "flags": flags,
        "details": details,
        "severity": (
            "CRITICAL" if fraud_score > 0.75 else
            "HIGH" if fraud_score > 0.5 else
            "MEDIUM" if fraud_score > 0.25 else "LOW"
        ),
        "components": {
            "device_anomaly": round(device_anomaly, 4),
            "location_anomaly": round(location_anomaly, 4),
            "similarity_anomaly": round(similarity_anomaly, 4),
            "behavior_anomaly": round(behavior_anomaly, 4),
        },
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


def get_fraud_dashboard() -> dict:
    """Get fraud dashboard summary for admin."""
    return {
        "tracked_devices": len(_device_student_map),
        "tracked_ips": len(_ip_student_map),
        "multi_student_devices": sum(1 for v in _device_student_map.values() if len(v) > 1),
        "suspicious_ips": sum(1 for v in _ip_student_map.values() if len(v) > 10),
        "students_tracked": len(_student_attendance_times),
    }
