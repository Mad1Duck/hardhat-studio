import axios from 'axios';

interface DiscordMember {
  user: { id: string; };
  roles: string[];
}

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