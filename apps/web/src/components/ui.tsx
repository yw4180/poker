'use client';
import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base =
    'rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-amber-500 text-black hover:bg-amber-400',
    ghost: 'bg-white/10 hover:bg-white/20',
    danger: 'bg-red-600 hover:bg-red-500',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-amber-400"
      {...props}
    />
  );
}

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-neutral-800/80 p-4 ${className}`}>
      {children}
    </div>
  );
}
