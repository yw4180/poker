# 项目约定

- pnpm monorepo；改动 packages/* 后需 `pnpm --filter <pkg> build`，apps 通过 dist 引用。
- 规则引擎 `packages/engine` 必须保持纯函数、零依赖；所有规则改动先写 Vitest 测试（`test/*.test.ts`，`helpers.ts` 里 `c('S7')`/`cs(...)` 简写取牌，`'` 后缀表示第二副）。
- 服务器从不向客户端发送他人手牌（`viewFor`）；客户端只做提示，合法性以服务器为准。
- socket 事件与载荷统一在 `packages/protocol` 用 zod 定义。
- 数据库改动：改 `packages/db/src/schema.ts` → `pnpm --filter @poker/db db:generate` → 提交生成的 `drizzle/*.sql`。
- Better Auth 版本升级后可用 `pnpm dlx @better-auth/cli generate --config apps/server/auth.config.ts` 对照 schema。
- 中文 UI 文案；代码注释中文为主。
- 端到端：`pnpm --filter @poker/web test:e2e`（需本地 Postgres；会复用已运行的 3000/4000）。`E2E_VIEWPORT=375x740` 可跑移动端视口并在 `apps/web/test-results/` 出截图。
- AI 在 `packages/engine/src/ai/`，权重集中在 `weights.ts`；改动后跑 `ai-vs-random.test.ts` 看胜率（门槛 75%）。
