# =============================================================
# CAMPUSAI AI Server Configuration
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

# ── Face Recognition (InsightFace / ArcFace — no TensorFlow needed) ──
FACE_SIMILARITY_THRESHOLD = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.55"))

# ── Liveness ──
EAR_BLINK_THRESHOLD = float(os.getenv("EAR_BLINK_THRESHOLD", "0.22"))
HEAD_TURN_THRESHOLD = float(os.getenv("HEAD_TURN_THRESHOLD", "15"))

# ── MLflow ──
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "./mlruns")

# ── Server ──
AI_SERVER_HOST = os.getenv("AI_SERVER_HOST", "0.0.0.0")
AI_SERVER_PORT = int(os.getenv("AI_SERVER_PORT", "8000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
