import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '@poker/db';
import { schema } from '@poker/db';
import { config } from './config.js';

export function createAuth(db: Database) {
  const google =
    config.google.clientId && config.google.clientSecret
      ? { google: { clientId: config.google.clientId, clientSecret: config.google.clientSecret } }
      : {};
  return betterAuth({
    baseURL: config.apiUrl,
    secret: config.authSecret,
    basePath: '/api/auth',
    trustedOrigins: [config.webOrigin],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 6 },
    socialProviders: google,
    session: { cookieCache: { enabled: true, maxAge: 60 } },
    advanced: { useSecureCookies: config.isProd },
  });
}
export type Auth = ReturnType<typeof createAuth>;

export interface AuthUser {
  id: string;
  name: string;
}

/** 从请求头（含 cookie）解析当前登录用户 */
export async function userFromHeaders(auth: Auth, headers: Headers): Promise<AuthUser | null> {
  const s = await auth.api.getSession({ headers });
  if (!s) return null;
  return { id: s.user.id, name: s.user.name || s.user.email };
}
