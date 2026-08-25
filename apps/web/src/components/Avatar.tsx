'use client';
import { API_URL } from '@/lib/api';

const COLORS = [
  'bg-sky-600',
  'bg-rose-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-cyan-600',
];

export function avatarUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith('/') ? `${API_URL}${src}` : src;
}

/** 头像：有图用图，否则用名字首字 + 固定色 */
export function Avatar({
  name,
  src,
  size = 32,
  bot = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  bot?: boolean;
}) {
  const url = avatarUrl(src);
  const style = { width: size, height: size, fontSize: size * 0.45 };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        style={style}
        className="shrink-0 rounded-full object-cover ring-1 ring-white/20"
      />
    );
  }
  if (bot) {
    return (
      <div
        style={style}
        className="flex shrink-0 items-center justify-center rounded-full bg-neutral-600 ring-1 ring-white/20"
      >
        🤖
      </div>
    );
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-white/20 ${COLORS[h % COLORS.length]}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
