import { ipcMain, shell, app, BrowserWindow } from 'electron';
import axios from 'axios';
import http from 'http';
import { deleteStorage, getStorage, setStorage } from '../../database/storage';
import { checkUserRoles } from '../services/discord.api.service';

const DEV_REDIRECT_URI = 'http://localhost:4399/callback';
const PROD_REDIRECT_URI = 'hardhatstudio://callback';

let resolveLogin: ((user: any) => void) | null = null;
let rejectLogin: ((err: any) => void) | null = null;

// ─── Deep link handler (dipanggil dari main.ts) ───────────────────────────────

export async function handleDiscordCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (!code) return;

    const isDev = !app.isPackaged;

    if (isDev) {
      // Dev pakai localhost HTTP server, deep link tidak dipakai
      return;
    }

    // Production: jika ada resolveLogin (flow dari discord-login), selesaikan promise-nya
    if (resolveLogin) {
      try {
        const user = await exchangeToken(code, PROD_REDIRECT_URI);
        resolveLogin(user);
      } catch (err) {
        rejectLogin?.(err);
      }
      return;
    }

    // Fallback: kirim code ke renderer via IPC (jika dipanggil di luar flow discord-login)
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('oauth-callback', { code });

  } catch (err) {
    rejectLogin?.(err);
  }
}

// ─── Token exchange ───────────────────────────────────────────────────────────

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

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

export function registerDiscordHandlers(): void {

  // Get cached user
  ipcMain.handle('get-user', async () => {
    return getStorage('discord_user');
  });

  // Logout
  ipcMain.handle('logout', async () => {
    await deleteStorage('discord_user');
    await deleteStorage('discord_access_token');
  });

  // Check Discord role via bot token
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

  // Exchange code (dipanggil renderer via useDiscordAuth jika pakai fallback IPC flow)
  ipcMain.handle('discord-exchange-code', async (_, code: string) => {
    const isDev = !app.isPackaged;
    const redirectUri = isDev ? DEV_REDIRECT_URI : PROD_REDIRECT_URI;
    return exchangeToken(code, redirectUri);
  });

  // Login — buka browser Discord OAuth
  ipcMain.handle('discord-login', async () => {
    resolveLogin = null;
    rejectLogin = null;

    await deleteStorage('discord_access_token');
    await deleteStorage('discord_user');

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
    const isDev = !app.isPackaged;
    const REDIRECT_URI = isDev ? DEV_REDIRECT_URI : PROD_REDIRECT_URI;

    console.log('[Discord] isDev:', isDev);
    console.log('[Discord] app.isPackaged:', app.isPackaged);
    console.log('[Discord] CLIENT_ID:', CLIENT_ID);
    console.log('[Discord] REDIRECT_URI:', REDIRECT_URI);

    const authUrl =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=identify`;

    return new Promise((resolve, reject) => {
      let server: http.Server | null = null;

      const timeout = setTimeout(() => {
        resolveLogin = null;
        rejectLogin = null;
        server?.close();
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);

      const done = (user?: any, err?: any) => {
        clearTimeout(timeout);
        resolveLogin = null;
        rejectLogin = null;
        server?.close();
        if (err) reject(err);
        else resolve(user);
      };

      if (isDev) {
        // Dev: HTTP server tangkap redirect dari localhost
        server = http.createServer(async (req, res) => {
          if (!req.url) return;

          const reqUrl = new URL(req.url, DEV_REDIRECT_URI);
          const code = reqUrl.searchParams.get('code');
          if (!code) return;

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h2>Login berhasil. Silakan kembali ke aplikasi.</h2>');

          try {
            const user = await exchangeToken(code, DEV_REDIRECT_URI);
            done(user);
          } catch (err) {
            done(undefined, err);
          }
        });

        server.listen(4399, () => {
          console.log('[Discord] Listening on http://localhost:4399/callback');
        });

        server.on('error', (err) => {
          console.error('[Discord] Server error:', err);
          done(undefined, err);
        });

      } else {
        // Production: tunggu deep link hardhatstudio://callback
        // handleDiscordCallback() akan resolve promise ini
        resolveLogin = (user) => done(user);
        rejectLogin = (err) => done(undefined, err);
      }

      shell.openExternal(authUrl);
    });
  });
}