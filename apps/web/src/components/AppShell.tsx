'use client';
import Link from 'next/link';
import { useStore } from '@/lib/store';

/** 顶部导航 + 内容容器 */
export function AppShell({
  children,
  center,
  right,
  wide = false,
  fill = false,
}: {
  children: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  wide?: boolean;
  /** 大屏下正文占满视口剩余高度，内部各自滚动 */
  fill?: boolean;
}) {
  const staleClient = useStore((s) => s.staleClient);
  return (
    <div className="flex min-h-screen flex-col">
      {staleClient && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full bg-amber-400 py-1.5 text-center text-[13px] font-medium text-black"
        >
          牌桌已更新到新版本 · 点击这里刷新页面（牌局会保留）
        </button>
      )}
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
      <main
        className={`mx-auto w-full flex-1 px-4 py-4 ${wide ? 'max-w-[1400px]' : 'max-w-3xl'} ${fill ? 'lg:min-h-[calc(100vh-3rem)]' : ''}`}
      >
        {children}
      </main>
    </div>
  );
}
