'use client';
import type { RoomView } from '@poker/protocol';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { RoomOptionsForm, optionsSummary } from './RoomOptionsForm';
import { Button, Code, Panel, Tag } from './ui';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

export function Lobby({ room, userId }: { room: RoomView; userId: string }) {
  const notify = useStore((s) => s.notify);
  const [editing, setEditing] = useState(false);
  const isHost = room.hostId === userId;
  const mySeat = room.seats.findIndex((s) => s?.userId === userId);
  const full = room.seats.every(Boolean);
  const act = async (ev: Parameters<typeof request>[0], payload: Parameters<typeof request>[1]) => {
    const r = await request(ev, payload as never);
    if (!r.ok) notify(r.error ?? '操作失败');
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-faint">房间码 · 发给朋友即可加入</div>
          <Code className="text-3xl font-semibold">{room.id}</Code>
        </div>
        {isHost ? (
          <Button
            variant="primary"
            size="lg"
            disabled={!full}
            onClick={() => act('room:start', {})}
          >
            {full ? '开始游戏' : `还差 ${room.seats.filter((s) => !s).length} 人`}
          </Button>
        ) : (
          <span className="text-sm text-muted">等待房主开始</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {room.seats.map((s, i) => {
          const isBot = !!s?.bot && s.userId.startsWith('bot:');
          return (
            <div key={i} className="panel flex items-center gap-3 p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center">
                {s ? (
                  <Avatar name={s.name} src={s.avatar} size={40} bot={isBot} />
                ) : (
                  <div className="h-10 w-10 rounded-full border border-dashed border-white/20" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-faint">座位 {i + 1}</span>
                  <Tag tone={i % 2 === 0 ? 'a' : 'b'}>{i % 2 === 0 ? '1/3 队' : '2/4 队'}</Tag>
                </div>
                <div className="truncate text-sm font-medium">
                  {s ? s.name : <span className="text-faint">空位</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                {!s && mySeat !== i && (
                  <Button size="sm" onClick={() => act('room:sit', { seat: i })}>
                    入座
                  </Button>
                )}
                {!s && isHost && (
                  <Button size="sm" variant="ghost" onClick={() => act('room:addBot', { seat: i })}>
                    +机器人
                  </Button>
                )}
                {isBot && isHost && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act('room:removeBot', { seat: i })}
                  >
                    移除
                  </Button>
                )}
                {s?.userId === userId && (
                  <Button size="sm" variant="ghost" onClick={() => act('room:stand', {})}>
                    离座
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Panel
        title="房间选项"
        actions={
          isHost && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
              {editing ? '收起' : '修改'}
            </Button>
          )
        }
      >
        {editing && isHost ? (
          <div className="p-4">
            <RoomOptionsForm
              value={room.options}
              onChange={(v) => act('room:setOptions', { options: v })}
            />
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted">{optionsSummary(room.options)}</div>
        )}
      </Panel>

      {room.spectators.length > 0 && (
        <div className="text-xs text-faint">
          旁观：{room.spectators.map((s) => s.name).join('、')}
        </div>
      )}
    </div>
  );
}
