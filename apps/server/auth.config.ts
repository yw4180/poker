// 仅供 @better-auth/cli generate 使用：pnpm dlx @better-auth/cli generate --config auth.config.ts
import { createDb } from '@poker/db';
import { createAuth } from './src/auth.js';
export const auth = createAuth(
  createDb(process.env.DATABASE_URL ?? 'postgres://poker:poker@localhost:5432/poker'),
);
