import { ipcMain, shell, app, BrowserWindow } from 'electron';
import axios from 'axios';
import http from 'http';
import { deleteStorage, getStorage, setStorage } from '../../database/storage';
import { checkUserRoles } from '../services/discord.api.service';
import log from 'electron-log';

const CANDIDATE_PORTS = [4399, 4400, 4401, 4402];

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (i: number) => {
      if (i >= CANDIDATE_PORTS.length) {
        reject(new Error('Semua port kandidat sedang digunakan'));
        return;
      }
      const port = CANDIDATE_PORTS[i];
      const srv = require('net').createServer();
      srv.once('error', () => tryPort(i + 1));
      srv.listen(port, '127.0.0.1', () => {
        srv.close(() => resolve(port));
      });
    };
    tryPort(0);
  });
}

let resolveLogin: ((user: any) => void) | null = null;
let rejectLogin: ((err: any) => void) | null = null;

export async function handleDiscordCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (!code) return;

    const isDev = !app.isPackaged;

    if (isDev) {
      return;
    }

    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('oauth-callback', { code });

  } catch (err) {
    rejectLogin?.(err);
  }
}

//  Token exchange 

async function exchangeToken(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    client_secret: process.env.DISCORD_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await axios.post(
    'https://discord.com/api/oauth2/token',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  const { access_token } = tokenRes.data;

  const userRes = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  await setStorage('discord_access_token', access_token);
  await setStorage('discord_user', userRes.data);

  return userRes.data;
}

//  IPC Handlers 

export function registerDiscordHandlers(): void {

  ipcMain.handle('get-user', async () => {
    return getStorage('discord_user');
  });

  ipcMain.handle('logout', async () => {
    await deleteStorage('discord_user');
    await deleteStorage('discord_access_token');
  });

  ipcMain.handle('discord-check-role', async (
    _,
    { guildId, userId, roleIds }: { guildId: string; userId: string; roleIds: string[]; },
  ) => {
    const botToken = process.env.DISCORD_BOT_TOKEN ?? '';
    if (!botToken) {
      console.warn('[Discord] DISCORD_BOT_TOKEN not set in env');
      return false;
    }
    return checkUserRoles({ botToken, guildId, userId, roleIds });
  });

  ipcMain.handle('discord-exchange-code', async (_, code: string) => {
    const port = await getAvailablePort();
    const redirectUri = `http://localhost:${port}/callback`;
    return exchangeToken(code, redirectUri);
  });

  ipcMain.handle('discord-login', async () => {
    resolveLogin = null;
    rejectLogin = null;

    await deleteStorage('discord_access_token');
    await deleteStorage('discord_user');

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

    log.info('[Discord] app.isPackaged:', app.isPackaged);
    log.info('[Discord] CLIENT_ID:', CLIENT_ID ?? 'UNDEFINED!!!');

    const port = await getAvailablePort();
    const redirectUri = `http://localhost:${port}/callback`;

    const dynamicAuthUrl =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=identify`;

    return new Promise((resolve, reject) => {
      let server: http.Server | null = null;

      const timeout = setTimeout(() => {
        server?.close();
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);

      const done = (user?: any, err?: any) => {
        clearTimeout(timeout);
        server?.close();
        if (err) reject(err);
        else resolve(user);
      };

      server = http.createServer(async (req, res) => {
        if (!req.url) return;
        const reqUrl = new URL(req.url, redirectUri);
        const code = reqUrl.searchParams.get('code');
        if (!code) return;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login Successful</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --accent: hsl(30, 95%, 54%);
      --accent-dim: hsla(30, 95%, 54%, 0.12);
      --accent-border: hsla(30, 95%, 54%, 0.3);
      --accent-glow: hsla(30, 95%, 54%, 0.15);
    }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      font-family: 'DM Sans', sans-serif;
      overflow: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 60% 50% at 30% 40%, var(--accent-glow) 0%, transparent 70%),
        radial-gradient(ellipse 40% 60% at 75% 65%, hsla(30, 95%, 54%, 0.07) 0%, transparent 60%);
      pointer-events: none;
    }

    .card {
      position: relative;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 20px;
      padding: 52px 48px 44px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      backdrop-filter: blur(24px);
      animation: rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(28px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 15%; right: 15%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      border-radius: 999px;
    }

    .icon-wrap {
      width: 64px;
      height: 64px;
      margin: 0 auto 28px;
      background: var(--accent-dim);
      border: 1px solid var(--accent-border);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pop 0.5s 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    @keyframes pop {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }

    .icon-wrap svg {
      width: 28px; height: 28px;
      stroke: var(--accent);
      stroke-width: 2.5;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .icon-wrap svg path {
      stroke-dasharray: 40;
      stroke-dashoffset: 40;
      animation: draw 0.4s 0.6s ease forwards;
    }

    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }

    h1 {
      font-family: 'DM Serif Display', serif;
      font-size: 1.75rem;
      color: #f0f0ef;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      animation: fadein 0.5s 0.4s ease both;
    }

    p {
      font-size: 0.9rem;
      color: rgba(255,255,255,0.45);
      line-height: 1.65;
      animation: fadein 0.5s 0.5s ease both;
    }

    @keyframes fadein {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .divider {
      margin: 28px 0;
      height: 1px;
      background: rgba(255,255,255,0.07);
      animation: fadein 0.5s 0.55s ease both;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 16px;
      background: var(--accent-dim);
      border: 1px solid var(--accent-border);
      border-radius: 999px;
      font-size: 0.78rem;
      color: var(--accent);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 500;
      animation: fadein 0.5s 0.65s ease both;
    }

    .status-pill::before {
      content: '';
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 6px var(--accent);
      animation: pulse 1.8s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      <svg viewBox="0 0 24 24">
        <path d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h1>Login Successful</h1>
    <p>Authentication complete. You may close this tab and return to the application.</p>
    <div class="divider"></div>
    <span class="status-pill">Session active</span>
  </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);

        try {
          const user = await exchangeToken(code, redirectUri);
          done(user);
        } catch (err) {
          done(undefined, err);
        }
      });

      server.listen(port, () => {
        log.info(`[Discord] Listening on ${redirectUri}`);
      });

      server.on('error', (err) => {
        log.error('[Discord] Server error:', err);
        done(undefined, err);
      });

      shell.openExternal(dynamicAuthUrl);
    });
  });
}