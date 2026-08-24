'use client';
import { useState } from 'react';
import { Button, Input } from './ui';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

export function Chat() {
  const chat = useStore((s) => s.chat);
  const [text, setText] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    await request('chat:send', { text });
    setText('');
  };
  return (
    <div className="flex h-64 flex-col rounded-xl border border-white/10 bg-neutral-800/80">
      <div className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
        {chat.map((m, i) => (
          <div key={i}>
            <span className="text-amber-300">{m.name}</span>：{m.text}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-2"
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
        <Button type="submit">发送</Button>
      </form>
    </div>
  );
}
