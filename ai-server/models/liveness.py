# =============================================================
# 2. Liveness Detection — Mediapipe + OpenCV  (ai-server/models/liveness.py)
# =============================================================
"""
Three-layer anti-spoofing pipeline:
  Layer 1 — Eye Aspect Ratio (EAR) blink detection
  Layer 2 — Head pose estimation via PnP solve
  Layer 3 — Texture / frequency analysis (Laplacian variance)

EAR formula:
  EAR = (||p2 - p6|| + ||p3 - p5||) / (2 × ||p1 - p4||)
  Blink → EAR < threshold (~0.22)
"""
from __future__ import annotations

import base64, io, logging, math
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from config import EAR_BLINK_THRESHOLD, HEAD_TURN_THRESHOLD

logger = logging.getLogger("campusai.liveness")

# ── Lazy mediapipe ────────────────────────────────────────────
_mp_face_mesh = None


def _get_face_mesh():
    global _mp_face_mesh
    if _mp_face_mesh is None:
        import mediapipe as mp
        _mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
        logger.info("Mediapipe FaceMesh initialised")
    return _mp_face_mesh


def _b64_to_rgb(b64: str) -> np.ndarray:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


# ── Eye Aspect Ratio ─────────────────────────────────────────
# Mediapipe FaceMesh landmark indices for left/right eyes
LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]


def _distance(a, b):
    return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)


def _ear(eye_pts: list) -> float:
    """EAR = (||p2-p6|| + ||p3-p5||) / (2 × ||p1-p4||)"""
    v1 = _distance(eye_pts[1], eye_pts[5])
    v2 = _distance(eye_pts[2], eye_pts[4])
    h  = _distance(eye_pts[0], eye_pts[3])
    if h == 0:
        return 0.0
    return (v1 + v2) / (2.0 * h)


# ── Head Pose (PnP) ──────────────────────────────────────────
# 3-D model points (generic face model)
MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),             # Nose tip
    (0.0, -330.0, -65.0),        # Chin
    (-225.0, 170.0, -135.0),     # Left eye left corner
    (225.0, 170.0, -135.0),      # Right eye right corner
    (-150.0, -150.0, -125.0),    # Left mouth corner
    (150.0, -150.0, -125.0),     # Right mouth corner
], dtype=np.float64)

# Mediapipe landmark indices that correspond to the 3-D points above
POSE_LANDMARKS = [1, 152, 263, 33, 287, 57]


def _estimate_head_pose(landmarks, img_w: int, img_h: int) -> dict:
    """Solve PnP for head yaw/pitch/roll in degrees."""
    image_points = np.array([
        (landmarks[i].x * img_w, landmarks[i].y * img_h)
        for i in POSE_LANDMARKS
    ], dtype=np.float64)

    focal_length = img_w
    centre = (img_w / 2, img_h / 2)
    camera_matrix = np.array([
        [focal_length, 0, centre[0]],
        [0, focal_length, centre[1]],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1))

    ok, rvec, tvec = cv2.solvePnP(MODEL_POINTS, image_points, camera_matrix, dist_coeffs)
    if not ok:
        return {"yaw": 0, "pitch": 0, "roll": 0}

    rmat, _ = cv2.Rodrigues(rvec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
    return {"yaw": float(angles[1]), "pitch": float(angles[0]), "roll": float(angles[2])}


# ── Texture Analysis ─────────────────────────────────────────

def _laplacian_score(img_rgb: np.ndarray) -> float:
    """Higher variance ⇒ more texture ⇒ likely real face."""
    grey = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    lap = cv2.Laplacian(grey, cv2.CV_64F)
    return float(lap.var())


# ── Public API ───────────────────────────────────────────────

def analyse_liveness(image_b64: str) -> dict:
    """
    Full liveness analysis on a single frame.
    Returns {
        "is_live": bool,
        "ear_left": float, "ear_right": float, "blink_detected": bool,
        "head_pose": {"yaw", "pitch", "roll"},
        "texture_score": float,
        "liveness_score": float   (0..1)
    }
    """
    img_rgb = _b64_to_rgb(image_b64)
    h, w, _ = img_rgb.shape
    mesh = _get_face_mesh()
    results = mesh.process(img_rgb)

    if not results.multi_face_landmarks:
        return {"is_live": False, "error": "No face landmarks detected", "liveness_score": 0.0}

    lm = results.multi_face_landmarks[0].landmark

    # 1. EAR
    def pts(indices):
        return [(lm[i].x * w, lm[i].y * h) for i in indices]

    ear_l = _ear(pts(LEFT_EYE))
    ear_r = _ear(pts(RIGHT_EYE))
    avg_ear = (ear_l + ear_r) / 2.0
    blink = avg_ear < EAR_BLINK_THRESHOLD

    # 2. Head pose
    pose = _estimate_head_pose(lm, w, h)
    head_moved = abs(pose["yaw"]) > HEAD_TURN_THRESHOLD or abs(pose["pitch"]) > HEAD_TURN_THRESHOLD

    # 3. Texture
    tex = _laplacian_score(img_rgb)
    tex_ok = tex > 50  # empirical threshold for real faces

    # Composite score  (weighted sum)
    score = 0.0
    # EAR presence (eyes open = good check)
    score += 0.3 * min(avg_ear / 0.3, 1.0)
    # Texture realness
    score += 0.4 * min(tex / 200.0, 1.0)
    # Head micro-movement penalty for perfectly still (spoof)
    pose_variety = min((abs(pose["yaw"]) + abs(pose["pitch"])) / 30.0, 1.0)
    score += 0.3 * pose_variety

    score = max(0.0, min(1.0, score))

    return {
        "is_live": score >= 0.45,
        "ear_left": round(ear_l, 4),
        "ear_right": round(ear_r, 4),
        "blink_detected": blink,
        "head_pose": {k: round(v, 2) for k, v in pose.items()},
        "texture_score": round(tex, 2),
        "liveness_score": round(score, 4),
    }


def analyse_liveness_sequence(images_b64: list[str]) -> dict:
    """
    Analyse a sequence of frames for blink / head-turn challenge.
    Returns aggregate result with per-frame breakdown.
    """
    frames = [analyse_liveness(b) for b in images_b64]
    blink_count = sum(1 for f in frames if f.get("blink_detected"))
    avg_score = np.mean([f.get("liveness_score", 0) for f in frames]) if frames else 0
    any_head_move = any(
        abs(f.get("head_pose", {}).get("yaw", 0)) > HEAD_TURN_THRESHOLD
        for f in frames
    )
    return {
        "is_live": float(avg_score) >= 0.4 and (blink_count > 0 or any_head_move),
        "avg_liveness_score": round(float(avg_score), 4),
        "blink_count": blink_count,
        "head_movement_detected": any_head_move,
        "frame_count": len(frames),
        "frames": frames,
    }
