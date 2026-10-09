# =============================================================
# AISMS — AI server (FastAPI)
# =============================================================
# Build context MUST be the REPOSITORY ROOT:
#   docker build -t aisms-ai -f ai-server/Dockerfile .
#   docker compose build ai-server        (compose uses the same context)
#
# Why repo root: the committed railway.json lives at the repo root, and Railway
# always builds a root-level Dockerfile service from the repository root — its
# manifest schema has no field for a subdirectory build context. Rooting the COPY
# paths here is what keeps the Railway deploy and docker compose in agreement
# rather than letting them silently diverge.
#
# Multi-stage so that the compiler toolchain, headers and the
# pip build cache never reach the runtime image.

# ── Stage 1: build wheels into a self-contained virtualenv ──
FROM python:3.12-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# Build-only toolchain. Needed by insightface / onnxruntime / numpy
# when no prebuilt wheel matches this interpreter.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        make \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies first so the layer is cached across code edits.
COPY ai-server/requirements.txt ./

# Install into a venv that we later copy wholesale. --no-compile keeps
# .pyc files out; the runtime sets PYTHONDONTWRITEBYTECODE as well.
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# ── Stage 2: runtime ──
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/opt/venv/bin:$PATH" \
    AI_SERVER_HOST=0.0.0.0 \
    AI_SERVER_PORT=8000

# Runtime shared libraries only (no build-essential).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Unprivileged runtime user with a fixed UID so a host bind-mount can
# be chowned to match. Never run the server as root.
RUN groupadd --system --gid 1001 aisms \
    && useradd --system --uid 1001 --gid aisms --no-create-home --shell /usr/sbin/nologin aisms

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=aisms:aisms ai-server/ /app

# Writable scratch dirs (audit_logs, MLflow runs, InsightFace model cache).
RUN mkdir -p /app/audit_logs /app/mlruns /home/aisms/.insightface \
    && chown -R aisms:aisms /app /home/aisms

USER aisms

EXPOSE 8000

# Uses the stdlib so the image does not need curl installed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"]

# Form: "sh -c" so ${PORT:-8000} expands at runtime (Railway injects PORT).
# Workers default to 1; raise only after confirming the InsightFace model
# is loaded once per process and memory headroom allows it.
CMD ["sh", "-c", "exec uvicorn main:app --host ${AI_SERVER_HOST:-0.0.0.0} --port ${PORT:-8000} --workers ${WORKERS:-1} --limit-concurrency 100"]