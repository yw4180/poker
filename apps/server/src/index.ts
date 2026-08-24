import cors from '@fastify/cors';
import { createDb, gamePlayers, games } from '@poker/db';
import Fastify from 'fastify';
import { nanoid } from 'nanoid';
import { createAuth, userFromHeaders } from './auth.js';
import { config } from './config.js';
import { attachSocket } from './socket.js';

async function main() {
  const db = createDb(config.databaseUrl);
  const auth = createAuth(db);
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.webOrigin, credentials: true });

  // Better Auth：把 Fastify 请求转成 Web Request
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, config.apiUrl);
      const headers = new Headers();
      for (const [k, v] of Object.entries(request.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const init: RequestInit = { method: request.method, headers };
      if (request.body) init.body = JSON.stringify(request.body);
      const req = new Request(url, init);
      const res = await auth.handler(req);
      reply.status(res.status);
      res.headers.forEach((v, k) => reply.header(k, v));
      reply.send(res.body ? await res.text() : null);
    },
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/me', async (request, reply) => {
    const headers = new Headers();
    for (const [k, v] of Object.entries(request.headers))
      if (typeof v === 'string') headers.set(k, v);
    const user = await userFromHeaders(auth, headers);
    if (!user) return reply.status(401).send({ error: '未登录' });
    return user;
  });

  const { rooms } = attachSocket(app.server, {
    corsOrigin: config.webOrigin,
    authenticate: (headers) => userFromHeaders(auth, headers),
    async onGameFinished(room, state) {
      const id = nanoid();
      await db.insert(games).values({
        id,
        roomId: room.id,
        config: state.config,
        finishedAt: new Date(),
        winnerTeam: state.winner,
        finalLevels: state.levels,
        rounds: state.roundNo,
      });
      await db.insert(gamePlayers).values(
        room.seats.map((s, seat) => ({
          gameId: id,
          userId: s!.bot ? null : s!.userId,
          displayName: s!.name,
          seat,
          team: seat % 2,
          isBot: s!.bot,
        })),
      );
    },
  });

  app.get('/api/rooms', async () => ({
    rooms: rooms.list().map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      players: r.seats.filter(Boolean).length,
    })),
  }));

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
