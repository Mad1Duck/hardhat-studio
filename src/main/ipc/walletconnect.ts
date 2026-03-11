import { ipcMain, BrowserWindow } from 'electron';

//  State 
let _wcClient: any = null;
let _wcLastResult: WcResult | null = null;
let wcPendingResolve: ((result: WcResult | null) => void) | null = null;

interface WcResult {
  address: string;
  chainId: number;
}

//  Helpers 
export function sendWcApproved(
  win: BrowserWindow | null,
  result: WcResult | null,
): void {
  if (result) _wcLastResult = result;
  if (wcPendingResolve) { wcPendingResolve(result); wcPendingResolve = null; }
  if (win && !win.isDestroyed()) win.webContents.send('wc-approved', result);
}

/**
 * Get or init the SignClient singleton.
 * On restart, restores persisted sessions from its built-in store — no re-scan needed.
 */
async function getOrInitWcClient(): Promise<any> {
  if (_wcClient) return _wcClient;

  const projectId =
    process.env.VITE_WC_PROJECT_ID ||
    process.env.WC_PROJECT_ID ||
    '3721e5967517bd23fc60c504c8ded53c';

  // Polyfill crypto for Node < 19
  if (!globalThis.crypto || !(globalThis.crypto as any).getRandomValues) {
    const nodeCrypto = require('node:crypto')
      ; (globalThis as any).crypto = nodeCrypto.webcrypto;
  }

  const { SignClient } = require('@walletconnect/sign-client');
  _wcClient = await SignClient.init({
    projectId,
    metadata: {
      name: 'Hardhat Studio',
      description: 'Professional Hardhat Development Environment',
      url: 'https://hardhatstudio.dev',
      icons: ['https://hardhatstudio.dev/icon.png'],
    },
  });

  console.log(
    '[WC] Client initialised, existing sessions:',
    _wcClient.session?.getAll?.()?.length ?? 0,
  );
  return _wcClient;
}

//  IPC Handlers 
export function registerWalletConnectHandlers(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('wc-session-approved', async (_, result: WcResult) => {
    sendWcApproved(getWin(), result);
  });

  ipcMain.handle('wc-poll-result', async () => {
    const r = _wcLastResult;
    _wcLastResult = null;
    return r;
  });

  ipcMain.handle('wc-has-session', async (): Promise<boolean> => {
    try {
      const client = await getOrInitWcClient();
      return (client.session?.getAll?.() ?? []).length > 0;
    } catch {
      return false;
    }
  });

  ipcMain.handle('wc-get-uri', async (): Promise<{ uri: string; } | { error: string; }> => {
    const projectId =
      process.env.VITE_WC_PROJECT_ID ||
      process.env.WC_PROJECT_ID ||
      '3721e5967517bd23fc60c504c8ded53c';

    if (!projectId) return { error: 'NO_PROJECT_ID' };

    try {
      const client = await getOrInitWcClient();
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          eip155: {
            methods: [
              'eth_sendTransaction', 'personal_sign',
              'eth_sign', 'eth_accounts', 'eth_chainId',
            ],
            chains: [
              'eip155:1', 'eip155:137', 'eip155:42161',
              'eip155:56', 'eip155:10', 'eip155:8453', 'eip155:11155111',
            ],
            events: ['chainChanged', 'accountsChanged'],
          },
        },
      });

      if (!uri) return { error: 'NO_URI' };

      approval()
        .then((session: any) => {
          try {
            const ns =
              session.namespaces?.eip155 ||
              (Object.values(session.namespaces || {}) as any[])[0];
            const accounts: string[] = ns?.accounts ?? [];
            if (!accounts.length) { sendWcApproved(getWin(), null); return; }

            let addr: string, chainId: number;
            if (accounts[0].includes(':')) {
              const [, chain, address] = accounts[0].split(':');
              addr = address;
              chainId = parseInt(chain || '1');
            } else {
              addr = accounts[0];
              chainId = 1;
            }
            sendWcApproved(getWin(), { address: addr, chainId });
          } catch {
            sendWcApproved(getWin(), null);
          }
        })
        .catch((e: any) => console.error('[WC] approval rejected:', e?.message));

      return { uri };
    } catch (err: any) {
      return { error: err?.message ?? 'INIT_FAILED' };
    }
  });

  ipcMain.handle(
    'wc-send-transaction',
    async (
      _,
      { from, to, data, chainId }: { from: string; to: string; data: string; chainId: number; },
    ): Promise<{ txHash: string; } | { error: string; }> => {
      try {
        const client = await getOrInitWcClient();
        const sessions = client.session?.getAll?.() ?? [];

        if (!sessions.length) {
          return {
            error: 'NO_WC_SESSION: No active WalletConnect session. Please reconnect your wallet via QR.',
          };
        }

        const session = sessions[sessions.length - 1];
        console.log(`[WC] Sending tx via session ${session.topic.slice(0, 8)}… chainId=eip155:${chainId}`);

        const txHash = await client.request({
          topic: session.topic,
          chainId: `eip155:${chainId}`,
          request: {
            method: 'eth_sendTransaction',
            params: [{ from, to, data }],
          },
        });

        return { txHash };
      } catch (err: any) {
        return { error: err?.message ?? String(err) };
      }
    },
  );
}
