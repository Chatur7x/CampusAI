# =============================================================
# 3. Smart Attendance Confidence Scoring  (ai-server/models/confidence.py)
# =============================================================
"""
Weighted formula:
  confidence = 0.6 × face_similarity + 0.2 × liveness_score + 0.2 × geo_accuracy

Categories:
  HIGH       ≥ 0.85
  MEDIUM     ≥ 0.60
  LOW        ≥ 0.40
  REJECTED   < 0.40
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger("campusai.confidence")


@dataclass
class ConfidenceResult:
    score: float
    category: str
    breakdown: dict
    auto_approved: bool


WEIGHTS = {"face": 0.6, "liveness": 0.2, "geo": 0.2}


def compute_confidence(
    face_similarity: float,
    liveness_score: float,
    geo_accuracy: float,
) -> ConfidenceResult:
    """
    Compute a weighted confidence score for an attendance mark.

    Args:
        face_similarity: 0..1 cosine similarity between probe and enrolled embedding
        liveness_score:  0..1 from liveness pipeline
        geo_accuracy:    0..1 (1 = on campus, decays with distance)
    """
    face_similarity = max(0.0, min(1.0, face_similarity))
    liveness_score  = max(0.0, min(1.0, liveness_score))
    geo_accuracy    = max(0.0, min(1.0, geo_accuracy))

    score = (
        WEIGHTS["face"]     * face_similarity +
        WEIGHTS["liveness"] * liveness_score +
        WEIGHTS["geo"]      * geo_accuracy
    )
    score = round(score, 4)

    if score >= 0.85:
        category = "HIGH"
    elif score >= 0.60:
        category = "MEDIUM"
    elif score >= 0.40:
        category = "LOW"
    else:
        category = "REJECTED"

    return ConfidenceResult(
        score=score,
        category=category,
        breakdown={
            "face_similarity": round(face_similarity, 4),
            "liveness_score": round(liveness_score, 4),
            "geo_accuracy": round(geo_accuracy, 4),
            "weights": WEIGHTS,
        },
        auto_approved=category in ("HIGH", "MEDIUM"),
    )
