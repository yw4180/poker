'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input, Panel } from './ui';
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
    <div className="mx-auto mt-24 max-w-sm">
      <Panel>
        <h1 className="mb-4 text-xl font-bold">{mode === 'login' ? '登录' : '注册'}</h1>
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
          {error && <div className="text-sm text-red-400">{error}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>
        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() =>
            signIn.social({ provider: 'google', callbackURL: window.location.origin + '/' })
          }
        >
          使用 Google 登录
        </Button>
        <div className="mt-4 text-center text-sm text-white/60">
          {mode === 'login' ? (
            <>
              没有账号？
              <Link className="text-amber-300" href="/register">
                注册
              </Link>
            </>
          ) : (
            <>
              已有账号？
              <Link className="text-amber-300" href="/login">
                登录
              </Link>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
