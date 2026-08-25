'use client';
import { useEffect, useState } from 'react';

export function Countdown({
  deadlineAt,
  totalMs = 4000,
  label,
}: {
  deadlineAt: number;
  totalMs?: number;
  label?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, deadlineAt - now);
  const pct = Math.min(100, (left / totalMs) * 100);
  const urgent = left < 5000;
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      {label && (
        <span>
          {label}{' '}
          <span className={`font-mono ${urgent ? 'text-red-300' : 'text-fg'}`}>
            {Math.ceil(left / 1000)}s
          </span>
        </span>
      )}
      <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full transition-[width] duration-100 ${urgent ? 'bg-red-400' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
