import { ipcMain, shell } from 'electron';
import axios from 'axios';
import { deleteStorage, getStorage, setStorage } from '../../database/storage';
import { checkUserRoles } from '../services/discord.api.service';

//  Pending login promise 
let resolveLogin: ((user: any) => void) | null = null;
let rejectLogin: ((err: any) => void) | null = null;

//  Called from main/index.ts when hardhatstudio://callback?code=xxx is received
export async function handleDiscordCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');

    if (!code) {
      rejectLogin?.(new Error('No code in callback URL'));
      return;
    }

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    });

    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userRes.data;

    await setStorage('discord_access_token', accessToken);
    await setStorage('discord_user', user);

    resolveLogin?.(user);
  } catch (err) {
    rejectLogin?.(err);
  } finally {
    resolveLogin = null;
    rejectLogin = null;
  }
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

  ipcMain.handle('discord-login', async () => {
    resolveLogin = null;
    rejectLogin = null;

    await deleteStorage('discord_access_token');
    await deleteStorage('discord_user');

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;

    const authUrl =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=identify`;

    return new Promise((resolve, reject) => {
      resolveLogin = resolve;
      rejectLogin = reject;

      const timeout = setTimeout(() => {
        resolveLogin = null;
        rejectLogin = null;
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);

      const originalResolve = resolve;
      const originalReject = reject;
      resolveLogin = (user) => { clearTimeout(timeout); originalResolve(user); };
      rejectLogin = (err) => { clearTimeout(timeout); originalReject(err); };

      shell.openExternal(authUrl);
    });
  });
}