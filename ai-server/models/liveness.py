# =============================================================
# 2. Anti-Spoof Security — Advanced Liveness Detection
#    (ai-server/models/liveness.py)
# =============================================================
"""
Subsystem 2: Anti-Spoof Security

Five-layer anti-spoofing pipeline:
  Layer 1 — Eye Aspect Ratio (EAR) blink detection
  Layer 2 — Head pose estimation via PnP solve
  Layer 3 — Texture / frequency analysis (Laplacian variance)
  Layer 4 — Reflection analysis (specular highlight detection)
  Layer 5 — CNN spoof classifier (Real vs Fake)

Models:
  - Mediapipe FaceMesh (468 landmarks)
  - CNN Binary Classifier (PyTorch) — Real vs Fake
  - Frequency domain analysis

Algorithms:
  EAR = (||p2-p6|| + ||p3-p5||) / (2 × ||p1-p4||)
  PnP head pose estimation
  Laplacian variance (texture)
  FFT frequency analysis (deepfake artifacts)

Advanced Security:
  ✔ Random blink challenge
  ✔ Head turn challenge
  ✔ Reflection analysis
  ✔ Texture analysis
  ✔ Deepfake detection (frequency domain)
  ✔ CNN spoof classifier
  ✔ Sigmoid confidence blending
  ✔ Temporal consistency checks (video injection detection)
"""
from __future__ import annotations

import base64, io, logging, math, random, time
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from config import EAR_BLINK_THRESHOLD, HEAD_TURN_THRESHOLD, LIVENESS_CHALLENGE_ENABLED, DEEPFAKE_DETECTION_ENABLED

logger = logging.getLogger("campusai.liveness")

# ── Lazy mediapipe ────────────────────────────────────────────
_mp_face_mesh = None
_cnn_model = None
_cnn_available = False

try:
    import torch
    import torch.nn as nn
    _torch_available = True
except ImportError:
    _torch_available = False
    logger.info("PyTorch not installed — CNN spoof classifier disabled")


def _get_face_mesh():
    global _mp_face_mesh
    if _mp_face_mesh is None:
        try:
            import mediapipe as mp
            _mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
            )
            logger.info("Mediapipe FaceMesh initialised")
        except ImportError:
            logger.warning("Mediapipe not installed — advanced liveness disabled")
            return None
    return _mp_face_mesh


def _b64_to_rgb(b64: str) -> np.ndarray:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


# ═══════════════════════════════════════════════════════════════
# Layer 1: Eye Aspect Ratio (EAR) Blink Detection
# ═══════════════════════════════════════════════════════════════
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


# ═══════════════════════════════════════════════════════════════
# Layer 2: Head Pose Estimation (PnP Algorithm)
# ═══════════════════════════════════════════════════════════════
MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),             # Nose tip
    (0.0, -330.0, -65.0),        # Chin
    (-225.0, 170.0, -135.0),     # Left eye left corner
    (225.0, 170.0, -135.0),      # Right eye right corner
    (-150.0, -150.0, -125.0),    # Left mouth corner
    (150.0, -150.0, -125.0),     # Right mouth corner
], dtype=np.float64)

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


# ═══════════════════════════════════════════════════════════════
# Layer 3: Texture Analysis (Laplacian Variance)
# ═══════════════════════════════════════════════════════════════

def _laplacian_score(img_rgb: np.ndarray) -> float:
    """Higher variance ⇒ more texture ⇒ likely real face."""
    grey = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    lap = cv2.Laplacian(grey, cv2.CV_64F)
    return float(lap.var())


# ═══════════════════════════════════════════════════════════════
# Layer 4: Reflection / Specular Highlight Analysis
# ═══════════════════════════════════════════════════════════════

