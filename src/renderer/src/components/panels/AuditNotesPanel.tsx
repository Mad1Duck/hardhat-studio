import { useState, useEffect } from 'react';
import { AuditNote, ContractAbi } from '../../types';
import { cn } from '../../lib/utils';
import {
  MessageSquare,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  Info,
  XCircle,
  Filter,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input, Label, ScrollArea } from '../ui/primitives';

const api = (window as any).api;

interface Props {
  abis: ContractAbi[];
  projectPath: string | null;
}

const SEV_CONFIG = {
  note: { label: 'Note', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30', icon: Info },
  warning: {
    label: 'Warning',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    icon: AlertTriangle,
  },
  critical: {
    label: 'Critical',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    icon: XCircle,
  },
};

export default function AuditNotesPanel({ abis, projectPath }: Props) {
  const [notes, setNotes] = useState<AuditNote[]>([]);
  const [filter, setFilter] = useState<'all' | AuditNote['severity']>('all');
  const [filterContract, setFilterContract] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<AuditNote>>({
    contractName: '',
    functionName: '',
    line: undefined,
    severity: 'note',
    content: '',
  });

  useEffect(() => {
    if (!projectPath) return;
    api.loadAuditNotes(projectPath).then((loaded: AuditNote[]) => {
      if (Array.isArray(loaded)) setNotes(loaded);
    });
  }, [projectPath]);

  const save = async () => {
    if (!projectPath) return;
    setSaving(true);
    await api.saveAuditNotes(projectPath, notes);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addNote = () => {
    if (!form.content?.trim() || !form.contractName) return;
    const note: AuditNote = {
      id: crypto.randomUUID(),
      contractName: form.contractName || '',
      functionName: form.functionName || undefined,
      line: form.line,
      severity: (form.severity as AuditNote['severity']) || 'note',
      content: form.content.trim(),
      createdAt: Date.now(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    setForm({
      contractName: form.contractName,
      severity: form.severity,
      functionName: '',
      line: undefined,
      content: '',
    });
  };

  const deleteNote = (id: string) => setNotes(notes.filter((n) => n.id !== id));

  const exportMarkdown = () => {
    const lines = ['# Audit Notes\n'];
    const bySev = ['critical', 'warning', 'note'] as const;
    for (const sev of bySev) {
      const sevNotes = notes.filter((n) => n.severity === sev);
      if (!sevNotes.length) continue;
      lines.push(`## ${SEV_CONFIG[sev].label}s\n`);
      for (const n of sevNotes) {
        lines.push(
          `### ${n.contractName}${n.functionName ? `::${n.functionName}` : ''}${n.line ? ` (line ${n.line})` : ''}`,
        );
        lines.push(n.content + '\n');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-notes.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const contractNames = [
    'all',
    ...new Set([...abis.map((a) => a.contractName), ...notes.map((n) => n.contractName)]),
  ];

  const filtered = notes.filter(
    (n) =>
      (filter === 'all' || n.severity === filter) &&
      (filterContract === 'all' || n.contractName === filterContract),
  );

  const counts = {
    note: notes.filter((n) => n.severity === 'note').length,
    warning: notes.filter((n) => n.severity === 'warning').length,
    critical: notes.filter((n) => n.severity === 'critical').length,
  };

  const contractAbi = abis.find((a) => a.contractName === form.contractName);
  const functions =
    contractAbi?.abi.filter((i) => i.type === 'function').map((i) => i.name || '') || [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Add note form */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden border-r w-72 border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold">Audit Notes</span>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Annotate contracts with findings
          </p>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
            Add Finding
          </p>

          {/* Contract */}
          <div>
            <Label className="block mb-1 text-xs">Contract *</Label>
            <select
              value={form.contractName}
              onChange={(e) => setForm((f) => ({ ...f, contractName: e.target.value }))}
              className="w-full px-2 text-xs border rounded outline-none h-7 bg-muted/20 border-border text-foreground/80 focus:border-amber-500/40">
              <option value="">— Select contract —</option>
              {abis.map((a) => (
                <option key={a.contractName} value={a.contractName}>
                  {a.contractName}
                </option>
              ))}
              <option value="General">General / Cross-contract</option>
            </select>
          </div>

          {/* Function */}
          <div>
            <Label className="block mb-1 text-xs">Function (optional)</Label>
            {functions.length > 0 ? (
              <select
                value={form.functionName || ''}
                onChange={(e) => setForm((f) => ({ ...f, functionName: e.target.value }))}
                className="w-full px-2 text-xs border rounded outline-none h-7 bg-muted/20 border-border text-foreground/80 focus:border-amber-500/40">
                <option value="">— All functions —</option>
                {functions.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={form.functionName || ''}
                onChange={(e) => setForm((f) => ({ ...f, functionName: e.target.value }))}
                placeholder="functionName"
                className="text-xs h-7"
              />
            )}
          </div>

          {/* Line */}
          <div>
            <Label className="block mb-1 text-xs">Line Number (optional)</Label>
            <Input
              type="number"
              value={form.line || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, line: parseInt(e.target.value) || undefined }))
              }
              placeholder="e.g. 42"
              className="text-xs h-7"
            />
          </div>

          {/* Severity */}
          <div>
            <Label className="block mb-1 text-xs">Severity</Label>
            <div className="flex gap-1">
              {(['note', 'warning', 'critical'] as const).map((s) => {
                const cfg = SEV_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setForm((f) => ({ ...f, severity: s }))}
                    className={cn(
                      'flex-1 text-[10px] py-1.5 rounded border transition-all capitalize',
                      form.severity === s
                        ? cfg.color
                        : 'border-border text-muted-foreground/50 hover:bg-muted/30',
                    )}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <Label className="block mb-1 text-xs">Finding *</Label>
            <textarea
              value={form.content || ''}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Describe the finding, vulnerability, or note..."
              className="w-full h-24 p-2 text-xs border rounded outline-none resize-none bg-muted/20 border-border text-foreground/80 placeholder:text-muted-foreground/30 focus:border-amber-500/40"
            />
          </div>

          <Button
            className="w-full h-8 gap-2 text-xs bg-amber-600 hover:bg-amber-500"
            onClick={addNote}
            disabled={!form.content?.trim() || !form.contractName}>
            <Plus className="w-3.5 h-3.5" /> Add Note
          </Button>
        </div>

        {/* Save / Export */}
        <div className="p-4 space-y-2 border-t border-border">
          <Button
            className="w-full h-8 gap-2 text-xs"
            variant="outline"
            onClick={save}
            disabled={saving || !projectPath}>
            {saved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Notes'}
          </Button>
          <Button
            className="w-full gap-2 text-xs h-7"
            variant="ghost"
            onClick={exportMarkdown}
            disabled={notes.length === 0}>
            <Download className="w-3 h-3" /> Export Markdown
          </Button>
        </div>
      </div>

      {/* Right: Notes list */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Summary + filters */}
        <div className="flex-shrink-0 border-b border-border">
          <div className="flex gap-px">
            {(
              [
                { key: 'all', label: 'All', count: notes.length, color: 'text-foreground' },
                {
                  key: 'critical',
                  label: 'Critical',
                  count: counts.critical,
                  color: 'text-rose-400',
                },
                {
                  key: 'warning',
                  label: 'Warning',
                  count: counts.warning,
                  color: 'text-amber-400',
                },
                { key: 'note', label: 'Note', count: counts.note, color: 'text-sky-400' },
              ] as const
            ).map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key as typeof filter)}
                className={cn(
                  'flex-1 py-2 text-center transition-all',
                  filter === key ? 'bg-accent border-b-2 border-amber-500' : 'hover:bg-accent/40',
                )}>
                <div className={cn('text-sm font-bold', color)}>{count}</div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
                  {label}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-card/40">
            <Filter className="w-3 h-3 text-muted-foreground/40" />
            <select
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
              className="text-xs bg-transparent border-none outline-none text-muted-foreground/60">
              {contractNames.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All contracts' : c}
                </option>
              ))}
            </select>
            <span className="ml-auto text-[10px] text-muted-foreground/30">
              {filtered.length} finding{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-20 text-muted-foreground/30">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm">No audit notes yet</p>
              <p className="text-xs opacity-60">Add findings using the form on the left</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {filtered.map((note) => {
                const cfg = SEV_CONFIG[note.severity];
                const Icon = cfg.icon;
                return (
                  <div key={note.id} className={cn('border rounded-lg p-3', cfg.color)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start flex-1 min-w-0 gap-2">
                        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5 mb-1">
                            <span className="text-xs font-semibold">{note.contractName}</span>
                            {note.functionName && (
                              <code className="text-[10px] bg-black/20 px-1 rounded">
                                ::{note.functionName}()
                              </code>
                            )}
                            {note.line && (
                              <span className="text-[10px] opacity-60">line {note.line}</span>
                            )}
                            <span
                              className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded border capitalize ml-auto',
                                cfg.color,
                              )}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed opacity-90">{note.content}</p>
                          <div className="text-[9px] opacity-40 mt-1">
                            {new Date(note.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="flex-shrink-0 p-1 text-current rounded hover:bg-black/20 opacity-40 hover:opacity-80">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
