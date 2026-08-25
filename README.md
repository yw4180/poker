# 牌桌 · 升级（拖拉机）

朋友之间登录即玩的在线升级（4 人 2 副牌拖拉机）。后续计划扩展桥牌。

## 技术栈

pnpm + Turborepo monorepo · TypeScript 全栈 · 纯函数规则引擎（Vitest）· Fastify + Socket.IO · PostgreSQL + Drizzle · Better Auth（邮箱密码 + Google）· Next.js 15 + Tailwind + zustand · Docker Compose + Caddy 部署

```
apps/web        Next.js 前端（登录、大厅、牌桌）
apps/server     Fastify + Socket.IO（房间、对局驱动、机器人、战绩入库）
packages/engine 升级规则引擎：reduce(state, action) -> { state, events }
packages/protocol  zod 定义的 socket 事件协议
packages/db     Drizzle schema 与迁移
deploy/         docker-compose / Caddyfile / Dockerfile
```

## 本地开发

```bash
corepack enable && pnpm install
docker compose -f deploy/docker-compose.dev.yml up -d     # 本地 Postgres
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @poker/db db:migrate
pnpm --filter @poker/engine --filter @poker/protocol --filter @poker/db build
pnpm dev            # server :4000, web :3000
```

打开 http://localhost:3000 注册账号 → 创建房间 → 添加机器人补位 → 开始。

## 测试

```bash
pnpm test        # 引擎单测 + 随机整局模拟；服务器 socket 集成测试
pnpm typecheck
```

## 部署

见 `deploy/README.md`。

## 素材与致谢

- 牌面为程序化 SVG（`apps/web/src/components/CardSvg.tsx`），无第三方素材。
- 机器人头像由 [DiceBear](https://www.dicebear.com/) 的 **Bottts Neutral** 风格生成（原作者 Pablo Stanley，CC0）。
