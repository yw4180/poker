import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '牌桌 · 升级', description: '和朋友一起打升级' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
