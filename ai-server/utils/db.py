# =============================================================
# Supabase DB helper  (ai-server/utils/db.py)
# =============================================================
from __future__ import annotations

import logging
from functools import lru_cache

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger("campusai.db")


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
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student_id).maybe_single().execute()
    return res.data


def fetch_student_by_user(user_id: str) -> dict | None:
    sb = get_supabase()
    res = _try_query(sb, "students", "*", "userId", user_id, single=True)
    return res.data


def update_face_data(student_id: str, embedding_json: str):
    sb = get_supabase()
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
    sb = get_supabase()
    try:
        res = sb.table("face_embeddings").select("*").eq("student_id", student_id).order("created_at", desc=False).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch face_embeddings: {e}")
        return []


def log_face_verification(student_id: str, similarity_score: float, device_id: str | None = None):
    """Log a verification attempt into the history table."""
    sb = get_supabase()
    try:
        sb.table("face_verification_logs").insert({
            "student_id": student_id,
            "similarity_score": similarity_score,
            "device_id": device_id,
        }).execute()
    except Exception as e:
        logger.error(f"Failed to append to face_verification_logs: {e}")


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
