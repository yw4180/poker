import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { eq } from 'drizzle-orm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createAvatar } from '@dicebear/core';
import { funEmoji } from '@dicebear/collection';
import { createDb, gamePlayers, games, user as userTable } from '@poker/db';
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
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  const uploadDir = path.resolve(config.uploadDir);
  await mkdir(path.join(uploadDir, 'avatars'), { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/api/uploads/',
    decorateReply: false,
    maxAge: '7d',
  });

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

  /** 机器人头像：DiceBear Fun Emoji（CC BY 4.0，见 README），按名字生成 */
  app.get<{ Params: { seed: string } }>('/api/bot-avatar/:seed', async (request, reply) => {
    const seed = decodeURIComponent(request.params.seed.replace(/\.svg$/, ''));
    const svg = createAvatar(funEmoji, {
      seed,
      backgroundColor: ['1f2937', '0f766e', '155e75', '4c1d95', '9f1239', '92400e'],
      radius: 50,
    }).toString();
    reply.header('cache-control', 'public, max-age=604800, immutable');
    return reply.type('image/svg+xml').send(svg);
  });

  /** 上传头像：multipart 字段 file；压成 128x128 webp，写入 user.image */
  app.post('/api/avatar', async (request, reply) => {
    const headers = new Headers();
    for (const [k, v] of Object.entries(request.headers))
      if (typeof v === 'string') headers.set(k, v);
    const me = await userFromHeaders(auth, headers);
    if (!me) return reply.status(401).send({ error: '未登录' });
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: '没有文件' });
    const buf = await file.toBuffer();
    const name = `${me.id}-${Date.now()}.webp`;
    await sharp(buf)
      .rotate()
      .resize(128, 128, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(path.join(uploadDir, 'avatars', name));
    const url = `/api/uploads/avatars/${name}`;
    await db
      .update(userTable)
      .set({ image: url, updatedAt: new Date() })
      .where(eq(userTable.id, me.id));
    return { url };
  });

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

  // ---------- 房间状态持久化：重启不丢房间 ----------
  const stateDir = path.resolve(config.stateDir);
  mkdirSync(stateDir, { recursive: true });
  const stateFile = path.join(stateDir, 'rooms.json');
  if (existsSync(stateFile)) {
    try {
      const data = JSON.parse(readFileSync(stateFile, 'utf8'));
      rooms.restore(data);
      app.log.info(`已恢复 ${data.length} 个房间`);
    } catch (e) {
      app.log.error({ err: e }, '恢复房间状态失败');
    }
  }
  const saveRooms = () => {
    try {
      writeFileSync(stateFile, JSON.stringify(rooms.snapshot()));
    } catch (e) {
      app.log.error({ err: e }, '保存房间状态失败');
    }
  };
  setInterval(saveRooms, 15_000).unref();
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      saveRooms();
      process.exit(0);
    });
  }
  void readFile;
  void writeFile;

  app.get('/api/rooms', async () => ({
    rooms: rooms.list().map((r) => ({
      id: r.id,
      name: r.name,
      hostName: r.hostName,
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
