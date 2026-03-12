import { ipcMain } from 'electron';
import { networkInterfaces } from 'os';
import * as net from 'net';

function getLanIp(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function checkPort(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;

    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function isHardhatNode(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'web3_clientVersion', params: [] }),
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json() as { result?: string; };
    return typeof data.result === 'string';
  } catch {
    return false;
  }
}

export function registerCollabHandlers(): void {
  ipcMain.handle('get-lan-ip', () => getLanIp());

  ipcMain.handle('check-hardhat-port', async (_, port: number) => {
    try {
      const isOpen = await checkPort(port);
      if (!isOpen) return { running: false, port };

      const isHardhat = await isHardhatNode(port);
      return { running: isHardhat, port };
    } catch {
      return { running: false, port };
    }
  });

  ipcMain.handle('detect-hardhat-node', async () => {
    const COMMON_PORTS = [8545, 8546, 8547, 7545, 9545];

    for (const port of COMMON_PORTS) {
      const isOpen = await checkPort(port);
      if (isOpen) {
        const isHardhat = await isHardhatNode(port);
        if (isHardhat) {
          return { found: true, port, rpcUrl: `http://127.0.0.1:${port}` };
        }
      }
    }

    return { found: false, port: null, rpcUrl: null };
  });
}