'use client';
import { useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { API_URL } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { useStore } from '@/lib/store';

/** 点击头像即可上传新头像（≤5MB，服务器压成 128×128） */
export function AvatarUploader({ name }: { name: string }) {
  const { data, refetch } = useSession();
  const notify = useStore((s) => s.notify);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_URL}/api/avatar`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '上传失败');
      await refetch();
      notify('头像已更新（下次进房生效）');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      title="点击更换头像"
      className={`rounded-full ${busy ? 'opacity-50' : 'hover:ring-2 hover:ring-amber-400'}`}
      onClick={() => input.current?.click()}
      disabled={busy}
    >
      <Avatar name={name} src={data?.user.image} size={36} />
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
    </button>
  );
}
