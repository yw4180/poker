'use client';
import { type RoomOptions, DEFAULT_ROOM_OPTIONS } from '@poker/protocol';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { AvatarUploader } from '@/components/AvatarUploader';
import { RoomOptionsForm, optionsSummary } from '@/components/RoomOptionsForm';
import { Button, Code, Input, Panel, Tag } from '@/components/ui';
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
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<RoomOptions>(DEFAULT_ROOM_OPTIONS);

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
    const r = await request('room:create', { options });
    if (r.ok) router.push(`/room/${(r.data as { roomId: string }).roomId}`);
    else notify(r.error ?? '创建失败');
  };
  const join = (id: string) => router.push(`/room/${id.toUpperCase()}`);

  return (
    <AppShell
      right={
        <>
          <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
          <AvatarUploader name={user.name} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => signOut().then(() => router.replace('/login'))}
          >
            退出
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="pt-4">
          <h1 className="text-2xl font-semibold tracking-tight">开一桌升级</h1>
          <p className="mt-1 text-sm text-muted">4 人 2 副牌拖拉机 · 人不够可以让机器人补位</p>
        </div>

        <Panel>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" onClick={create}>
              创建房间
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setShowOptions(!showOptions)}>
              {showOptions ? '收起选项' : '房间选项'}
            </Button>
            <div className="hidden h-6 w-px bg-white/10 sm:block" />
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length >= 4) join(code);
              }}
            >
              <Input
                placeholder="输入房间码加入"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="font-mono uppercase tracking-widest"
              />
              <Button type="submit" size="md" disabled={code.length < 4} className="h-11">
                加入
              </Button>
            </form>
          </div>
          {showOptions ? (
            <div className="border-t border-white/[0.06] p-4">
              <RoomOptionsForm value={options} onChange={setOptions} />
            </div>
          ) : (
            <div className="border-t border-white/[0.06] px-4 py-2 text-xs text-faint">
              {optionsSummary(options)}
            </div>
          )}
        </Panel>

        <Panel title="当前房间">
          {rooms.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-faint">还没有房间，创建一个吧</div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {rooms.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Code>{r.id}</Code>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <Tag tone={r.status === 'playing' ? 'accent' : 'default'}>
                    {r.status === 'playing' ? '游戏中' : '等待中'}
                  </Tag>
                  <span className="font-mono text-xs text-muted">{r.players}/4</span>
                  <Button size="sm" onClick={() => join(r.id)}>
                    进入
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

export default function Page() {
  return <AuthGate>{(user) => <Home user={user} />}</AuthGate>;
}
