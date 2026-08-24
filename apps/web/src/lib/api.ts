/**
 * 后端地址：开发时通过 NEXT_PUBLIC_API_URL 指向 4000 端口；
 * 生产同域部署时留空，浏览器里回退到当前 origin。
 */
const configured = process.env.NEXT_PUBLIC_API_URL ?? '';
export const API_URL = configured;
export function apiOrigin(): string {
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}
