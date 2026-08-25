'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input } from './ui';
import { signIn, signUp } from '@/lib/auth-client';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r =
      mode === 'login'
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });
    setBusy(false);
    if (r.error) setError(r.error.message ?? '失败');
    else router.replace('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-2xl text-[#06281c] shadow-[0_8px_24px_-8px_rgba(16,185,129,.6)]">
            ♠
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h1>
          <p className="text-sm text-muted">和朋友一起打升级</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <Input
              placeholder="昵称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={20}
            />
          )}
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full">
            {mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-white/10" />或<span className="h-px flex-1 bg-white/10" />
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() =>
            signIn.social({ provider: 'google', callbackURL: window.location.origin + '/' })
          }
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M21.35 11.1H12v2.9h5.3c-.5 2.5-2.6 3.9-5.3 3.9a5.9 5.9 0 1 1 0-11.8c1.5 0 2.8.5 3.8 1.5l2.1-2.1A9 9 0 1 0 12 21c5.2 0 8.6-3.6 8.6-8.8 0-.4 0-.8-.1-1.1Z"
            />
          </svg>
          使用 Google 登录
        </Button>
        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              没有账号？
              <Link className="text-accent hover:underline" href="/register">
                注册
              </Link>
            </>
          ) : (
            <>
              已有账号？
              <Link className="text-accent hover:underline" href="/login">
                登录
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
