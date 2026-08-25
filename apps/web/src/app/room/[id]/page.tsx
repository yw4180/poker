'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { CardCounter } from '@/components/CardCounter';
import { Chat } from '@/components/Chat';
import { Controls } from '@/components/Controls';
import { GameLog } from '@/components/GameLog';
import { Hand } from '@/components/Hand';
import { LastTrick } from '@/components/LastTrick';
import { Lobby } from '@/components/Lobby';
import { RoundEndModal } from '@/components/RoundEndModal';
import { InfoBar, Table } from '@/components/Table';
import { UndoBanner } from '@/components/UndoBanner';
import { Button, Code, Panel, Tag } from '@/components/ui';
import { request } from '@/lib/socket';
import { roomTitle } from '@/lib/room-name';
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
  const roundEndDismissed = useStore((s) => s.roundEndDismissed);
  const enterRoom = useStore((s) => s.enterRoom);
  const [showCounter, setShowCounter] = useState(true);

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
    useStore.setState({ currentRoomId: null, room: null, game: null, chat: [], log: [] });
    router.replace('/');
  };

  if (!room || room.id !== id.toUpperCase()) {
    return (
      <AppShell
        wide
        right={
          <Button size="sm" variant="ghost" onClick={leave}>
            离开
          </Button>
        }
      >
        <div className="py-24 text-center text-sm text-muted">
          {connected ? '进入房间中…' : '连接服务器中…'}
        </div>
      </AppShell>
    );
  }

  const inGame = room.status === 'playing' && game;
  const mySeat = game?.seat ?? -1;
  const interactive =
    !!game &&
    mySeat >= 0 &&
    (game.actor === mySeat || game.phase === 'dealing' || game.phase === 'declaring');
  const roundOver = game && (game.phase === 'roundEnd' || game.phase === 'finished');

  const side = (
    <div className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)]">
      {inGame && room.options.cardCounter && (
        <Panel
          title="记牌器"
          actions={
            <Button size="sm" variant="ghost" onClick={() => setShowCounter(!showCounter)}>
              {showCounter ? '收起' : '展开'}
            </Button>
          }
        >
          {showCounter && (
            <div className="px-4 py-3">
              <CardCounter game={game} />
            </div>
          )}
        </Panel>
      )}
      <GameLog className="h-40 shrink-0 lg:h-auto lg:min-h-0 lg:flex-[2]" />
      <Chat className="h-72 shrink-0 lg:h-auto lg:min-h-0 lg:flex-[3]" />
    </div>
  );

  return (
    <AppShell
      wide
      fill
      center={
        <span className="flex items-center gap-2">
          <span className="truncate">{roomTitle(room)}</span>
          <Code className="text-xs">{room.id}</Code>
          {!connected && <Tag tone="warn">重连中…</Tag>}
        </span>
      }
      right={
        <Button size="sm" variant="ghost" onClick={leave}>
          离开房间
        </Button>
      }
    >
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5">
        {notices.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-white/10 bg-elev-2/95 px-3 py-1.5 text-[13px] shadow-lg backdrop-blur"
          >
            {n.text}
          </div>
        ))}
      </div>

      {inGame ? (
        <div className="grid gap-4 lg:items-start lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-0 flex-col gap-3">
            <InfoBar game={game} />
            <Table game={game} room={room} />
            <UndoBanner room={room} mySeat={mySeat} />
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
          {side}
          {roundOver && !roundEndDismissed && (
            <RoundEndModal game={game} room={room} userId={user.id} onLeave={leave} />
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:items-start lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            {game && game.phase === 'finished' && (
              <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-center text-sm">
                游戏结束，{game.winner === 0 ? '1/3 队' : '2/4 队'} 获胜！
              </div>
            )}
            <Lobby room={room} userId={user.id} />
          </div>
          {side}
        </div>
      )}
    </AppShell>
  );
}

export default function Page() {
  return <AuthGate>{(user) => <RoomPage user={user} />}</AuthGate>;
}
