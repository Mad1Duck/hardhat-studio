import { useState } from 'react';
import { DeployedContract, ProxyInfo } from '../../types';
import { cn } from '../../lib/utils';
import {
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/primitives';

const api = (window as any).api;

interface Props {
  rpcUrl: string;
  deployedContracts: DeployedContract[];
  onNavigateToInteract?: (address: string) => void;
}

const PROXY_DESCRIPTIONS: Record<
  string,
  { label: string; color: string; desc: string; risk: string }
> = {
  transparent: {
    label: 'Transparent Proxy',
    color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    desc: 'Uses EIP-1967 slots. Admin calls proxy directly; users delegatecall to implementation.',
    risk: 'Admin key is critical. Function selector clashing possible.',
  },
  uups: {
    label: 'UUPS Proxy',
    color: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
    desc: 'Upgrade logic lives in the implementation. No admin slot.',
    risk: 'If implementation loses upgrade function, contract is frozen forever.',
  },
  beacon: {
    label: 'Beacon Proxy',
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    desc: 'Points to a beacon contract which holds the implementation. Many proxies can share one beacon.',
    risk: 'Beacon owner can upgrade all instances simultaneously.',
  },
  minimal: {
    label: 'Minimal Proxy (EIP-1167)',
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    desc: 'Clone factory pattern. Tiny bytecode, delegates all calls. Not upgradeable.',
    risk: 'Low risk. Implementation is fixed at deploy time.',
  },
  unknown: {
    label: 'Not a Proxy',
    color: 'text-muted-foreground border-border bg-muted/10',
    desc: 'No EIP-1967 proxy slots detected. This is a regular contract.',
    risk: '',
  },
};

export default function ProxyInspectorPanel({
  rpcUrl,
  deployedContracts,
  onNavigateToInteract,
}: Props) {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<ProxyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<{ address: string; info: ProxyInfo }[]>([]);

  const inspect = async (addr?: string) => {
    const target = (addr || address).trim();
    if (!target) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const info = await api.inspectProxy(rpcUrl, target);
      setResult(info);
      setHistory((prev) => [
        { address: target, info },
        ...prev.filter((h) => h.address !== target).slice(0, 9),
      ]);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const copyAddr = (addr: string) => navigator.clipboard.writeText(addr);

  const meta = result ? PROXY_DESCRIPTIONS[result.type] || PROXY_DESCRIPTIONS.unknown : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden border-r w-72 border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold">Proxy Inspector</span>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Detect EIP-1967, UUPS, Beacon, Minimal proxy
          </p>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div>
            <Label className="block mb-1 text-xs">Contract Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="mb-2 font-mono text-xs h-7"
              onKeyDown={(e) => e.key === 'Enter' && inspect()}
            />
            <Button
              className="w-full h-8 gap-2 text-xs bg-violet-600 hover:bg-violet-500"
              onClick={() => inspect()}
              disabled={loading || !address}>
              <Search className="w-3.5 h-3.5" />
              {loading ? 'Inspecting...' : 'Inspect Proxy'}
            </Button>
            {error && (
              <div className="flex items-center gap-2 p-2 mt-2 text-xs border rounded text-rose-400 bg-rose-500/10 border-rose-500/20">
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              </div>
            )}
          </div>

          {/* Deployed contracts quick pick */}
          {deployedContracts.length > 0 && (
            <div>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">
                Deployed Contracts
              </p>
              <div className="space-y-1">
                {deployedContracts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setAddress(c.address);
                      inspect(c.address);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted/40 transition-all text-left group border border-transparent hover:border-border">
                    <div>
                      <div className="font-medium text-foreground/80">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground/40 font-mono">
                        {c.address.slice(0, 16)}…
                      </div>
                    </div>
                    <Search className="w-3 h-3 transition-all text-muted-foreground/30 group-hover:text-violet-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">
                Recent
              </p>
              <div className="space-y-1">
                {history.map((h) => (
                  <button
                    key={h.address}
                    onClick={() => {
                      setAddress(h.address);
                      setResult(h.info);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/40 transition-all text-left">
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded border capitalize',
                        (PROXY_DESCRIPTIONS[h.info.type] || PROXY_DESCRIPTIONS.unknown).color,
                      )}>
                      {h.info.type}
                    </span>
                    <span className="font-mono truncate text-muted-foreground/50">
                      {h.address.slice(0, 14)}…
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: result */}
      <div className="flex flex-col flex-1 overflow-hidden overflow-y-auto">
        {!result ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30">
            <Shield className="w-12 h-12 opacity-20" />
            <p className="text-sm">Enter an address to inspect</p>
          </div>
        ) : (
          <div className="max-w-2xl p-6 space-y-5">
            {/* Type badge */}
            <div className={cn('flex items-center gap-3 p-4 rounded-xl border', meta?.color)}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {(result as any)?.isProxy ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span className="text-base font-bold">{meta?.label}</span>
                </div>
                <p className="text-xs leading-relaxed opacity-80">{meta?.desc}</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] opacity-60">Bytecode</div>
                <div className="font-mono text-sm font-semibold">
                  {(result as any)?.bytecodeSize}B
                </div>
              </div>
            </div>

            {/* Risk */}
            {meta?.risk && (
              <div className="flex items-start gap-2 p-3 text-xs border rounded-lg bg-amber-500/10 border-amber-500/20 text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Security Note: </span>
                  {meta.risk}
                </div>
              </div>
            )}

            {/* Addresses */}
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                Addresses
              </p>

              {[
                { label: 'Proxy Address', value: result.proxyAddress, always: true },
                { label: 'Implementation', value: result.implementationAddress },
                { label: 'Admin', value: result.adminAddress },
                { label: 'Beacon', value: (result as any).beaconAddress },
              ]
                .filter((a) => a.always || a.value)
                .map(({ label, value }) =>
                  value ? (
                    <div
                      key={label}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20 border-border">
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground/50 mb-0.5">{label}</div>
                        <code className="font-mono text-xs text-foreground/80">{value}</code>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyAddr(value)}
                          className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground/40 hover:text-muted-foreground transition-all">
                          <Copy className="w-3 h-3" />
                        </button>
                        {onNavigateToInteract && label === 'Implementation' && (
                          <button
                            onClick={() => onNavigateToInteract(value)}
                            className="p-1.5 rounded hover:bg-violet-500/20 text-muted-foreground/40 hover:text-violet-400 transition-all">
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null,
                )}
            </div>

            {/* Raw storage slots */}
            <div>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">
                EIP-1967 Storage Slots
              </p>
              <div className="space-y-2">
                {result.slots.map((slot) => (
                  <div
                    key={slot.slot}
                    className="text-[10px] font-mono p-2 rounded bg-muted/10 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground/50">{slot.label}</span>
                      <button
                        onClick={() => copyAddr(slot.value)}
                        className="text-muted-foreground/30 hover:text-muted-foreground">
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <div className="text-muted-foreground/30 text-[9px] truncate">{slot.slot}</div>
                    <div
                      className={cn(
                        'truncate',
                        slot.value.replace(/0+$/, '').length > 10
                          ? 'text-emerald-400/80'
                          : 'text-muted-foreground/20',
                      )}>
                      {slot.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
