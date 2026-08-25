import { io } from 'socket.io-client';
const API = 'http://localhost:4000';
const email = `e2e${Date.now()}@test.com`;
let res = await fetch(`${API}/api/auth/sign-up/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  body: JSON.stringify({ email, password: 'secret123', name: '测试员' }),
});
const cookie = res.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const s = io(API, { extraHeaders: { cookie } });
const emit = (ev, p) => new Promise((r) => s.emit(ev, p, r));
await new Promise((r) => s.on('connect', r));
const c = await emit('room:create', { name: 'dbg' });
await emit('room:sit', { seat: 0 });
for (const seat of [1, 2, 3]) await emit('room:addBot', { seat });
let first = null;
s.on('game:state', (v) => {
  if (!first) first = v;
});
console.log('start', JSON.stringify(await emit('room:start', {})));
await new Promise((r) => setTimeout(r, 1500));
console.log('game:state roomId =', first?.roomId, 'phase', first?.phase, 'created', c.data?.roomId);
console.log('autoplay', JSON.stringify(await emit('room:autoplay', { on: true })));
s.close();
