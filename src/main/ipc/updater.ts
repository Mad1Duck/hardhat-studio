import { ipcMain, shell, BrowserWindow } from 'electron';

let autoUpdater: any = null;

//  Setup 
export function initAutoUpdater(isDev: boolean): void {
  if (isDev) return;

  const { autoUpdater: au } = require('electron-updater');
  const log = require('electron-log');

  au.logger = log;
  au.logger.transports.file.level = 'info';
  au.autoDownload = false;
  au.autoInstallOnAppQuit = true;
  au.allowPrerelease = false;
  au.allowDowngrade = false;

  autoUpdater = au;
}

export function setupAutoUpdaterWindow(win: BrowserWindow): void {
  if (!autoUpdater) return;

  const send = (payload: object) =>
    win.webContents.send('update-status', payload);

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }));
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }));
  autoUpdater.on('update-available', (info: any) => {
    send({ type: 'available', version: info.version, releaseNotes: info.releaseNotes });
    if (process.env.AUTO_UPDATE === 'true') autoUpdater.downloadUpdate();
  });
  autoUpdater.on('download-progress', (p: any) =>
    send({ type: 'download-progress', percent: p.percent }));
  autoUpdater.on('update-downloaded', (info: any) =>
    send({ type: 'downloaded', version: info.version }));
  autoUpdater.on('error', (e: Error) =>
    send({ type: 'error', message: e.message }));

  // Check on startup after 5s, then every hour
  setTimeout(() => autoUpdater.checkForUpdates(), 5_000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => { }), 60 * 60 * 1_000);
}

//  IPC Handlers 
export function registerUpdaterHandlers(): void {
  ipcMain.handle('force-update', async () => {
    if (!autoUpdater) return false;
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return !!result;
  });

  ipcMain.handle('open-download-page', async () => {
    shell.openExternal('https://github.com/RaihanArdianata/hardhat-studio/releases');
  });

  ipcMain.handle('check-for-update', async () => {
    if (!autoUpdater) return false;
    try { await autoUpdater.checkForUpdates(); return true; } catch { return false; }
  });

  ipcMain.handle('download-update', async () => {
    if (!autoUpdater) return false;
    try { await autoUpdater.downloadUpdate(); return true; } catch { return false; }
  });

  ipcMain.handle('install-update', async () => {
    if (!autoUpdater) return false;
    autoUpdater.quitAndInstall();
    return true;
  });
}
