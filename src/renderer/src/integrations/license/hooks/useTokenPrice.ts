import { useState, useEffect } from 'react';
import { fetchTokenPrice } from '@/integrations/license';

export function useTokenPrice(symbol: string | undefined) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    fetchTokenPrice(symbol)
      .then((p) => { if (!cancelled) setPrice(p); })
      .catch(() => { if (!cancelled) setPrice(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  return { price, loading };
}