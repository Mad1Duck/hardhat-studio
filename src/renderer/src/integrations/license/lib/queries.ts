// 
//  GRAPHQL QUERIES — all Sablier Flow subgraph queries in one place
//
//  Strategy: try queries from most-fields → least-fields, stop at first success.
//  Flow v1.0/v1.1 (FL/FL2): token field, depositedAmount
//  Flow v2.0     (FL3):      token field, may rename fields
//  Legacy:                   asset field instead of token
// 

/** Query A — Full fields (most modern subgraphs) */
export const STREAMS_QUERY_FULL = /* graphql */ `
  query GetStreams($sender: String!) {
    streams(
      where: { sender: $sender }
      orderBy: timestamp
      orderDirection: desc
      first: 50
    ) {
      id alias sender recipient paused
      ratePerSecond withdrawnAmount depositedAmount
      startTime timestamp
      token { id symbol decimals name }
    }
  }
`;

/** Query B — Without depositedAmount (some older deployments) */
export const STREAMS_QUERY_NO_DEPOSIT = /* graphql */ `
  query GetStreamsNoDeposit($sender: String!) {
    streams(
      where: { sender: $sender }
      orderBy: timestamp
      orderDirection: desc
      first: 50
    ) {
      id alias sender recipient paused
      ratePerSecond withdrawnAmount
      startTime timestamp
      token { id symbol decimals name }
    }
  }
`;

/** Query C — Legacy "asset" field (Flow v1.0) */
export const STREAMS_QUERY_ASSET = /* graphql */ `
  query GetStreamsAsset($sender: String!) {
    streams(
      where: { sender: $sender }
      orderBy: timestamp
      orderDirection: desc
      first: 50
    ) {
      id alias sender recipient paused
      ratePerSecond withdrawnAmount
      startTime timestamp
      asset { id symbol decimals }
    }
  }
`;

/** Envio multi-chain query (token field) */
export const ENVIO_QUERY = (senderLower: string) => /* graphql */ `
  query {
    Stream(
      limit: 50
      order_by: { timestamp: desc }
      where: { sender: { _ilike: "${senderLower}" } }
    ) {
      id alias chainId sender recipient paused
      ratePerSecond withdrawnAmount depositedAmount
      startTime timestamp
      token { id symbol decimals name }
    }
  }
`;

/** Envio multi-chain query (legacy asset field) */
export const ENVIO_QUERY_ASSET = (senderLower: string) => /* graphql */ `
  query {
    Stream(
      limit: 50
      order_by: { timestamp: desc }
      where: { sender: { _ilike: "${senderLower}" } }
    ) {
      id alias chainId sender recipient paused
      ratePerSecond withdrawnAmount depositedAmount
      startTime timestamp
      asset { id symbol decimals name }
    }
  }
`;
