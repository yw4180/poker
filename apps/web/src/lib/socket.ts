'use client';
import type { ClientToServerEvents, ServerToClientEvents } from '@poker/protocol';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(API_URL || undefined, { withCredentials: true, autoConnect: true });
  }
  return socket;
}

/** Promise 化的 emit（带 ack） */
export function request<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  return new Promise((resolve) => {
    (getSocket() as Socket).emit(event, payload, resolve);
  });
}
