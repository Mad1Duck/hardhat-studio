//
//  useDiscordAuth — Discord login/logout + license role bypass sync
//
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

  //  Check roles for a given user 
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

  //  On mount: restore session + check roles 
  useEffect(() => {
    window.api.getUser()
      .then(async (u) => {
        setUser(u);
        await checkRoles(u);
      })
      .finally(() => setLoading(false));
  }, [checkRoles]);

  //  Login 
  const login = async () => {
    const u = await window.api.discordLogin();
    setUser(u);
    await checkRoles(u);
    await refreshDiscordStatus(); // sync LicenseProvider's can()
  };

  //  Logout 
  const logout = async () => {
    await window.api.logout();
    setUser(null);
    setDiscordPlan('free');
    clearRoleCache();
    await refreshDiscordStatus(); // revoke bypass in LicenseProvider
  };

  return {
    user,
    loading,
    login,
    logout,
    discordPlan,    // 'free' | 'basic' | 'pro' — plan granted by Discord role
    roleChecking,   // true while checking (show spinner if needed)
    hasAccess: (plan: DiscordPlan): boolean => {
      if (discordPlan === 'pro') return true;
      if (discordPlan === 'basic' && plan !== 'pro') return true;
      return plan === 'free';
    },
  };
}