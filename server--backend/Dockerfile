# Stage 1: Base
FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# Stage 2: Builder
FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000
CMD ["node", "dist/index.js"]
