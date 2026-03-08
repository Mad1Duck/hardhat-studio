import { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { ScriptFile, ProjectInfo } from '../../types';
import { cn } from '../../lib/utils';
import {
  FolderOpen,
  Play,
  RefreshCw,
  FileCode,
  Plus,
  Save,
  X,
  Wand2,
  Trash2,
  ChevronDown,
  Copy,
  Check,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/primitives';

const api = (window as any).api;

interface Props {
  projectPath: string | null;
  projectInfo: ProjectInfo | null;
  onRunInTerminal: (cmd: string) => void;
}

const TEMPLATES = {
  empty: {
    label: 'Blank',
    desc: 'Empty script',
    code: `// Hardhat Script
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Running with:", deployer.address);

  // Your code here
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  },
  deploy: {
    label: 'Deploy',
    desc: 'Deploy a contract',
    code: `const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Contract = await ethers.getContractFactory("MyContract");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
`,
  },
  interact: {
    label: 'Interact',
    desc: 'Call contract functions',
    code: `const { ethers } = require("hardhat");

async function main() {
  const CONTRACT_ADDRESS = "0x...";
  const [signer] = await ethers.getSigners();

  const contract = await ethers.getContractAt("MyContract", CONTRACT_ADDRESS, signer);

  // Read
  const value = await contract.getValue();
  console.log("Value:", value.toString());

  // Write
  const tx = await contract.setValue(42);
  await tx.wait();
  console.log("Tx hash:", tx.hash);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
`,
  },
  ignition: {
    label: 'Ignition',
    desc: 'Hardhat Ignition module',
    code: `const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MyModule", (m) => {
  const myContract = m.contract("MyContract", [
    // constructor args here
  ]);

  return { myContract };
});
`,
  },
  viem: {
    label: 'Viem',
    desc: 'Using viem client',
    code: `import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

async function main() {
  const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const publicClient = createPublicClient({ chain: hardhat, transport: http() });
  const walletClient = createWalletClient({ account, chain: hardhat, transport: http() });

  const blockNumber = await publicClient.getBlockNumber();
  console.log("Block:", blockNumber.toString());
}

main().catch(console.error);
`,
  },
};

type TemplateKey = keyof typeof TEMPLATES;

// ─── Monaco theme registration ─────────────────────────────────────────────
function useHardhatTheme(monaco: ReturnType<typeof useMonaco>) {
  useEffect(() => {
    if (!monaco) return;
    monaco.editor.defineTheme('hardhat-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4b5563', fontStyle: 'italic' },
        { token: 'keyword', foreground: '818cf8' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '67e8f9' },
        { token: 'identifier', foreground: 'e2e8f0' },
        { token: 'delimiter', foreground: '64748b' },
        { token: 'delimiter.bracket', foreground: '94a3b8' },
      ],
      colors: {
        'editor.background': '#090e1a',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#0f172a',
        'editor.selectionBackground': '#1e40af55',
        'editor.inactiveSelectionBackground': '#1e3a5f33',
        'editorLineNumber.foreground': '#1e3a5f',
        'editorLineNumber.activeForeground': '#3b82f6',
        'editorCursor.foreground': '#34d399',
        'editorWhitespace.foreground': '#1e293b',
        'editorIndentGuide.background': '#1e293b',
        'editorIndentGuide.activeBackground': '#334155',
        'editor.findMatchBackground': '#78350f88',
        'editor.findMatchHighlightBackground': '#451a0344',
        'editorGutter.background': '#080d16',
        'editorWidget.background': '#0f172a',
        'editorWidget.border': '#1e293b',
        'input.background': '#0f172a',
        'input.border': '#1e293b',
        focusBorder: '#3b82f6',
        'scrollbarSlider.background': '#1e293b88',
        'scrollbarSlider.hoverBackground': '#334155aa',
        'minimap.background': '#080d16',
      },
    });
    monaco.editor.setTheme('hardhat-dark');
  }, [monaco]);
}

export default function ScriptsPanel({ projectPath, projectInfo, onRunInTerminal }: Props) {
  const monaco = useMonaco();
  useHardhatTheme(monaco);

  const [scripts, setScripts] = useState<ScriptFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [network, setNetwork] = useState('localhost');
  const [selected, setSelected] = useState<ScriptFile | null>(null);
  const [editorCode, setEditorCode] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'new'>('view');
  const [newFileName, setNewFileName] = useState('');
  const [newTemplate, setNewTemplate] = useState<TemplateKey>('empty');
  const [confirmDelete, setConfirmDelete] = useState<ScriptFile | null>(null);
  const [copied, setCopied] = useState(false);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [wordCount, setWordCount] = useState(0);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const pm = projectInfo?.isBun
    ? 'bunx'
    : projectInfo?.packageManager === 'yarn'
      ? 'yarn'
      : projectInfo?.packageManager === 'pnpm'
        ? 'pnpm exec'
        : 'npx';

  const scan = async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const r = await api.scanScripts(projectPath);
      setScripts(r || []);
    } catch {}
    setLoading(false);
  };

  const loadFile = async (script: ScriptFile) => {
    setSelected(script);
    setMode('view');
    setDirty(false);
    try {
      const c = await api.readFile(script.path);
      setEditorCode(c || '');
      setWordCount((c || '').split(/\s+/).filter(Boolean).length);
    } catch {
      setEditorCode('');
    }
  };

  const saveFile = useCallback(async () => {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      await api.writeFile(selected.path, editorCode);
    } catch {}
    setSaving(false);
    setDirty(false);
  }, [selected, dirty, editorCode]);

  // Ctrl+S shortcut via Monaco action
  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    editor.addCommand(
      // monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS
      2048 | 49,
      () => saveFile(),
    );

    editor.onDidChangeCursorPosition((e) => {
      setCursorInfo({ line: e.position.lineNumber, col: e.position.column });
    });
  };

  const createNewScript = async () => {
    if (!projectPath || !newFileName.trim()) return;
    const name = /\.[jt]s$/.test(newFileName) ? newFileName : newFileName + '.js';
    const filePath = `${projectPath}/scripts/${name}`;
    const code = TEMPLATES[newTemplate].code;
    try {
      await api.writeFile(filePath, code);
      await scan();
      const newFile: ScriptFile = {
        id: crypto.randomUUID(),
        name,
        path: filePath,
        relativePath: `scripts/${name}`,
        size: code.length,
      };
      setSelected(newFile);
      setEditorCode(code);
      setMode('view');
      setDirty(false);
      setNewFileName('');
    } catch {}
  };

  const deleteScript = async (script: ScriptFile) => {
    setConfirmDelete(null);
    try {
      await api.writeFile(script.path, `// Removed via Hardhat Studio\n`);
      if (selected?.path === script.path) {
        setSelected(null);
        setEditorCode('');
      }
      await scan();
    } catch {}
  };

  const runScript = () => {
    if (!selected) return;
    const isIgnition = selected.relativePath.includes('ignition');
    const cmd = isIgnition
      ? `${pm} hardhat ignition deploy ${selected.relativePath} --network ${network} --reset`
      : `${pm} hardhat run ${selected.relativePath} --network ${network}`;
    onRunInTerminal(cmd);
  };

  const formatCode = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.getAction('editor.action.formatDocument')?.run();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(editorCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Detect language from file extension
  const getLanguage = (filename: string) => {
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.sol')) return 'sol';
    return 'javascript';
  };

  useEffect(() => {
    scan();
  }, [projectPath]);

  // Re-bind saveFile shortcut when it changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.addCommand(2048 | 49, () => saveFile());
  }, [saveFile]);

  const NETWORKS = [
    'localhost',
    'hardhat',
    'sepolia',
    'mainnet',
    'polygon',
    'base',
    ...Object.keys(projectInfo?.networks || {}),
  ];
  const uniqueNets = [...new Set(NETWORKS)];
  const filtered = scripts.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const isIgnitionScript = selected?.relativePath.includes('ignition');

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="flex flex-col flex-shrink-0 w-64 border-r border-border bg-card">
        <div className="px-3 py-2.5 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold">Scripts</span>
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                {scripts.length}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => setMode('new')}>
                <Plus className="w-3 h-3" /> New
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={scan}
                disabled={loading}>
                <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="h-6 text-[11px]"
          />
        </div>

        {/* Network */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60">
          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">Network</span>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="flex-1 h-6 text-[11px] bg-muted/20 border border-border rounded px-1.5 outline-none font-mono">
            {uniqueNets.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground/25 py-10 text-[11px]">
              No scripts found
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.path}
                className={cn(
                  'flex items-center group border-b border-border/30 transition-colors',
                  selected?.path === s.path ? 'bg-blue-500/10' : 'hover:bg-muted/30',
                )}>
                <button
                  onClick={() => loadFile(s)}
                  className="flex items-center flex-1 min-w-0 gap-2 px-3 py-2 text-left">
                  <FileCode
                    className={cn(
                      'w-3 h-3 flex-shrink-0',
                      s.relativePath.includes('ignition')
                        ? 'text-purple-400'
                        : selected?.path === s.path
                          ? 'text-emerald-400'
                          : 'text-muted-foreground/30',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium truncate">{s.name}</div>
                    <div className="text-[9px] text-muted-foreground/35 truncate font-mono">
                      {s.relativePath}
                    </div>
                  </div>
                  {selected?.path === s.path && (
                    <ChevronRight className="flex-shrink-0 w-3 h-3 text-blue-400" />
                  )}
                </button>

                {/* Delete confirm */}
                {confirmDelete?.path === s.path ? (
                  <div className="flex items-center flex-shrink-0 gap-1 pr-2">
                    <span className="text-[9px] text-rose-400">Delete?</span>
                    <button
                      onClick={() => deleteScript(s)}
                      className="text-rose-400 hover:text-rose-300 p-0.5">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-muted-foreground/30 hover:text-muted-foreground p-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(s);
                    }}
                    className="p-1 mr-1 transition-opacity opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-rose-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: editor area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* New file wizard */}
        {mode === 'new' && (
          <div className="flex flex-col flex-1 overflow-auto">
            <div className="px-4 py-2.5 border-b border-border bg-card/50 flex items-center gap-2 flex-shrink-0">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-semibold">New Script</span>
              <button
                onClick={() => setMode('view')}
                className="ml-auto text-muted-foreground/30 hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-w-lg p-6 space-y-5">
              <div>
                <Label className="mb-1.5 block text-xs">File name</Label>
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="deploy.js or MyModule.ts"
                  onKeyDown={(e) => e.key === 'Enter' && createNewScript()}
                />
              </div>
              <div>
                <Label className="block mb-2 text-xs">Template</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    Object.entries(TEMPLATES) as [TemplateKey, (typeof TEMPLATES)[TemplateKey]][]
                  ).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setNewTemplate(key)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        newTemplate === key
                          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                          : 'border-border hover:border-muted-foreground/20 hover:bg-muted/20',
                      )}>
                      <div
                        className={cn(
                          'text-xs font-semibold',
                          newTemplate === key ? 'text-emerald-400' : 'text-foreground/70',
                        )}>
                        {t.label}
                      </div>
                      <div className="text-[9px] text-muted-foreground/40 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground/50">Preview</Label>
                <div className="rounded-lg border border-border overflow-hidden bg-[#090e1a]">
                  <Editor
                    height="200px"
                    language={newFileName.endsWith('.ts') ? 'typescript' : 'javascript'}
                    value={TEMPLATES[newTemplate].code}
                    theme="hardhat-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      lineNumbers: 'off',
                      folding: false,
                      scrollBeyondLastLine: false,
                      fontSize: 11,
                      padding: { top: 8, bottom: 8 },
                      renderLineHighlight: 'none',
                      scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                    }}
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2 text-sm bg-emerald-600 hover:bg-emerald-500"
                onClick={createNewScript}
                disabled={!newFileName.trim()}>
                <Plus className="w-4 h-4" /> Create Script
              </Button>
            </div>
          </div>
        )}

        {/* File editor */}
        {mode === 'view' && selected && (
          <>
            {/* Toolbar */}
            <div className="flex items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border bg-card/50">
              <FileCode
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  isIgnitionScript ? 'text-purple-400' : 'text-emerald-400',
                )}
              />
              <span className="font-mono text-xs font-medium">{selected.name}</span>
              {isIgnitionScript && (
                <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-mono">
                  ignition
                </span>
              )}
              {dirty && (
                <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  ● unsaved
                </span>
              )}

              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={copyCode}
                  title="Copy code">
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={formatCode}
                  title="Format document (Shift+Alt+F)">
                  <Wand2 className="w-3 h-3" /> Format
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[10px] gap-1"
                  onClick={saveFile}
                  disabled={!dirty || saving}>
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-3 text-[10px] gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                  onClick={runScript}>
                  <Play className="w-3 h-3" />
                  {isIgnitionScript ? 'Deploy' : 'Run'} · {network}
                </Button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <Editor
                height="100%"
                language={getLanguage(selected.name)}
                value={editorCode}
                theme="hardhat-dark"
                onChange={(val) => {
                  setEditorCode(val || '');
                  setDirty(true);
                  setWordCount((val || '').split(/\s+/).filter(Boolean).length);
                }}
                onMount={handleEditorMount}
                options={{
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                  fontLigatures: true,
                  lineHeight: 22,
                  minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  renderLineHighlight: 'gutter',
                  renderWhitespace: 'selection',
                  bracketPairColorization: { enabled: true },
                  guides: { bracketPairs: 'active', indentation: true },
                  suggest: { showKeywords: true, showSnippets: true },
                  quickSuggestions: { other: true, comments: false, strings: false },
                  tabSize: 2,
                  insertSpaces: true,
                  wordWrap: 'off',
                  folding: true,
                  foldingHighlight: true,
                  showFoldingControls: 'mouseover',
                  padding: { top: 12, bottom: 24 },
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  overviewRulerLanes: 2,
                  formatOnPaste: true,
                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  autoIndent: 'full',
                  contextmenu: true,
                }}
              />
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 px-4 py-1 border-t border-border/40 bg-[#080d16] text-[10px] font-mono flex-shrink-0">
              <span className="text-muted-foreground/30">{selected.name}</span>
              <span className="text-muted-foreground/25">
                Ln {cursorInfo.line}, Col {cursorInfo.col}
              </span>
              <span className="text-muted-foreground/25">
                {editorCode.split('\n').length} lines
              </span>
              <span className="text-muted-foreground/20">{editorCode.length} chars</span>
              <div className="flex items-center gap-3 ml-auto text-muted-foreground/20">
                <span>{getLanguage(selected.name).toUpperCase()}</span>
                <span>UTF-8</span>
                <span>Spaces: 2</span>
                <span>Ctrl+S to save</span>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {mode === 'view' && !selected && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground/25">
            <div className="relative">
              <FolderOpen className="w-14 h-14 opacity-15" />
              <div className="absolute flex items-center justify-center w-5 h-5 rounded-full -bottom-1 -right-1 bg-emerald-500/20">
                <Plus className="w-3 h-3 text-emerald-400/50" />
              </div>
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm text-muted-foreground/40">Select a script to edit</p>
              <p className="text-xs text-muted-foreground/20">or create a new one</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => setMode('new')}>
              <Plus className="w-3.5 h-3.5" /> New Script
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
