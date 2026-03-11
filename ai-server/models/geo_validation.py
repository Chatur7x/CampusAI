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

    # Impossible speed check (Short term spoofing - e.g. jumping between buildings)
    if prev_lat is not None and prev_lon is not None and time_delta_s and time_delta_s > 0:
        dist = haversine(current_lat, current_lon, prev_lat, prev_lon)
        speed_kmh = (dist / time_delta_s) * 3.6
        if speed_kmh > 120:
            flags.append("IMPOSSIBLE_SPEED")

    return {
        "spoofing_suspected": len(flags) > 0,
        "flags": flags,
    }


def check_impossible_travel(
    current_lat: float,
    current_lon: float,
    last_lat: float,
    last_lon: float,
    last_timestamp: str | float,  # ISO string or unix timestamp
) -> dict:
    """
    Impossible Travel (Velocity) Check.
    Detects if a user has checked in from two distant locations faster than possible.
    """
    import datetime
    
    # 1. Parse time
    now = datetime.datetime.now(datetime.timezone.utc)
    if isinstance(last_timestamp, str):
        try:
            # Handle Supabase style timestamps
            last_t = datetime.datetime.fromisoformat(last_timestamp.replace('Z', '+00:00'))
        except ValueError:
            return {"impossible": False, "reason": "invalid_timestamp"}
    else:
        last_t = datetime.datetime.fromtimestamp(last_timestamp, datetime.timezone.utc)
        
    delta_s = (now - last_t).total_seconds()
    if delta_s <= 0:
        return {"impossible": False, "reason": "invalid_delta"}
        
    # 2. Calculate distance
    dist_m = haversine(current_lat, current_lon, last_lat, last_lon)
    dist_km = dist_m / 1000.0
    
    # 3. Calculate required velocity (km/h)
    velocity_kmh = (dist_km / (delta_s / 3600.0))
    
    # Heuristics:
    # - If distance > 5km and velocity > 1000 km/h (Faster than a jet)
    # - If distance > 100km and velocity > 500 km/h
    # - If distance < 5km, we ignore (likely GPS jitter/accuracy issues)
    
    is_impossible = False
    if dist_km > 2 and velocity_kmh > 1000:
        is_impossible = True
    elif dist_km > 100 and velocity_kmh > 600:
        is_impossible = True
        
    return {
        "impossible": is_impossible,
        "velocity_kmh": round(velocity_kmh, 2),
        "distance_km": round(dist_km, 2),
        "time_delta_mins": round(delta_s / 60.0, 2)
    }

