import type { DiscordRuleEntry } from '../config/discord.config';

//  Cache (5 min TTL) 
type CacheEntry = { matched: boolean; fetchedAt: number; };
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(userId: string, guildId: string) {
  return `${userId}:${guildId}`;
}

//  Internal: single guild check 
async function checkGuildRole(
  userId: string,
  guildId: string,
  roleIds: string[],
): Promise<boolean> {
  if (!guildId || !userId || roleIds.length === 0) return false;

  const key = cacheKey(userId, guildId);
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.matched;

  try {
    const api = (window as any).api;
    if (!api?.checkDiscordRole) {
      console.warn('[Discord] window.api.checkDiscordRole not available');
      return false;
    }
    const matched: boolean = await api.checkDiscordRole({ guildId, userId, roleIds });
    _cache.set(key, { matched, fetchedAt: Date.now() });
    return matched;
  } catch (err) {
    console.error('[Discord] Role check failed:', err);
    return false;
  }
}

//  Public API 
export async function resolveMatchedRules(
  userId: string,
  rules: DiscordRuleEntry[],
): Promise<DiscordRuleEntry[]> {
  if (!userId || rules.length === 0) return [];

  const results = await Promise.all(
    rules.map(async (rule) => {
      const matched = await checkGuildRole(userId, rule.guildId, rule.roles);
      return matched ? rule : null;
    }),
  );
  return results.filter((r): r is DiscordRuleEntry => r !== null);
}


export function getHighestPlan(matchedRules: DiscordRuleEntry[]): 'free' | 'basic' | 'pro' {
  if (matchedRules.some((r) => r.plans.includes('pro'))) return 'pro';
  if (matchedRules.some((r) => r.plans.includes('basic'))) return 'basic';
  return 'free';
}

export function clearRoleCache(): void {
  _cache.clear();
}