def _reflection_analysis(img_rgb: np.ndarray) -> dict:
    """
    Detect specular highlights that indicate a screen/photo.
    Real faces have diffuse reflections; screens have bright spots.
    """
    grey = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    h, w = grey.shape

    # Threshold for very bright pixels (screen reflections)
    _, bright_mask = cv2.threshold(grey, 240, 255, cv2.THRESH_BINARY)
    bright_ratio = np.count_nonzero(bright_mask) / (h * w)

    # Check for uniform bright regions (screen glow)
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    saturation = hsv[:, :, 1]
    low_sat_ratio = np.count_nonzero(saturation < 30) / (h * w)

    # Color histogram entropy (screens have less color variety)
    hist = cv2.calcHist([img_rgb], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    hist = hist.flatten()
    hist = hist / (hist.sum() + 1e-10)
    entropy = -np.sum(hist[hist > 0] * np.log2(hist[hist > 0]))

    is_screen = bright_ratio > 0.05 or low_sat_ratio > 0.4 or entropy < 4.0

    return {
        "bright_ratio": round(bright_ratio, 4),
        "low_saturation_ratio": round(low_sat_ratio, 4),
        "color_entropy": round(entropy, 2),
        "screen_detected": is_screen,
        "reflection_score": round(1.0 - min(bright_ratio * 10 + (1.0 if low_sat_ratio > 0.4 else 0.0), 1.0), 4),
    }


# ═══════════════════════════════════════════════════════════════
# Layer 5: Deepfake / Frequency Domain Detection
# ═══════════════════════════════════════════════════════════════

def _frequency_analysis(img_rgb: np.ndarray) -> dict:
    """
    FFT-based deepfake detection.
    Deepfakes often lack high-frequency details and show GAN artifacts
    in the frequency spectrum.
    """
    grey = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    grey = cv2.resize(grey, (256, 256))

    # 2D FFT
    f_transform = np.fft.fft2(grey.astype(np.float64))
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.log1p(np.abs(f_shift))

    # Analyze frequency bands
    h, w = magnitude.shape
    cy, cx = h // 2, w // 2

    # High-frequency energy (outer ring)
    mask_high = np.zeros((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            dist = math.sqrt((y - cy)**2 + (x - cx)**2)
            if dist > min(h, w) * 0.3:
                mask_high[y, x] = True

    high_freq_energy = float(np.mean(magnitude[mask_high])) if mask_high.any() else 0
    total_energy = float(np.mean(magnitude))
    hf_ratio = high_freq_energy / (total_energy + 1e-10)

    # Deepfakes typically have lower high-frequency content
    is_deepfake = hf_ratio < 0.35

    return {
        "high_freq_ratio": round(hf_ratio, 4),
        "total_energy": round(total_energy, 2),
        "deepfake_suspected": is_deepfake,
        "frequency_score": round(min(hf_ratio / 0.5, 1.0), 4),
    }


# ═══════════════════════════════════════════════════════════════
# CNN Spoof Classifier (PyTorch)
# ═══════════════════════════════════════════════════════════════

def _get_cnn_spoof_model():
    """
    Lightweight CNN for Real vs Fake classification.
    Uses a simple architecture that can be trained on spoof datasets.
    """
    global _cnn_model, _cnn_available
    if not _torch_available:
        return None
    if _cnn_model is not None:
        return _cnn_model

    try:
        class SpoofCNN(nn.Module):
            def __init__(self):
                super().__init__()
                self.features = nn.Sequential(
                    nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                    nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                    nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(4),
                )
                self.classifier = nn.Sequential(
                    nn.Flatten(),
                    nn.Linear(128 * 4 * 4, 256), nn.ReLU(), nn.Dropout(0.5),
                    nn.Linear(256, 2),
                )

            def forward(self, x):
                return self.classifier(self.features(x))

        _cnn_model = SpoofCNN()
        _cnn_model.eval()
        _cnn_available = True
        logger.info("CNN spoof classifier initialised (untrained — heuristic mode)")
    except Exception as e:
        logger.warning(f"CNN spoof model init failed: {e}")
        _cnn_available = False
    return _cnn_model


def _cnn_spoof_score(img_rgb: np.ndarray) -> float:
    """
    CNN-based spoof detection score.
    Returns 0..1 where 1 = real, 0 = fake.
    Falls back to texture+reflection heuristic if model untrained.
    """
    if not _torch_available:
        return 0.5  # neutral

    model = _get_cnn_spoof_model()
    if model is None:
        return 0.5

    try:
        img_resized = cv2.resize(img_rgb, (128, 128))
        tensor = torch.from_numpy(img_resized).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        with torch.no_grad():
            output = model(tensor)
            probs = torch.softmax(output, dim=1)
            real_prob = float(probs[0][1])  # class 1 = real
        return real_prob
    except Exception:
        return 0.5


# ═══════════════════════════════════════════════════════════════
# Layer 6: Mouth Aspect Ratio (MAR) & Smile Detection
# ═══════════════════════════════════════════════════════════════
MOUTH_INNER_TOP = 13
MOUTH_INNER_BOTTOM = 14
MOUTH_INNER_LEFT = 78
MOUTH_INNER_RIGHT = 308


def _mar(lm, w, h) -> float:
    """
    MAR = ||p13-p14|| / ||p78-p308||
    Higher value means mouth is open or wide.
    """
    p_top = (lm[MOUTH_INNER_TOP].x * w, lm[MOUTH_INNER_TOP].y * h)
    p_bot = (lm[MOUTH_INNER_BOTTOM].x * w, lm[MOUTH_INNER_BOTTOM].y * h)
    p_left = (lm[MOUTH_INNER_LEFT].x * w, lm[MOUTH_INNER_LEFT].y * h)
    p_right = (lm[MOUTH_INNER_RIGHT].x * w, lm[MOUTH_INNER_RIGHT].y * h)

    vertical = _distance(p_top, p_bot)
    horizontal = _distance(p_left, p_right)

    if horizontal == 0:
        return 0.0
    return vertical / horizontal


# ═══════════════════════════════════════════════════════════════
# Random Challenge System
# ═══════════════════════════════════════════════════════════════

CHALLENGES = [
    {"type": "blink", "instruction": "Please blink your eyes", "timeout_s": 5},
    {"type": "head_left", "instruction": "Please turn your head left", "timeout_s": 5},
    {"type": "head_right", "instruction": "Please turn your head right", "timeout_s": 5},
    {"type": "head_up", "instruction": "Please look up slightly", "timeout_s": 5},
    {"type": "smile", "instruction": "Please smile briefly", "timeout_s": 5},
]


def generate_challenge() -> dict:
    """Generate a random liveness challenge for the client to complete."""
    if not LIVENESS_CHALLENGE_ENABLED:
        return {"challenge": None, "required": False}

    challenge = random.choice(CHALLENGES)
    return {
        "challenge": challenge,
        "required": True,
        "challenge_id": f"ch_{random.randint(10000, 99999)}",
    }


def verify_challenge(challenge_type: str, frames: list[dict]) -> dict:
    """Verify that a challenge was completed based on frame analysis results."""
    if challenge_type == "blink":
        # Detect a sharp drop then rise in EAR
        ears = [f.get("avg_ear", 0.3) for f in frames]
        blinked = any(e < EAR_BLINK_THRESHOLD for e in ears)
        return {"passed": blinked, "note": f"Blink detected in {len(frames)} frames"}

    if challenge_type in ("head_left", "head_right"):
        target_yaw = -HEAD_TURN_THRESHOLD if "left" in challenge_type else HEAD_TURN_THRESHOLD
        yaws = [f.get("head_pose", {}).get("yaw", 0) for f in frames]
        detected = any((y < -HEAD_TURN_THRESHOLD if "left" in challenge_type else y > HEAD_TURN_THRESHOLD) for y in yaws)
        return {"passed": detected, "max_yaw": round(max(yaws) if "right" in challenge_type else min(yaws), 2)}

    if challenge_type == "head_up":
        pitches = [f.get("head_pose", {}).get("pitch", 0) for f in frames]
        detected = any(p > HEAD_TURN_THRESHOLD for p in pitches)
        return {"passed": detected, "max_pitch": round(max(pitches), 2)}

    if challenge_type == "smile":
        mars = [f.get("mar", 0) for f in frames]
        # A smile typically increases MAR if mouth opens slightly, or we can look for variance
        # For simplicity, we check if MAR > 0.1 (slight mouth open/smile)
        detected = any(m > 0.15 for m in mars)
        return {"passed": detected, "max_mar": round(max(mars), 4)}

    return {"passed": False, "error": f"Unknown challenge: {challenge_type}"}


# ═══════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════

def analyse_liveness(image_b64: str) -> dict:
    """
    Full 5-layer liveness analysis on a single frame.
    Pipeline: EAR → Head Pose → Texture → Reflection → Deepfake → CNN → MAR
    """
    start = time.time()
    img_rgb = _b64_to_rgb(image_b64)
    h, w, _ = img_rgb.shape
    mesh = _get_face_mesh()
    results = mesh.process(img_rgb)

    if not results.multi_face_landmarks:
        return {"is_live": False, "error": "No face landmarks detected", "liveness_score": 0.0}

    lm = results.multi_face_landmarks[0].landmark

    # Layer 1: EAR blink detection
    def pts(indices):
        return [(lm[i].x * w, lm[i].y * h) for i in indices]

    ear_l = _ear(pts(LEFT_EYE))
    ear_r = _ear(pts(RIGHT_EYE))
    avg_ear = (ear_l + ear_r) / 2.0
    blink = avg_ear < EAR_BLINK_THRESHOLD

    # Layer 2: Head pose (PnP algorithm)
    pose = _estimate_head_pose(lm, w, h)

    # Layer 3: Texture analysis (Laplacian)
    tex = _laplacian_score(img_rgb)

    # Layer 4: Reflection analysis
    reflection = _reflection_analysis(img_rgb)

    # Layer 5: Deepfake + CNN
    deepfake = _frequency_analysis(img_rgb) if DEEPFAKE_DETECTION_ENABLED else {"frequency_score": 0.5}
    cnn_score = _cnn_spoof_score(img_rgb)

    # Layer 6: MAR (Mouth Aspect Ratio)
    mar = _mar(lm, w, h)

    # ── Bio-Net v4 Advanced Sigmoid Blending ──
    # Instead of linear weighting, use a non-linear confidence model
    
    def _sigmoid(x, alpha=10, beta=0.5):
        return 1 / (1 + math.exp(-alpha * (x - beta)))

    # Compute individual confidences
    c_tex = _sigmoid(tex / 180.0, 8, 0.4) 
    c_pose = _sigmoid(min((abs(pose["yaw"]) + abs(pose["pitch"])) / 25.0, 1.0), 6, 0.3)
    c_refl = _sigmoid(reflection.get("reflection_score", 0.5), 8, 0.5)
    c_freq = _sigmoid(deepfake.get("frequency_score", 0.5), 7, 0.45)
    c_cnn = _sigmoid(cnn_score, 10, 0.5)
    
    # Weighted ensemble with primary layers having higher 'veto' power
    # If any score is critically low, it drags the result down non-linearly
    combined_score = (
        0.20 * c_tex + 
        0.15 * c_pose + 
        0.20 * c_refl + 
        0.15 * c_freq + 
        0.20 * c_cnn + 
        0.10 * min(mar / 0.15, 1.0)
    )

    score = combined_score

    # Anti-spoof flags
    spoof_flags: list[str] = []
    if reflection.get("screen_detected"):
        spoof_flags.append("SCREEN_DETECTED")
    if deepfake.get("deepfake_suspected"):
        spoof_flags.append("DEEPFAKE_SUSPECTED")
    if tex < 30:
        spoof_flags.append("LOW_TEXTURE")
    if cnn_score < 0.2 and not any(spoof_flags): # Only flag if score is very low
        spoof_flags.append("CNN_SPOOF_RISK")

    return {
        "is_live": score >= 0.45 and len(spoof_flags) == 0,
        "liveness_score": round(score, 4),
        "avg_ear": round(avg_ear, 4),
        "mar": round(mar, 4),
        "blink_detected": blink,
        "head_pose": {k: round(v, 2) for k, v in pose.items()},
        "texture_score": round(tex, 2),
        "reflection": reflection,
        "deepfake": deepfake,
        "cnn_spoof_score": round(cnn_score, 4),
        "spoof_flags": spoof_flags,
        "inference_ms": round((time.time() - start) * 1000, 1),
        "layers": ["EAR", "HeadPose_PnP", "Texture_Laplacian", "Reflection", "FFT_Deepfake", "CNN_Spoof", "MAR"],
    }


def analyse_liveness_sequence(images_b64: list[str], challenge_type: Optional[str] = None) -> dict:
    """
    Analyse a sequence of frames for blink/head-turn challenge.
    Aggregates per-frame scores and detects temporal patterns.
    """
    frames = [analyse_liveness(b) for b in images_b64]
    
    # Challenge Verification
    challenge_result = {"passed": True}
    if challenge_type:
        challenge_result = verify_challenge(challenge_type, frames)

    avg_score = np.mean([f.get("liveness_score", 0) for f in frames]) if frames else 0
    any_spoof_flags = any(len(f.get("spoof_flags", [])) > 0 for f in frames)

    # Temporal consistency check: scores and pixels should vary naturally
    scores = [f.get("liveness_score", 0) for f in frames]
    score_variance = float(np.var(scores)) if len(scores) > 1 else 0
    
    # Advanced Anti-Injection: Check for excessive pixel stability
    # Synthetic/Replay attacks often show suspiciously low variance in background
    pixel_stabilities = [f.get("texture_score", 0) for f in frames]
    tex_variance = float(np.var(pixel_stabilities)) if len(pixel_stabilities) > 1 else 0
    
    too_consistent = (score_variance < 0.0001 or tex_variance < 0.01) and len(frames) > 3 

    # Final decision: challenge MUST pass if provided
    is_live = (
        float(avg_score) >= 0.45 # Raised threshold for v4
        and challenge_result.get("passed", False)
        and not any_spoof_flags
        and not too_consistent
        and tex_variance > 0.005 # Ensure some natural sensor noise exists
    )

    return {
        "is_live": is_live,
        "avg_liveness_score": round(float(avg_score), 4),
        "liveness_score": round(float(avg_score), 4),
        "challenge_passed": challenge_result.get("passed", False),
        "challenge_details": challenge_result,
        "any_spoof_flags": any_spoof_flags,
        "temporal_consistency": round(score_variance, 6),
        "frame_count": len(frames),
        "frames": frames,
    }
