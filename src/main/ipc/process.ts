import { ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'

// ── State ──────────────────────────────────────────────────────────────────────
const processes = new Map<string, ChildProcess>()

export function getProcesses() { return processes }

// ── IPC Handlers ───────────────────────────────────────────────────────────────
export function registerProcessHandlers(getWin: () => BrowserWindow | null): void {

  ipcMain.handle('run-command', async (
    _,
    { id, command, cwd }: { id: string; command: string; cwd: string },
  ): Promise<{ success: boolean; error?: string }> => {
    const existing = processes.get(id)
    if (existing) {
      try { existing.kill('SIGTERM') } catch { }
      processes.delete(id)
    }

    return new Promise((resolve) => {
      try {
        const isWin  = process.platform === 'win32'
        const shell  = isWin ? 'cmd'    : '/bin/sh'
        const flag   = isWin ? '/c'     : '-c'

        const child = spawn(shell, [flag, command], {
          cwd,
          env:   { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        processes.set(id, child)

        const send = (payload: object) => getWin()?.webContents.send('process-output', payload)

        child.stdout?.on('data', (data: Buffer) =>
          send({ id, type: 'stdout', data: data.toString() }))

        child.stderr?.on('data', (data: Buffer) =>
          send({ id, type: 'stderr', data: data.toString() }))

        child.on('spawn', () => {
          getWin()?.webContents.send('process-status', { id, status: 'running' })
          resolve({ success: true })
        })

        child.on('close', (code: number | null) => {
          processes.delete(id)
          getWin()?.webContents.send('process-status', { id, status: 'stopped', code })
        })

        child.on('error', (err: Error) => {
          processes.delete(id)
          getWin()?.webContents.send('process-status', { id, status: 'error', error: err.message })
          resolve({ success: false, error: err.message })
        })
      } catch (e) {
        resolve({ success: false, error: String(e) })
      }
    })
  })

  ipcMain.handle('stop-command', async (_, id: string) => {
    const proc = processes.get(id)
    if (!proc) return false
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'])
      } else {
        proc.kill('SIGTERM')
        setTimeout(() => { try { proc.kill('SIGKILL') } catch { } }, 2_000)
      }
      processes.delete(id)
      return true
    } catch { return false }
  })

  ipcMain.handle('get-process-status', async (_, id: string) =>
    processes.has(id) ? 'running' : 'stopped')
}
