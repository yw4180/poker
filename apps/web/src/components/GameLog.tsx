'use client';
import { useEffect, useRef } from 'react';
import { Panel } from './ui';
import { useStore } from '@/lib/store';

export function GameLog({ className = '' }: { className?: string }) {
  const log = useStore((s) => s.log);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);
  return (
    <Panel title="对局记录" className={`flex flex-col ${className}`}>
      <div ref={ref} className="flex-1 space-y-1 overflow-y-auto px-4 py-3 text-[13px] text-muted">
        {log.length === 0 && <div className="text-faint">还没有记录</div>}
        {log.map((l, i) => (
          <div key={`${l.at}-${i}`}>{l.text}</div>
        ))}
      </div>
    </Panel>
  );
}
