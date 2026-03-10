//
//  NetworkManager — shows all supported chains + lets user add custom ones
//
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  useLicense,
  THEGRAPH_ENDPOINTS,
  CHAIN_NAMES,
  addCustomChain,
} from '@/integrations/license';
import { cn } from '@/lib/utils';
import { CHAIN_ICONS, TESTNET_IDS } from '../../config/constants';

type ChainEntry = { chainId: number; name: string; endpoint: string; isTestnet: boolean };

export function NetworkManager() {
  const { refresh } = useLicense();
  const [customName, setCustomName] = useState('');
  const [customChainId, setCustomChainId] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [chains, setChains] = useState<ChainEntry[]>(() =>
    Object.entries(THEGRAPH_ENDPOINTS).map(([id, ep]) => {
      const cid = Number(id);
      return {
        chainId: cid,
        name: CHAIN_NAMES[cid] ?? `Chain ${cid}`,
        endpoint: ep,
        isTestnet: TESTNET_IDS.has(cid),
      };
    }),
  );

  const handleAdd = () => {
    setAddError('');
    setAddSuccess('');
    const cid = parseInt(customChainId.trim(), 10);
    if (isNaN(cid) || cid <= 0) return setAddError('Chain ID harus angka valid');
    if (!customName.trim()) return setAddError('Nama chain wajib diisi');
    if (!customEndpoint.trim().startsWith('http')) return setAddError('Endpoint harus URL valid');

    addCustomChain(cid, customName.trim(), customEndpoint.trim());
    setChains((prev) => {
      const exists = prev.find((c) => c.chainId === cid);
      if (exists)
        return prev.map((c) =>
          c.chainId === cid
            ? { ...c, name: customName.trim(), endpoint: customEndpoint.trim() }
            : c,
        );
      return [
        ...prev,
        {
          chainId: cid,
          name: customName.trim(),
          endpoint: customEndpoint.trim(),
          isTestnet: false,
        },
      ];
    });
    setAddSuccess(`✓ ${customName} (${cid}) ditambahkan`);
    setCustomName('');
    setCustomChainId('');
    setCustomEndpoint('');
    setTimeout(() => setAddSuccess(''), 3000);
  };

  const mainnets = chains.filter((c) => !c.isTestnet);
  const testnets = chains.filter((c) => c.isTestnet);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Jaringan yang Di-search
        </p>
        <button
          onClick={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn('w-2.5 h-2.5', refreshing && 'animate-spin')} />
          {refreshing ? 'Searching…' : 'Search Ulang'}
        </button>
      </div>

      {/* Mainnet */}
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest px-1">
          Mainnet
        </p>
        {mainnets.map(({ chainId, name }) => (
          <div
            key={chainId}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/30">
            <span className="text-sm leading-none">{CHAIN_ICONS[chainId] ?? '🔗'}</span>
            <span className="flex-1 text-[10px] text-foreground font-medium">{name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/40">{chainId}</span>
          </div>
        ))}
      </div>

      {/* Testnet */}
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest px-1">
          Testnet
        </p>
        {testnets.map(({ chainId, name }) => (
          <div
            key={chainId}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <span className="text-sm leading-none">🧪</span>
            <span className="flex-1 text-[10px] text-amber-400/80 font-medium">{name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/40">{chainId}</span>
          </div>
        ))}
      </div>

      {/* Add custom */}
      <div className="overflow-hidden border border-border/40 rounded-xl">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 w-full px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground bg-muted/10 hover:bg-muted/20 transition-colors">
          <span className="text-sm">{showAdd ? '▾' : '▸'}</span>
          <span className="font-medium">Tambah Network Custom</span>
          <span className="ml-auto text-[9px] opacity-50">The Graph endpoint</span>
        </button>
        {showAdd && (
          <div className="p-3 space-y-2 border-t border-border/30">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nama (e.g. Monad Testnet)"
                className="px-2.5 py-1.5 text-[10px] rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/60"
              />
              <input
                value={customChainId}
                onChange={(e) => setCustomChainId(e.target.value)}
                placeholder="Chain ID (e.g. 10143)"
                className="px-2.5 py-1.5 text-[10px] rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/60"
              />
            </div>
            <input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://api.studio.thegraph.com/query/.../sablier-flow-.../version/latest"
              className="w-full px-2.5 py-1.5 text-[10px] font-mono rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/60"
            />
            {addError && <p className="text-[9px] text-red-400">{addError}</p>}
            {addSuccess && <p className="text-[9px] text-emerald-400">{addSuccess}</p>}
            <button
              onClick={handleAdd}
              className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-semibold transition-colors">
              Tambahkan & Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
