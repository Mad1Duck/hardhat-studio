import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncate(str: string, max: number) {
  return str.length > max ? '…' + str.slice(-max) : str
}

export function formatAddress(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function timeAgo(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}
