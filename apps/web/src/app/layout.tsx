import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '牌桌 · 升级', description: '和朋友一起打升级' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      {/* 浏览器插件（如 Grammarly）会往 body 加属性，忽略这类 hydration 差异 */}
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
