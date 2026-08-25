import type { RoomView } from '@poker/protocol';

/** “xx的房间 · 名称” */
export function roomTitle(r: Pick<RoomView, 'hostName' | 'name'>): string {
  return `${r.hostName}的房间 · ${r.name}`;
}
