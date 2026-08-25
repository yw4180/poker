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
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm">
      <span>
        <b>{req.name}</b> 请求悔牌{' '}
        <span className="text-muted">
          （{req.approved.length}/{req.required.length} 已同意）
        </span>
      </span>
      {needMe && (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={() => vote(true)}>
            同意
          </Button>
          <Button size="sm" variant="danger" onClick={() => vote(false)}>
            拒绝
          </Button>
        </div>
      )}
    </div>
  );
}
