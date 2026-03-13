import { useState } from 'react';
import { FlaskConical, Search, ChevronRight } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { ScrollArea } from '../../../ui/primitives';
import { ALL_MODULES, MODULE_CATEGORIES } from '../../../modules/Simulation/SimulationModule';

interface Props {
  activeModuleId: string;
  onSelect: (id: string) => void;
}

export function ModuleSidebar({ activeModuleId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(MODULE_CATEGORIES.map((c) => c.id)),
  );

  const filtered = ALL_MODULES.filter(
    (m) =>
      !search ||
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });

  return (
    <div className="flex flex-col flex-shrink-0 w-56 overflow-hidden border-r border-border bg-card">
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold">Sim Lab</span>
          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-auto font-mono">
            {ALL_MODULES.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules…"
            className="w-full bg-muted border border-border rounded text-[10px] pl-6 pr-2 py-1 focus:outline-none focus:border-violet-500/50 text-foreground placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="py-1">
          {MODULE_CATEGORIES.map((cat) => {
            const catModules = filtered.filter((m) => m.category === cat.id);
            if (catModules.length === 0) return null;
            const isExpanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[9px] text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest font-mono transition-colors">
                  <span>{cat.icon}</span>
                  <span>{cat.id}</span>
                  <span
                    className={cn(
                      'ml-auto text-[8px] px-1 rounded',
                      cat.bg,
                      cat.color,
                      cat.border,
                      'border',
                    )}>
                    {catModules.length}
                  </span>
                  <ChevronRight
                    className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
                  />
                </button>

                {isExpanded &&
                  catModules.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onSelect(m.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all text-left border-l-2',
                        activeModuleId === m.id
                          ? 'bg-violet-500/10 border-l-violet-500 text-foreground'
                          : 'border-l-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                      )}>
                      <span className="flex-shrink-0 text-sm">{m.icon}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium truncate">{m.label}</div>
                        <div className="text-[9px] text-muted-foreground/40 leading-tight truncate">
                          {m.desc}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
