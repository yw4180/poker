'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

export function GameLog({ className = '' }: { className?: string }) {
  const log = useStore((s) => s.log);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);
  return (
    <div
      className={`flex flex-col rounded-xl border border-white/10 bg-neutral-800/80 ${className}`}
    >
      <div className="border-b border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">
        对局记录
      </div>
      <div ref={ref} className="flex-1 space-y-0.5 overflow-y-auto p-3 text-xs text-white/80">
        {log.length === 0 && <div className="text-white/40">还没有记录</div>}
        {log.map((l, i) => (
          <div key={`${l.at}-${i}`}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}
