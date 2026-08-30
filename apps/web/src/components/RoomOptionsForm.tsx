'use client';
import { type RoomOptions, DEFAULT_ROOM_OPTIONS } from '@poker/protocol';
import { Select } from './ui';
import { levelText } from '@/lib/store';

const TIMEOUTS: RoomOptions['turnTimeoutSec'][] = [0, 20, 40, 60];
const DECLARE: RoomOptions['declareWindowSec'][] = [0, 3, 6, 10, 15, 30, 60];
const LEVELS: RoomOptions['startLevel'][] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

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
  const Toggle = ({
    k,
    label,
    desc,
  }: {
    k: 'cardCounter' | 'undo' | 'hint';
    label: string;
    desc: string;
  }) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1">
      <span className="text-sm">
        {label}
        <span className="block text-xs text-faint">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value[k]}
        disabled={disabled}
        onClick={() => set(k, !value[k])}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value[k] ? 'bg-accent' : 'bg-white/15'} disabled:opacity-40`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${value[k] ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
  const Row = <K extends 'turnTimeoutSec' | 'declareWindowSec' | 'kittyBonus' | 'startLevel'>({
    k,
    label,
    opts,
  }: {
    k: K;
    label: string;
    opts: { v: RoomOptions[K]; t: string }[];
  }) => (
    <label className="flex items-center justify-between gap-3 px-1 py-1 text-sm">
      <span>{label}</span>
      <Select
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
      </Select>
    </label>
  );
  return (
    <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
      <Toggle k="cardCounter" label="记牌器" desc="随时查看还没出现的牌" />
      <Toggle k="undo" label="允许悔牌" desc="撤回刚出的牌，需对方两人同意" />
      <Toggle k="hint" label="允许提示" desc="出牌/扣底时可用 AI 提示" />
      <Row
        k="turnTimeoutSec"
        label="出牌倒计时"
        opts={TIMEOUTS.map((v) => ({ v, t: v === 0 ? '不限时' : `${v} 秒` }))}
      />
      <Row
        k="declareWindowSec"
        label="亮主窗口"
        opts={DECLARE.map((v) => ({ v, t: v === 0 ? '无限制（全员过）' : `${v} 秒` }))}
      />
      <Row
        k="startLevel"
        label="从几打起"
        opts={LEVELS.map((v) => ({ v, t: `打 ${levelText(v)}` }))}
      />
      <Row
        k="kittyBonus"
        label="底牌翻倍"
        opts={[
          { v: 'exp' as const, t: '拖拉机 2ⁿ' },
          { v: 'double' as const, t: '固定 ×2' },
        ]}
      />
    </div>
  );
}

export function optionsSummary(o: RoomOptions): string {
  return [
    o.cardCounter ? '记牌器' : null,
    o.undo ? '悔牌' : null,
    o.hint ? '提示' : '无提示',
    o.turnTimeoutSec ? `${o.turnTimeoutSec}s 倒计时` : '不限时',
    o.declareWindowSec === 0 ? '亮主不限时' : `亮主 ${o.declareWindowSec}s`,
    o.kittyBonus === 'exp' ? '底牌 2ⁿ' : '底牌 ×2',
    o.startLevel !== 2 ? `从 ${o.startLevel} 打起` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export { DEFAULT_ROOM_OPTIONS };
