FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
RUN pnpm install --frozen-lockfile

COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter @nugget/shared-types build

COPY apps/api ./apps/api
RUN pnpm --filter @nugget/api build

RUN pnpm --filter @nugget/api --prod deploy /prod/api

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=base /prod/api ./
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/apps/api/prisma ./prisma
COPY --from=base /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=base /app/packages/shared-types/dist ./node_modules/@nugget/shared-types/dist

EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
