// 
//  TOKEN PRICE SERVICE — CoinGecko price fetching with in-memory cache
// 

const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Known stablecoins that are always $1 (no API call needed)
const STABLECOINS = new Set([
  'USDC', 'USDT', 'DAI', 'LUSD', 'FRAX', 'USDS', 'GUSD', 'BUSD', 'TUSD',
]);

// Map token symbol → CoinGecko coin ID
const COINGECKO_ID_MAP: Record<string, string> = {
  WETH: 'ethereum',
  ETH: 'ethereum',
  WBTC: 'wrapped-bitcoin',
  BTC: 'bitcoin',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  MKR: 'maker',
  SNX: 'havven',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  RPL: 'rocket-pool',
  ENS: 'ethereum-name-service',
  MATIC: 'matic-network',
  POL: 'matic-network',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  OP: 'optimism',
  ARB: 'arbitrum',
  GNO: 'gnosis',
};

type PriceCacheEntry = { price: number; fetchedAt: number; };
const _cache: Record<string, PriceCacheEntry> = {};

function getCoinGeckoId(symbol: string): string {
  const upper = symbol.toUpperCase();
  return COINGECKO_ID_MAP[upper] ?? symbol.toLowerCase();
}

/**
 * Fetch USD price for a token symbol via CoinGecko.
 * Returns null if price cannot be determined.
 * Stablecoins always return 1.
 */
export async function fetchTokenPrice(
  symbol: string,
  forceRefresh = false,
): Promise<number | null> {
  const sym = symbol.toUpperCase();

  if (STABLECOINS.has(sym)) return 1;

  const cached = _cache[sym];
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }

  try {
    const coinId = getCoinGeckoId(sym);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) },
    );
    const json = await res.json();
    const price: number | undefined = json[coinId]?.usd;

    if (price != null) {
      _cache[sym] = { price, fetchedAt: Date.now() };
      return price;
    }
    return cached?.price ?? null;
  } catch {
    return cached?.price ?? null;
  }
}

/** Clear the entire price cache (useful for tests). */
export function clearPriceCache(): void {
  Object.keys(_cache).forEach((k) => delete _cache[k]);
}
