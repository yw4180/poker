'use client';
import { type RoomOptions, DEFAULT_ROOM_OPTIONS } from '@poker/protocol';

const TIMEOUTS: RoomOptions['turnTimeoutSec'][] = [0, 20, 40, 60];
const DECLARE: RoomOptions['declareWindowSec'][] = [3, 6, 10, 15];

export function RoomOptionsForm({
  value,
  onChange,
  disabled = false,
}: {
  value: RoomOptions;
  onChange: (v: RoomOptions) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof RoomOptions>(k: K, v: RoomOptions[K]) =>
    onChange({ ...value, [k]: v });
  const check = (k: 'cardCounter' | 'undo' | 'hint', label: string, desc: string) => (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        disabled={disabled}
        checked={value[k]}
        onChange={(e) => set(k, e.target.checked)}
      />
      <span>
        {label}
        <span className="block text-xs text-white/50">{desc}</span>
      </span>
    </label>
  );
  const select = <K extends 'turnTimeoutSec' | 'declareWindowSec' | 'kittyBonus'>(
    k: K,
    label: string,
    opts: { v: RoomOptions[K]; t: string }[],
  ) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <select
        className="rounded bg-white/10 px-2 py-1 text-sm"
        disabled={disabled}
        value={String(value[k])}
        onChange={(e) => {
          const o = opts.find((x) => String(x.v) === e.target.value)!;
          set(k, o.v);
        }}
      >
        {opts.map((o) => (
          <option key={String(o.v)} value={String(o.v)}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {check('cardCounter', '记牌器', '随时查看还没出现的牌')}
      {check('undo', '允许悔牌', '撤回自己刚出的牌，需对方两人同意（机器人自动同意）')}
      {check('hint', '允许提示', '出牌/扣底时可用 AI 提示')}
      {select(
        'turnTimeoutSec',
        '出牌倒计时',
        TIMEOUTS.map((v) => ({ v, t: v === 0 ? '不限时' : `${v} 秒（超时机器人代打）` })),
      )}
      {select(
        'declareWindowSec',
        '亮主窗口',
        DECLARE.map((v) => ({ v, t: `${v} 秒` })),
      )}
      {select('kittyBonus', '底牌翻倍', [
        { v: 'exp' as const, t: '拖拉机 2ⁿ 倍' },
        { v: 'double' as const, t: '固定 ×2' },
      ])}
    </div>
  );
}

export function optionsSummary(o: RoomOptions): string {
  const parts = [
    o.cardCounter ? '记牌器' : null,
    o.undo ? '悔牌' : null,
    o.hint ? '提示' : '无提示',
    o.turnTimeoutSec ? `${o.turnTimeoutSec}s 倒计时` : '不限时',
    `亮主 ${o.declareWindowSec}s`,
    o.kittyBonus === 'exp' ? '底牌 2ⁿ' : '底牌 ×2',
  ];
  return parts.filter(Boolean).join(' · ');
}

export { DEFAULT_ROOM_OPTIONS };
