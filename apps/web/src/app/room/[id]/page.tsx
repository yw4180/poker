'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { Chat } from '@/components/Chat';
import { Controls } from '@/components/Controls';
import { Hand } from '@/components/Hand';
import { LastTrick } from '@/components/LastTrick';
import { Lobby } from '@/components/Lobby';
import { RoundEndModal } from '@/components/RoundEndModal';
import { InfoBar, Table } from '@/components/Table';
import { Button } from '@/components/ui';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

function RoomPage({ user }: { user: { id: string; name: string } }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const bind = useStore((s) => s.bind);
  const connected = useStore((s) => s.connected);
  const room = useStore((s) => s.room);
  const game = useStore((s) => s.game);
  const notices = useStore((s) => s.notices);
  const notify = useStore((s) => s.notify);
  const kittyNewIds = useStore((s) => s.kittyNewIds);
  const showLastTrick = useStore((s) => s.showLastTrick);
  const enterRoom = useStore((s) => s.enterRoom);

  useEffect(() => enterRoom(id.toUpperCase()), [enterRoom, id]);
  useEffect(() => bind(), [bind]);
  useEffect(() => {
    if (!connected) return;
    request('room:join', { roomId: id.toUpperCase() }).then((r) => {
      if (!r.ok) {
        notify(r.error ?? '无法加入房间');
        router.replace('/');
      }
    });
  }, [connected, id, notify, router]);

  const leave = async () => {
    await request('room:leave', {});
    useStore.setState({ currentRoomId: null, room: null, game: null, chat: [] });
    router.replace('/');
  };

  if (!room || room.id !== id.toUpperCase()) {
    return (
      <div className="p-8 text-center text-white/60">
        {connected ? '进入房间中…' : '连接服务器中…'}
      </div>
    );
  }

  const inGame = room.status === 'playing' && game;
  const mySeat = game?.seat ?? -1;
  const interactive =
    !!game &&
    mySeat >= 0 &&
    (game.actor === mySeat || game.phase === 'dealing' || game.phase === 'declaring');
  const roundOver = game && (game.phase === 'roundEnd' || game.phase === 'finished');

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-2 sm:p-4">
      <header className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/60 hover:text-white">
            ← 大厅
          </Link>
          <span className="font-semibold">{room.name}</span>
          <span className="tracking-widest text-amber-300">{room.id}</span>
          {!connected && <span className="text-red-400">连接断开，重连中…</span>}
        </div>
        <Button variant="ghost" onClick={leave}>
          离开房间
        </Button>
      </header>

      <div className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 space-y-2">
        {notices.map((n) => (
          <div key={n.id} className="rounded-md bg-black/80 px-3 py-2 text-sm shadow">
            {n.text}
          </div>
        ))}
      </div>

      {inGame ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="space-y-2">
            <InfoBar game={game} />
            <Table game={game} room={room} />
            {showLastTrick && <LastTrick game={game} />}
            <Controls game={game} room={room} userId={user.id} />
            {mySeat >= 0 && (
              <Hand
                cards={game.hand}
                trump={game.trump}
                level={game.level}
                interactive={interactive}
                highlightIds={kittyNewIds}
              />
            )}
          </div>
          <Chat className="h-64 lg:h-auto lg:max-h-[80vh]" />
          {roundOver && <RoundEndModal game={game} room={room} userId={user.id} />}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            {game && game.phase === 'finished' && (
              <div className="mb-4 rounded-lg bg-amber-500/20 p-3 text-center">
                游戏结束，{game.winner === 0 ? '1/3 队' : '2/4 队'} 获胜！
              </div>
            )}
            <Lobby room={room} userId={user.id} />
          </div>
          <Chat className="h-64" />
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <AuthGate>{(user) => <RoomPage user={user} />}</AuthGate>;
}
