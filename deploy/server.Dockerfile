FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @poker/server... build
# 只保留生产依赖
RUN pnpm --filter @poker/server --prod deploy /out

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /out /app
# 数据库迁移文件（启动时执行）
COPY --from=build /app/packages/db/drizzle /app/drizzle
COPY --from=build /app/packages/db/dist/migrate.js /app/migrate.js
EXPOSE 4000
CMD ["sh", "-c", "node migrate.js && node dist/index.js"]
