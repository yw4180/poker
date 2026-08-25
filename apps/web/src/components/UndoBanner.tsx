'use client';
import type { RoomView } from '@poker/protocol';
import { Button } from './ui';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

export function UndoBanner({ room, mySeat }: { room: RoomView; mySeat: number }) {
  const notify = useStore((s) => s.notify);
  const req = room.undoRequest;
  if (!req) return null;
  const needMe = req.required.includes(mySeat) && !req.approved.includes(mySeat);
  const vote = async (approve: boolean) => {
    const r = await request('game:undoVote', { approve });
    if (!r.ok) notify(r.error ?? '');
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
      <span>
        {req.name} 请求悔牌（{req.approved.length}/{req.required.length} 已同意）
      </span>
      {needMe && (
        <>
          <Button onClick={() => vote(true)}>同意</Button>
          <Button variant="danger" onClick={() => vote(false)}>
            拒绝
          </Button>
        </>
      )}
    </div>
  );
}
