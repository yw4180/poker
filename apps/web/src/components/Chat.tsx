'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Panel } from './ui';
import { request } from '@/lib/socket';
import { useStore } from '@/lib/store';

const fmt = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 快捷常用语（参考斗地主） */
const QUICK = [
  '等得我花都谢了 🌸',
  '快点出牌啦 ⏰',
  '打得好！👏',
  '不好意思，牌太好了 😎',
  '你的牌打得也太好了 🤯',
  '和你合作真是太愉快了 🤝',
  '这波稳了 ✅',
  '大意了 😵',
  '让我想想 🤔',
  '别走，决战到天亮 🌙',
  '再来一局！🔁',
  '哈哈哈哈 😂',
];
const EMOJI = ['👍', '👏', '😂', '😭', '😡', '🤡', '🎉', '💩', '🍺', '🐶'];

export function Chat({ className = '' }: { className?: string }) {
  const chat = useStore((s) => s.chat);
  const [text, setText] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);
  const send = async (t = text) => {
    if (!t.trim()) return;
    await request('chat:send', { text: t });
    setText('');
    setQuickOpen(false);
  };
  return (
    <Panel
      title="聊天"
      className={`relative flex flex-col ${className}`}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setQuickOpen(!quickOpen)}>
          快捷语 {quickOpen ? '▴' : '▾'}
        </Button>
      }
    >
      {quickOpen && (
        <div className="absolute inset-x-0 top-11 z-10 border-b border-white/[0.06] bg-elev-2/95 p-2 backdrop-blur">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md text-lg hover:bg-white/10"
                onClick={() => send(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                className="truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-white/10"
                onClick={() => send(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {chat.length === 0 && <div className="text-[13px] text-faint">还没有人说话</div>}
        {chat.map((m, i) => (
          <div key={`${m.at}-${i}`} className="flex gap-2">
            <span className="shrink-0 font-mono text-[11px] leading-5 text-faint">{fmt(m.at)}</span>
            <span className="min-w-0 break-words">
              <span
                className={`font-medium ${m.userId.startsWith('bot:') ? 'text-team-b' : 'text-accent'}`}
              >
                {m.name}
              </span>
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
