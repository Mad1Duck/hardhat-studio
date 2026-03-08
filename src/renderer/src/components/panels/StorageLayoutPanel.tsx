import { useState } from 'react';
import { ContractAbi, DeployedContract } from '../../types';
import { cn } from '../../lib/utils';
import { Database, RefreshCw, AlertCircle, Eye, Copy, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/primitives';

const api = (window as any).api;

interface StorageSlot {
  slot: number;
  name: string;
  type: string;
  bytes: number;
  offset: number;
  value?: string;
}

interface Props {
  deployedContracts?: DeployedContract[];
  abis: ContractAbi[];
  selectedAbi: ContractAbi | null;
  onSelectAbi: (abi: ContractAbi) => void;
  projectPath: string | null;
  rpcUrl: string;
}

const TYPE_COLOR: Record<string, string> = {
  address: 'bg-sky-500/20 border-sky-500/30 text-sky-300',
  uint256: 'bg-violet-500/20 border-violet-500/30 text-violet-300',
  uint: 'bg-violet-500/20 border-violet-500/30 text-violet-300',
  bool: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  bytes32: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  string: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
  bytes: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  mapping: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
};
const getTypeColor = (type: string) => {
  for (const [k, v] of Object.entries(TYPE_COLOR)) {
    if (type.startsWith(k)) return v;
  }
  return 'bg-muted/30 border-border text-foreground/60';
};

const TYPE_SIZES: Record<string, number> = {
  bool: 1,
  uint8: 1,
  int8: 1,
  uint16: 2,
  int16: 2,
  uint32: 4,
  int32: 4,
  uint64: 8,
  int64: 8,
  uint128: 16,
  int128: 16,
  uint256: 32,
  int256: 32,
  uint: 32,
  int: 32,
  address: 20,
  bytes32: 32,
  bytes: 32,
  string: 32,
};

export default function StorageLayoutPanel({
  abis,
  selectedAbi,
  onSelectAbi,
  projectPath,
  rpcUrl,
  deployedContracts = [],
}: Props) {
  const [slots, setSlots] = useState<StorageSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deployedAddr, setDeployedAddr] = useState('');

  // Auto-detect contract address from deployed contracts list
  const autoAddr = (() => {
    if (!selectedAbi) return '';
    const match = deployedContracts.find(
      (c) => c.name === selectedAbi.contractName || c.name === selectedAbi.name,
    );
    return match?.address || '';
  })();
  const effectiveAddr = deployedAddr || autoAddr;
  const [liveValues, setLiveValues] = useState<Record<string, string>>({});
  const [fetchingLive, setFetchingLive] = useState(false);

  const analyze = async () => {
    if (!selectedAbi || !projectPath) return;
    setLoading(true);
    setError('');
    setSlots([]);
    try {
      const result: StorageSlot[] = await api.analyzeStorageLayout(
        projectPath,
        selectedAbi.contractName,
      );
      setSlots(result);
      if (result.length === 0)
        setError(
          'No state variables found. Make sure the contract source is in the contracts/ folder.',
        );
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const fetchLiveValues = async () => {
    if (!effectiveAddr || !rpcUrl) return;
    setFetchingLive(true);
    const values: Record<string, string> = {};
    for (const slot of slots) {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getStorageAt',
            params: [effectiveAddr, `0x${slot.slot.toString(16)}`, 'latest'],
          }),
        });
        const data = (await res.json()) as { result?: string };
        if (data.result && data.result !== '0x' + '0'.repeat(64)) {
          values[`${slot.slot}-${slot.name}`] = data.result;
        }
      } catch {}
    }
    setLiveValues(values);
    setFetchingLive(false);
  };

  // Group slots by slot number
  const groupedSlots: Record<number, StorageSlot[]> = {};
  slots.forEach((s) => {
    if (!groupedSlots[s.slot]) groupedSlots[s.slot] = [];
    groupedSlots[s.slot].push(s);
  });
  const slotNums = Object.keys(groupedSlots)
    .map(Number)
    .sort((a, b) => a - b);
  const uniqueSlots = slotNums.length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex flex-col flex-shrink-0 w-64 overflow-hidden border-r border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold">Storage Layout</span>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Visualize contract storage slots
          </p>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Contract picker */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">
              Contract
            </p>
            <div className="space-y-1 overflow-y-auto max-h-48">
              {abis.map((a) => (
                <button
                  key={a.path}
                  onClick={() => {
                    onSelectAbi(a);
                    setSlots([]);
                    setError('');
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-xs transition-all',
                    selectedAbi?.path === a.path
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'hover:bg-muted/40 text-muted-foreground/70 border border-transparent',
                  )}>
                  {a.contractName}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full h-8 gap-2 text-xs bg-amber-600 hover:bg-amber-500"
            onClick={analyze}
            disabled={loading || !selectedAbi || !projectPath}>
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Analyzing...' : 'Analyze Layout'}
          </Button>

          {error && (
            <div className="flex items-start gap-2 p-2 text-xs border rounded text-rose-400 bg-rose-500/10 border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {slots.length > 0 && (
            <>
              {/* Stats */}
              <div>
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">
                  Summary
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: 'State Variables', value: slots.length },
                    { label: 'Storage Slots', value: uniqueSlots },
                    { label: 'Total Bytes', value: slots.reduce((s, v) => s + v.bytes, 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground/50">{label}</span>
                      <span className="font-mono text-amber-300">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live value fetch */}
              <div>
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1">
                  Live Values
                </p>
                {autoAddr && (
                  <div className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1 mb-1 flex items-center gap-1">
                    ✓ Auto: <span className="font-mono">{autoAddr.slice(0, 14)}…</span>
                  </div>
                )}
                {autoAddr && !deployedAddr && (
                  <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded mb-1 font-mono">
                    ✓ Auto: {autoAddr.slice(0, 10)}...
                  </div>
                )}
                <input
                  value={deployedAddr}
                  onChange={(e) => setDeployedAddr(e.target.value)}
                  placeholder={autoAddr || 'Contract address...'}
                  className="w-full h-7 px-2 text-[10px] font-mono bg-muted/20 border border-border rounded text-foreground/70 placeholder:text-muted-foreground/30 outline-none focus:border-amber-500/40 mb-2"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={fetchLiveValues}
                  disabled={!effectiveAddr || fetchingLive}>
                  <Eye className="w-3 h-3" />
                  {fetchingLive ? 'Fetching...' : 'Read from Chain'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: slot visualization */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold">
              {selectedAbi ? selectedAbi.contractName : 'Select a contract'}
            </span>
            {slots.length > 0 && (
              <span className="text-[10px] text-muted-foreground/40">
                {uniqueSlots} slots, {slots.length} variables
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          {slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-20 text-muted-foreground/30">
              <Database className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a contract and click Analyze</p>
              <p className="text-xs opacity-60">
                Parses Solidity source to map state variables to storage slots
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
                {Object.entries(TYPE_COLOR)
                  .slice(0, 6)
                  .map(([type, cls]) => (
                    <span
                      key={type}
                      className={cn('text-[9px] px-2 py-0.5 rounded border font-mono', cls)}>
                      {type}
                    </span>
                  ))}
              </div>

              {slotNums.map((slotNum) => {
                const vars = groupedSlots[slotNum];
                const totalBytes = vars.reduce((s, v) => s + v.bytes, 0);
                const packed = vars.length > 1;
                const liveKey = `${slotNum}-${vars[0]?.name}`;
                const liveVal = liveValues[liveKey];

                return (
                  <div key={slotNum} className="overflow-hidden border rounded-lg border-border">
                    {/* Slot header */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground/50">slot</span>
                        <span className="font-mono text-xs font-bold text-amber-400">
                          #{slotNum}
                        </span>
                        {packed && (
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 rounded border border-emerald-500/20">
                            packed
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/40">
                          {totalBytes}/32 bytes
                        </span>
                      </div>
                      {liveVal && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground/40">live:</span>
                          <code className="text-[9px] font-mono text-emerald-400 truncate max-w-32">
                            {liveVal}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(liveVal)}
                            className="text-muted-foreground/30 hover:text-muted-foreground">
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 32-byte slot visualizer */}
                    <div className="px-3 py-2">
                      {/* Byte bar */}
                      <div className="flex h-5 gap-px mb-2 overflow-hidden rounded bg-muted/20">
                        {vars.map((v, vi) => (
                          <div
                            key={vi}
                            className={cn(
                              'flex items-center justify-center text-[8px] font-mono transition-all',
                              getTypeColor(v.type),
                            )}
                            style={{
                              width: `${(v.bytes / 32) * 100}%`,
                              minWidth: v.bytes <= 2 ? '4px' : undefined,
                            }}>
                            {v.bytes >= 4 && v.name}
                          </div>
                        ))}
                        {/* Empty space */}
                        {totalBytes < 32 && (
                          <div className="flex-1 bg-muted/10 flex items-center justify-center text-[8px] text-muted-foreground/20">
                            {32 - totalBytes}B free
                          </div>
                        )}
                      </div>

                      {/* Variable details */}
                      <div className="space-y-1">
                        {vars.map((v, vi) => (
                          <div key={vi} className="flex items-center gap-2 text-xs">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded border text-[10px] font-mono',
                                getTypeColor(v.type),
                              )}>
                              {v.type}
                            </span>
                            <span className="font-semibold text-foreground/80">{v.name}</span>
                            <span className="text-muted-foreground/40 text-[10px]">
                              offset {v.offset}B · {v.bytes} byte{v.bytes !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
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
