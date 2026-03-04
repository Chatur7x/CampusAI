# =============================================================
# 7. Geo-location Validation  (ai-server/models/geo_validation.py)
# =============================================================
"""
Validates student location against campus coordinates.
  distance = Haversine(lat1, lon1, lat2, lon2)
  valid = distance ≤ campus_radius

Also checks for GPS spoofing indicators:
  - Mock location flag
  - Impossible speed (>120 km/h between consecutive checks)
"""
from __future__ import annotations

import logging, math
from typing import Optional

from config import CAMPUS_LAT, CAMPUS_LON, CAMPUS_RADIUS_M

logger = logging.getLogger("campusai.geo")


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine distance in metres.
    """
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def validate_location(
    lat: float,
    lon: float,
    accuracy_m: float = 0,
    campus_lat: float = CAMPUS_LAT,
    campus_lon: float = CAMPUS_LON,
    radius_m: float = CAMPUS_RADIUS_M,
) -> dict:
    """
    Check if (lat, lon) is within campus radius.
    Returns {
        "valid": bool,
        "distance_m": float,
        "radius_m": float,
        "geo_accuracy": float (0..1, 1=on campus)
    }
    """
    dist = haversine(lat, lon, campus_lat, campus_lon)

    # Accuracy factor: if GPS accuracy > 100 m, reduce confidence
    acc_factor = max(0.3, 1.0 - (accuracy_m / 500.0)) if accuracy_m > 0 else 1.0

    # Geo accuracy score (1 at campus, decays linearly to 0 at 2× radius)
    if dist <= radius_m:
        geo_acc = 1.0 * acc_factor
    elif dist <= 2 * radius_m:
        geo_acc = (1.0 - (dist - radius_m) / radius_m) * acc_factor
    else:
        geo_acc = 0.0

    return {
        "valid": dist <= radius_m,
        "distance_m": round(dist, 2),
        "radius_m": radius_m,
        "geo_accuracy": round(max(0.0, min(1.0, geo_acc)), 4),
    }


def detect_gps_spoof(
    current_lat: float,
    current_lon: float,
    prev_lat: Optional[float] = None,
    prev_lon: Optional[float] = None,
    time_delta_s: Optional[float] = None,
    is_mock: bool = False,
) -> dict:
    """
    Simple GPS spoofing heuristics.
    """
    flags: list[str] = []

    if is_mock:
        flags.append("MOCK_LOCATION")

    # Impossible speed check
    if prev_lat is not None and prev_lon is not None and time_delta_s and time_delta_s > 0:
        dist = haversine(current_lat, current_lon, prev_lat, prev_lon)
        speed_kmh = (dist / time_delta_s) * 3.6
        if speed_kmh > 120:
            flags.append("IMPOSSIBLE_SPEED")

    return {
        "spoofing_suspected": len(flags) > 0,
        "flags": flags,
    }
