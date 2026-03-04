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


# ── Convenience helpers ──────────────────────────────────────

def fetch_student(student_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("students").select("*").eq("id", student_id).maybe_single().execute()
    return res.data


def fetch_student_by_user(user_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("students").select("*").eq("userId", user_id).maybe_single().execute()
    return res.data


def update_face_data(student_id: str, embedding_json: str):
    sb = get_supabase()
    sb.table("students").update({
        "faceData": embedding_json,
        "faceRegistered": True,
    }).eq("id", student_id).execute()


def fetch_attendance_records(student_id: str | None = None, class_id: str | None = None):
    sb = get_supabase()
    q = sb.table("attendance").select("*")
    if student_id:
        q = q.eq("studentId", student_id)
    if class_id:
        q = q.eq("classId", class_id)
    res = q.order("date", desc=True).execute()
    return res.data or []


def fetch_all_students_with_faces(class_id: str | None = None):
    sb = get_supabase()
    q = sb.table("students").select("id, userId, enrollmentId, faceData, faceRegistered, classId").eq("faceRegistered", True)
    if class_id:
        q = q.eq("classId", class_id)
    return q.execute().data or []
