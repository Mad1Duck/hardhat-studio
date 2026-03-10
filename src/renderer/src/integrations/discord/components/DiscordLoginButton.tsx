import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

import { useDiscordAuth } from '../hooks/useDiscordAuth';

export function DiscordLoginButton() {
  const { login, logout, loading, user } = useDiscordAuth();

  if (user) {
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : undefined;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="w-7 h-7">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{user.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>

            <span className="text-sm">{user.global_name || user.username}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      onClick={login}
      disabled={loading}
      className="bg-[#5865F2] hover:bg-[#4752C4] text-white">
      {loading ? 'Logging in...' : 'Login with Discord'}
    </Button>
  );
}
