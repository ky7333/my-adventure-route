# syntax=docker/dockerfile:1.23@sha256:2780b5c3bab67f1f76c781860de469442999ed1a0d7992a5efdf2cffc0e3d769

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/scoring/package.json packages/scoring/package.json
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @adventure/contracts build \
  && pnpm --filter @adventure/scoring build \
  && pnpm --filter @adventure/api prisma:generate \
  && pnpm --filter @adventure/api build \
  && pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=app:app /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=app:app /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=app:app /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=app:app /app/packages/scoring/package.json ./packages/scoring/package.json
COPY --from=build --chown=app:app /app/packages/scoring/dist ./packages/scoring/dist

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT ?? 3001) + '/api/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
