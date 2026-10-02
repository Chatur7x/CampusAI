# =============================================================
# Face Recognition Routes  (ai-server/routes/face.py)
# =============================================================
from __future__ import annotations

import json, logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from models.face_recognition_module import (
    generate_embedding, generate_multi_embedding, verify_face, identify_face,
    update_embedding_with_aging,
)
from models.liveness import analyse_liveness, analyse_liveness_sequence
from models.confidence import compute_confidence, compute_device_trust
from models.geo_validation import validate_location, detect_gps_spoof, check_impossible_travel, haversine
from models.audit_logger import log_ai_decision
from utils.auth import require_self_or_staff, require_staff, require_user
from utils.db import (
    fetch_student, fetch_student_by_user, update_face_data,
    fetch_all_students_with_faces, fetch_student_embeddings,
    insert_face_embedding, log_face_verification,
    fetch_last_geo_verification, log_geo_verification, log_security_event,
    fetch_active_session, count_distinct_students_on_device
)

logger = logging.getLogger("campusai.routes.face")
router = APIRouter()


# ── Request / Response schemas ────────────────────────────────

class Photo(BaseModel):
    imageData: str
    angle: str

# A base64 data URL for a camera frame is a few hundred KB; 8 MB per image is a
# generous ceiling that still stops a caller streaming an unbounded body.
_IMAGE = Field(min_length=1, max_length=8 * 1024 * 1024)


class RegisterRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    photos: List[Photo] = Field(min_length=1, max_length=10)
    liveness_frames: List[str] = Field(default_factory=list, max_length=20)
    challenge_type: Optional[str] = Field(default=None, max_length=32)


class VerifyRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    image: str = _IMAGE          # base64 probe
    class_id: str = Field(min_length=1, max_length=128)
    session_code: Optional[str] = Field(default=None, pattern=r"^\d{6}$")
    liveness_frames: Optional[List[str]] = Field(default=None, max_length=20)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, allow_inf_nan=False)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, allow_inf_nan=False)
    accuracy_m: Optional[float] = Field(default=None, ge=0.0, le=100_000.0, allow_inf_nan=False)
    device_fingerprint: Optional[str] = Field(default=None, max_length=256)
    known_devices: Optional[List[str]] = Field(default=None, max_length=50)
    ip_address: Optional[str] = Field(default=None, max_length=64)
    known_ips: Optional[List[str]] = Field(default=None, max_length=50)


class IdentifyRequest(BaseModel):
    image: str = _IMAGE
    class_id: Optional[str] = Field(default=None, max_length=128)
    session_code: Optional[str] = Field(default=None, pattern=r"^\d{6}$")
    liveness_frames: Optional[List[str]] = Field(default=None, max_length=20)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, allow_inf_nan=False)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, allow_inf_nan=False)


class LivenessRequest(BaseModel):
    frames: List[str] = Field(min_length=1, max_length=20)


class AgingUpdateRequest(BaseModel):
    stored_embedding: List[float]
    new_embedding: List[float]
    alpha: float = 0.1


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/register")
async def register_face(req: RegisterRequest, user: dict = Depends(require_user)):
    await require_self_or_staff(req.user_id, user)
    """
    Register a new face profile with multi-angle capture and liveness.
    """
    try:
        # 1. Verify student exists first (Prevent 404 later)
        student = fetch_student_by_user(req.user_id) 
        if not student:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False, 
                    "error": f"Registration Blocked: No student record found for user {req.user_id}. Action Required: Please ensure your student profile has been initialized."
                }
            )

        # 2. Liveness verification on sequence
        liveness = analyse_liveness_sequence(req.liveness_frames, req.challenge_type)
        if not liveness["is_live"]:
            log_ai_decision(
                decision_type="FACE_REGISTER_LIVENESS_FAIL",
                student_id=student["id"],
                user_id=req.user_id,
                result={"success": False, "details": liveness},
            )
            return {"success": False, "error": "Liveness check failed", "details": liveness}

        # 3. Generate multi-embedding from photos
        images_base64 = [p.imageData for p in req.photos]
        result = generate_multi_embedding(images_base64) 

        if not result.get("face_detected"):
            log_ai_decision(
                decision_type="FACE_REGISTER_NO_FACE",
                student_id=student["id"],
                user_id=req.user_id,
                result={"success": False, "errors": result.get('errors')},
            )
            return {"success": False, "error": f"Face not detected: {result.get('errors')}"}

        embedding_json = json.dumps(result["embedding"])
        update_face_data(student["id"], embedding_json)

        # Audit log
        log_ai_decision(
            decision_type="FACE_REGISTER",
            student_id=student["id"],
            user_id=req.user_id,
            result={"success": True, "images_processed": result["count"], "liveness_details": liveness},
        )

        return {
            "success": True,
            "student_id": student["id"],
            "images_processed": result["count"],
            "errors": result.get("errors"),
            "liveness_details": liveness,
        }
    except Exception:
        logger.exception("Face registration failed for user %s", req.user_id)
        raise HTTPException(
            status_code=500,
            detail="Face registration failed",
        )


