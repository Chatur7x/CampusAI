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
    update_embedding_with_aging,
)
from models.liveness import analyse_liveness, analyse_liveness_sequence
from models.confidence import compute_confidence, compute_device_trust
from models.geo_validation import validate_location, detect_gps_spoof
from models.audit_logger import log_ai_decision
from utils.db import (
    fetch_student, fetch_student_by_user, update_face_data,
    fetch_all_students_with_faces, fetch_student_embeddings,
    insert_face_embedding, log_face_verification
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
    known_devices: Optional[List[str]] = None
    ip_address: Optional[str] = None
    known_ips: Optional[List[str]] = None


class IdentifyRequest(BaseModel):
    image: str
    class_id: Optional[str] = None
    liveness_frames: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LivenessRequest(BaseModel):
    frames: List[str]


class AgingUpdateRequest(BaseModel):
    stored_embedding: List[float]
    new_embedding: List[float]
    alpha: float = 0.1


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

    # Audit log
    log_ai_decision(
        decision_type="FACE_REGISTER",
        student_id=student["id"],
        user_id=req.user_id,
        result={"success": True, "images_processed": result["count"]},
    )

    return {
        "success": True,
        "student_id": student["id"],
        "images_processed": result["count"],
        "errors": result.get("errors"),
    }


@router.post("/verify")
async def verify_face_endpoint(req: VerifyRequest):
    """1:1 face verification + liveness + geo → 4-component confidence score."""
    student = fetch_student_by_user(req.user_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if not student.get("faceRegistered") or not student.get("faceData"):
        raise HTTPException(400, "No face registered for this student")

    # 1. Fetch multi-embeddings history
    historical_embeddings = fetch_student_embeddings(student["id"])
    
    # 2. Face verification
    match_result = {"match": False, "similarity": 0.0, "error": "No face data"}
    
    if len(historical_embeddings) > 0:
        # User has adaptive embeddings table
        best_sim = -1.0
        best_match_result = None
        for record in historical_embeddings:
            try:
                emb = record["embedding_vector"]
                if isinstance(emb, str):
                    emb = json.loads(emb)
                # Verify against this historical record
                res = verify_face(req.image, emb, enrollment_count=len(historical_embeddings))
                if res.get("similarity", 0) > best_sim:
                    best_sim = res.get("similarity", 0)
                    best_match_result = res
            except Exception as e:
                logger.warning(f"Error comparing historical embedding: {e}")
        
        if best_match_result:
            match_result = best_match_result
            
        # -- ADAPTIVE LEARNING OVER TIME --
        # If we got a highly confident match, inject this new observation back into the history
        if match_result.get("match") and match_result.get("similarity", 0) >= 0.90:
            # We must re-extract the raw embedding to save it.
            # verify_face doesn't return the raw embedding vector back to the route (for efficiency).
            # But generate_embedding is heavily cached by the OS/Insightface for the exact same b64 array if called immediately again, or we can just call it here:
            probe_vector_result = generate_embedding(req.image)
            if probe_vector_result.get("embedding"):
                insert_face_embedding(
                    student_id=student["id"], 
                    embedding_json=json.dumps(probe_vector_result["embedding"]),
                    confidence=match_result.get("similarity", 0)
                )
    else:
        # Fallback to legacy single-embedding if historical table is empty
        stored = json.loads(student["faceData"]) if isinstance(student["faceData"], str) else student["faceData"]
        match_result = verify_face(req.image, stored)
        # Migrate their legacy embedding to the new system so it enables adaptive learning
        insert_face_embedding(student["id"], json.dumps(stored), confidence=1.0)
        
        # Also run the adaptive check on the probe
        if match_result.get("match") and match_result.get("similarity", 0) >= 0.90:
            probe_vector_result = generate_embedding(req.image)
            if probe_vector_result.get("embedding"):
                insert_face_embedding(
                    student_id=student["id"], 
                    embedding_json=json.dumps(probe_vector_result["embedding"]),
                    confidence=match_result.get("similarity", 0)
                )

    # 3. Liveness
    liveness_result = {"liveness_score": 0.5}
    if req.liveness_frames and len(req.liveness_frames) > 0:
        liveness_result = analyse_liveness_sequence(req.liveness_frames)
    else:
        liveness_result = analyse_liveness(req.image)

    # 4. Geo
    geo_result = {"geo_accuracy": 0.5, "valid": True}
    if req.latitude is not None and req.longitude is not None:
        geo_result = validate_location(req.latitude, req.longitude, req.accuracy_m or 0)

    # 5. Confidence (4-component: face + liveness + geo + device trust)
    device_trust = compute_device_trust(
        device_fingerprint=req.device_fingerprint,
        known_devices=req.known_devices,
        ip_address=req.ip_address,
        known_ips=req.known_ips,
    )
    conf = compute_confidence(
        face_similarity=match_result.get("similarity", 0),
        liveness_score=liveness_result.get("liveness_score", liveness_result.get("avg_liveness_score", 0)),
        geo_accuracy=geo_result.get("geo_accuracy", 0),
        device_trust=device_trust,
    )

    # Write explicit verification log for this interaction
    log_face_verification(
        student_id=student["id"],
        similarity_score=match_result.get("similarity", 0),
        device_id=req.device_fingerprint
    )

    # System Audit log (Mainly for security metrics)
    log_ai_decision(
        decision_type="FACE_VERIFY",
        student_id=student.get("id"),
        user_id=req.user_id,
        similarity_score=match_result.get("similarity"),
        liveness_result=liveness_result,
        confidence_score=conf.score,
        fraud_flags=conf.flags,
        device_fingerprint=req.device_fingerprint,
        ip_address=req.ip_address,
        location={"lat": req.latitude, "lng": req.longitude} if req.latitude else None,
        approved=conf.auto_approved,
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
            "flags": conf.flags,
            "requires_reverification": conf.requires_reverification,
            "admin_alert": conf.admin_alert,
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

    # Audit log
    log_ai_decision(
        decision_type="FACE_IDENTIFY",
        result=result,
        similarity_score=result.get("similarity"),
        location={"lat": req.latitude, "lng": req.longitude} if req.latitude else None,
    )

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


@router.post("/aging-update")
async def aging_update(req: AgingUpdateRequest):
    """Update stored embedding with aging adaptation."""
    return update_embedding_with_aging(req.stored_embedding, req.new_embedding, req.alpha)
