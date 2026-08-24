'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { Button, Input, Panel } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { signOut } from '@/lib/auth-client';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

interface RoomSummary {
  id: string;
  name: string;
  status: string;
  players: number;
}

function Home({ user }: { user: { id: string; name: string } }) {
  const router = useRouter();
  const bind = useStore((s) => s.bind);
  const notify = useStore((s) => s.notify);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => bind(), [bind]);
  useEffect(() => {
    const load = () =>
      fetch(`${API_URL}/api/rooms`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setRooms(d.rooms ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const create = async () => {
    const r = await request('room:create', { name: `${user.name}的房间` });
    if (r.ok) router.push(`/room/${(r.data as { roomId: string }).roomId}`);
    else notify(r.error ?? '创建失败');
  };
  const join = (id: string) => router.push(`/room/${id.toUpperCase()}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🃏 牌桌 · 升级</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>{user.name}</span>
          <Button variant="ghost" onClick={() => signOut().then(() => router.replace('/login'))}>
            退出
          </Button>
        </div>
      </header>
      <Panel className="flex flex-wrap items-center gap-3">
        <Button onClick={create}>创建房间</Button>
        <span className="text-white/40">或</span>
        <Input
          placeholder="输入房间码"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{ width: 160 }}
          maxLength={8}
        />
        <Button variant="ghost" disabled={code.length < 4} onClick={() => join(code)}>
          加入
        </Button>
      </Panel>
      <Panel>
        <h2 className="mb-2 font-semibold">当前房间</h2>
        {rooms.length === 0 && <div className="text-sm text-white/50">还没有房间，创建一个吧</div>}
        <ul className="divide-y divide-white/10">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <b className="tracking-widest text-amber-300">{r.id}</b> · {r.name} · {r.players}/4
                · {r.status === 'playing' ? '游戏中' : '等待中'}
              </span>
              <Button variant="ghost" onClick={() => join(r.id)}>
                进入
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export default function Page() {
  return <AuthGate>{(user) => <Home user={user} />}</AuthGate>;
}
