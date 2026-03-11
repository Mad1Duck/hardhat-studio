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

  useEffect(() => {
    window.api.getUser()
      .then(async (u) => {
        setUser(u);
        await checkRoles(u);
      })
      .finally(() => setLoading(false));
  }, [checkRoles]);

  useEffect(() => {
    const handleOAuthCallback = async (code: string) => {
      try {
        const u = await window.api.exchangeDiscordCode(code);
        setUser(u);
        await checkRoles(u);
        await refreshDiscordStatus();
      } catch {
      }
    };

    window.api.onOAuthCallback(handleOAuthCallback);
    return () => window.api.offOAuthCallback();
  }, [checkRoles, refreshDiscordStatus]);

  const login = async () => {
    window.api.openExternal(
      `https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID}&redirect_uri=hardhatstudio://callback&response_type=code&scope=identify%20guilds`
    );
  };

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