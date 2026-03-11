import { ipcMain, shell } from 'electron';
import axios from 'axios';
import http from 'http';
import { deleteStorage, getStorage, setStorage } from '../../database/storage';
import { checkUserRoles } from '../services/discord.api.service';

const isDev = process.env.NODE_ENV === 'development';
const DEV_REDIRECT_URI = 'http://localhost:4399/callback';

let resolveLogin: ((user: any) => void) | null = null;
let rejectLogin: ((err: any) => void) | null = null;

export async function handleDiscordCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (!code) {
      rejectLogin?.(new Error('No code in callback URL'));
      return;
    }
    const user = await exchangeToken(code, process.env.DISCORD_REDIRECT_URI ?? "hardhatstudio://callback");
    resolveLogin?.(user);
  } catch (err) {
    rejectLogin?.(err);
  } finally {
    resolveLogin = null;
    rejectLogin = null;
  }
}

// ── Token exchange helper ──────────────────────────────────────────────────────
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

  const userRes = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
  });

  await setStorage('discord_access_token', tokenRes.data.access_token);
  await setStorage('discord_user', userRes.data);
  return userRes.data;
}

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

  ipcMain.handle('discord-login', async () => {
    resolveLogin = null;
    rejectLogin = null;

    await deleteStorage('discord_access_token');
    await deleteStorage('discord_user');

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? "hardhatstudio://callback";

    console.log('[Discord] isDev:', isDev);
    console.log('[Discord] CLIENT_ID:', CLIENT_ID);
    console.log('[Discord] REDIRECT_URI:', REDIRECT_URI);

    const authUrl =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=identify`;

    return new Promise((resolve, reject) => {
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
        if (err) reject(err);
        else resolve(user);
      };

      let server: http.Server | null = null;

      if (isDev) {
        // Dev: HTTP server tangkap callback
        server = http.createServer(async (req, res) => {
          const url = new URL(req.url!, DEV_REDIRECT_URI);
          const code = url.searchParams.get('code');
          if (!code) return;

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h2>Login berhasil. Silakan kembali ke aplikasi.</h2>');
          server?.close();

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
      } else {
        resolveLogin = (user) => done(user);
        rejectLogin = (err) => done(undefined, err);
      }

      shell.openExternal(authUrl);
    });
  });
}