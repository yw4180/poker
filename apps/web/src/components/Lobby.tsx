'use client';
import type { RoomView } from '@poker/protocol';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { RoomOptionsForm, optionsSummary } from './RoomOptionsForm';
import { Button } from './ui';
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
    <div className="mx-auto max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {room.seats.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-neutral-800 p-3"
          >
            <div>
              <div className="text-xs text-white/50">
                座位 {i + 1} ·{' '}
                <span className={i % 2 === 0 ? 'text-sky-300' : 'text-rose-300'}>
                  {i % 2 === 0 ? '1/3 队' : '2/4 队'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                {s && (
                  <Avatar
                    name={s.name}
                    src={s.avatar}
                    size={28}
                    bot={s.bot && s.userId.startsWith('bot:')}
                  />
                )}
                {s ? s.name : <span className="text-white/40">空位</span>}
              </div>
            </div>
            <div className="flex gap-1">
              {!s && mySeat !== i && (
                <Button variant="ghost" onClick={() => act('room:sit', { seat: i })}>
                  入座
                </Button>
              )}
              {!s && isHost && (
                <Button variant="ghost" onClick={() => act('room:addBot', { seat: i })}>
                  +机器人
                </Button>
              )}
              {s?.bot && isHost && (
                <Button variant="ghost" onClick={() => act('room:removeBot', { seat: i })}>
                  移除
                </Button>
              )}
              {s?.userId === userId && (
                <Button variant="ghost" onClick={() => act('room:stand', {})}>
                  离座
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-neutral-800 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-white/70">房间选项：{optionsSummary(room.options)}</span>
          {isHost && (
            <Button variant="ghost" onClick={() => setEditing(!editing)}>
              {editing ? '收起' : '修改'}
            </Button>
          )}
        </div>
        {editing && isHost && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <RoomOptionsForm
              value={room.options}
              onChange={(v) => act('room:setOptions', { options: v })}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-white/60">
          房间码 <b className="text-lg tracking-widest text-amber-300">{room.id}</b>
          （把房间码发给朋友）
        </div>
        {isHost ? (
          <Button disabled={!full} onClick={() => act('room:start', {})}>
            开始游戏
          </Button>
        ) : (
          <span className="text-sm text-white/60">等待房主开始</span>
        )}
      </div>
      {room.spectators.length > 0 && (
        <div className="text-xs text-white/50">
          旁观：{room.spectators.map((s) => s.name).join('、')}
        </div>
      )}
    </div>
  );
}
