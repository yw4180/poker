'use client';
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-[#06281c] hover:brightness-110 shadow-[0_1px_0_rgba(255,255,255,.15)_inset]',
  secondary:
    'bg-white/[0.06] text-fg border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
  ghost: 'text-muted hover:text-fg hover:bg-white/[0.06]',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
};
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
};

export function Button({
  className = '',
  variant = 'secondary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-[background,color,border,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-fg placeholder:text-faint transition-colors hover:border-white/20 focus:border-accent focus:bg-white/[0.06] focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-8 rounded-lg border border-white/10 bg-elev-2 px-2 text-sm text-fg hover:border-white/20 focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Panel({
  children,
  className = '',
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted">{title}</h3>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** 小标签 */
export function Tag({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'accent' | 'warn' | 'a' | 'b';
}) {
  const t = {
    default: 'bg-white/[0.06] text-muted',
    accent: 'bg-accent/15 text-accent',
    warn: 'bg-amber-500/15 text-amber-300',
    a: 'bg-team-a/15 text-team-a',
    b: 'bg-team-b/15 text-team-b',
  }[tone];
  return (
    <span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium ${t}`}>
      {children}
    </span>
  );
}

/** 键盘/房间码风格的等宽文本 */
export function Code({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`font-mono tracking-[0.2em] text-accent ${className}`}>{children}</span>;
}
