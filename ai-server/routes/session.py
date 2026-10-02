# =============================================================
# Attendance Session Routes  (ai-server/routes/session.py)
# =============================================================
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from utils.db import create_attendance_session, fetch_active_session
from utils.auth import require_user

logger = logging.getLogger("campusai.routes.session")
router = APIRouter()

class SessionStartRequest(BaseModel):
    faculty_id: str = Field(min_length=1, max_length=128)
    class_id: str = Field(min_length=1, max_length=128)
    course_id: str = Field(min_length=1, max_length=128)
    timetable_entry_id: Optional[str] = Field(default=None, max_length=128)
    latitude: float = Field(ge=-90.0, le=90.0, allow_inf_nan=False)
    longitude: float = Field(ge=-180.0, le=180.0, allow_inf_nan=False)
    radius_meters: int = Field(default=100, ge=10, le=2000)
    duration_mins: int = Field(default=5, ge=1, le=180)

class SessionCheckRequest(BaseModel):
    class_id: str = Field(min_length=1, max_length=128)
    code: Optional[str] = Field(default=None, pattern=r"^\d{6}$")

@router.post("/start")
async def start_session(req: SessionStartRequest, user: dict = Depends(require_user)):
    """Start a time-locked attendance session for a class."""
    # Sessions can only be opened by their own faculty (admins may open any).
    # faculty_id may be the faculty ROW id or, for legacy callers, the auth id.
    from utils.auth import _role_of, STAFF_ROLES
    from utils.db import get_supabase

    owner_id = str(user.get("id") or "")
    allowed = False
    if req.faculty_id == owner_id:
        allowed = _role_of(owner_id) in STAFF_ROLES
    else:
        try:
            sb = get_supabase()
            frow = (
                sb.table("faculty").select("user_id").eq("id", req.faculty_id)
                .maybe_single().execute().data
            )
            allowed = bool(frow) and str(frow.get("user_id")) == owner_id
        except Exception:
            allowed = False
        if not allowed:
            allowed = _role_of(owner_id) in ("ADMIN", "SUPER_ADMIN")
    if not allowed:
        raise HTTPException(status_code=403, detail="Only the assigned faculty can start a session")
    session = create_attendance_session(
        faculty_id=req.faculty_id,
        class_id=req.class_id,
        course_id=req.course_id,
        timetable_entry_id=req.timetable_entry_id,
        lat=req.latitude,
        lon=req.longitude,
        radius=req.radius_meters,
        duration_mins=req.duration_mins
    )
    if not session:
        raise HTTPException(status_code=500, detail="Failed to create attendance session")
    return {"success": True, "session": session}

@router.post("/check")
async def check_session(req: SessionCheckRequest):
    """Check if there is an active session for a class."""
    session = fetch_active_session(req.class_id, req.code)
    if not session:
        return {"active": False, "message": "No active session found or code mismatch"}
    return {"active": True, "session": session}

@router.get("/active/{class_id}")
async def get_active(class_id: str):
    """Get the current active session for a class (without requiring a code)."""
    session = fetch_active_session(class_id)
    if not session:
        return {"active": False}
    return {"active": True, "session": session}
