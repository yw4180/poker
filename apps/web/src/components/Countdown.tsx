'use client';
import { useEffect, useState } from 'react';

/** 倒计时进度条：deadlineAt 为时间戳 */
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
  return (
    <div className="w-40 text-center text-xs text-white/80">
      {label && (
        <div className="mb-1">
          {label} {Math.ceil(left / 1000)}s
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded bg-black/40">
        <div
          className="h-full bg-amber-400 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
