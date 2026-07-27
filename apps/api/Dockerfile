FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# Build shared-types
COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter @nugget/shared-types build

# Build API
COPY apps/api ./apps/api
RUN pnpm --filter @nugget/api prisma:generate
RUN pnpm --filter @nugget/api build

# Prune dev dependencies
RUN pnpm --filter @nugget/api --prod deploy /prod/api

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=base /prod/api ./
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/apps/api/prisma ./prisma
COPY --from=base /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=base /app/packages/shared-types/dist ./node_modules/@nugget/shared-types/dist

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
