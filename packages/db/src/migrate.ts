import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgres://poker:poker@localhost:5432/poker';
const folder = process.env.MIGRATIONS_DIR ?? new URL('../drizzle', import.meta.url).pathname;
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: folder });
await client.end();
console.log('migrations applied');
