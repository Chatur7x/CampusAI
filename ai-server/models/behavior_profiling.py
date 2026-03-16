# =============================================================
# 9. Attendance Behaviour Profiling  (ai-server/models/behavior_profiling.py)
# =============================================================
"""
KMeans clustering to segment students into behavioural profiles:
  - Regular          (high attendance, low variance)
  - Occasionally absent (medium attendance or high variance)
  - Chronic absentee (low attendance)

Features per student:
  attendance_pct, absence_streak_max, late_pct, variance_weekly
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

logger = logging.getLogger("campusai.behavior")

# ── Globals ──────────────────────────────────────────────────
_kmeans: Optional[KMeans] = None
_scaler: Optional[StandardScaler] = None
_cluster_labels: dict[int, str] = {}

PROFILE_NAMES = ["Regular", "Occasionally absent", "Chronic absentee"]


def _extract_features(record: dict) -> np.ndarray:
    return np.array([
        record.get("attendance_pct", 75),
        record.get("absence_streak_max", 0),
        record.get("late_pct", 0),
        record.get("variance_weekly", 5),
    ], dtype=np.float64).reshape(1, -1)


def train_profiles(records: list[dict], max_clusters: int = 5) -> dict:
    """
    Bio-Net v4: Self-Optimizing behavior clustering.
    Uses Silhouette Score to find optimal K and PCA for feature fusion.
    """
    global _kmeans, _scaler, _cluster_labels

    if len(records) < 5:
        return {"error": "Need ≥ 5 records for self-optimization"}

    X = np.vstack([_extract_features(r) for r in records])
    _scaler = StandardScaler().fit(X)
    Xs = _scaler.transform(X)

    # v4: PCA Feature Fusion (reduce noise/redundancy)
    pca = PCA(n_components=0.95) # Retain 95% variance
    Xp = pca.fit_transform(Xs)

    # v4: Find optimal clusters (Silhouette Score)
    best_k = 2
    best_score = -1
    
    for k in range(2, min(max_clusters + 1, len(records))):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(Xp)
        score = silhouette_score(Xp, labels)
        if score > best_score:
            best_score = score
            best_k = k

    _kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    _kmeans.fit(Xp)

    # Inverse transform centroids back to original feature space
    centres_p = _kmeans.cluster_centers_
    # centroids in scaled space: Centres_p -> centroids in Xs space -> inverse_transform to X space
    centres_s = pca.inverse_transform(centres_p)
    centres = _scaler.inverse_transform(centres_s)

    sorted_idx = np.argsort(-centres[:, 0])
    _cluster_labels = {}
    for rank, idx in enumerate(sorted_idx):
        _cluster_labels[int(idx)] = PROFILE_NAMES[min(rank, len(PROFILE_NAMES) - 1)]

    logger.info(f"Bio-Net v4 KMeans optimized: K={best_k}, score={best_score:.4f}")

    return {
        "n_clusters": n_clusters,
        "cluster_labels": _cluster_labels,
        "centres": [
            {"cluster": _cluster_labels.get(i, f"Cluster {i}"),
             "attendance_pct": round(centres[i][0], 2),
             "absence_streak_max": round(centres[i][1], 2),
             "late_pct": round(centres[i][2], 2),
             "variance_weekly": round(centres[i][3], 2)}
            for i in range(n_clusters)
        ],
        "total_records": len(records),
    }


def classify_student(record: dict) -> dict:
    """Assign a student to a behaviour profile."""
    if _kmeans is None or _scaler is None:
        return _heuristic_profile(record)

    X = _extract_features(record)
    Xs = _scaler.transform(X)
    cluster = int(_kmeans.predict(Xs)[0])
    label = _cluster_labels.get(cluster, f"Cluster {cluster}")

    # Distance to cluster centre (confidence proxy)
    dist = float(np.linalg.norm(Xs - _kmeans.cluster_centers_[cluster]))
    confidence = max(0, 1.0 - dist / 5.0)

    return {
        "profile": label,
        "cluster_id": cluster,
        "confidence": round(confidence, 4),
        "method": "kmeans",
    }


def _heuristic_profile(record: dict) -> dict:
    """Fallback when model not trained."""
    pct = record.get("attendance_pct", 75)
    if pct >= 85:
        profile = "Regular"
    elif pct >= 60:
        profile = "Occasionally absent"
    else:
        profile = "Chronic absentee"
    return {"profile": profile, "cluster_id": -1, "confidence": 0.5, "method": "heuristic"}


def batch_classify(records: list[dict]) -> list[dict]:
    """Classify many students at once."""
    return [{"student_id": r.get("student_id"), **classify_student(r)} for r in records]
