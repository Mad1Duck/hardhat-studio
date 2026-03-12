import { useEffect, useState, useCallback } from "react";
import { DiscordUser } from "../types/discord.type";
import { clearRoleCache, getHighestPlan, resolveMatchedRules, useLicense } from "@/integrations/license";
import { DISCORD_RULES } from "../config/discord.config";

export type DiscordPlan = 'free' | 'basic' | 'pro';

export function useDiscordAuth() {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordPlan, setDiscordPlan] = useState<DiscordPlan>('free');
  const [roleChecking, setRoleChecking] = useState(false);
  const { refreshDiscordStatus } = useLicense();

  // ── Check roles ──────────────────────────────────────────────────────────────
  const checkRoles = useCallback(async (u: DiscordUser | null) => {
    if (!u?.id || DISCORD_RULES.length === 0) {
      setDiscordPlan('free');
      return;
    }
    setRoleChecking(true);
    try {
      clearRoleCache();
      const matched = await resolveMatchedRules(u.id, DISCORD_RULES);
      setDiscordPlan(getHighestPlan(matched));
    } catch {
      setDiscordPlan('free');
    } finally {
      setRoleChecking(false);
    }
  }, []);

  // ── Restore session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    window.api.getUser()
      .then(async (u) => {
        setUser(u);
        await checkRoles(u);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [checkRoles]);

  // ── Login ────────────────────────────────────────────────────────────────────
  // discordLogin() handles everything in main process:
  // - opens browser with correct redirect URI (localhost dev / hardhatstudio:// prod)
  // - waits for callback & exchanges code → user
  const login = async () => {
    try {
      const u = await window.api.discordLogin();
      if (!u) return;
      setUser(u);
      await checkRoles(u);
      await refreshDiscordStatus();
    } catch (err) {
      console.error('[Discord] Login failed:', err);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = async () => {
    await window.api.logout();
    setUser(null);
    setDiscordPlan('free');
    clearRoleCache();
    await refreshDiscordStatus();
  };

  return {
    user,
    loading,
    login,
    logout,
    discordPlan,
    roleChecking,
    hasAccess: (plan: DiscordPlan): boolean => {
      if (discordPlan === 'pro') return true;
      if (discordPlan === 'basic' && plan !== 'pro') return true;
      return plan === 'free';
    },
  };
}