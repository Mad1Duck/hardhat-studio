import { ipcMain } from 'electron';
import { execSync } from 'child_process';

//  Helper 
function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch { return ''; }
}

//  IPC Handlers 
export function registerGitHandlers(): void {

  ipcMain.handle('git-status', async (_, cwd: string) => {
    try {
      const branch = git('rev-parse --abbrev-ref HEAD', cwd);
      if (!branch) return null;

      const remoteUrl = git('remote get-url origin', cwd);
      const ahead = parseInt(git('rev-list --count @{u}..HEAD', cwd) || '0');
      const behind = parseInt(git('rev-list --count HEAD..@{u}', cwd) || '0');
      const raw = git('status --porcelain', cwd);

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
      return git('branch -a', cwd)
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
      return git('log --oneline --format="%H|%h|%s|%an|%ar" -20', cwd)
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
      return git(file ? `diff HEAD -- "${file}"` : 'diff HEAD', cwd);
    } catch { return ''; }
  });

  ipcMain.handle('git-commit', async (
    _,
    { cwd, message, push }: { cwd: string; message: string; push: boolean; },
  ) => {
    try {
      git('add -A', cwd);
      git(`commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
      if (push) git('push', cwd);
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('git-checkout', async (
    _,
    { cwd, branch, create }: { cwd: string; branch: string; create: boolean; },
  ) => {
    try {
      git(create ? `checkout -b ${branch}` : `checkout ${branch}`, cwd);
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('git-pull', async (_, cwd: string) => {
    try { git('pull', cwd); return { success: true }; }
    catch (e) { return { success: false, error: String(e) }; }
  });
}
