import { ipcMain, shell } from 'electron'
import axios from 'axios'
import http from 'http'
import { deleteStorage, getStorage, setStorage } from '../database/storage'
import { checkUserRoles } from './services/discord.api.service'

// ── IPC Handlers ───────────────────────────────────────────────────────────────
export function registerDiscordHandlers(): void {

  ipcMain.handle('get-user', async () => {
    return getStorage('discord_user')
  })

  ipcMain.handle('logout', async () => {
    await deleteStorage('discord_user')
  })

  ipcMain.handle(
    'discord-check-role',
    async (
      _,
      { guildId, userId, roleIds }: { guildId: string; userId: string; roleIds: string[] },
    ) => {
      const botToken = process.env.DISCORD_BOT_TOKEN ?? ''
      if (!botToken) {
        console.warn('[Discord] DISCORD_BOT_TOKEN not set in env')
        return false
      }
      return checkUserRoles({ botToken, guildId, userId, roleIds })
    },
  )

  ipcMain.handle('discord-login', async () => {
    return new Promise(async (resolve, reject) => {
      const CLIENT_ID     = process.env.DISCORD_CLIENT_ID!
      const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!
      const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI!
      // e.g. http://localhost:4399/callback

      await deleteStorage('discord_access_token')
      await deleteStorage('discord_user')

      const authUrl =
        `https://discord.com/oauth2/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=identify`

      const server = http.createServer(async (req, res) => {
        try {
          const url  = new URL(req.url!, REDIRECT_URI)
          const code = url.searchParams.get('code')
          if (!code) return

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<h2>Login berhasil. Silakan kembali ke aplikasi.</h2>')
          server.close()

          const params = new URLSearchParams({
            client_id:     CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type:    'authorization_code',
            code,
            redirect_uri:  REDIRECT_URI,
          })

          const tokenRes = await axios.post(
            'https://discord.com/api/oauth2/token',
            params.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
          )
          const accessToken = tokenRes.data.access_token

          const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const user = userRes.data

          await setStorage('discord_access_token', accessToken)
          await setStorage('discord_user', user)

          resolve(user)
        } catch (err) {
          server.close()
          reject(err)
        }
      })

      server.listen(4399)
      await shell.openExternal(authUrl)
    })
  })
}
