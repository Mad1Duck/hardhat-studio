import { ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { BrowserWindow } from 'electron';

//  IPC Handlers 
export function registerFilesystemHandlers(getWin: () => BrowserWindow | null): void {

  //  Folder picker 
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(getWin()!, {
      properties: ['openDirectory'],
      title: 'Select Hardhat Project Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  //  Basic file I/O 
  ipcMain.handle('read-file', async (_, filePath: string) => {
    try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
  });

  ipcMain.handle('write-file', async (
    _,
    { filePath, content }: { filePath: string; content: string; },
  ) => {
    try { fs.writeFileSync(filePath, content, 'utf-8'); return true; } catch { return false; }
  });

  ipcMain.handle('list-dir', async (_, dirPath: string) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath, { withFileTypes: true }).map(e => ({
        name: e.name,
        isDir: e.isDirectory(),
        path: path.join(dirPath, e.name),
      }));
    } catch { return []; }
  });

  //  Open external URL / editor 
  ipcMain.handle('open-external', async (_, url: string) => {
    // Hanya izinkan https:// dan http:// — blokir file://, javascript:, dll
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    } catch { return false; }
    return shell.openExternal(url);
  });

  ipcMain.handle('open-in-editor', async (_, filePath: string) => {
    const editors = ['code', 'cursor', 'subl', 'vim', 'nano'];
    for (const editor of editors) {
      try {
        spawn(editor, [filePath], { detached: true, stdio: 'ignore' });
        return true;
      } catch { /* try next */ }
    }
    try { await shell.openPath(filePath); return true; } catch { return false; }
  });

  //  .env read / write 
  ipcMain.handle('read-env', async (_, folderPath: string) => {
    const envPath = path.join(folderPath, '.env');
    if (!fs.existsSync(envPath)) return [];
    try {
      return fs.readFileSync(envPath, 'utf-8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
        .map(l => {
          const idx = l.indexOf('=');
          if (idx === -1) return null;
          return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
        })
        .filter(Boolean);
    } catch { return []; }
  });

  ipcMain.handle('write-env', async (
    _,
    { folderPath, entries }: { folderPath: string; entries: Array<{ key: string; value: string; }>; },
  ) => {
    try {
      fs.writeFileSync(
        path.join(folderPath, '.env'),
        entries.map(e => `${e.key}=${e.value}`).join('\n'),
        'utf-8',
      );
      return true;
    } catch { return false; }
  });

  //  Export logs dialog 
  ipcMain.handle('export-logs', async (
    _,
    { content, filename }: { content: string; filename: string; },
  ) => {
    const result = await dialog.showSaveDialog(getWin()!, {
      defaultPath: filename,
      filters: [{ name: 'Log Files', extensions: ['log', 'txt', 'json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    try { fs.writeFileSync(result.filePath, content, 'utf-8'); return true; } catch { return false; }
  });

  //  Save / load workspace 
  ipcMain.handle('save-workspace', async (
    _,
    { workspace, savePath }: { workspace: unknown; savePath?: string; },
  ) => {
    const filePath = savePath ?? (await dialog.showSaveDialog(getWin()!, {
      defaultPath: 'workspace.hhws',
      filters: [{ name: 'Hardhat Studio Workspace', extensions: ['hhws', 'json'] }],
    })).filePath;
    if (!filePath) return null;
    try { fs.writeFileSync(filePath, JSON.stringify(workspace, null, 2), 'utf-8'); return filePath; }
    catch { return null; }
  });

  ipcMain.handle('load-workspace', async (_, loadPath?: string) => {
    const filePath = loadPath ?? (await dialog.showOpenDialog(getWin()!, {
      filters: [{ name: 'Hardhat Studio Workspace', extensions: ['hhws', 'json'] }],
      properties: ['openFile'],
    })).filePaths?.[0];
    if (!filePath || !fs.existsSync(filePath)) return null;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
  });

  //  Generic file-picker dialogs (used by NotesEditorPanel) 
  ipcMain.handle('show-open-file-dialog', async (
    _,
    opts: { filters?: Array<{ name: string; extensions: string[]; }>; title?: string; } = {},
  ) => {
    const result = await dialog.showOpenDialog(getWin()!, {
      properties: ['openFile'],
      title: opts.title ?? 'Open File',
      filters: opts.filters ?? [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });

  ipcMain.handle('show-save-file-dialog', async (
    _,
    opts: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[]; }>;
      title?: string;
    } = {},
  ) => {
    const result = await dialog.showSaveDialog(getWin()!, {
      defaultPath: opts.defaultPath ?? 'untitled.txt',
      title: opts.title ?? 'Save File',
      filters: opts.filters ?? [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePath ?? null;
  });

  //  Audit notes 
  ipcMain.handle('save-audit-notes', async (
    _,
    { folderPath, notes }: { folderPath: string; notes: unknown[]; },
  ) => {
    try {
      const p = path.join(folderPath, '.hardhat-studio', 'audit-notes.json');
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(notes, null, 2), 'utf-8');
      return true;
    } catch { return false; }
  });

  ipcMain.handle('load-audit-notes', async (_, folderPath: string) => {
    try {
      const p = path.join(folderPath, '.hardhat-studio', 'audit-notes.json');
      if (!fs.existsSync(p)) return [];
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return []; }
  });
}