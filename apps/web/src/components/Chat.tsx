'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Panel } from './ui';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

const fmt = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function Chat({ className = '' }: { className?: string }) {
  const chat = useStore((s) => s.chat);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);
  const send = async () => {
    if (!text.trim()) return;
    await request('chat:send', { text });
    setText('');
  };
  return (
    <Panel title="聊天" className={`flex flex-col ${className}`}>
      <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {chat.length === 0 && <div className="text-[13px] text-faint">还没有人说话</div>}
        {chat.map((m, i) => (
          <div key={`${m.at}-${i}`} className="flex gap-2">
            <span className="shrink-0 font-mono text-[11px] leading-5 text-faint">{fmt(m.at)}</span>
            <span className="min-w-0 break-words">
              <span className="font-medium text-accent">{m.name}</span>
              <span className="text-faint"> · </span>
              {m.text}
            </span>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-white/[0.06] p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="说点什么…"
          maxLength={200}
        />
        <Button type="submit" variant="primary" className="shrink-0">
          发送
        </Button>
      </form>
    </Panel>
  );
}
