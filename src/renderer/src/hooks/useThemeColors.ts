import { useTheme } from '../context/ThemeContext';

const DARK = {
  background: '#0d1017',   // matches --background: 222 22% 6%
  card: '#111620',   // matches --card: 222 20% 9%
  border: '#1e2433',   // matches --border: 222 16% 16%
  muted: '#141926',   // matches --muted: 222 18% 12%
  mix: (accent: string, w = 0.18) => mixHex('#111620', accent, w),
};

const LIGHT = {
  background: '#f6f7f9',   // matches --background: 210 20% 98%
  card: '#ffffff',   // matches --card: 0 0% 100%
  border: '#d5d9e0',   // matches --border: 220 13% 87%
  muted: '#f0f2f5',   // matches --muted: 220 14% 96%
  mix: (accent: string, w = 0.18) => mixHex('#ffffff', accent, w),
};

export function useThemeColors() {
  const { theme } = useTheme();
  return theme === 'light' ? LIGHT : DARK;
}

/** Simple hex color mix */
function mixHex(base: string, accent: string, weight: number): string {
  try {
    const br = parseInt(base.slice(1, 3), 16), bg = parseInt(base.slice(3, 5), 16), bb = parseInt(base.slice(5, 7), 16);
    const ar = parseInt(accent.slice(1, 3), 16), ag = parseInt(accent.slice(3, 5), 16), ab = parseInt(accent.slice(5, 7), 16);
    const r = Math.round(br + (ar - br) * weight);
    const g = Math.round(bg + (ag - bg) * weight);
    const b = Math.round(bb + (ab - bb) * weight);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return base; }
}
