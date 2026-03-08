/**
 * NotesEditorPanel.tsx
 *
 * Prerequisites — install these packages first:
 *   npm install @monaco-editor/react react-quill quill
 *   (or: bun add @monaco-editor/react react-quill quill)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import {
  FileText,
  Code2,
  Plus,
  FolderOpen,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  File,
  Trash2,
  MoreHorizontal,
  Pencil,
  Check,
} from 'lucide-react';
import Editor, { loader as monacoLoader } from '@monaco-editor/react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// ─── Quill dark-mode CSS override (injected once) ────────────────────────────
const QUILL_DARK_CSS = `
.ql-dark .ql-toolbar.ql-snow {
  background: #1a1a2e;
  border-color: rgba(255,255,255,0.07);
}
.ql-dark .ql-container.ql-snow {
  background: #0f0f1a;
  border-color: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.85);
  font-size: 13.5px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.ql-dark .ql-editor {
  min-height: 100%;
  color: rgba(255,255,255,0.85);
  line-height: 1.75;
}
.ql-dark .ql-editor.ql-blank::before {
  color: rgba(255,255,255,0.2);
  font-style: normal;
}
.ql-dark .ql-stroke { stroke: rgba(255,255,255,0.55) !important; }
.ql-dark .ql-fill   { fill:   rgba(255,255,255,0.55) !important; }
.ql-dark .ql-picker-label { color: rgba(255,255,255,0.55); }
.ql-dark .ql-picker-options {
  background: #1a1a2e;
  border-color: rgba(255,255,255,0.1);
}
.ql-dark .ql-picker-item { color: rgba(255,255,255,0.7); }
.ql-dark .ql-active .ql-stroke { stroke: #818cf8 !important; }
.ql-dark .ql-active .ql-fill   { fill:   #818cf8 !important; }
.ql-dark .ql-active .ql-picker-label { color: #818cf8; }
.ql-dark .ql-toolbar button:hover .ql-stroke { stroke: #818cf8 !important; }
.ql-dark .ql-toolbar button:hover .ql-fill   { fill:   #818cf8 !important; }
.ql-dark .ql-editor h1,.ql-dark .ql-editor h2,.ql-dark .ql-editor h3 { color: #e2e8f0; }
.ql-dark .ql-editor a { color: #818cf8; }
.ql-dark .ql-editor code,.ql-dark .ql-editor pre { background: rgba(255,255,255,0.05); color: #7dd3fc; }
.ql-dark .ql-editor blockquote { border-left: 3px solid #818cf8; color: rgba(255,255,255,0.45); }
.ql-dark .ql-snow.ql-toolbar button:hover,.ql-dark .ql-snow.ql-toolbar .ql-picker-label:hover {
  background: rgba(129,140,248,0.1);
  border-radius: 4px;
}
`;

// ─── Quill config ─────────────────────────────────────────────────────────────
const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'list',
  'bullet',
  'blockquote',
  'code-block',
  'link',
];

// ─── Monaco — tell it where to find workers (Vite-compatible) ────────────────
monacoLoader.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' },
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type NoteMode = 'rich' | 'code';

export interface NoteDoc {
  id: string;
  title: string;
  content: string;
  mode: NoteMode;
  language: string; // for code mode
  filePath?: string; // if saved to / loaded from disk
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'notes_panel_docs';

const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'solidity',
  'json',
  'markdown',
  'shell',
  'python',
  'yaml',
  'css',
  'html',
  'plaintext',
];

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sol: 'solidity',
  json: 'json',
  md: 'markdown',
  py: 'python',
  sh: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
  css: 'css',
  html: 'html',
  txt: 'plaintext',
};

const CODE_EXTS = new Set(['js', 'ts', 'sol', 'json', 'py', 'sh', 'yaml', 'yml', 'css', 'html']);

function newDoc(mode: NoteMode = 'rich'): NoteDoc {
  return {
    id: crypto.randomUUID(),
    title: mode === 'rich' ? 'Untitled Note' : 'untitled.js',
    content: '',
    mode,
    language: 'javascript',
    dirty: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').pop() || p;
}

interface Props {
  projectPath?: string | null;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function NotesEditorPanel({ projectPath }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<NoteDoc[]>(() => {
    try {
      const saved: NoteDoc[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return saved.length ? saved : [newDoc('rich')];
    } catch {
      return [newDoc('rich')];
    }
  });
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      const saved: NoteDoc[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return saved[0]?.id || '';
    } catch {
      return '';
    }
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Inject Quill dark CSS once ─────────────────────────────────────────────
  useEffect(() => {
    const id = 'quill-dark-override';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = QUILL_DARK_CSS;
      document.head.appendChild(style);
    }
  }, []);

  // ── Keep activeId valid ────────────────────────────────────────────────────
  useEffect(() => {
    if (docs.length && !docs.find((d) => d.id === activeId)) {
      setActiveId(docs[0].id);
    }
  }, [docs, activeId]);

  // ── Ctrl+S shortcut ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const active = docs.find((d) => d.id === activeId);
        if (active) handleSave(active);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [docs, activeId]);

  // ── Close context menu on click ────────────────────────────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const persist = useCallback((list: NoteDoc[]) => {
    setDocs(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }, []);

  const showStatus = (msg: string, ok = true) => {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 2800);
  };

  const updateDoc = useCallback(
    (id: string, updates: Partial<NoteDoc>) => {
      persist(
        docs.map((d) =>
          d.id === id ? { ...d, ...updates, dirty: true, updatedAt: Date.now() } : d,
        ),
      );
    },
    [docs, persist],
  );

  const activeDoc = docs.find((d) => d.id === activeId) ?? null;

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const createDoc = (mode: NoteMode) => {
    const doc = newDoc(mode);
    persist([...docs, doc]);
    setActiveId(doc.id);
  };

  const closeDoc = (id: string) => {
    const rest = docs.filter((d) => d.id !== id);
    if (!rest.length) {
      const doc = newDoc('rich');
      persist([doc]);
      setActiveId(doc.id);
    } else {
      persist(rest);
      if (activeId === id) setActiveId(rest[rest.length - 1].id);
    }
    if (contextMenu?.id === id) setContextMenu(null);
  };

  const deleteDoc = (id: string) => {
    if (!confirm('Delete this document?')) return;
    closeDoc(id);
  };

  const startRename = (doc: NoteDoc) => {
    setRenamingId(doc.id);
    setRenameVal(doc.title);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const commitRename = () => {
    if (renamingId && renameVal.trim()) {
      persist(docs.map((d) => (d.id === renamingId ? { ...d, title: renameVal.trim() } : d)));
    }
    setRenamingId(null);
  };

  // ── File: Save ─────────────────────────────────────────────────────────────
  const handleSave = async (doc: NoteDoc) => {
    const ext =
      doc.mode === 'rich'
        ? 'html'
        : doc.language === 'solidity'
          ? 'sol'
          : doc.language === 'typescript'
            ? 'ts'
            : doc.language === 'markdown'
              ? 'md'
              : 'js';

    // If already has a filePath, save directly
    if (doc.filePath) {
      const ok = await window.api.writeFile(doc.filePath, doc.content);
      if (ok) {
        persist(docs.map((d) => (d.id === doc.id ? { ...d, dirty: false } : d)));
        showStatus(`Saved → ${basename(doc.filePath)}`);
      } else {
        showStatus('Save failed', false);
      }
      return;
    }

    // Otherwise open save-as dialog
    handleSaveAs(doc, ext);
  };

  const handleSaveAs = async (doc: NoteDoc, ext?: string) => {
    const fileExt =
      ext ||
      (doc.mode === 'rich'
        ? 'html'
        : doc.language === 'solidity'
          ? 'sol'
          : doc.language === 'typescript'
            ? 'ts'
            : 'js');

    const defaultName = doc.title.endsWith(`.${fileExt}`) ? doc.title : `${doc.title}.${fileExt}`;
    const defaultPath = projectPath ? `${projectPath}/${defaultName}` : defaultName;

    const filePath = await window.api.showSaveFileDialog({
      defaultPath,
      title: 'Save File As',
      filters: [
        { name: doc.mode === 'rich' ? 'HTML Files' : 'Source Files', extensions: [fileExt] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!filePath) return;

    const ok = await window.api.writeFile(filePath, doc.content);
    if (ok) {
      persist(
        docs.map((d) =>
          d.id === doc.id ? { ...d, filePath, title: basename(filePath), dirty: false } : d,
        ),
      );
      showStatus(`Saved → ${basename(filePath)}`);
    } else {
      showStatus('Save failed', false);
    }
  };

  // ── File: Open ─────────────────────────────────────────────────────────────
  const handleOpen = async () => {
    const filePath = await window.api.showOpenFileDialog({
      title: 'Open File',
      filters: [
        {
          name: 'Supported Files',
          extensions: [
            'md',
            'html',
            'txt',
            'js',
            'ts',
            'sol',
            'json',
            'py',
            'sh',
            'yaml',
            'yml',
            'css',
          ],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!filePath) return;

    const content = await window.api.readFile(filePath);
    if (content === null) {
      showStatus('Could not read file', false);
      return;
    }

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const isCode = CODE_EXTS.has(ext);
    const doc: NoteDoc = {
      id: crypto.randomUUID(),
      title: basename(filePath),
      content,
      mode: isCode ? 'code' : 'rich',
      language: EXT_TO_LANG[ext] || 'plaintext',
      filePath,
      dirty: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...docs, doc]);
    setActiveId(doc.id);
    showStatus(`Opened ${basename(filePath)}`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a14]">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#0f0f1e] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-indigo-400/60" />
          <span className="text-sm font-semibold tracking-tight text-white/80">Notes & Editor</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Status badge */}
          {status && (
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full transition-all',
                status.ok
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
              )}>
              {status.msg}
            </span>
          )}

          <button
            onClick={() => createDoc('rich')}
            className="flex items-center gap-1 px-2.5 h-7 text-xs bg-indigo-600/70 hover:bg-indigo-600 text-white rounded-lg transition-all">
            <Plus className="w-3 h-3" /> Note
          </button>
          <button
            onClick={() => createDoc('code')}
            className="flex items-center gap-1 px-2.5 h-7 text-xs bg-emerald-600/70 hover:bg-emerald-600 text-white rounded-lg transition-all">
            <Plus className="w-3 h-3" /> Code
          </button>
          <button
            onClick={handleOpen}
            className="flex items-center gap-1 px-2.5 h-7 text-xs border border-white/10 hover:bg-white/5 text-white/60 hover:text-white/90 rounded-lg transition-all">
            <FolderOpen className="w-3 h-3" /> Open
          </button>
          {activeDoc && (
            <button
              onClick={() => handleSave(activeDoc)}
              className={cn(
                'flex items-center gap-1 px-2.5 h-7 text-xs rounded-lg transition-all',
                activeDoc.dirty
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                  : 'border border-white/10 hover:bg-white/5 text-white/60 hover:text-white/90',
              )}>
              <Save className="w-3 h-3" /> {activeDoc.dirty ? 'Save*' : 'Save'}
            </button>
          )}
          {activeDoc && (
            <button
              onClick={() => handleSaveAs(activeDoc)}
              className="flex items-center gap-1 px-2.5 h-7 text-xs border border-white/10 hover:bg-white/5 text-white/50 hover:text-white/80 rounded-lg transition-all"
              title="Save As…">
              <Save className="w-3 h-3" />
              <span className="text-[9px] -ml-0.5">As</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Sidebar ── */}
        <div className="w-52 flex-shrink-0 border-r border-white/5 flex flex-col bg-[#0d0d1a] overflow-y-auto">
          <div className="px-3 pt-2.5 pb-1.5">
            <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest">
              Documents ({docs.length})
            </p>
          </div>

          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => {
                setActiveId(doc.id);
                setContextMenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ id: doc.id, x: e.clientX, y: e.clientY });
              }}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-white/[0.04] transition-all select-none',
                activeId === doc.id
                  ? 'bg-indigo-500/10 border-l-2 border-l-indigo-400'
                  : 'hover:bg-white/[0.03]',
              )}>
              {doc.mode === 'rich' ? (
                <FileText className="flex-shrink-0 w-3 h-3 text-indigo-400/70" />
              ) : (
                <Code2 className="flex-shrink-0 w-3 h-3 text-emerald-400/70" />
              )}

              {renamingId === doc.id ? (
                <input
                  ref={renameInputRef}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-1 text-xs border rounded outline-none bg-white/5 border-indigo-400/40 text-white/90"
                  autoFocus
                />
              ) : (
                <span className="flex-1 min-w-0 text-xs truncate text-white/70">
                  {doc.title}
                  {doc.dirty && <span className="text-amber-400 ml-0.5 text-[10px]">●</span>}
                </span>
              )}

              {/* Quick close */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeDoc(doc.id);
                }}
                className="flex-shrink-0 ml-auto transition-all opacity-0 group-hover:opacity-100 text-white/20 hover:text-white/60">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          {docs.length === 0 && (
            <p className="p-4 text-xs text-center text-white/15">No documents open</p>
          )}
        </div>

        {/* ── Editor pane ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {activeDoc ? (
            <>
              {/* ── Doc toolbar ── */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-[#0d0d1a] flex-shrink-0">
                {/* Inline title edit */}
                <input
                  value={activeDoc.title}
                  onChange={(e) => updateDoc(activeDoc.id, { title: e.target.value })}
                  className="flex-1 min-w-0 text-sm font-medium bg-transparent outline-none text-white/85 placeholder:text-white/20"
                  placeholder="Document title…"
                />

                {/* Mode toggle */}
                <div className="flex items-center flex-shrink-0 overflow-hidden border rounded-lg border-white/8">
                  <button
                    onClick={() => updateDoc(activeDoc.id, { mode: 'rich' })}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                      activeDoc.mode === 'rich'
                        ? 'bg-indigo-600 text-white'
                        : 'text-white/30 hover:text-white/60',
                    )}>
                    <FileText className="w-2.5 h-2.5" /> Rich
                  </button>
                  <button
                    onClick={() => updateDoc(activeDoc.id, { mode: 'code' })}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                      activeDoc.mode === 'code'
                        ? 'bg-emerald-600 text-white'
                        : 'text-white/30 hover:text-white/60',
                    )}>
                    <Code2 className="w-2.5 h-2.5" /> Code
                  </button>
                </div>

                {/* Language selector for code mode */}
                {activeDoc.mode === 'code' && (
                  <select
                    value={activeDoc.language}
                    onChange={(e) => updateDoc(activeDoc.id, { language: e.target.value })}
                    className="h-6 px-1.5 text-[10px] bg-white/[0.04] border border-white/8 rounded-lg outline-none text-white/60 flex-shrink-0">
                    {CODE_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                )}

                {/* File path badge */}
                {activeDoc.filePath && (
                  <span
                    className="text-[9px] text-white/20 truncate max-w-[140px] flex-shrink-0 font-mono"
                    title={activeDoc.filePath}>
                    {basename(activeDoc.filePath)}
                  </span>
                )}
              </div>

              {/* ── Editor ── */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeDoc.mode === 'rich' ? (
                  <div className="flex flex-col h-full overflow-hidden ql-dark">
                    <ReactQuill
                      key={activeDoc.id}
                      theme="snow"
                      value={activeDoc.content}
                      onChange={(val) => updateDoc(activeDoc.id, { content: val })}
                      modules={QUILL_MODULES}
                      formats={QUILL_FORMATS}
                      placeholder="Start writing…"
                      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    />
                  </div>
                ) : (
                  <Editor
                    key={activeDoc.id}
                    height="100%"
                    language={activeDoc.language}
                    value={activeDoc.content}
                    onChange={(val) => updateDoc(activeDoc.id, { content: val ?? '' })}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                      fontLigatures: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                      padding: { top: 16, bottom: 16 },
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      tabSize: 2,
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white/10" />
              </div>
              <p className="text-sm text-white/20">No document selected</p>
              <div className="flex gap-2">
                <button
                  onClick={() => createDoc('rich')}
                  className="px-3 py-1.5 text-xs bg-indigo-600/60 hover:bg-indigo-600 text-white rounded-lg transition-all">
                  New Note
                </button>
                <button
                  onClick={() => createDoc('code')}
                  className="px-3 py-1.5 text-xs bg-emerald-600/60 hover:bg-emerald-600 text-white rounded-lg transition-all">
                  New Code File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right-click context menu ── */}
      {contextMenu &&
        (() => {
          const doc = docs.find((d) => d.id === contextMenu.id);
          if (!doc) return null;
          return (
            <div
              style={{ top: contextMenu.y, left: contextMenu.x }}
              className="fixed z-50 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]"
              onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  startRename(doc);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                onClick={() => {
                  setActiveId(doc.id);
                  handleSave(doc);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => {
                  setActiveId(doc.id);
                  handleSaveAs(doc);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                <Save className="w-3 h-3" /> Save As…
              </button>
              <div className="my-1 border-t border-white/5" />
              <button
                onClick={() => {
                  deleteDoc(doc.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          );
        })()}
    </div>
  );
}
