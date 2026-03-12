import { ipcMain } from 'electron';
import { execFileSync } from 'child_process';

//  Helper 
function git(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch { return ''; }
}

// Validasi branch name — hanya huruf, angka, dan karakter git yang valid
function isValidBranch(branch: string): boolean {
  return /^[a-zA-Z0-9._\-/]+$/.test(branch) && branch.length <= 255;
}

// Validasi commit message — blokir karakter null byte
function isValidMessage(msg: string): boolean {
  return msg.length > 0 && msg.length <= 1000 && !msg.includes('\0');
}

//  IPC Handlers 
export function registerGitHandlers(): void {

  ipcMain.handle('git-status', async (_, cwd: string) => {
    try {
      const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      if (!branch) return null;

      const remoteUrl = git(['remote', 'get-url', 'origin'], cwd);
      const aheadStr = git(['rev-list', '--count', '@{u}..HEAD'], cwd);
      const behindStr = git(['rev-list', '--count', 'HEAD..@{u}'], cwd);
      const raw = git(['status', '--porcelain'], cwd);

      const ahead = parseInt(aheadStr || '0');
      const behind = parseInt(behindStr || '0');

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      raw.split('\n').filter(Boolean).forEach(l => {
        const [x, y] = [l[0], l[1]];
        const file = l.slice(3);
        if (x !== ' ' && x !== '?') staged.push(file);
        if (y === 'M' || y === 'D') unstaged.push(file);
        if (l.startsWith('??')) untracked.push(file);
      });

      return {
        branch,
        ahead: isNaN(ahead) ? 0 : ahead,
        behind: isNaN(behind) ? 0 : behind,
        staged,
        unstaged,
        untracked,
        remoteUrl,
      };
    } catch { return null; }
  });

  ipcMain.handle('git-branches', async (_, cwd: string) => {
    try {
      return git(['branch', '-a'], cwd)
        .split('\n')
        .filter(Boolean)
        .map(b => ({
          name: b.replace(/^\*?\s+/, '').trim(),
          current: b.startsWith('*'),
          remote: b.trim().startsWith('remotes/'),
        }));
    } catch { return []; }
  });

  ipcMain.handle('git-log', async (_, cwd: string) => {
    try {
      return git(['log', '--oneline', '--format=%H|%h|%s|%an|%ar', '-20'], cwd)
        .split('\n')
        .filter(Boolean)
        .map(l => {
          const [hash, shortHash, message, author, date] = l.split('|');
          return { hash, shortHash, message, author, date };
        });
    } catch { return []; }
  });

  ipcMain.handle('git-diff', async (
    _,
    { cwd, file }: { cwd: string; file?: string; },
  ) => {
    try {
      const args = file
        ? ['diff', 'HEAD', '--', file]
        : ['diff', 'HEAD'];
      return git(args, cwd);
    } catch { return ''; }
  });

  ipcMain.handle('git-commit', async (
    _,
    { cwd, message, push }: { cwd: string; message: string; push: boolean; },
  ) => {
    if (!isValidMessage(message)) return { success: false, error: 'Invalid commit message' };
    try {
      git(['add', '-A'], cwd);
      git(['commit', '-m', message], cwd);
      if (push) git(['push'], cwd);
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('git-checkout', async (
    _,
    { cwd, branch, create }: { cwd: string; branch: string; create: boolean; },
  ) => {
    if (!isValidBranch(branch)) return { success: false, error: 'Invalid branch name' };
    try {
      const args = create ? ['checkout', '-b', branch] : ['checkout', branch];
      git(args, cwd);
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('git-pull', async (_, cwd: string) => {
    try { git(['pull'], cwd); return { success: true }; }
    catch (e) { return { success: false, error: String(e) }; }
  });
}