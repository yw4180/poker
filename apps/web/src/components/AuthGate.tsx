'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';

/** 未登录跳转到 /login；已登录把 user 交给 children */
export function AuthGate({
  children,
}: {
  children: (user: { id: string; name: string }) => React.ReactNode;
}) {
  const { data, isPending } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!isPending && !data) router.replace('/login');
  }, [isPending, data, router]);
  if (isPending) return <div className="p-8 text-center text-white/60">加载中…</div>;
  if (!data) return null;
  return <>{children({ id: data.user.id, name: data.user.name || data.user.email })}</>;
}
