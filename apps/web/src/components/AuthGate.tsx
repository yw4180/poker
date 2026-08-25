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
  if (isPending)
    return (
      <div className="py-24 text-center text-sm text-muted">
        加载中…
        <div className="mt-3">
          <a href="/login" className="text-accent hover:underline">
            连接不上？返回登录
          </a>
        </div>
      </div>
    );
  if (!data) return null;
  return <>{children({ id: data.user.id, name: data.user.name || data.user.email })}</>;
}
