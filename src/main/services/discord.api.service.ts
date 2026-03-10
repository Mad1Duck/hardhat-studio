//
//  discord.api.service.ts — Main Process only
//
//  Calls Discord REST API using Bot Token.
//  NEVER import this in renderer — bot token lives here only.
//
//  Usage in main.ts:
//    import { checkUserRoles } from './services/discord.api.service'
//
import axios from 'axios';

interface DiscordMember {
  user: { id: string; };
  roles: string[];
}

/**
 * checkUserRoles — check if a user has ANY of the given roleIds in a guild.
 *
 * Changed from original:
 *   - roleId: string  →  roleIds: string[]  (support multiple roles, OR logic)
 *   - returns true if user has at least one of the roleIds
 */
export async function checkUserRoles({
  botToken,
  guildId,
  userId,
  roleIds,
}: {
  botToken: string;
  guildId: string;
  userId: string;
  roleIds: string[];
}): Promise<boolean> {
  try {
    const res = await axios.get<DiscordMember>(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    const userRoles = res.data.roles;
    console.log('[Discord] User roles:', userRoles);

    return roleIds.some((id) => userRoles.includes(id));
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('[Discord] User tidak ada di server:', guildId);
      return false;
    }
    console.error('[Discord] API error:', error.response?.data ?? error);
    throw error;
  }
}