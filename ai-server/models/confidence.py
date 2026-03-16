# =============================================================
# 3. Confidence & Trust Scoring Engine
#    (ai-server/models/confidence.py)
# =============================================================
"""
Subsystem 3: Confidence & Trust Scoring

Formula:
  confidence =
    0.50 × face_similarity
  + 0.20 × liveness_score
  + 0.15 × geo_accuracy
  + 0.15 × device_trust

Categories:
  HIGH       ≥ 0.80  → Valid attendance (auto-approved)
  MEDIUM     ≥ 0.60  → Valid but flagged for random audit
  LOW        ≥ 0.40  → Require manual verification
  REJECTED   < 0.40  → Rejected

Advanced Features:
  ✔ Suspicious attendance flag
  ✔ Admin alert system
  ✔ Automatic re-verification trigger
  ✔ Device trust scoring
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from config import CONF_WEIGHT_FACE, CONF_WEIGHT_LIVENESS, CONF_WEIGHT_GEO, CONF_WEIGHT_DEVICE

logger = logging.getLogger("campusai.confidence")

WEIGHTS = {
    "face": CONF_WEIGHT_FACE,
    "liveness": CONF_WEIGHT_LIVENESS,
    "geo": CONF_WEIGHT_GEO,
    "device": CONF_WEIGHT_DEVICE,
}


@dataclass
class ConfidenceResult:
    score: float
    category: str
    breakdown: dict
    auto_approved: bool
    flags: list = field(default_factory=list)
    requires_reverification: bool = False
    admin_alert: bool = False


def compute_device_trust(
    device_fingerprint: Optional[str] = None,
    known_devices: Optional[list[str]] = None,
    ip_address: Optional[str] = None,
    known_ips: Optional[list[str]] = None,
) -> float:
    """
    Compute device trust score (0..1).
    1.0 = known device + known IP
    0.5 = unknown device or IP
    0.0 = suspicious combination
    """
    score = 0.5  # Neutral default

    if device_fingerprint and known_devices:
        if device_fingerprint in known_devices:
            score += 0.3
        else:
            score -= 0.2

    if ip_address and known_ips:
        if ip_address in known_ips:
            score += 0.2
        else:
            score -= 0.1

    return max(0.0, min(1.0, score))


def compute_confidence(
    face_similarity: float,
    liveness_score: float,
    geo_accuracy: float,
    device_trust: float = 0.5,
    impossible_travel: bool = False,
    device_risk: bool = False,
    session_mismatch: bool = False,
    proxy_location: bool = False,
    shared_device: bool = False,
) -> ConfidenceResult:
    """
    Bio-Net v4: Multi-Factor Probabilistic Collapse.
    Uses a non-linear approach: if any security pillar fails, the total confidence
    collapses exponentially rather than decreasing linearly.
    """
    import math
    
    # 1. Base components
    f = max(0.01, face_similarity)
    l = max(0.01, liveness_score)
    g = max(0.01, geo_accuracy)
    d = max(0.01, device_trust)
    
    # 2. Probability product (Geometric Mean based logic)
    # High confidence requires ALL factors to be high simultaneously
    base_prob = (f ** 0.5) * (l ** 0.2) * (g ** 0.15) * (d ** 0.15)
    
    # 3. Apply Multi-Factor penalties (Exponential Collapse)
    penalties = 1.0
    if session_mismatch: penalties *= 0.3
    if proxy_location: penalties *= 0.2
    if shared_device: penalties *= 0.7
    if impossible_travel: penalties *= 0.1
    
    score = base_prob * penalties
    
    # Sigmoid sharpening: accentuate the difference between 'good' and 'suspicious'
    # Centered at 0.6, alpha = 8
    score = 1.0 / (1.0 + math.exp(-8 * (score - 0.6)))
    score = round(max(0.0, min(1.0, score)), 4)

    # Category thresholds
    if score >= 0.85:
        category = "HIGH"
    elif score >= 0.65:
        category = "MEDIUM"
    elif score >= 0.45:
        category = "LOW"
    else:
        category = "REJECTED"

    # Suspicious flags
    flags: list[str] = []
    if face_similarity < 0.55: flags.append("LOW_FACE_SIMILARITY")
    if liveness_score < 0.5: flags.append("LIVENESS_CONCERN")
    if geo_accuracy < 0.4: flags.append("OUTSIDE_CAMPUS")
    if device_trust < 0.4: flags.append("UNKNOWN_DEVICE")
    if impossible_travel: flags.append("IMPOSSIBLE_TRAVEL")
    if device_risk: flags.append("HIGH_DEVICE_RISK")
    if session_mismatch: flags.append("SESSION_CODE_MISMATCH")
    if proxy_location: flags.append("PROXY_LOCATION_DETECTION")
    if shared_device: flags.append("SHARED_DEVICE_DETECTED")

    # Auto re-verification
    requires_reverification = category == "LOW" or len(flags) >= 2 or session_mismatch
    admin_alert = category == "REJECTED" or len(flags) >= 3 or proxy_location or impossible_travel

    return ConfidenceResult(
        score=score,
        category=category,
        breakdown={
            "face_similarity": round(face_similarity, 4),
            "liveness_score": round(liveness_score, 4),
            "geo_accuracy": round(geo_accuracy, 4),
            "device_trust": round(device_trust, 4),
            "weights": "Non-Linear Sigmoid (v4)",
        },
        auto_approved=category in ("HIGH", "MEDIUM") and len(flags) == 0,
        flags=flags,
        requires_reverification=requires_reverification,
        admin_alert=admin_alert,
    )
