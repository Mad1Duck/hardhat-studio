//
//  InlineWcQr — WalletConnect QR rendered directly in UI (no popup)
//
import { useRef, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

let _qrScriptLoaded = false;
function loadQrScript(): Promise<void> {
  if (_qrScriptLoaded || (window as any).QRCode) {
    _qrScriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => {
      _qrScriptLoaded = true;
      res();
    };
    s.onerror = () => rej(new Error('QRCode CDN load failed'));
    document.head.appendChild(s);
  });
}

const WALLET_DEEPLINKS: Record<string, string> = {
  '🦊 MetaMask': 'metamask://wc?uri=',
  '🛡️ Trust': 'trust://wc?uri=',
  '🔵 Coinbase': 'cbwallet://wc?uri=',
  '🐰 Rabby': 'rabby://wc?uri=',
};

export function InlineWcQr({
  uri,
  loading,
  error,
  onManual,
}: {
  uri: string | null;
  loading: boolean;
  error: string | null;
  onManual: (addr: string, chainId: number) => Promise<void>;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [addr, setAddr] = useState('');
  const [chainId, setChainId] = useState(11155111);
  const [addrOk, setAddrOk] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!uri || !qrRef.current) return;
    loadQrScript()
      .then(() => {
        if (!qrRef.current) return;
        qrRef.current.innerHTML = '';
        new (window as any).QRCode(qrRef.current, {
          text: uri,
          width: 148,
          height: 148,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: (window as any).QRCode.CorrectLevel.M,
        });
      })
      .catch(console.warn);
  }, [uri]);

  return (
    <div className="overflow-hidden border rounded-xl border-border/50 bg-card/60">
      {/* QR + wallet tiles */}
      <div className="flex gap-3 p-3">
        <div className="flex-shrink-0 w-[162px] h-[162px] rounded-lg bg-white flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 rounded-full border-violet-300 border-t-violet-600 animate-spin" />
              <span className="text-[9px] text-gray-400">Loading...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-1 px-3 text-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-[9px] text-red-400 leading-tight">{error}</span>
            </div>
          )}
          {uri && <div ref={qrRef} />}
        </div>

        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
            <span className="text-[10px] font-semibold text-blue-300">WalletConnect v2</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Scan QR or click wallet to deep link to mobile app.
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(WALLET_DEEPLINKS).map(([label, prefix]) => (
              <button
                key={label}
                disabled={!uri}
                onClick={() => window.open(prefix + encodeURIComponent(uri ?? ''), '_blank')}
                className="flex flex-col items-center gap-1 py-2 text-center transition-all border rounded-lg border-border/50 bg-muted/20 hover:border-violet-500/50 hover:bg-violet-500/10 disabled:opacity-30 disabled:pointer-events-none">
                <span className="text-base leading-none">{label.split(' ')[0]}</span>
                <span className="text-[8px] text-muted-foreground leading-none">
                  {label.split(' ').slice(1).join(' ')}
                </span>
              </button>
            ))}
          </div>
          {uri && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(uri);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/40 bg-muted/20 hover:border-violet-500/40 transition-all text-left w-full">
              <code className="flex-1 text-[8px] text-muted-foreground font-mono truncate">
                {uri.slice(0, 36)}…
              </code>
              <span className="text-[8px] text-violet-400 flex-shrink-0">
                {copied ? '✓' : 'Copy'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Manual input */}
      {/* <div className="flex items-center gap-2 px-3">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          atau input manual
        </span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
      <div className="p-3 pt-2 space-y-2">
        <input
          type="text"
          value={addr}
          placeholder="0xAbc...def"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setAddr(e.target.value);
            setAddrOk(/^0x[0-9a-fA-F]{40}$/.test(e.target.value.trim()));
          }}
          className="w-full px-3 py-2 text-[10px] font-mono rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/60"
        />
        <div className="flex gap-2">
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-border/50 bg-muted/20 text-foreground focus:outline-none focus:border-violet-500/60">
            <optgroup label="Mainnet">
              <option value={1}>Ethereum</option>
              <option value={137}>Polygon</option>
              <option value={42161}>Arbitrum</option>
              <option value={8453}>Base</option>
            </optgroup>
            <optgroup label="Testnet">
              <option value={11155111}>Sepolia 🧪</option>
              <option value={84532}>Base Sepolia 🧪</option>
            </optgroup>
          </select>
          <button
            disabled={!addrOk}
            onClick={() => onManual(addr.trim(), chainId)}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-30 disabled:pointer-events-none">
            ✓ Verifikasi
          </button>
        </div>
      </div> */}
    </div>
  );
}
