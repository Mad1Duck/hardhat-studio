// 
//  CHAIN CONFIG — network names, Sablier contract addresses, subgraph endpoints
// 

//  Chain display names 
export const CHAIN_NAMES: Record<number, string> = {
  // Mainnets
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  56: 'BNB Chain',
  10: 'Optimism',
  8453: 'Base',
  43114: 'Avalanche',
  534352: 'Scroll',
  100: 'Gnosis',
  59144: 'Linea',
  146: 'Sonic',
  10143: 'Monad',
  // Testnets
  11155111: 'Sepolia',
  84532: 'Base Sepolia',
  421614: 'Arbitrum Sepolia',
  11155420: 'Optimism Sepolia',
};

//  Sablier Flow v2.0 (FL3) contract addresses 
//    Source: https://docs.sablier.com/guides/flow/deployments
export const SABLIER_FLOW_CONTRACTS: Record<number, string> = {
  // Mainnets
  1: '0x7a86d3e6894f9c5b5f25ffbdaae658cfc7569623',
  137: '0x62b6d5a3ac0cc91ecebd019d1c70fe955d8c7426',
  42161: '0xf0f6477422a346378458f73cf02f05a7492e0c25',
  8453: '0x8551208f75375abfaee1fbe0a69e390a94000ec2',
  10: '0xd18491649440d6338532f260761cee64e79d7bb2',
  56: '0x5505c2397B0BeBEEE64919F21Df84F83C008C51b',
  43114: '0x64dc318ba879eca8222e963d319728f211c600c7',
  534352: '0xc3e92b9714ed01b51fdc29bb88b17af5cddd2c22',
  100: '0xcdd3eb5283e4a675f16ba83e9d8c28c871a550a2',
  59144: '0x977FDf70abeD6b60eECcee85322beA4575B0b6Ed',
  146: '0x3954146884425accb86a6476dad69ec3591838cd',
  // Testnets
  11155111: '0xde489096eC9C718358c52a8BBe4ffD74857356e9',
  84532: '0x19e99dcdbaf2fbf43c60cfd026d571860da29d43',
  421614: '0x73a474c9995b659bc4736486f25501e0a4a671ed',
  11155420: '0x4cc7b50b0856c607edee0b6547221360e82e768c',
};

//  Sablier Flow subgraph endpoints 
//    Envio: multi-chain single endpoint (primary)
//    TheGraph: per-chain endpoints (fallback, query ID 112500)
//    Source: https://docs.sablier.com/api/flow/indexers

export const ENVIO_FLOW_ENDPOINT =
  'https://indexer.hyperindex.xyz/a0b4e0b/v1/graphql';

export const THEGRAPH_ENDPOINTS: Record<number, string> = {
  // Mainnets
  1: 'https://api.studio.thegraph.com/query/112500/sablier-flow-ethereum/version/latest',
  137: 'https://api.studio.thegraph.com/query/112500/sablier-flow-polygon/version/latest',
  42161: 'https://api.studio.thegraph.com/query/112500/sablier-flow-arbitrum/version/latest',
  56: 'https://api.studio.thegraph.com/query/112500/sablier-flow-bsc/version/latest',
  10: 'https://api.studio.thegraph.com/query/112500/sablier-flow-optimism/version/latest',
  8453: 'https://api.studio.thegraph.com/query/112500/sablier-flow-base/version/latest',
  43114: 'https://api.studio.thegraph.com/query/112500/sablier-flow-avalanche/version/latest',
  534352: 'https://api.studio.thegraph.com/query/112500/sablier-flow-scroll/version/latest',
  100: 'https://api.studio.thegraph.com/query/112500/sablier-flow-gnosis/version/latest',
  59144: 'https://api.studio.thegraph.com/query/112500/sablier-flow-linea/version/latest',
  146: 'https://api.studio.thegraph.com/query/112500/sablier-flow-sonic/version/latest',
  // Testnets
  11155111: 'https://api.studio.thegraph.com/query/112500/sablier-flow-sepolia/version/latest',
  84532: 'https://api.studio.thegraph.com/query/112500/sablier-flow-base-sepolia/version/latest',
  421614: 'https://api.studio.thegraph.com/query/112500/sablier-flow-arbitrum-sepolia/version/latest',
  11155420: 'https://api.studio.thegraph.com/query/112500/sablier-flow-optimism-sepolia/version/latest',
};

//  Runtime-mutable custom chains (added via addCustomChain()) 
export const CUSTOM_ENDPOINTS: Record<number, string> = {};
export const CUSTOM_CHAIN_NAMES: Record<number, string> = {};

/**
 * Register a custom chain at runtime (e.g. local Anvil, private network).
 * Automatically merges into CHAIN_NAMES and THEGRAPH_ENDPOINTS.
 */
export function addCustomChain(
  chainId: number,
  name: string,
  graphEndpoint: string,
): void {
  CUSTOM_ENDPOINTS[chainId] = graphEndpoint;
  CUSTOM_CHAIN_NAMES[chainId] = name;
  (THEGRAPH_ENDPOINTS as any)[chainId] = graphEndpoint;
  (CHAIN_NAMES as any)[chainId] = name;
}
