# ── Stage 1: deps ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ── Stage 2: build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Increase Node memory for large Next.js builds
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Dummy env vars so Next.js doesn't fail on missing envs at build time
ENV ANTHROPIC_API_KEY=dummy
ENV PINECONE_API_KEY=dummy
ENV PINECONE_INDEX=ai
ENV DEEPGRAM_API_KEY=dummy
ENV DEEPGRAM_PROJECT_ID=dummy
ENV ELEVENLABS_API_KEY=dummy
ENV ELEVENLABS_VOICE_ID=dummy
ENV OPENAI_API_KEY=dummy

RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
