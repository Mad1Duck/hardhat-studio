import { useEffect, useState } from "react";
import { DiscordUser } from "../types/discord.type";

export function useDiscordAuth() {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.getUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = async () => {
    const u = await window.api.discordLogin();
    setUser(u);
  };

  const logout = async () => {
    await window.api.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    login,
    logout,
  };
}