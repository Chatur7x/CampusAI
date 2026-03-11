# =============================================================
# Attendance Session Routes  (ai-server/routes/session.py)
# =============================================================
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.db import create_attendance_session, fetch_active_session

logger = logging.getLogger("campusai.routes.session")
router = APIRouter()

class SessionStartRequest(BaseModel):
    faculty_id: str
    class_id: str
    course_id: str
    timetable_entry_id: Optional[str] = None
    latitude: float
    longitude: float
    radius_meters: int = 100
    duration_mins: int = 5

class SessionCheckRequest(BaseModel):
    class_id: str
    code: Optional[str] = None

@router.post("/start")
async def start_session(req: SessionStartRequest):
    """Start a time-locked attendance session for a class."""
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