@router.post("/verify")
async def verify_face_endpoint(req: VerifyRequest, user: dict = Depends(require_user)):
    """1:1 face verification + liveness + geo → 4-component confidence score."""
    await require_self_or_staff(req.user_id, user)
    student = fetch_student_by_user(req.user_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if not student.get("faceRegistered") or not student.get("faceData"):
        raise HTTPException(400, "No face registered for this student")

    # 1. Anti-Proxy Session & proximity validation
    session_mismatch = False
    proxy_location = False
    active_session = None

    if req.class_id:
        active_session = fetch_active_session(req.class_id, req.session_code)
        if not active_session:
            session_mismatch = True
            logger.warning(f"Session mismatch or expired for class {req.class_id} with code {req.session_code}")
        elif req.latitude is not None and req.longitude is not None:
            # Check proximity to faculty (Dynamic Geo-fencing)
            faculty_dist = haversine(req.latitude, req.longitude, active_session["latitude"], active_session["longitude"])
            if faculty_dist > active_session["radius_meters"]:
                proxy_location = True
                logger.warning(f"Proxy location detected: Student is {faculty_dist}m away from faculty (radius: {active_session['radius_meters']}m)")

    # 2. Fetch multi-embeddings history
    historical_embeddings = fetch_student_embeddings(student["id"])
    
    # 3. Face verification
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
        insert_face_embedding(student["id"], json.dumps(stored), confidence=1.0)
        
        if match_result.get("match") and match_result.get("similarity", 0) >= 0.90:
            probe_vector_result = generate_embedding(req.image)
            if probe_vector_result.get("embedding"):
                insert_face_embedding(
                    student_id=student["id"], 
                    embedding_json=json.dumps(probe_vector_result["embedding"]),
                    confidence=match_result.get("similarity", 0)
                )

    # 4. Liveness
    liveness_result = {"liveness_score": 0.5}
    if req.liveness_frames and len(req.liveness_frames) > 0:
        liveness_result = analyse_liveness_sequence(req.liveness_frames)
    else:
        liveness_result = analyse_liveness(req.image)

    # 5. Geo + Impossible Travel
    geo_result = {"geo_accuracy": 0.5, "valid": True}
    impossible_travel_result = {"impossible": False}
    
    if req.latitude is not None and req.longitude is not None:
        # Use session geo-fence if available, otherwise fallback to campus defaults
        target_lat = active_session["latitude"] if active_session else None
        target_lon = active_session["longitude"] if active_session else None
        target_rad = active_session["radius_meters"] if active_session else None
        
        geo_result = validate_location(
            req.latitude, req.longitude, req.accuracy_m or 0,
            campus_lat=target_lat or None, # validate_location uses defaults if None
            campus_lon=target_lon or None,
            radius_m=target_rad or None
        )
        
        # Impossible Travel Check
        last_geo = fetch_last_geo_verification(student["userId"] if "userId" in student else student.get("user_id"))
        if last_geo:
            impossible_travel_result = check_impossible_travel(
                req.latitude, req.longitude,
                last_geo["latitude"], last_geo["longitude"],
                last_geo["created_at"]
            )
            if impossible_travel_result.get("impossible"):
                log_security_event(
                    user_id=req.user_id,
                    event_type="IMPOSSIBLE_TRAVEL",
                    severity="HIGH",
                    description=f"Impossible travel detected for user {req.user_id}. Distance: {impossible_travel_result.get('distance_km', 'N/A')}km, Time: {impossible_travel_result.get('time_delta_mins', 'N/A')}min.",
                    metadata=impossible_travel_result
                )
            
        # Log this geo verification
        log_geo_verification(
            user_id=student["userId"] if "userId" in student else student.get("user_id"),
            lat=req.latitude,
            lon=req.longitude,
            is_within_campus=geo_result["valid"],
            spoof_detected=impossible_travel_result.get("impossible", False) or proxy_location,
            spoof_reason="IMPOSSIBLE_TRAVEL" if impossible_travel_result.get("impossible") else ("PROXY_LOCATION" if proxy_location else None)
        )

    # 5.5 Shared Device Check (Anti-Proxy)
    distinct_students = count_distinct_students_on_device(req.device_fingerprint) if req.device_fingerprint else 0
    shared_device = distinct_students > 1

    # 6. Confidence (4-component: face + liveness + geo + device trust)
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
        impossible_travel=impossible_travel_result.get("impossible", False),
        device_risk=device_trust < 0.3,
        session_mismatch=session_mismatch,
        proxy_location=proxy_location,
        shared_device=shared_device
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

    # Low-confidence fallback (A6). Previously a non-match returned the same
    # 200 shape as a confident match and left it to the client to interpret a
    # bare score. Make the "could not verify" outcome explicit and actionable so
    # a borderline photo never reads as a pass.
    verified = bool(match_result.get("match")) and bool(conf.auto_approved)

    if not verified:
        reason = (
            "No confident face match. Try again in better lighting, without obstructions."
            if not match_result.get("match")
            else "Face matched but the combined signals (liveness, geofence, device) were insufficient. Please retry; if this repeats, an admin will need to approve."
        )
        logger.info(
            "[face/verify] not verified user=%s similarity=%.3f confidence=%.3f flags=%s",
            req.user_id, match_result.get("similarity", 0.0), conf.score, conf.flags,
        )

    return {
        "verified": verified,
        "requires_manual_review": bool(conf.requires_reverification or conf.admin_alert),
        "reason": None if verified else reason,
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
async def identify_face_endpoint(req: IdentifyRequest, user: dict = Depends(require_staff)):
    """
    Bio-Net v4: 1:N face identification across enrolled students.
    Native HNSW Vector search. Staff-only: scans every enrolled student.
    """
    # Bio-Net v4: No longer pulling all candidates into memory.
    # The database handles the 512-D vector search via match_face_v4.
    result = identify_face(req.image)

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


@router.post("/challenge")
async def get_liveness_challenge():
    """Generate a random liveness challenge."""
    from models.liveness import generate_challenge
    return generate_challenge()


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
