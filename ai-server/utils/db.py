# =============================================================
# Supabase DB helper  (ai-server/utils/db.py)
# =============================================================
from __future__ import annotations

import logging
import time
import datetime
from functools import lru_cache
from typing import Dict, Tuple, Any

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger("campusai.db")

# ── Caching Logic ──────────────────────────────────────────
# Simple in-memory TTL cache to reduce database load during peak attendance hours.
_CACHE: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 minutes

def get_from_cache(key: str) -> Any:
    if key in _CACHE:
        timestamp, data = _CACHE[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
        del _CACHE[key]
    return None

def set_to_cache(key: str, data: Any):
    _CACHE[key] = (time.time(), data)

def invalidate_cache(key_prefix: str):
    """Invalidate all keys starting with prefix."""
    to_del = [k for k in _CACHE if k.startswith(key_prefix)]
    for k in to_del:
        del _CACHE[k]

@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a singleton Supabase service-role client."""
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("Supabase client initialized")
    return client


# ── Column name helpers ──────────────────────────────────────
# The DB may use camelCase (Prisma) or snake_case (migration 001).
# We try camelCase first, then fall back to snake_case.

_COL_MAP = {
    "userId": ["userId", "user_id"],
    "classId": ["classId", "class_id"],
    "studentId": ["studentId", "student_id"],
    "faceData": ["faceData", "face_data"],
    "faceRegistered": ["faceRegistered", "face_registered"],
    "enrollmentId": ["enrollmentId", "enrollment_id"],
}

def _col(name: str) -> str:
    """Return the first column alias that exists. Defaults to camelCase."""
    return _COL_MAP.get(name, [name])[0]


def _try_query(sb, table: str, select: str, eq_col: str, eq_val, single: bool = True):
    """Try query with camelCase column, fall back to snake_case."""
    aliases = _COL_MAP.get(eq_col, [eq_col])
    for col in aliases:
        try:
            q = sb.table(table).select(select).eq(col, eq_val)
            res = q.maybe_single().execute() if single else q.execute()
            if res.data is not None:
                return res
        except Exception:
            continue
    # Final attempt with first alias
    q = sb.table(table).select(select).eq(aliases[0], eq_val)
    return q.maybe_single().execute() if single else q.execute()


# ── Convenience helpers ──────────────────────────────────────

def fetch_student(student_id: str) -> dict | None:
    cache_key = f"student_{student_id}"
    cached = get_from_cache(cache_key)
    if cached: return cached

    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student_id).maybe_single().execute()
    if res.data:
        set_to_cache(cache_key, res.data)
    return res.data


def fetch_student_by_user(user_id: str) -> dict | None:
    cache_key = f"user_{user_id}"
    cached = get_from_cache(cache_key)
    if cached: return cached

    sb = get_supabase()
    res = _try_query(sb, "students", "*", "userId", user_id, single=True)
    if res.data:
        set_to_cache(cache_key, res.data)
        set_to_cache(f"student_{res.data['id']}", res.data)
    return res.data


def update_face_data(student_id: str, embedding_json: str):
    sb = get_supabase()
    # Invalidate caches
    invalidate_cache(f"student_{student_id}")
    student = fetch_student(student_id)
    if student:
        invalidate_cache(f"user_{student.get('userId', student.get('user_id', ''))}")
    invalidate_cache(f"embeddings_{student_id}")

    # 1. Update the student record to mark face_registered=True (and preserve legacy faceData field for backwards compat)
    try:
        sb.table("students").update({
            "faceData": embedding_json,
            "faceRegistered": True,
        }).eq("id", student_id).execute()
    except Exception:
        sb.table("students").update({
            "face_data": embedding_json,
            "face_registered": True,
        }).eq("id", student_id).execute()
    
    # 2. Insert the embedding into the new time-series historical table
    insert_face_embedding(student_id, embedding_json, confidence=1.0)


def insert_face_embedding(student_id: str, embedding_json: str, confidence: float = 1.0):
    """Insert a new vector into the historical embeddings table."""
    sb = get_supabase()
    invalidate_cache(f"embeddings_{student_id}")
    try:
        sb.table("face_embeddings").insert({
            "student_id": student_id,
            "embedding_vector": embedding_json,
            "confidence": confidence,
        }).execute()
        logger.info(f"Inserted new historical embedding for student {student_id}")
    except Exception as e:
        logger.error(f"Failed to insert into face_embeddings: {e}")


def fetch_student_embeddings(student_id: str) -> list[dict]:
    """Fetch all historical embeddings for this student, ordered oldest to newest."""
    cache_key = f"embeddings_{student_id}"
    cached = get_from_cache(cache_key)
    if cached: return cached

    sb = get_supabase()
    try:
        res = sb.table("face_embeddings").select("*").eq("student_id", student_id).order("created_at", desc=False).execute()
        data = res.data or []
        set_to_cache(cache_key, data)
        return data
    except Exception as e:
        logger.error(f"Failed to fetch face_embeddings: {e}")
        return []


def log_face_verification(student_id: str, similarity_score: float, device_id: str | None = None, metadata: dict | None = None):
    """Log a verification attempt into the history table."""
    sb = get_supabase()
    try:
        # Use a list of potential columns to be safe
        payload = {
            "student_id": student_id,
            "similarity_score": similarity_score,
            "device_id": device_id,
        }
        if metadata:
            payload["metadata"] = metadata # if it exists
        
        sb.table("face_verification_logs").insert(payload).execute()
    except Exception as e:
        logger.error(f"Failed to append to face_verification_logs: {e}")


def fetch_last_geo_verification(user_id: str) -> dict | None:
    """Fetch the most recent geo verification for a user to check impossible travel."""
    sb = get_supabase()
    try:
        res = sb.table("geo_verifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Failed to fetch last geo verification: {e}")
        return None


def log_geo_verification(user_id: str, lat: float, lon: float, is_within_campus: bool, spoof_detected: bool = False, spoof_reason: str | None = None, attendance_id: str | None = None):
    """Log geo verification data."""
    sb = get_supabase()
    try:
        sb.table("geo_verifications").insert({
            "user_id": user_id,
            "latitude": lat,
            "longitude": lon,
            "is_within_campus": is_within_campus,
            "spoof_detected": spoof_detected,
            "spoof_reason": spoof_reason,
            "attendance_id": attendance_id
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log geo verification: {e}")


def fetch_attendance_records(student_id: str | None = None, class_id: str | None = None):
    sb = get_supabase()
    q = sb.table("attendance").select("*")
    if student_id:
        for col in _COL_MAP.get("studentId", ["studentId"]):
            try:
                test = sb.table("attendance").select("id").eq(col, student_id).limit(1).execute()
                if test.data is not None:
                    q = q.eq(col, student_id)
                    break
            except Exception:
                continue
        else:
            q = q.eq("studentId", student_id)
    if class_id:
        q = q.eq(_col("classId"), class_id)
    res = q.order("date", desc=True).execute()
    return res.data or []


def fetch_all_students_with_faces(class_id: str | None = None):
    sb = get_supabase()
    # Try with camelCase select first
    try:
        q = sb.table("students").select("id, userId, enrollmentId, faceData, faceRegistered, classId").eq("faceRegistered", True)
        if class_id:
            q = q.eq("classId", class_id)
        result = q.execute()
        if result.data:
            return result.data
    except Exception:
        pass
    # Fallback to snake_case
    q = sb.table("students").select("id, user_id, enrollment_id, face_data, face_registered, class_id").eq("face_registered", True)
    if class_id:
        q = q.eq("class_id", class_id)
    return q.execute().data or []


def log_security_event(user_id: str, event_type: str, severity: str, description: str, metadata: dict | None = None):
    """Log a high-risk security event (Impossible Travel, Suspicious Device, Spoofing)."""
    sb = get_supabase()
    try:
        payload = {
            "user_id": user_id,
            "event_type": event_type,
            "severity": severity,
            "description": description,
            "resolved": False
        }
        if metadata:
            payload["metadata"] = metadata
        
        sb.table("security_events").insert(payload).execute()
        logger.info(f"Security event logged: {event_type} ({severity}) for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to log security event: {e}")


def create_attendance_session(faculty_id: str, class_id: str, course_id: str, timetable_entry_id: str | None, lat: float, lon: float, radius: int = 100, duration_mins: int = 5):
    """Create a new 6-digit time-locked attendance session."""
    import random
    import datetime
    sb = get_supabase()
    session_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=duration_mins)).isoformat()
    
    try:
        # Deactivate any existing active session for this class/course
        sb.table("attendance_sessions").update({"is_active": False}).eq("class_id", class_id).eq("course_id", course_id).eq("is_active", True).execute()
        
        res = sb.table("attendance_sessions").insert({
            "faculty_id": faculty_id,
            "class_id": class_id,
            "course_id": course_id,
            "timetable_entry_id": timetable_entry_id,
            "session_code": session_code,
            "latitude": lat,
            "longitude": lon,
            "radius_meters": radius,
            "expires_at": expires_at,
            "is_active": True
        }).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Failed to create attendance session: {e}")
        return None


def fetch_active_session(class_id: str, code: str | None = None) -> dict | None:
    """Fetch an active session for a class, optionally matching a specific code."""
    sb = get_supabase()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        q = sb.table("attendance_sessions").select("*").eq("class_id", class_id).eq("is_active", True).gt("expires_at", now)
        if code:
            q = q.eq("session_code", code)
        res = q.maybe_single().execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to fetch active session: {e}")
        return None
