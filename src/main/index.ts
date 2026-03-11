import { app, shell, BrowserWindow } from 'electron';
import { join } from 'path';
import { config } from 'dotenv';

// Load .env
const envPath = app.isPackaged
  ? join(process.resourcesPath, '.env')
  : join(__dirname, '../../.env');
config({ path: envPath });

// IPC modules
import { initAutoUpdater, setupAutoUpdaterWindow, registerUpdaterHandlers } from './ipc/updater';
import { registerWalletConnectHandlers } from './ipc/walletconnect';
import { registerDiscordHandlers, handleDiscordCallback } from './ipc/discord';
import { registerLicenseHandlers } from './ipc/license';
import { registerProjectHandlers } from './ipc/project';
import { registerProcessHandlers, getProcesses } from './ipc/process';
import { registerFilesystemHandlers } from './ipc/filesystem';
import { registerGitHandlers } from './ipc/git';
import { registerEvmHandlers } from './ipc/evm';
import { registerAnalysisHandlers } from './ipc/analysis';

// Constants
const isDev = process.env.NODE_ENV === 'development' || !!process.env['ELECTRON_RENDERER_URL'];
const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'build/icon.png')
  : join(__dirname, '../../build/icon.png');

// Window ref
let mainWindow: BrowserWindow | null = null;
const getWin = () => mainWindow;

//  Register custom protocol 
app.setAsDefaultProtocolClient('hardhatstudio'); // 👈 tambah ini

// Windows / Linux: handle deep link via second-instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_, argv) => {
    // Focus window jika ada
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Cari URL hardhatstudio:// dari argv
    const url = argv.find(arg => arg.startsWith('hardhatstudio://'));
    if (url) handleDiscordCallback(url); // 👈
  });
}

// macOS: handle deep link via open-url
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDiscordCallback(url); // 👈
});

// Window creation
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#090c12',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show();
    setupAutoUpdaterWindow(mainWindow!);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Register all IPC handlers
function registerAllHandlers(): void {
  registerUpdaterHandlers();
  registerWalletConnectHandlers(getWin);
  registerDiscordHandlers();
  registerLicenseHandlers();
  registerProjectHandlers(getWin);
  registerProcessHandlers(getWin);
  registerFilesystemHandlers(getWin);
  registerGitHandlers();
  registerEvmHandlers();
  registerAnalysisHandlers(getWin);
}

// App lifecycle
initAutoUpdater(isDev);
registerAllHandlers();

app.whenReady().then(() => {
  app.setAppUserModelId('com.hardhatstudio');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  getProcesses().forEach(p => { try { p.kill(); } catch { } });
  if (process.platform !== 'darwin') app.quit();
});