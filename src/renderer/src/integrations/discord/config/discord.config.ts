
//  Discord Role-based bypass 

import { Plan } from "@/integrations/license";

/**
 * DiscordRuleEntry — one guild with one-or-more required roles.
 *
 * plans    : which plans are granted when the user has ANY of the roles
 * roles    : role IDs — user only needs ONE of them (OR logic)
 * guildId  : Discord server ID
 *
 * Multiple entries = multiple guilds supported (OR across guilds too).
 *
 * Example config:
 *   { guildId: '123', roles: ['roleA', 'roleB'], plans: ['basic', 'pro'] }
 *   → user in guild 123 with roleA OR roleB → gets Pro access
 */
export interface DiscordRuleEntry {
  guildId: string;
  roles: string[];
  plans: Plan[];
}

/**
 * DISCORD_RULES — edit this to configure guild/role → plan mapping.
 * Set to [] to disable Discord bypass entirely.
 *
 * Requires these env vars in your .env:
 *   VITE_DISCORD_BOT_TOKEN=Bot xxxxx   (keep secret — use main process only)
 *   VITE_DISCORD_GUILD_ID=123456       (optional shorthand for single guild)
 */
export const DISCORD_RULES: DiscordRuleEntry[] = [
  {
    guildId: import.meta.env.VITE_DISCORD_GUILD_ID ?? '',
    roles: (import.meta.env.VITE_DISCORD_PRO_ROLES ?? '').split(',').map((r: string) => r.trim()).filter(Boolean),
    plans: ['basic', 'pro'],
  },
];

/**
 * getDiscordBypassPlan — highest plan the user qualifies for across all rules.
 * Pass in the matched rule entries (already filtered by role check).
 */
export function getDiscordBypassPlan(matchedRules: DiscordRuleEntry[]): Plan {
  if (matchedRules.some((r) => r.plans.includes('pro'))) return 'pro';
  if (matchedRules.some((r) => r.plans.includes('basic'))) return 'basic';
  return 'free';
}
