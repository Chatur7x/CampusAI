# syntax=docker/dockerfile:1.7
# check=skip=SecretsUsedInArgOrEnv
# =============================================================
# AISMS — Frontend (React + Vite SPA, served by nginx)
# =============================================================
# Build context MUST be the repository root:
#   docker build -t aisms-frontend .
#
# Stage 1 compiles the SPA with Vite. Stage 2 serves the resulting
# static assets from an unprivileged nginx image. No Node runtime
# ships in the final image.

# ── Stage 1: build ──
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Vite inlines import.meta.env.VITE_* at BUILD time, so these must be
# passed as build args rather than runtime environment variables.
# The defaults match the local docker-compose wiring.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_AI_SERVER_URL=http://localhost:8000
ARG VITE_BACKEND_URL=http://localhost:5000
ARG VITE_CAMPUS_LATITUDE
ARG VITE_CAMPUS_LONGITUDE
ARG VITE_MAX_ATTENDANCE_DISTANCE

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_AI_SERVER_URL=$VITE_AI_SERVER_URL \
    VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_CAMPUS_LATITUDE=$VITE_CAMPUS_LATITUDE \
    VITE_CAMPUS_LONGITUDE=$VITE_CAMPUS_LONGITUDE \
    VITE_MAX_ATTENDANCE_DISTANCE=$VITE_MAX_ATTENDANCE_DISTANCE \
    NODE_ENV=production

# Manifests first, so npm ci is cached until dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

# Everything Vite needs to compile: index.html, vite.config.ts,
# tailwind/postcss config, tsconfig set, public/ and src--frontend/.
# The root .dockerignore strips .env*, node_modules, server--backend,
# ai-server and uploads out of this context.
COPY . .

RUN npm run build

# ── Stage 2: serve ──
# nginxinc/nginx-unprivileged runs master + workers as uid 101 and is
# built to listen on an unprivileged port, so no root and no
# CAP_NET_BIND_SERVICE are required.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Reuse the repo's existing SPA + API-proxy config (nginx.conf).
# It listens on 5173 and proxies /api/ai/ to the `ai-server` service
# name, which only resolves on the compose network.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

# `nginx:unprivileged` image already sets this; repeated for clarity.
USER 101

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:5173/"]

CMD ["nginx", "-g", "daemon off;"]