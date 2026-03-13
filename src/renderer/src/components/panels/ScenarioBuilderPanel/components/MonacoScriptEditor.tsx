import { useState, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FileCode, Package } from 'lucide-react';
import { Label } from '../../../ui/primitives';

const ETHERS_TYPES = `
declare const ethers: typeof import('ethers');
declare const provider: import('ethers').JsonRpcProvider;
declare const signer: import('ethers').Wallet | null;
declare const accounts: Array<{ address: string; privateKey: string }>;
declare const contracts: Record<string, import('ethers').Contract>;
declare const console: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void; };
`;

function detectImports(code: string): string[] {
  const pkgs = new Set<string>();
  const esImport = /import\s+(?:.*?\s+from\s+)?['"]([^'"./][^'"]*)['"]/g;
  const cjsRequire = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  let m;
  while ((m = esImport.exec(code)) !== null) pkgs.add(m[1].split('/')[0]);
  while ((m = cjsRequire.exec(code)) !== null) pkgs.add(m[1].split('/')[0]);
  return [...pkgs];
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function MonacoScriptEditor({ value, onChange }: Props) {
  const monaco = useMonaco();
  const [detectedPkgs, setDetectedPkgs] = useState<string[]>([]);

  useEffect(() => {
    if (!monaco) return;
    try {
      const ts = (monaco as any).languages?.typescript;
      if (!ts) return;
      const defaults = ts.typescriptDefaults;
      defaults.addExtraLib(ETHERS_TYPES, 'file:///env.d.ts');
      defaults.setCompilerOptions({
        target: ts.ScriptTarget?.ES2020 ?? 99,
        allowNonTsExtensions: true,
        moduleResolution: ts.ModuleResolutionKind?.NodeJs ?? 2,
        allowSyntheticDefaultImports: true,
      });
      defaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
    } catch {}
  }, [monaco]);

  useEffect(() => {
    setDetectedPkgs(detectImports(value));
  }, [value]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[10px] flex items-center gap-1">
          <FileCode className="w-3 h-3 text-pink-400" /> Script
          <span className="ml-1 font-normal text-muted-foreground/30">TypeScript · ethers v6</span>
        </Label>
      </div>

      {detectedPkgs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 p-2 mb-2 border rounded-lg bg-amber-500/10 border-amber-500/20">
          <Package className="flex-shrink-0 w-3 h-3 text-amber-400" />
          <span className="text-[9px] text-amber-400/80 mr-1">Detected imports:</span>
          {detectedPkgs.map((pkg) => (
            <span
              key={pkg}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
              {pkg}
            </span>
          ))}
          <span className="text-[9px] text-amber-400/40 ml-auto">⚠ ensure bundled</span>
        </div>
      )}

      <div className="overflow-hidden border rounded-lg border-border/50 focus-within:border-pink-500/40">
        <Editor
          height="220px"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 11,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            renderLineHighlight: 'gutter',
            padding: { top: 8, bottom: 8 },
            scrollbar: { verticalScrollbarSize: 4 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            suggest: { showKeywords: true },
          }}
        />
      </div>

      <p className="text-[9px] text-muted-foreground/25 mt-1">
        vars: <span className="text-pink-400/50">ethers</span> ·{' '}
        <span className="text-pink-400/50">provider</span> ·{' '}
        <span className="text-pink-400/50">signer</span> ·{' '}
        <span className="text-pink-400/50">accounts</span> ·{' '}
        <span className="text-pink-400/50">contracts</span> ·{' '}
        <span className="text-pink-400/50">console</span>
      </p>
    </div>
  );
}
