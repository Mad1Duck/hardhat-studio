// 
//  STREAM PARSER — convert raw subgraph response into typed ActiveStream
// 

import type { ActiveStream, LogEntry, LogLevel } from '../types';
import { CHAIN_NAMES } from '../config/chainConfig';
import { ALLOWED_TOKENS } from '../config/planConfig';
import { isTokenAllowed } from '../config/planConfig';

type RawStream = Record<string, any>;

function makeLog(level: LogLevel, msg: string, data?: unknown): LogEntry {
  return { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, msg, data };
}

/**
 * parseStream — map one raw subgraph stream object to ActiveStream.
 * Returns null if the stream should be skipped (token not allowed, no token field, etc.).
 */
export function parseStream(
  s: RawStream,
  fallbackChainId: number,
  fallbackChainName: string,
): { stream: ActiveStream | null; log?: LogEntry; } {
  const tok = s.token ?? s.asset;

  if (!tok) {
    return {
      stream: null,
      log: makeLog('debug', `  Skip ${s.alias ?? s.id}: no token/asset field`),
    };
  }

  const sym = tok.symbol ?? '';
  const addr = tok.id ?? '';

  if (ALLOWED_TOKENS.length > 0 && !isTokenAllowed(sym) && !isTokenAllowed(addr)) {
    return {
      stream: null,
      log: makeLog('debug', `  Skip ${s.alias ?? s.id}: token ${sym} not in allowlist`),
    };
  }

  const decimals = Number(tok.decimals ?? 18);
  const rateRaw = BigInt(s.ratePerSecond ?? '0');
  const withdrawnRaw = BigInt(s.withdrawnAmount ?? '0');
  const netDepositedRaw = BigInt(s.depositedAmount ?? s.depositAmount ?? '0');
  const balanceRaw = netDepositedRaw > withdrawnRaw
    ? netDepositedRaw - withdrawnRaw
    : 0n;

  const nowSec = Math.floor(Date.now() / 1000);
  const lastEventTime = Number(s.startTime ?? s.timestamp ?? nowSec);
  const streamIsPaused = Boolean(s.paused);

  //  Debt detection 
  // Debt = stream running (rate > 0, not paused) but balance hit 0.
  let hasDebt = false;
  let debtRaw = 0n;

  if (!streamIsPaused && rateRaw > 0n) {
    if (netDepositedRaw > 0n && balanceRaw === 0n) {
      hasDebt = true;
      const elapsedSecs = BigInt(Math.max(0, nowSec - lastEventTime));
      const totalAccrued = rateRaw * elapsedSecs;
      debtRaw = totalAccrued > netDepositedRaw
        ? totalAccrued - netDepositedRaw
        : rateRaw; // fallback: 1 second worth
    }
  }

  //  Synthesized end time 
  const ratePerSec = Number(rateRaw) / 10 ** decimals;
  const remainingTokens = Number(balanceRaw) / 10 ** decimals;
  const secondsRemaining = ratePerSec > 0 ? remainingTokens / ratePerSec : 86_400 * 30;
  const endTime = nowSec + Math.max(secondsRemaining, 0);

  const streamChainId = s.chainId ? Number(s.chainId) : fallbackChainId;
  const streamChainName = CHAIN_NAMES[streamChainId] ?? fallbackChainName;

  return {
    stream: {
      streamId: s.id ?? '',
      streamAlias: s.alias ?? s.id ?? '',
      sender: s.sender,
      tokenAddress: addr,
      tokenSymbol: sym || 'UNKNOWN',
      tokenDecimals: decimals,
      chainId: streamChainId,
      chainName: streamChainName,
      ratePerSecond: String(rateRaw),
      balance: String(balanceRaw),
      totalStreamed: String(withdrawnRaw),
      netDeposited: String(netDepositedRaw),
      depositAmount: String(netDepositedRaw),
      withdrawnAmount: String(withdrawnRaw),
      hasDebt,
      debtRaw: String(debtRaw),
      startTime: Number(s.startTime ?? nowSec),
      lastAdjustmentTime: lastEventTime,
      paused: streamIsPaused,
      endTime: Math.floor(endTime),
    },
  };
}

/**
 * formatStreamStatusLabel — short human-readable status for logging / UI badges.
 */
export function formatStreamStatusLabel(s: ActiveStream): string {
  if (s.paused) return '⏸ paused';
  if (s.hasDebt) {
    const debt = (Number(s.debtRaw) / 10 ** s.tokenDecimals).toFixed(6);
    return `⚠ debt (${debt} ${s.tokenSymbol})`;
  }
  return '✓ active';
}
