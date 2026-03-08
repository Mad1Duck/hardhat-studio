import { useState, useEffect, useCallback } from 'react';
import { ProjectInfo } from '../../types';
import { Button } from '../ui/button';
import { Input, Label, ScrollArea } from '../ui/primitives';
import { Globe, Wifi, WifiOff, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  projectInfo: ProjectInfo | null;
  currentRpcUrl: string;
  onNetworkChange: (url: string) => void;
}

interface NetworkStatus {
  name: string;
  url: string;
  chainId?: number;
  latency?: number;
  connected: boolean;
  blockNumber?: number;
}

const PRESET_NETWORKS = [
  { name: 'Hardhat Local', url: 'http://127.0.0.1:8545', chainId: 31337 },
  { name: 'Hardhat Local (alt)', url: 'http://localhost:8545', chainId: 31337 },
  { name: 'Ethereum Mainnet', url: 'https://eth.llamarpc.com', chainId: 1 },
  { name: 'Sepolia Testnet', url: 'https://rpc.sepolia.org', chainId: 11155111 },
  { name: 'Goerli Testnet', url: 'https://rpc.goerli.mudit.blog', chainId: 5 },
  { name: 'Polygon', url: 'https://polygon-rpc.com', chainId: 137 },
  { name: 'Arbitrum', url: 'https://arb1.arbitrum.io/rpc', chainId: 42161 },
  { name: 'Optimism', url: 'https://mainnet.optimism.io', chainId: 10 },
  { name: 'Base', url: 'https://mainnet.base.org', chainId: 8453 },
];

export default function NetworkPanel({ projectInfo, currentRpcUrl, onNetworkChange }: Props) {
  const [statuses, setStatuses] = useState<Record<string, NetworkStatus>>({});
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [customNetworks, setCustomNetworks] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const checkNetwork = async (name: string, url: string): Promise<NetworkStatus> => {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      const latency = Date.now() - start;
      const chainId = parseInt(data.result, 16);

      const blockRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 }),
        signal: AbortSignal.timeout(2000),
      });
      const blockData = await blockRes.json();
      const blockNumber = parseInt(blockData.result, 16);

      return { name, url, chainId, latency, connected: true, blockNumber };
    } catch {
      return { name, url, connected: false, latency: Date.now() - start };
    }
  };

  const checkAll = useCallback(async () => {
    setLoading(true);
    const allNets = [
      ...PRESET_NETWORKS.slice(0, 2), // Only check local by default for speed
      ...customNetworks,
    ];
    const results = await Promise.all(allNets.map((n) => checkNetwork(n.name, n.url)));
    const newStatuses: Record<string, NetworkStatus> = {};
    results.forEach((r) => {
      newStatuses[r.url] = r;
    });
    setStatuses(newStatuses);
    setLoading(false);
  }, [customNetworks]);

  useEffect(() => {
    checkAll();
  }, []);

  const addCustom = () => {
    if (!customUrl.trim()) return;
    setCustomNetworks((prev) => [...prev, { name: customName || customUrl, url: customUrl }]);
    setCustomUrl('');
    setCustomName('');
  };

  const allNetworks = [...PRESET_NETWORKS, ...customNetworks];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold">Network Manager</span>
          {projectInfo?.networks && Object.keys(projectInfo?.networks).length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/50">
              {Object.keys(projectInfo?.networks).length} from hardhat.config
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-7"
          onClick={checkAll}
          disabled={loading}>
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Check All
        </Button>
      </div>

      {/* Current network */}
      <div className="px-4 py-2 border-b bg-sky-500/5 border-sky-500/20">
        <div className="flex items-center gap-2 text-xs">
          <Wifi className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-muted-foreground/60">Connected to:</span>
          <span className="font-mono text-sky-300">{currentRpcUrl}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-1.5">
          {/* Hardhat config networks */}
          {projectInfo?.networks && Object.keys(projectInfo?.networks).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-2">
                From hardhat.config
              </p>
              {Object.keys(projectInfo?.networks).map((n) => (
                <div
                  key={n}
                  className="flex items-center gap-2 px-3 py-2 mb-1 border rounded-md bg-orange-500/5 border-orange-500/15">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
                  <span className="font-mono text-xs text-orange-300">{n}</span>
                </div>
              ))}
            </div>
          )}

          {allNetworks.map((net) => {
            const status = statuses[net.url];
            const isCurrent = net.url === currentRpcUrl;
            return (
              <div
                key={net.url}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                  isCurrent
                    ? 'border-sky-500/40 bg-sky-500/5'
                    : 'border-border bg-card hover:border-border/80',
                )}
                onClick={() => onNetworkChange(net.url)}>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    !status
                      ? 'bg-muted-foreground/30'
                      : status.connected
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                        : 'bg-rose-400',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        isCurrent ? 'text-sky-300' : 'text-foreground/80',
                      )}>
                      {net.name}
                    </span>
                    {status?.chainId && (
                      <span className="text-[10px] font-mono text-muted-foreground/40">
                        chain:{status.chainId}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/50 truncate">
                    {net.url}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {status?.connected ? (
                    <>
                      <div className="text-[10px] font-mono text-emerald-400">
                        {status.latency}ms
                      </div>
                      {status.blockNumber && (
                        <div className="text-[10px] font-mono text-muted-foreground/40">
                          #{status.blockNumber.toLocaleString()}
                        </div>
                      )}
                    </>
                  ) : status ? (
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Add custom */}
          <div className="p-3 mt-4 border border-dashed rounded-lg border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-2">
              Add Custom Network
            </p>
            <div className="space-y-2">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Network name"
                className="text-xs h-7"
              />
              <div className="flex gap-2">
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="RPC URL"
                  className="flex-1 text-xs h-7"
                />
                <Button
                  size="sm"
                  className="px-3 h-7"
                  onClick={addCustom}
                  disabled={!customUrl.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
