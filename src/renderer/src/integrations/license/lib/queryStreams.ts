// 
//  QUERY STREAMS — orchestrates Envio → TheGraph fallback strategy
// 

import type { ActiveStream, LogEntry, LogLevel } from '../types';
import {
  ENVIO_FLOW_ENDPOINT,
  THEGRAPH_ENDPOINTS,
  CHAIN_NAMES,
} from '../config/chainConfig';
import { RECIPIENT_ADDRESS } from '../config/planConfig';
import {
  STREAMS_QUERY_FULL,
  STREAMS_QUERY_NO_DEPOSIT,
  STREAMS_QUERY_ASSET,
  ENVIO_QUERY,
  ENVIO_QUERY_ASSET,
} from './queries';
import { parseStream, formatStreamStatusLabel } from './streamParser';

type QueryResult = {
  streams: ActiveStream[];
  logs: LogEntry[];
};

function makeLog(level: LogLevel, msg: string, data?: unknown): LogEntry {
  return { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, msg, data };
}

//  Generic GraphQL POST helper 
async function gqlFetch(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
  label: string,
  logs: LogEntry[],
): Promise<any[] | null> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      logs.push(makeLog('warn', `[${label}] HTTP ${res.status}`));
      return null;
    }

    const json = await res.json();
    if (json.errors) {
      logs.push(makeLog('warn', `[${label}] GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`));
      return null;
    }

    // Envio uses capital "Stream", TheGraph uses "streams"
    const streams: any[] = json.data?.Stream ?? json.data?.streams ?? [];
    logs.push(makeLog(
      streams.length > 0 ? 'success' : 'debug',
      `[${label}] ${streams.length} stream(s)`,
    ));
    return streams;
  } catch (err: any) {
    logs.push(makeLog('warn', `[${label}] ${err.message ?? String(err)}`));
    return null;
  }
}

//  Main query function 

/**
 * queryStreams — fetch and filter all valid streams for the given wallet.
 *
 * Strategy:
 *  1. Try Envio (all chains, single request, most reliable)
 *  2. Fall back to TheGraph per-chain endpoints (query ID 112500)
 *
 * Always searches ALL chains — selectedChainId is a UI hint, not a hard filter.
 * Returns all streams that match recipient + token allowlist.
 */
export async function queryStreams(
  wallet: string,
  chainId: number,
  chainName: string,
  _selectedChainId: number | null = null, // UI hint only
): Promise<QueryResult> {
  const logs: LogEntry[] = [];

  const senderLower = wallet.toLowerCase();
  const recipientLower = RECIPIENT_ADDRESS.toLowerCase();

  logs.push(makeLog('info', `Flow query start`, { wallet: senderLower.slice(0, 10) + '…', chainId, chainName }));
  logs.push(makeLog('info', `Recipient: ${RECIPIENT_ADDRESS}`));

  let foundOnChainId = chainId;
  let foundOnChainName = chainName;
  let bestStreams: any[] | null = null;

  //  Step 1: Envio (all chains) 
  logs.push(makeLog('info', `[Envio] Querying all chains…`));

  bestStreams = await gqlFetch(ENVIO_FLOW_ENDPOINT, ENVIO_QUERY(senderLower), {}, 'Envio', logs);
  if (!bestStreams) {
    bestStreams = await gqlFetch(ENVIO_FLOW_ENDPOINT, ENVIO_QUERY_ASSET(senderLower), {}, 'Envio/asset', logs);
  }

  //  Step 2: TheGraph fallback 
  if (!bestStreams || bestStreams.length === 0) {
    logs.push(makeLog('warn', `[Envio] Empty — falling back to TheGraph…`));

    const allChainIds = Object.keys(THEGRAPH_ENDPOINTS).map(Number);
    const searchChains = [chainId, ...allChainIds.filter((id) => id !== chainId)];

    logs.push(makeLog('info', `[TheGraph] Searching chains: ${searchChains.map((id) => CHAIN_NAMES[id] ?? id).join(', ')}`));

    const chainResults = await Promise.all(
      searchChains.map(async (cid) => {
        const ep = THEGRAPH_ENDPOINTS[cid];
        if (!ep) return { cid, streams: null as any[] | null };
        const cname = CHAIN_NAMES[cid] ?? `Chain ${cid}`;

        let streams = await gqlFetch(ep, STREAMS_QUERY_FULL, { sender: senderLower }, `TheGraph/${cname}`, logs);
        if (!streams) streams = await gqlFetch(ep, STREAMS_QUERY_NO_DEPOSIT, { sender: senderLower }, `TheGraph/${cname}/nodep`, logs);
        if (!streams) streams = await gqlFetch(ep, STREAMS_QUERY_ASSET, { sender: senderLower }, `TheGraph/${cname}/asset`, logs);
        return { cid, streams };
      }),
    );

    const hit =
      chainResults.find((r) => r.cid === chainId && r.streams && r.streams.length > 0) ??
      chainResults.find((r) => r.streams && r.streams.length > 0);

    if (hit?.streams && hit.streams.length > 0) {
      bestStreams = hit.streams;
      foundOnChainId = hit.cid;
      foundOnChainName = CHAIN_NAMES[hit.cid] ?? `Chain ${hit.cid}`;
      logs.push(makeLog('success', `[TheGraph] Found on ${foundOnChainName}`));
    }
  }

  if (!bestStreams || bestStreams.length === 0) {
    logs.push(makeLog('warn', `No streams found (Envio + TheGraph both empty)`));
    logs.push(makeLog('warn', `wallet=${senderLower} recipient=${recipientLower}`));
    return { streams: [], logs };
  }

  //  Step 3: Filter by recipient + token, parse all valid streams 
  logs.push(makeLog('info', `[Filter] ${bestStreams.length} raw → filtering recipient + token…`));

  const parsedStreams: ActiveStream[] = [];

  console.log(bestStreams, "=====bestStreams=====");

  for (const s of bestStreams) {
    if (s.recipient?.toLowerCase() !== recipientLower) {
      logs.push(makeLog('debug', `  Skip ${s.alias ?? s.id}: recipient mismatch (${s.recipient})`));
      continue;
    }

    const cid = s.chainId ? Number(s.chainId) : foundOnChainId;
    const cname = CHAIN_NAMES[cid] ?? foundOnChainName;

    const { stream, log } = parseStream(s, cid, cname);
    if (log) logs.push(log);
    if (!stream) continue;

    logs.push(makeLog(
      'success',
      `[Stream] ${stream.streamAlias} — ${stream.tokenSymbol} ${formatStreamStatusLabel(stream)} on ${stream.chainName}`,
    ));
    parsedStreams.push(stream);
  }

  if (parsedStreams.length === 0) {
    logs.push(makeLog('warn', `[Filter] No streams passed recipient + token filter`));
    logs.push(makeLog('warn', `Recipients seen: ${[...new Set(bestStreams.map((s: any) => s.recipient))].join(', ')}`));
  } else {
    logs.push(makeLog('info', `[Result] ${parsedStreams.length} valid stream(s) ✓`));
  }

  return { streams: parsedStreams, logs };
}
