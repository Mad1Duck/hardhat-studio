import { useEffect } from 'react';

export const useDiscordOAuth = (onCode: (code: string) => void) => {
  useEffect(() => {
    window.api.onOAuthCallback(onCode);
    return () => window.api.offOAuthCallback();
  }, [onCode]);
};