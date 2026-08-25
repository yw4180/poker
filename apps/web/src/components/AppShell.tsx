'use client';
import Link from 'next/link';

/** 顶部导航 + 内容容器 */
export function AppShell({
  children,
  center,
  right,
  wide = false,
}: {
  children: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-bg/80 backdrop-blur">
        <div
          className={`mx-auto flex h-12 items-center gap-4 px-4 ${wide ? 'max-w-[1400px]' : 'max-w-3xl'}`}
        >
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] text-[#06281c]">
              ♠
            </span>
            牌桌
          </Link>
          <div className="min-w-0 flex-1 truncate text-sm text-muted">{center}</div>
          <div className="flex items-center gap-2">{right}</div>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-5 ${wide ? 'max-w-[1400px]' : 'max-w-3xl'}`}>
        {children}
      </main>
    </div>
  );
}
