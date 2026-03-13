export interface GroupColor {
  color: string;
  bg: string;
  border: string;
}

export const GROUP_COLORS: Record<string, GroupColor> = {
  A: { color: '#f472b6', bg: '#1f0015', border: '#ec4899' },
  B: { color: '#38bdf8', bg: '#0c1a2e', border: '#0ea5e9' },
  C: { color: '#34d399', bg: '#0a1f16', border: '#10b981' },
  D: { color: '#fbbf24', bg: '#1a1200', border: '#f59e0b' },
  E: { color: '#c084fc', bg: '#150a24', border: '#a855f7' },
};

export const GROUP_IDS = Object.keys(GROUP_COLORS);
