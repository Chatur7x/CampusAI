# =============================================================
# CAMPUSAI AI Server Configuration — Advanced AI Architecture
# =============================================================
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# ── Supabase ──
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Validate required secrets are set
_missing = [k for k, v in [
    ("SUPABASE_URL", SUPABASE_URL),
    ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY),
] if not v]
if _missing:
    print(f"[AI-Server] ERROR: Missing required env vars: {', '.join(_missing)}", file=sys.stderr)
    print("[AI-Server] Create ai-server/.env with SUPABASE_URL and SUPABASE_SERVICE_KEY", file=sys.stderr)

# ── Campus Geofencing ──
CAMPUS_LAT = float(os.getenv("CAMPUS_LAT", "17.335"))
CAMPUS_LON = float(os.getenv("CAMPUS_LON", "78.714"))
CAMPUS_RADIUS_M = float(os.getenv("CAMPUS_RADIUS_M", "500"))

# ── Face Recognition ──
FACE_SIMILARITY_THRESHOLD = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.55"))
FACE_BACKEND = os.getenv("FACE_BACKEND", "insightface")  # insightface | deepface
GPU_ENABLED = os.getenv("GPU_ENABLED", "false").lower() == "true"

# ── Liveness / Anti-Spoof ──
EAR_BLINK_THRESHOLD = float(os.getenv("EAR_BLINK_THRESHOLD", "0.22"))
HEAD_TURN_THRESHOLD = float(os.getenv("HEAD_TURN_THRESHOLD", "15"))
LIVENESS_CHALLENGE_ENABLED = os.getenv("LIVENESS_CHALLENGE_ENABLED", "true").lower() == "true"
DEEPFAKE_DETECTION_ENABLED = os.getenv("DEEPFAKE_DETECTION_ENABLED", "true").lower() == "true"

# ── Confidence Scoring Weights ──
CONF_WEIGHT_FACE = float(os.getenv("CONF_WEIGHT_FACE", "0.50"))
CONF_WEIGHT_LIVENESS = float(os.getenv("CONF_WEIGHT_LIVENESS", "0.20"))
CONF_WEIGHT_GEO = float(os.getenv("CONF_WEIGHT_GEO", "0.15"))
CONF_WEIGHT_DEVICE = float(os.getenv("CONF_WEIGHT_DEVICE", "0.15"))

# ── Fraud Detection ──
FRAUD_CONTAMINATION = float(os.getenv("FRAUD_CONTAMINATION", "0.05"))

# ── MLflow ──
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "./mlruns")

# ── Audit Logging ──
AUDIT_LOG_DIR = os.getenv("AUDIT_LOG_DIR", "./audit_logs")
AUDIT_LOG_ENABLED = os.getenv("AUDIT_LOG_ENABLED", "true").lower() == "true"

# ── Server ──
AI_SERVER_HOST = os.getenv("AI_SERVER_HOST", "0.0.0.0")
AI_SERVER_PORT = int(os.getenv("AI_SERVER_PORT", "8000"))
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://campusai.app,https://*.vercel.app"
).split(",")
