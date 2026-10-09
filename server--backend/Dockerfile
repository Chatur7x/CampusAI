# =============================================================
# AISMS — Express/Prisma backend
# =============================================================
# Build context MUST be the server--backend/ directory:
#   docker build -t aisms-backend ./server--backend
#
# Stages
#   deps    — full dependency tree (needed for prisma generate + tsc)
#   build   — compiled TypeScript
#   runtime — production dependencies only, non-root, no compiler

# ── Stage 1: install every dependency (dev included) ──
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Only the manifests first — this layer is cached until deps actually change.
COPY package.json package-lock.json ./
# Prisma needs the schema present before `prisma generate` can run.
COPY prisma ./prisma

RUN npm ci

# ── Stage 2: generate the Prisma client and compile TypeScript ──
FROM node:20-bookworm-slim AS build
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` writes into node_modules/.prisma, so it must run
# before node_modules is pruned in the runtime stage.
RUN npx prisma generate \
    && npm run build

# Drop devDependencies from the tree we are going to ship.
RUN npm prune --omit=dev

# ── Stage 3: runtime ──
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_PATH=/app/uploads

# openssl is required by the Prisma query engine on Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# The node image already ships an unprivileged `node` user (uid 1000).
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json

# CSV bulk-upload destination; multer writes here at runtime.
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

# Exec form: no shell, so the container is PID 1 and receives SIGTERM
# directly for a clean shutdown.
CMD ["node", "dist/index.js"]