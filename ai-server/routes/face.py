# =============================================================
# Face Recognition Routes  (ai-server/routes/face.py)
# =============================================================
from __future__ import annotations

import json, logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.face_recognition_module import (
    generate_embedding, generate_multi_embedding, verify_face, identify_face,
)
from models.liveness import analyse_liveness, analyse_liveness_sequence
from models.confidence import compute_confidence
from models.geo_validation import validate_location, detect_gps_spoof
from utils.db import (
    fetch_student, fetch_student_by_user, update_face_data,
    fetch_all_students_with_faces,
)

logger = logging.getLogger("campusai.routes.face")
router = APIRouter()


# ── Request / Response schemas ────────────────────────────────

class RegisterRequest(BaseModel):
    user_id: str
    images: List[str]  # base64 data-URLs


class VerifyRequest(BaseModel):
    user_id: str
    image: str          # base64 probe
    liveness_frames: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    device_fingerprint: Optional[str] = None


class IdentifyRequest(BaseModel):
    image: str
    class_id: Optional[str] = None
    liveness_frames: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LivenessRequest(BaseModel):
    frames: List[str]


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/register")
async def register_face(req: RegisterRequest):
    """Multi-image face enrollment."""
    student = fetch_student_by_user(req.user_id)
    if not student:
        raise HTTPException(404, "Student not found for this user")

    result = generate_multi_embedding(req.images)
    if not result.get("face_detected"):
        raise HTTPException(400, f"Face not detected: {result.get('errors')}")

    embedding_json = json.dumps(result["embedding"])
    update_face_data(student["id"], embedding_json)

    return {
        "success": True,
        "student_id": student["id"],
        "images_processed": result["count"],
        "errors": result.get("errors"),
    }


@router.post("/verify")
async def verify_face_endpoint(req: VerifyRequest):
    """1:1 face verification + liveness + geo → confidence score."""
    student = fetch_student_by_user(req.user_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if not student.get("faceRegistered") or not student.get("faceData"):
        raise HTTPException(400, "No face registered for this student")

    stored = json.loads(student["faceData"]) if isinstance(student["faceData"], str) else student["faceData"]

    # 1. Face verification
    match_result = verify_face(req.image, stored)

    # 2. Liveness
    liveness_result = {"liveness_score": 0.5}
    if req.liveness_frames and len(req.liveness_frames) > 0:
        liveness_result = analyse_liveness_sequence(req.liveness_frames)
    else:
        liveness_result = analyse_liveness(req.image)

    # 3. Geo
    geo_result = {"geo_accuracy": 0.5, "valid": True}
    if req.latitude is not None and req.longitude is not None:
        geo_result = validate_location(req.latitude, req.longitude, req.accuracy_m or 0)

    # 4. Confidence
    conf = compute_confidence(
        face_similarity=match_result.get("similarity", 0),
        liveness_score=liveness_result.get("liveness_score", liveness_result.get("avg_liveness_score", 0)),
        geo_accuracy=geo_result.get("geo_accuracy", 0),
    )

    return {
        "match": match_result,
        "liveness": {k: v for k, v in liveness_result.items() if k != "frames"},
        "geo": geo_result,
        "confidence": {
            "score": conf.score,
            "category": conf.category,
            "auto_approved": conf.auto_approved,
            "breakdown": conf.breakdown,
        },
    }


@router.post("/identify")
async def identify_face_endpoint(req: IdentifyRequest):
    """1:N face identification across enrolled students."""
    students = fetch_all_students_with_faces(req.class_id)
    if not students:
        raise HTTPException(404, "No enrolled faces found")

    candidates = []
    for s in students:
        try:
            emb = json.loads(s["faceData"]) if isinstance(s["faceData"], str) else s["faceData"]
            if emb:
                candidates.append({"student_id": s["id"], "embedding": emb})
        except Exception:
            continue

    if not candidates:
        raise HTTPException(404, "No valid face embeddings")

    result = identify_face(req.image, candidates)

    # Optional liveness
    if req.liveness_frames:
        liveness = analyse_liveness_sequence(req.liveness_frames)
        result["liveness"] = {k: v for k, v in liveness.items() if k != "frames"}

    # Optional geo
    if req.latitude is not None and req.longitude is not None:
        result["geo"] = validate_location(req.latitude, req.longitude)

    return result


@router.post("/liveness")
async def liveness_check(req: LivenessRequest):
    """Standalone liveness analysis."""
    if len(req.frames) == 1:
        return analyse_liveness(req.frames[0])
    return analyse_liveness_sequence(req.frames)


@router.post("/embedding")
async def get_embedding(image: str):
    """Generate face embedding (utility endpoint)."""
    return generate_embedding(image)
