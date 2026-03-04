# =============================================================
# 1. Face Recognition — InsightFace / ArcFace  (ai-server/models/face_recognition_module.py)
# =============================================================
"""
- Uses InsightFace with ArcFace (buffalo_l) to generate 512-D embeddings.
- Cosine similarity for matching:  similarity = (A · B) / (||A|| × ||B||)
- Multi-image enrollment: stores average embedding per student.
- No TensorFlow dependency — pure ONNX Runtime.
"""
from __future__ import annotations

import base64, io, logging
from typing import List

import numpy as np
from PIL import Image

from config import FACE_SIMILARITY_THRESHOLD

logger = logging.getLogger("campusai.face")

# Lazy load ──────────────────────────────────────────────────
_face_app = None


def _get_face_app():
    global _face_app
    if _face_app is None:
        from insightface.app import FaceAnalysis
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=-1, det_size=(640, 640))
        logger.info("InsightFace buffalo_l loaded (ArcFace 512-D, ONNX)")
    return _face_app


# ── Helpers ──────────────────────────────────────────────────

def _b64_to_np(b64: str) -> np.ndarray:
    """Decode base64 data-URL or raw base64 → numpy BGR image."""
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)
    # InsightFace expects BGR
    return arr[:, :, ::-1].copy()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """similarity = (A · B) / (||A|| × ||B||)"""
    a = a.flatten().astype(np.float64)
    b = b.flatten().astype(np.float64)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


# ── Public API ───────────────────────────────────────────────

def generate_embedding(image_b64: str) -> dict:
    """
    Generate a 512-D face embedding from a base64-encoded image.
    Returns {"embedding": [...], "face_detected": True/False}
    """
    app = _get_face_app()
    img = _b64_to_np(image_b64)
    try:
        faces = app.get(img)
        if not faces:
            return {"embedding": None, "face_detected": False}
        # Take the largest face
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        embedding = face.normed_embedding.tolist()  # Already L2-normalized 512-D
        return {"embedding": embedding, "face_detected": True}
    except Exception as e:
        logger.warning(f"Face detection failed: {e}")
        return {"embedding": None, "face_detected": False, "error": str(e)}


def generate_multi_embedding(images_b64: List[str]) -> dict:
    """
    Generate an averaged embedding from multiple images (multi-angle enrollment).
    Returns {"embedding": [...], "count": N, "face_detected": True}
    """
    embeddings: list[np.ndarray] = []
    errors: list[str] = []
    for idx, b64 in enumerate(images_b64):
        result = generate_embedding(b64)
        if result.get("face_detected") and result.get("embedding"):
            embeddings.append(np.array(result["embedding"]))
        else:
            errors.append(f"Image {idx}: {result.get('error', 'no face')}")

    if not embeddings:
        return {"embedding": None, "face_detected": False, "errors": errors}

    avg = np.mean(embeddings, axis=0)
    avg = avg / np.linalg.norm(avg)  # L2 normalise
    return {
        "embedding": avg.tolist(),
        "count": len(embeddings),
        "face_detected": True,
        "errors": errors if errors else None,
    }


def verify_face(probe_b64: str, stored_embedding: list[float]) -> dict:
    """
    Compare a probe image against a stored embedding.
    Returns {"match": bool, "similarity": float, "threshold": float}
    """
    result = generate_embedding(probe_b64)
    if not result.get("face_detected") or not result.get("embedding"):
        return {"match": False, "similarity": 0.0, "error": "No face in probe image"}

    probe_emb = np.array(result["embedding"])
    stored_emb = np.array(stored_embedding)
    sim = cosine_similarity(probe_emb, stored_emb)
    return {
        "match": sim >= FACE_SIMILARITY_THRESHOLD,
        "similarity": round(sim, 4),
        "threshold": FACE_SIMILARITY_THRESHOLD,
    }


def identify_face(probe_b64: str, candidates: list[dict]) -> dict:
    """
    1-to-N face identification.
    candidates = [{"student_id": "...", "embedding": [...]}]
    Returns best match or None.
    """
    result = generate_embedding(probe_b64)
    if not result.get("face_detected") or not result.get("embedding"):
        return {"identified": False, "error": "No face in probe"}

    probe_emb = np.array(result["embedding"])
    best_sim = -1.0
    best_id = None

    for c in candidates:
        stored = np.array(c["embedding"])
        sim = cosine_similarity(probe_emb, stored)
        if sim > best_sim:
            best_sim = sim
            best_id = c["student_id"]

    if best_sim >= FACE_SIMILARITY_THRESHOLD:
        return {
            "identified": True,
            "student_id": best_id,
            "similarity": round(best_sim, 4),
            "threshold": FACE_SIMILARITY_THRESHOLD,
        }
    return {"identified": False, "best_similarity": round(best_sim, 4)}
