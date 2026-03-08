import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { NavTab } from '../../types';
import {
  Pin,
  PinOff,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Zap,
  Bug,
  Fuel,
  GitBranch,
  Activity,
  Droplets,
  Database,
  FlaskConical,
  ListOrdered,
  Layers,
  Package,
  BookOpen,
  Shield,
  Wallet,
} from 'lucide-react';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  // All panel components as renderable nodes — we forward the currently active content
  panels: {
    tab: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[];
  renderPanel: (tab: NavTab) => React.ReactNode;
}

const PINNABLE: {
  tab: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { tab: 'commands', label: 'Commands', icon: LayoutGrid, color: 'text-amber-400' },
  { tab: 'interact', label: 'Interact', icon: Zap, color: 'text-blue-400' },
  { tab: 'deployed', label: 'Deployed', icon: GitBranch, color: 'text-emerald-400' },
  { tab: 'debug', label: 'Debug', icon: Bug, color: 'text-violet-400' },
  { tab: 'gas', label: 'Gas', icon: Fuel, color: 'text-amber-400' },
  { tab: 'analytics', label: 'Analytics', icon: Activity, color: 'text-emerald-400' },
  { tab: 'lp', label: 'LP Sim', icon: Droplets, color: 'text-cyan-400' },
  { tab: 'storage', label: 'Storage', icon: Database, color: 'text-amber-400' },
  { tab: 'simulation', label: 'Sim Lab', icon: FlaskConical, color: 'text-pink-400' },
  { tab: 'scenario', label: 'Scenario', icon: ListOrdered, color: 'text-emerald-400' },
  { tab: 'explorer', label: 'Explorer', icon: Layers, color: 'text-sky-400' },
  { tab: 'nft', label: 'NFT', icon: Package, color: 'text-purple-400' },
  { tab: 'erc', label: 'ERC Std', icon: BookOpen, color: 'text-indigo-400' },
  { tab: 'security', label: 'Security', icon: Shield, color: 'text-rose-400' },
  { tab: 'accounts', label: 'accounts', icon: Wallet, color: 'text-yellow-400' },
];

export { PINNABLE };

interface PinnedPanelProps {
  pinnedTab: NavTab | null;
  renderPanel: (tab: NavTab) => React.ReactNode;
  onClose: () => void;
}

export default function PinnedPanel({ pinnedTab, renderPanel, onClose }: PinnedPanelProps) {
  const [width, setWidth] = useState(480);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartW.current = width;
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      setWidth(Math.max(280, Math.min(900, dragStartW.current + delta)));
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  if (!pinnedTab) return null;

  return (
    <div className="relative flex flex-shrink-0 h-full border-l border-border" style={{ width }}>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-500/40 transition-colors',
          dragging && 'bg-blue-500/60',
        )}
      />

      {/* Panel content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border bg-card/80">
          <Pin className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-300 capitalize">
            {PINNABLE.find((p) => p.tab === pinnedTab)?.label || pinnedTab}
          </span>
          <span className="text-[9px] text-muted-foreground/40 ml-1">pinned</span>
          <button
            onClick={onClose}
            className="ml-auto transition-colors text-muted-foreground/40 hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Rendered panel */}
        <div className="flex-1 overflow-hidden">{renderPanel(pinnedTab)}</div>
      </div>
    </div>
  );
}
