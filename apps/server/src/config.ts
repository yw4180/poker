import 'dotenv/config';

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  port: Number(env('PORT', '4000')),
  databaseUrl: env('DATABASE_URL', 'postgres://poker:poker@localhost:5432/poker'),
  apiUrl: env('API_URL', 'http://localhost:4000'),
  webOrigin: env('WEB_ORIGIN', 'http://localhost:3000'),
  authSecret: env('BETTER_AUTH_SECRET', 'dev-secret-do-not-use-in-prod'),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  isProd: process.env.NODE_ENV === 'production',
};
