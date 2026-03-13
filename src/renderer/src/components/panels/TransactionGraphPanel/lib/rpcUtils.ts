export async function rpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

export function hex(n: string | null | undefined): number {
  return n ? parseInt(n, 16) : 0;
}

export function shortAddr(a: string): string {
  return a ? a.slice(0, 6) + '…' + a.slice(-4) : '?';
}

export function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
