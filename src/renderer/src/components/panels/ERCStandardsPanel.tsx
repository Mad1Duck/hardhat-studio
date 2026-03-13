import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { ContractAbi, DeployedContract } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Code2,
  Layers,
  Shield,
  Zap,
  Globe,
  Package,
  Settings,
  FileCode,
  RefreshCw,
  FolderOpen,
  Download,
  Upload,
  FileJson,
} from 'lucide-react';

interface Props {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
}

type ERCCategory =
  | 'token'
  | 'nft'
  | 'account'
  | 'defi'
  | 'gas'
  | 'signature'
  | 'access'
  | 'crosschain'
  | 'proxy'
  | 'governance'
  | 'custom';

interface ERCStandard {
  id: string;
  name: string;
  category: ERCCategory;
  description: string;
  url: string;
  requiredFunctions: string[];
  optionalFunctions?: string[];
  events?: string[];
  errors?: string[];
  testable: boolean;
  testNote?: string;
  tags: string[];
  status?: 'final' | 'draft' | 'stagnant' | 'withdrawn' | 'custom';
  since?: string; // EIP number or year
}

//  BUILT-IN STANDARDS 
const STANDARDS: ERCStandard[] = [
  //  TOKENS 
  {
    id: 'ERC-20',
    name: 'Fungible Token',
    category: 'token',
    status: 'final',
    since: 'EIP-20',
    description:
      'Standard interface for fungible tokens. Foundation of DeFi — any token that can be traded, held, or used as collateral. Defines totalSupply, balanceOf, transfer, approve/allowance pattern.',
    url: 'https://eips.ethereum.org/EIPS/eip-20',
    requiredFunctions: [
      'totalSupply',
      'balanceOf',
      'transfer',
      'transferFrom',
      'approve',
      'allowance',
    ],
    optionalFunctions: ['name', 'symbol', 'decimals'],
    events: ['Transfer', 'Approval'],
    testable: true,
    tags: ['token', 'fungible', 'defi', 'core'],
    testNote: 'Connect a deployed ERC-20 to test all standard functions',
  },
  {
    id: 'ERC-721',
    name: 'Non-Fungible Token (NFT)',
    category: 'nft',
    status: 'final',
    since: 'EIP-721',
    description:
      'Non-fungible token standard. Each token is unique and owned by exactly one address. Supports metadata via tokenURI and operator approval patterns.',
    url: 'https://eips.ethereum.org/EIPS/eip-721',
    requiredFunctions: [
      'balanceOf',
      'ownerOf',
      'transferFrom',
      'approve',
      'getApproved',
      'setApprovalForAll',
      'isApprovedForAll',
    ],
    optionalFunctions: [
      'safeTransferFrom',
      'tokenURI',
      'name',
      'symbol',
      'totalSupply',
      'tokenByIndex',
      'tokenOfOwnerByIndex',
    ],
    events: ['Transfer', 'Approval', 'ApprovalForAll'],
    testable: true,
    tags: ['nft', 'unique', 'collectible'],
    testNote: 'Use NFT Viewer panel to inspect individual tokens',
  },
  {
    id: 'ERC-1155',
    name: 'Multi Token Standard',
    category: 'nft',
    status: 'final',
    since: 'EIP-1155',
    description:
      'Multi-token standard. A single contract manages multiple token types — fungible and non-fungible. Batch operations reduce gas costs significantly.',
    url: 'https://eips.ethereum.org/EIPS/eip-1155',
    requiredFunctions: [
      'balanceOf',
      'balanceOfBatch',
      'setApprovalForAll',
      'isApprovedForAll',
      'safeTransferFrom',
      'safeBatchTransferFrom',
    ],
    optionalFunctions: ['uri', 'totalSupply', 'name', 'symbol'],
    events: ['TransferSingle', 'TransferBatch', 'ApprovalForAll', 'URI'],
    testable: true,
    tags: ['nft', 'multi-token', 'gaming', 'batch'],
    testNote: 'Good for game items, editions, and mixed token portfolios',
  },
  {
    id: 'ERC-4626',
    name: 'Tokenized Vault',
    category: 'defi',
    status: 'final',
    since: 'EIP-4626',
    description:
      'Standard for yield-bearing vaults. Deposit assets, receive shares proportional to vault ownership. Key primitive for DeFi composability — enables protocol-agnostic integrations.',
    url: 'https://eips.ethereum.org/EIPS/eip-4626',
    requiredFunctions: [
      'asset',
      'totalAssets',
      'convertToShares',
      'convertToAssets',
      'maxDeposit',
      'previewDeposit',
      'deposit',
      'maxMint',
      'previewMint',
      'mint',
      'maxWithdraw',
      'previewWithdraw',
      'withdraw',
      'maxRedeem',
      'previewRedeem',
      'redeem',
    ],
    events: ['Deposit', 'Withdraw'],
    testable: true,
    tags: ['vault', 'yield', 'defi', 'shares'],
    testNote: 'Test deposit → shares → redeem cycle and preview accuracy',
  },
  {
    id: 'ERC-2612',
    name: 'Permit (ERC-20 Extension)',
    category: 'signature',
    status: 'final',
    since: 'EIP-2612',
    description:
      'Adds gasless approve via off-chain EIP-712 signature. Users sign a permit message; relayer submits + executes approval in one transaction. Eliminates separate approve tx.',
    url: 'https://eips.ethereum.org/EIPS/eip-2612',
    requiredFunctions: ['permit', 'nonces', 'DOMAIN_SEPARATOR'],
    events: [],
    testable: true,
    tags: ['token', 'gasless', 'signature', 'permit'],
    testNote: 'Test permit signature flow: sign → verify → approve in one tx',
  },
  {
    id: 'ERC-2981',
    name: 'NFT Royalty Standard',
    category: 'nft',
    status: 'final',
    since: 'EIP-2981',
    description:
      'Standard for querying NFT royalty info. Marketplaces call royaltyInfo(tokenId, salePrice) to determine creator payment. Simple, lightweight interface.',
    url: 'https://eips.ethereum.org/EIPS/eip-2981',
    requiredFunctions: ['royaltyInfo'],
    optionalFunctions: ['supportsInterface'],
    events: [],
    testable: true,
    tags: ['nft', 'royalty', 'creator', 'marketplace'],
    testNote: 'Call royaltyInfo(tokenId, salePrice) to get receiver and amount',
  },
  {
    id: 'ERC-777',
    name: 'Token Standard (Hooks)',
    category: 'token',
    status: 'final',
    since: 'EIP-777',
    description:
      'Advanced token standard with send/receive hooks. Contracts can react to tokens being sent/received via tokensReceived/tokensToSend callbacks. Backward compatible with ERC-20.',
    url: 'https://eips.ethereum.org/EIPS/eip-777',
    requiredFunctions: [
      'name',
      'symbol',
      'granularity',
      'totalSupply',
      'balanceOf',
      'send',
      'burn',
      'isOperatorFor',
      'authorizeOperator',
      'revokeOperator',
      'defaultOperators',
      'operatorSend',
      'operatorBurn',
    ],
    events: ['Sent', 'Minted', 'Burned', 'AuthorizedOperator', 'RevokedOperator'],
    testable: true,
    tags: ['token', 'hooks', 'operators'],
    testNote: 'Note: ERC-777 re-entrancy risks. Use with caution in DeFi.',
  },
  {
    id: 'ERC-223',
    name: 'Token with Transfer Notifications',
    category: 'token',
    status: 'draft',
    since: 'EIP-223',
    description:
      "Fixes ERC-20 accidental token loss by adding tokenReceived hook on contracts. If recipient contract doesn't implement tokenReceived, transfer reverts.",
    url: 'https://eips.ethereum.org/EIPS/eip-223',
    requiredFunctions: ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'transfer'],
    events: ['Transfer'],
    testable: true,
    tags: ['token', 'safety', 'notifications'],
    testNote: "Prevents token loss to contracts that don't handle ERC-20",
  },
  //  ACCOUNT ABSTRACTION 
  {
    id: 'ERC-4337',
    name: 'Account Abstraction via EntryPoint',
    category: 'account',
    status: 'final',
    since: 'EIP-4337',
    description:
      'Smart contract wallets without protocol changes. UserOperations batched by Bundler → EntryPoint validates and executes. Enables gas sponsorship, batch txs, social recovery.',
    url: 'https://eips.ethereum.org/EIPS/eip-4337',
    requiredFunctions: ['validateUserOp', 'execute', 'executeBatch'],
    optionalFunctions: ['validatePaymasterUserOp', 'postOp', 'addDeposit', 'withdrawDepositTo'],
    events: ['UserOperationEvent', 'AccountDeployed'],
    testable: false,
    tags: ['account-abstraction', 'wallet', 'bundler', 'paymaster'],
    testNote: 'Requires deployed EntryPoint (0x5FF...7357) and Bundler node',
  },
  {
    id: 'ERC-6900',
    name: 'Modular Smart Contract Accounts',
    category: 'account',
    status: 'draft',
    since: 'EIP-6900',
    description:
      'Modular AA account standard. Plugins extend account functionality. Based on ERC-4337. Defines install/uninstall plugin interfaces and execution hooks.',
    url: 'https://eips.ethereum.org/EIPS/eip-6900',
    requiredFunctions: [
      'installPlugin',
      'uninstallPlugin',
      'executeFromPlugin',
      'executeFromPluginExternal',
    ],
    optionalFunctions: ['getInstalledPlugins'],
    events: ['PluginInstalled', 'PluginUninstalled'],
    testable: false,
    tags: ['account-abstraction', 'modular', 'plugins'],
    testNote: 'Draft stage — implementations vary across teams (Alchemy, Biconomy)',
  },
  //  SIGNATURES 
  {
    id: 'EIP-712',
    name: 'Typed Structured Data Signing',
    category: 'signature',
    status: 'final',
    since: 'EIP-712',
    description:
      'Standardizes how structured data is hashed and signed. Prevents signature replay via domain separator. Powers permit, meta-transactions, and all gasless flows.',
    url: 'https://eips.ethereum.org/EIPS/eip-712',
    requiredFunctions: ['DOMAIN_SEPARATOR'],
    events: [],
    testable: true,
    tags: ['signature', 'typed-data', 'meta-tx', 'gasless'],
    testNote: 'Look for DOMAIN_SEPARATOR — indicates EIP-712 support',
  },
  {
    id: 'ERC-1271',
    name: 'Standard Signature Validation',
    category: 'signature',
    status: 'final',
    since: 'EIP-1271',
    description:
      'Contract-level signature validation. isValidSignature(hash, signature) returns magic value 0x1626ba7e if valid. Enables smart contract wallets to sign messages.',
    url: 'https://eips.ethereum.org/EIPS/eip-1271',
    requiredFunctions: ['isValidSignature'],
    events: [],
    testable: true,
    tags: ['signature', 'wallet', 'contract-signature'],
    testNote: 'Check return value equals bytes4(0x1626ba7e)',
  },
  //  GAS / NETWORK 
  {
    id: 'EIP-1559',
    name: 'Fee Market Reform',
    category: 'gas',
    status: 'final',
    since: 'EIP-1559',
    description:
      'New fee mechanism: baseFee (burned) + priorityFee (miner tip). More predictable gas pricing. Reduces ETH supply via burn. Type 2 transactions.',
    url: 'https://eips.ethereum.org/EIPS/eip-1559',
    requiredFunctions: [],
    events: [],
    testable: true,
    tags: ['gas', 'fee', 'network', 'burn'],
    testNote: 'Inspect block baseFeePerGas and transaction maxFeePerGas in Block Explorer',
  },
  {
    id: 'EIP-4844',
    name: 'Proto-Danksharding (Blob Txns)',
    category: 'gas',
    status: 'final',
    since: 'EIP-4844',
    description:
      'Introduces blob-carrying transactions (Type 3). Blobs are cheaper temporary data for L2 rollups. Reduces L2 fees by 10-100x. Introduces blob base fee market.',
    url: 'https://eips.ethereum.org/EIPS/eip-4844',
    requiredFunctions: [],
    events: [],
    testable: false,
    tags: ['gas', 'blob', 'l2', 'rollup', 'danksharding'],
    testNote: 'Relevant for L2 developers. Blob data expires after ~18 days.',
  },
  {
    id: 'EIP-7702',
    name: 'Set EOA Account Code',
    category: 'account',
    status: 'draft',
    since: 'EIP-7702',
    description:
      'Allows EOAs to temporarily set code during a transaction. Enables EOAs to behave like smart contract wallets without permanent migration. Part of Pectra upgrade.',
    url: 'https://eips.ethereum.org/EIPS/eip-7702',
    requiredFunctions: [],
    events: [],
    testable: false,
    tags: ['account-abstraction', 'eoa', 'pectra'],
    testNote: 'Not yet deployed on mainnet. Part of upcoming Pectra hardfork.',
  },
  //  PROXY 
  {
    id: 'EIP-1967',
    name: 'Standard Proxy Storage Slots',
    category: 'proxy',
    status: 'final',
    since: 'EIP-1967',
    description:
      'Standardizes storage slots for proxy implementation address, beacon address, and admin address. Enables block explorers to detect and display proxy relationships.',
    url: 'https://eips.ethereum.org/EIPS/eip-1967',
    requiredFunctions: [],
    optionalFunctions: ['implementation', 'admin', 'upgradeTo', 'upgradeToAndCall', 'changeAdmin'],
    events: ['Upgraded', 'AdminChanged', 'BeaconUpgraded'],
    testable: true,
    tags: ['proxy', 'upgradeable', 'storage-slots'],
    testNote:
      'Implementation slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  },
  {
    id: 'ERC-1822',
    name: 'Universal Upgradeable Proxy (UUPS)',
    category: 'proxy',
    status: 'stagnant',
    since: 'EIP-1822',
    description:
      'UUPS pattern places upgrade logic in implementation, not proxy. Cheaper deployments, smaller proxy bytecode. Used by OpenZeppelin UUPSUpgradeable.',
    url: 'https://eips.ethereum.org/EIPS/eip-1822',
    requiredFunctions: ['proxiableUUID', 'upgradeTo', 'upgradeToAndCall'],
    events: ['Upgraded'],
    testable: true,
    tags: ['proxy', 'uups', 'upgradeable'],
    testNote: 'Check proxiableUUID() returns ERC1967 implementation slot',
  },
  {
    id: 'ERC-2535',
    name: 'Diamond Multi-Facet Proxy',
    category: 'proxy',
    status: 'final',
    since: 'EIP-2535',
    description:
      'Diamond pattern: one proxy, multiple implementation contracts (facets). Unlimited contract size. Granular upgrades per function. Complex but powerful.',
    url: 'https://eips.ethereum.org/EIPS/eip-2535',
    requiredFunctions: [
      'diamondCut',
      'facets',
      'facetFunctionSelectors',
      'facetAddresses',
      'facetAddress',
    ],
    events: ['DiamondCut'],
    testable: true,
    tags: ['proxy', 'diamond', 'facets', 'upgradeable'],
    testNote: 'Use Proxy panel to inspect facet addresses and function selectors',
  },
  //  ACCESS CONTROL 
  {
    id: 'OZ-Ownable',
    name: 'Ownable (Single Owner)',
    category: 'access',
    status: 'final',
    since: 'OpenZeppelin',
    description:
      'Basic single-owner access control. owner() returns current owner; transferOwnership() changes it. renounceOwnership() permanently removes owner.',
    url: 'https://docs.openzeppelin.com/contracts/5.x/access-control',
    requiredFunctions: ['owner', 'transferOwnership', 'renounceOwnership'],
    events: ['OwnershipTransferred'],
    testable: true,
    tags: ['access-control', 'owner', 'openzeppelin'],
    testNote: 'Detect owner() and OwnershipTransferred event in ABI',
  },
  {
    id: 'OZ-Ownable2Step',
    name: 'Ownable2Step (Safe Transfer)',
    category: 'access',
    status: 'final',
    since: 'OpenZeppelin',
    description:
      'Two-step ownership transfer. New owner must explicitly acceptOwnership(). Prevents accidental transfer to wrong address. Highly recommended over Ownable.',
    url: 'https://docs.openzeppelin.com/contracts/5.x/api/access#Ownable2Step',
    requiredFunctions: [
      'owner',
      'pendingOwner',
      'transferOwnership',
      'acceptOwnership',
      'renounceOwnership',
    ],
    events: ['OwnershipTransferStarted', 'OwnershipTransferred'],
    testable: true,
    tags: ['access-control', 'owner', 'safe', 'openzeppelin'],
    testNote: 'Check for pendingOwner() function — confirms 2-step pattern',
  },
  {
    id: 'OZ-AccessControl',
    name: 'Role-Based Access Control',
    category: 'access',
    status: 'final',
    since: 'OpenZeppelin',
    description:
      'Multi-role access control. Roles identified by bytes32 constants. Grant/revoke per role per address. DEFAULT_ADMIN_ROLE manages all other roles.',
    url: 'https://docs.openzeppelin.com/contracts/5.x/access-control',
    requiredFunctions: ['hasRole', 'getRoleAdmin', 'grantRole', 'revokeRole', 'renounceRole'],
    optionalFunctions: ['DEFAULT_ADMIN_ROLE', 'MINTER_ROLE', 'PAUSER_ROLE', 'supportsInterface'],
    events: ['RoleGranted', 'RoleRevoked', 'RoleAdminChanged'],
    testable: true,
    tags: ['access-control', 'roles', 'openzeppelin'],
    testNote: 'DEFAULT_ADMIN_ROLE = bytes32(0). Check for hasRole in ABI.',
  },
  //  GOVERNANCE 
  {
    id: 'ERC-20Votes',
    name: 'Governance Votes (ERC-20)',
    category: 'governance',
    status: 'final',
    since: 'OpenZeppelin',
    description:
      'Extends ERC-20 with voting power tracking. delegate() assigns voting power. getPastVotes() retrieves historical snapshots for on-chain governance.',
    url: 'https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20Votes',
    requiredFunctions: [
      'delegate',
      'delegateBySig',
      'getVotes',
      'getPastVotes',
      'getPastTotalSupply',
      'delegates',
    ],
    events: ['DelegateChanged', 'DelegateVotesChanged'],
    testable: true,
    tags: ['governance', 'voting', 'dao', 'token'],
    testNote: 'Voting power only activates after delegating — even to yourself',
  },
  {
    id: 'OZ-Governor',
    name: 'On-Chain Governor (DAO)',
    category: 'governance',
    status: 'final',
    since: 'OpenZeppelin',
    description:
      'Full on-chain governance: propose → vote → queue → execute lifecycle. Compatible with Timelock. Configurable quorum, voting delay, voting period.',
    url: 'https://docs.openzeppelin.com/contracts/5.x/api/governance',
    requiredFunctions: [
      'propose',
      'castVote',
      'castVoteWithReason',
      'execute',
      'cancel',
      'queue',
      'state',
      'proposalDeadline',
      'proposalSnapshot',
      'quorum',
      'votingDelay',
      'votingPeriod',
    ],
    events: [
      'ProposalCreated',
      'VoteCast',
      'ProposalExecuted',
      'ProposalQueued',
      'ProposalCanceled',
    ],
    testable: true,
    tags: ['governance', 'dao', 'voting', 'timelock'],
    testNote: 'Deploy with GovernorVotes + GovernorTimelockControl for full setup',
  },
  //  DEFI 
  {
    id: 'Uniswap-V2',
    name: 'Uniswap V2 Interface',
    category: 'defi',
    status: 'final',
    since: '2020',
    description:
      'AMM DEX interface. Core: swapExactTokensForTokens, addLiquidity, getAmountsOut. x*y=k invariant. Foundation for DeFi composability.',
    url: 'https://docs.uniswap.org/contracts/v2/reference',
    requiredFunctions: [
      'getAmountsOut',
      'getAmountsIn',
      'swapExactTokensForTokens',
      'swapTokensForExactTokens',
      'addLiquidity',
      'removeLiquidity',
      'factory',
    ],
    optionalFunctions: ['swapExactETHForTokens', 'swapExactTokensForETH', 'addLiquidityETH'],
    events: ['Swap', 'Mint', 'Burn', 'Sync'],
    testable: true,
    tags: ['dex', 'amm', 'swap', 'defi'],
    testNote: 'Use LP Simulator panel for AMM mechanics testing',
  },
  {
    id: 'Uniswap-V3',
    name: 'Uniswap V3 Interface',
    category: 'defi',
    status: 'final',
    since: '2021',
    description:
      'Concentrated liquidity AMM. Liquidity providers set price ranges. Capital efficiency up to 4000x vs V2. Multiple fee tiers: 0.01%, 0.05%, 0.3%, 1%.',
    url: 'https://docs.uniswap.org/contracts/v3/reference',
    requiredFunctions: ['exactInputSingle', 'exactInput', 'exactOutputSingle', 'exactOutput'],
    optionalFunctions: ['mint', 'burn', 'collect', 'slot0', 'liquidity', 'positions'],
    events: ['Swap', 'Mint', 'Burn', 'Collect', 'Flash'],
    testable: true,
    tags: ['dex', 'amm', 'concentrated-liquidity', 'defi'],
    testNote: 'Use ISwapRouter interface for V3 swaps',
  },
  {
    id: 'Aave-V3',
    name: 'Aave V3 Lending Pool',
    category: 'defi',
    status: 'final',
    since: '2022',
    description:
      'Lending protocol interface. Supply collateral, borrow assets with interest rate models. Health factor determines liquidation risk.',
    url: 'https://docs.aave.com/developers',
    requiredFunctions: [
      'supply',
      'borrow',
      'repay',
      'withdraw',
      'getUserAccountData',
      'getReserveData',
      'liquidationCall',
    ],
    optionalFunctions: [
      'flashLoan',
      'flashLoanSimple',
      'setUserUseReserveAsCollateral',
      'swapBorrowRateMode',
    ],
    events: ['Supply', 'Borrow', 'Repay', 'Withdraw', 'LiquidationCall', 'FlashLoan'],
    testable: true,
    tags: ['lending', 'defi', 'aave', 'borrowing'],
    testNote: 'Use DeFi Simulation panel for lending protocol testing',
  },
  //  CROSS-CHAIN 
  {
    id: 'LayerZero',
    name: 'LayerZero OApp',
    category: 'crosschain',
    status: 'final',
    since: '2023',
    description:
      'Cross-chain messaging protocol. Contracts implement _lzSend/_lzReceive to send/receive messages across chains. DVN (Decentralized Verifier Network) security.',
    url: 'https://layerzero.network/developers',
    requiredFunctions: ['send', 'lzReceive', 'setTrustedRemote'],
    optionalFunctions: ['quote', 'setDelegate', 'setPeer'],
    events: ['OFTSent', 'OFTReceived'],
    testable: false,
    tags: ['cross-chain', 'bridge', 'omnichain', 'layerzero'],
    testNote: 'Requires LayerZero endpoint contract on source + destination chains',
  },
  {
    id: 'ERC-7683',
    name: 'Cross-Chain Intents (ERC-7683)',
    category: 'crosschain',
    status: 'draft',
    since: 'EIP-7683',
    description:
      'Standardizes cross-chain intent orders. Users sign intents (what they want), fillers execute across chains. Enables chain-abstracted UX.',
    url: 'https://eips.ethereum.org/EIPS/eip-7683',
    requiredFunctions: ['open', 'resolve'],
    events: ['Open'],
    testable: false,
    tags: ['cross-chain', 'intents', 'chain-abstraction'],
    testNote: 'Used by Across, Uniswap X. Still being finalized.',
  },
  //  INTROSPECTION 
  {
    id: 'ERC-165',
    name: 'Standard Interface Detection',
    category: 'token',
    status: 'final',
    since: 'EIP-165',
    description:
      'Allows contracts to declare which interfaces they implement. supportsInterface(bytes4) returns true/false. Used by ERC-721, ERC-1155, ERC-2981 and most modern standards.',
    url: 'https://eips.ethereum.org/EIPS/eip-165',
    requiredFunctions: ['supportsInterface'],
    events: [],
    testable: true,
    tags: ['introspection', 'interface', 'detection', 'core'],
    testNote: 'ERC-721 interfaceId: 0x80ac58cd. ERC-1155: 0xd9b67a26',
  },
  {
    id: 'EIP-1014',
    name: 'CREATE2 Deterministic Deployment',
    category: 'gas',
    status: 'final',
    since: 'EIP-1014',
    description:
      'Deterministic contract deployment. Address computed from deployer + salt + bytecode hash. Used by Uniswap, Gnosis Safe, and most counterfactual account setups.',
    url: 'https://eips.ethereum.org/EIPS/eip-1014',
    requiredFunctions: [],
    events: [],
    testable: false,
    tags: ['deployment', 'deterministic', 'create2', 'counterfactual'],
    testNote: 'Address: keccak256(0xff ++ deployer ++ salt ++ keccak256(bytecode))[12:]',
  },
];

//  CATEGORY META 
const CATEGORY_META: Record<ERCCategory, { label: string; icon: string; color: string }> = {
  token: { label: 'Tokens', icon: '🪙', color: 'blue' },
  nft: { label: 'NFT', icon: '🎨', color: 'purple' },
  account: { label: 'Account', icon: '👤', color: 'green' },
  defi: { label: 'DeFi', icon: '🏦', color: 'emerald' },
  gas: { label: 'Gas/Network', icon: '⛽', color: 'amber' },
  signature: { label: 'Signature', icon: '✍️', color: 'orange' },
  access: { label: 'Access', icon: '🔐', color: 'red' },
  crosschain: { label: 'Cross-chain', icon: '🌐', color: 'cyan' },
  proxy: { label: 'Proxy', icon: '🔄', color: 'indigo' },
  governance: { label: 'Governance', icon: '🗳️', color: 'pink' },
  custom: { label: 'Custom', icon: '⚙️', color: 'gray' },
};

//  DEFAULT JSON TEMPLATE 
const DEFAULT_CUSTOM_JSON = `{
  "id": "ERC-XXXX",
  "name": "My Custom Standard",
  "category": "token",
  "status": "custom",
  "description": "Describe what this standard does, its use case, and key design decisions.",
  "url": "https://eips.ethereum.org/EIPS/eip-XXXX",
  "requiredFunctions": [
    "functionName",
    "anotherFunction"
  ],
  "optionalFunctions": [
    "optionalFunction"
  ],
  "events": [
    "EventName"
  ],
  "errors": [
    "CustomError"
  ],
  "testable": true,
  "testNote": "How to test this standard in Hardhat Studio",
  "tags": ["custom", "your-tag"]
}`;

//  HELPERS 
const statusColor: Record<string, string> = {
  final: 'text-green-400 bg-green-500/10',
  draft: 'text-amber-400 bg-amber-500/10',
  stagnant: 'text-muted-foreground bg-muted',
  withdrawn: 'text-red-400 bg-red-500/10 line-through',
  custom: 'text-purple-400 bg-purple-500/10',
};

const catColor = (cat: ERCCategory) => {
  const map: Record<string, string> = {
    token: 'text-blue-400 bg-blue-500/10',
    nft: 'text-purple-400 bg-purple-500/10',
    account: 'text-green-400 bg-green-500/10',
    defi: 'text-emerald-400 bg-emerald-500/10',
    gas: 'text-amber-400 bg-amber-500/10',
    signature: 'text-orange-400 bg-orange-500/10',
    access: 'text-red-400 bg-red-500/10',
    crosschain: 'text-cyan-400 bg-cyan-500/10',
    proxy: 'text-indigo-400 bg-indigo-500/10',
    governance: 'text-pink-400 bg-pink-500/10',
    custom: 'text-gray-400 bg-gray-500/10',
  };
  return map[cat] || 'text-muted-foreground bg-muted';
};

//  MAIN COMPONENT 
export default function ERCStandardsPanel({ abis, deployedContracts, rpcUrl }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<ERCCategory | 'all'>('all');
  const [selected, setSelected] = useState<ERCStandard | null>(null);
  const [copiedId, setCopiedId] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'add' | 'config'>('detail');

  // Contract selector
  const [selectedAbiId, setSelectedAbiId] = useState<string | null>(null);
  const [selectedDeployedId, setSelectedDeployedId] = useState<string | null>(null);

  // Custom standards
  const [customStandards, setCustomStandards] = useState<ERCStandard[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('erc_custom_standards') || '[]');
    } catch {
      return [];
    }
  });

  // Monaco editor state for add/edit
  const [editorJson, setEditorJson] = useState(DEFAULT_CUSTOM_JSON);
  const [editorError, setEditorError] = useState('');
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [fileStatus, setFileStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const showFileStatus = (msg: string, ok = true) => {
    setFileStatus({ msg, ok });
    setTimeout(() => setFileStatus(null), 2800);
  };

  const basename = (p: string) => p.replace(/\\/g, '/').split('/').pop() || p;

  const allStandards = [...STANDARDS, ...customStandards];

  // Selected contract for compliance check
  const activeAbi: ContractAbi | null = (() => {
    if (selectedAbiId) return abis.find((a) => a.contractName === selectedAbiId) || null;
    if (selectedDeployedId) {
      const dc = deployedContracts.find((d) => d.id === selectedDeployedId);
      if (dc) return { contractName: dc.name, name: dc.name, path: '', abi: dc.abi };
    }
    return null;
  })();

  const saveCustom = (list: ERCStandard[]) => {
    setCustomStandards(list);
    try {
      localStorage.setItem('erc_custom_standards', JSON.stringify(list));
    } catch {}
  };

  const handleSaveFromEditor = () => {
    try {
      const parsed = JSON.parse(editorJson) as ERCStandard;
      if (!parsed.id || !parsed.name) {
        setEditorError('id and name are required');
        return;
      }
      if (!parsed.requiredFunctions) parsed.requiredFunctions = [];
      if (!parsed.tags) parsed.tags = ['custom'];
      parsed.category = parsed.category || 'custom';
      parsed.status = parsed.status || 'custom';

      if (editingCustomId) {
        const updated = customStandards.map((s) => (s.id === editingCustomId ? parsed : s));
        saveCustom(updated);
        setSelected(parsed);
      } else {
        if (allStandards.find((s) => s.id === parsed.id)) {
          setEditorError(`ID "${parsed.id}" already exists`);
          return;
        }
        saveCustom([...customStandards, parsed]);
        setSelected(parsed);
      }
      setEditorError('');
      setEditingCustomId(null);
      setActiveTab('detail');
    } catch (e: any) {
      setEditorError('Invalid JSON: ' + e.message);
    }
  };

  const deleteCustom = (id: string) => {
    saveCustom(customStandards.filter((s) => s.id !== id));
    if (selected?.id === id) {
      setSelected(null);
      setActiveTab('detail');
    }
  };

  const startEdit = (std: ERCStandard) => {
    setEditorJson(JSON.stringify(std, null, 2));
    setEditingCustomId(std.id);
    setEditorError('');
    setEditorFilePath(null);
    setEditorDirty(false);
    setActiveTab('add');
  };

  //  File: Load JSON from disk 
  const handleLoadFile = async () => {
    const filePath = await window.api.showOpenFileDialog({
      title: 'Open ERC Standard JSON',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!filePath) return;
    const content = await window.api.readFile(filePath);
    if (content === null) {
      showFileStatus('Could not read file', false);
      return;
    }
    try {
      JSON.parse(content); // validate
      setEditorJson(content);
      setEditorFilePath(filePath);
      setEditorDirty(false);
      setEditingCustomId(null);
      setEditorError('');
      setActiveTab('add');
      showFileStatus(`Loaded ${basename(filePath)}`);
    } catch {
      showFileStatus('File is not valid JSON', false);
    }
  };

  //  File: Save JSON to disk (overwrite) 
  const handleSaveFile = async () => {
    if (!editorFilePath) {
      handleSaveFileAs();
      return;
    }
    const ok = await window.api.writeFile(editorFilePath, editorJson);
    if (ok) {
      setEditorDirty(false);
      showFileStatus(`Saved → ${basename(editorFilePath)}`);
    } else showFileStatus('Save failed', false);
  };

  //  File: Save As 
  const handleSaveFileAs = async () => {
    let defaultName = 'custom-standard.json';
    try {
      const parsed = JSON.parse(editorJson);
      if (parsed.id) defaultName = `${parsed.id.toLowerCase()}.json`;
    } catch {}

    const filePath = await window.api.showSaveFileDialog({
      defaultPath: defaultName,
      title: 'Save ERC Standard As',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!filePath) return;
    const ok = await window.api.writeFile(filePath, editorJson);
    if (ok) {
      setEditorFilePath(filePath);
      setEditorDirty(false);
      showFileStatus(`Saved → ${basename(filePath)}`);
    } else {
      showFileStatus('Save failed', false);
    }
  };

  //  Export all custom standards as one JSON file 
  const handleExportAll = async () => {
    if (customStandards.length === 0) {
      showFileStatus('No custom standards to export', false);
      return;
    }
    const filePath = await window.api.showSaveFileDialog({
      defaultPath: 'erc-custom-standards.json',
      title: 'Export All Custom Standards',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (!filePath) return;
    const ok = await window.api.writeFile(filePath, JSON.stringify(customStandards, null, 2));
    if (ok) showFileStatus(`Exported ${customStandards.length} standards`);
    else showFileStatus('Export failed', false);
  };

  //  Import standards from a JSON file (array or single object) 
  const handleImportFile = async () => {
    const filePath = await window.api.showOpenFileDialog({
      title: 'Import Custom Standards',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (!filePath) return;
    const content = await window.api.readFile(filePath);
    if (!content) {
      showFileStatus('Could not read file', false);
      return;
    }
    try {
      const parsed = JSON.parse(content);
      const items: ERCStandard[] = Array.isArray(parsed) ? parsed : [parsed];
      const valid = items.filter((s) => s.id && s.name);
      if (valid.length === 0) {
        showFileStatus('No valid standards found in file', false);
        return;
      }
      const newOnes = valid.filter((s) => !allStandards.find((a) => a.id === s.id));
      if (newOnes.length === 0) {
        showFileStatus('All IDs already exist', false);
        return;
      }
      saveCustom([...customStandards, ...newOnes]);
      showFileStatus(`Imported ${newOnes.length} standard${newOnes.length > 1 ? 's' : ''}`);
    } catch {
      showFileStatus('Invalid JSON file', false);
    }
  };

  const detectCompliance = (standard: ERCStandard, abi: ContractAbi) => {
    const abiNames = new Set(abi.abi.filter((i) => i.type === 'function').map((i) => i.name || ''));
    const eventNames = new Set(abi.abi.filter((i) => i.type === 'event').map((i) => i.name || ''));
    const requiredMet = standard.requiredFunctions.filter((f) => abiNames.has(f));
    const eventsMet = (standard.events || []).filter((e) => eventNames.has(e));
    const compliance =
      standard.requiredFunctions.length > 0
        ? Math.round((requiredMet.length / standard.requiredFunctions.length) * 100)
        : 0;
    return {
      compliance,
      requiredMet,
      missing: standard.requiredFunctions.filter((f) => !abiNames.has(f)),
      missingEvents: (standard.events || []).filter((e) => !eventNames.has(e)),
      foundEvents: eventsMet,
    };
  };

  const filtered = allStandards.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.tags.some((t) => t.includes(q)) ||
      s.description.toLowerCase().includes(q);
    const matchCat = selectedCat === 'all' || s.category === selectedCat;
    return matchSearch && matchCat;
  });

  const copyInterface = (std: ERCStandard) => {
    const iface = [
      `// SPDX-License-Identifier: MIT`,
      `// ${std.id} - ${std.name}`,
      `// ${std.url}`,
      `// solc ^0.8.0`,
      ``,
      `interface I${std.id.replace(/[-_.]/g, '')} {`,
      ...std.requiredFunctions.map((f) => `    function ${f}(/* params */) external;`),
      ...(std.optionalFunctions || []).map(
        (f) => `    // optional: function ${f}(/* params */) external;`,
      ),
      ...(std.events || []).map((e) => `    event ${e}(/* params */);`),
      ...(std.errors || []).map((e) => `    error ${e}(/* params */);`),
      `}`,
    ].join('\n');
    navigator.clipboard.writeText(iface);
    setCopiedId(std.id);
    setTimeout(() => setCopiedId(''), 1500);
  };

  //  RENDER 
  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/*  LEFT PANEL  */}
      <div className="flex flex-col flex-shrink-0 border-r w-72 border-border bg-card">
        {/* Header */}
        <div className="px-3 py-3 space-y-2 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold">ERC / EIP Standards</span>
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-auto">
              {filtered.length}/{allStandards.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ERC, function, tag..."
              className="w-full pr-3 text-xs border rounded outline-none h-7 pl-7 bg-muted/20 border-border text-foreground/80 focus:border-blue-500/40"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCat('all')}
              className={cn(
                'px-2 py-0.5 text-[9px] rounded font-medium transition-colors',
                selectedCat === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}>
              All
            </button>
            {(Object.keys(CATEGORY_META) as ERCCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={cn(
                  'px-2 py-0.5 text-[9px] rounded font-medium transition-colors',
                  selectedCat === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}>
                {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        </div>

        {/* Contract Selector */}
        <div className="px-3 py-2 border-b border-border bg-muted/10">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
            📋 Check Compliance Against
          </p>
          <select
            value={selectedAbiId || selectedDeployedId || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setSelectedAbiId(null);
                setSelectedDeployedId(null);
                return;
              }
              const isDeployed = deployedContracts.find((d) => d.id === v);
              if (isDeployed) {
                setSelectedDeployedId(v);
                setSelectedAbiId(null);
              } else {
                setSelectedAbiId(v);
                setSelectedDeployedId(null);
              }
            }}
            className="w-full px-2 text-xs border rounded outline-none h-7 bg-muted/20 border-border text-foreground/80 focus:border-blue-500/40">
            <option value="">— No contract selected —</option>
            {abis.length > 0 && (
              <optgroup label="Loaded ABIs">
                {abis.map((a) => (
                  <option key={a.contractName} value={a.contractName}>
                    {a.contractName}
                  </option>
                ))}
              </optgroup>
            )}
            {deployedContracts.length > 0 && (
              <optgroup label="Deployed Contracts">
                {deployedContracts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.address.slice(0, 8)}...)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {activeAbi && (
            <p className="text-[9px] text-green-400 mt-1">
              ✓ {activeAbi.abi.filter((i) => i.type === 'function').length} functions,{' '}
              {activeAbi.abi.filter((i) => i.type === 'event').length} events loaded
            </p>
          )}
        </div>

        {/* Standards list */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-xs text-center text-muted-foreground">No standards match</div>
          )}
          {filtered.map((std) => {
            const compliance =
              activeAbi && std.requiredFunctions.length > 0
                ? detectCompliance(std, activeAbi).compliance
                : null;
            const isCustom = !!customStandards.find((s) => s.id === std.id);
            return (
              <div
                key={std.id}
                onClick={() => {
                  setSelected(std);
                  setActiveTab('detail');
                }}
                className={cn(
                  'group relative px-3 py-2 border-b border-border cursor-pointer hover:bg-muted/20 transition-colors',
                  selected?.id === std.id && 'bg-blue-600/10 border-l-2 border-l-blue-500',
                )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded font-mono',
                      catColor(std.category),
                    )}>
                    {std.id}
                  </span>
                  {std.status && (
                    <span
                      className={cn(
                        'text-[9px] px-1 py-0.5 rounded',
                        statusColor[std.status] || '',
                      )}>
                      {std.status}
                    </span>
                  )}
                  {compliance !== null && (
                    <span
                      className={cn(
                        'text-[9px] font-bold',
                        compliance === 100
                          ? 'text-green-400'
                          : compliance > 50
                            ? 'text-amber-400'
                            : 'text-red-400',
                        isCustom ? 'mr-5' : 'ml-auto',
                      )}>
                      {compliance}%
                    </span>
                  )}
                  {/* Delete button — only for custom, hover reveal */}
                  {isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustom(std.id);
                      }}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60 hover:text-red-400 p-0.5 rounded"
                      title="Delete custom standard">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-medium text-foreground/90 truncate">{std.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {std.description.slice(0, 60)}…
                </p>
              </div>
            );
          })}
        </div>

        {/* Add custom button */}
        <div className="p-2 space-y-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 gap-1.5"
            onClick={() => {
              setEditorJson(DEFAULT_CUSTOM_JSON);
              setEditingCustomId(null);
              setEditorError('');
              setEditorFilePath(null);
              setEditorDirty(false);
              setActiveTab('add');
              setSelected(null);
            }}>
            <Plus className="w-3 h-3" /> Add Custom Standard
          </Button>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-6 gap-1 text-xs"
              onClick={handleImportFile}
              title="Import standards from JSON file">
              <Upload className="w-3 h-3" /> Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-6 gap-1 text-xs"
              onClick={handleExportAll}
              title="Export all custom standards">
              <Download className="w-3 h-3" /> Export
            </Button>
          </div>
        </div>
      </div>

      {/*  RIGHT PANEL  */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Tab bar (only shown when a standard is selected) */}
        {(selected || activeTab === 'add') && (
          <div className="flex gap-1 px-4 pt-2 border-b border-border bg-card">
            {selected && (
              <>
                <button
                  onClick={() => setActiveTab('detail')}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-t font-medium transition-colors',
                    activeTab === 'detail'
                      ? 'bg-background text-foreground border-x border-t border-border -mb-px'
                      : 'text-muted-foreground hover:text-foreground',
                  )}>
                  Detail
                </button>
                {customStandards.find((s) => s.id === selected.id) && (
                  <button
                    onClick={() => startEdit(selected)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-t font-medium transition-colors',
                      activeTab === 'add' && editingCustomId
                        ? 'bg-background text-foreground border-x border-t border-border -mb-px'
                        : 'text-muted-foreground hover:text-foreground',
                    )}>
                    <Edit3 className="inline w-3 h-3 mr-1" />
                    Edit
                  </button>
                )}
              </>
            )}
            {activeTab === 'add' && (
              <button className="px-3 py-1.5 text-xs rounded-t font-medium bg-background text-foreground border-x border-t border-border -mb-px">
                {editingCustomId ? '✏️ Edit Standard' : '+ New Standard'}
              </button>
            )}
          </div>
        )}

        {/*  ADD/EDIT PANEL (Monaco)  */}
        {activeTab === 'add' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar row 1: title + file path */}
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-card border-border">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {editingCustomId ? `✏️ ${editingCustomId}` : '+ New Custom Standard'}
                  {editorFilePath && (
                    <span
                      className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]"
                      title={editorFilePath}>
                      📄 {basename(editorFilePath)}
                      {editorDirty ? ' ●' : ''}
                    </span>
                  )}
                  {!editorFilePath && editorDirty && (
                    <span className="text-[10px] text-amber-400">● unsaved</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  JSON editor · Load/Save files · Import &amp; Export collections
                </p>
              </div>

              {/* File status badge */}
              {fileStatus && (
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0',
                    fileStatus.ok
                      ? 'bg-green-500/15 text-green-400 border-green-500/20'
                      : 'bg-red-500/15 text-red-400 border-red-500/20',
                  )}>
                  {fileStatus.msg}
                </span>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-end flex-shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={handleLoadFile}
                  title="Load a JSON file from disk">
                  <FolderOpen className="w-3 h-3" /> Load
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-xs h-7 gap-1',
                    editorDirty && editorFilePath && 'border-amber-500/40 text-amber-400',
                  )}
                  onClick={handleSaveFile}
                  title="Save current JSON to disk">
                  <Save className="w-3 h-3" />
                  {editorDirty && editorFilePath ? 'Save*' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={handleSaveFileAs}
                  title="Save As…">
                  <Download className="w-3 h-3" /> Save As
                </Button>
                <div className="w-px h-4 bg-border mx-0.5" />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={handleImportFile}
                  title="Import standards from a JSON file into the list">
                  <Upload className="w-3 h-3" /> Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={handleExportAll}
                  title="Export all custom standards to a JSON file">
                  <FileJson className="w-3 h-3" /> Export All
                </Button>
                <div className="w-px h-4 bg-border mx-0.5" />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setActiveTab('detail');
                    setEditingCustomId(null);
                    setEditorFilePath(null);
                    setEditorDirty(false);
                  }}>
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1 text-xs text-white bg-blue-600 h-7 hover:bg-blue-700"
                  onClick={handleSaveFromEditor}
                  title="Parse JSON and add/update to standards list">
                  <Check className="w-3 h-3" /> {editingCustomId ? 'Update' : 'Add to List'}
                </Button>
              </div>
            </div>

            {editorError && (
              <div className="px-4 py-2 text-xs text-red-400 border-b bg-red-500/10 border-red-500/20">
                ⚠ {editorError}
              </div>
            )}

            {/* Schema reference */}
            <div className="px-4 py-2 border-b bg-muted/10 border-border">
              <p className="text-[10px] text-muted-foreground">
                <strong className="text-foreground/70">Required fields:</strong> id, name, category,
                description, url, requiredFunctions, tags &nbsp;|&nbsp;
                <strong className="text-foreground/70">Categories:</strong> token · nft · account ·
                defi · gas · signature · access · crosschain · proxy · governance · custom
                &nbsp;|&nbsp;
                <strong className="text-foreground/70">Status:</strong> final · draft · stagnant ·
                custom
              </p>
            </div>

            <div className="flex-1">
              <Editor
                height="100%"
                language="json"
                value={editorJson}
                onChange={(v) => {
                  setEditorJson(v || '');
                  setEditorDirty(true);
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  formatOnPaste: true,
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        )}

        {/*  DETAIL PANEL  */}
        {activeTab === 'detail' && !selected && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <BookOpen className="w-16 h-16 mb-4 text-muted-foreground/10" />
            <p className="text-sm text-muted-foreground">Select a standard to view details</p>
            <p className="mt-1 text-xs text-muted-foreground/50">
              {allStandards.length} standards · {customStandards.length} custom
            </p>
          </div>
        )}

        {activeTab === 'detail' && selected && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={cn(
                        'text-sm font-bold px-2 py-0.5 rounded font-mono',
                        catColor(selected.category),
                      )}>
                      {selected.id}
                    </span>
                    {selected.status && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          statusColor[selected.status] || '',
                        )}>
                        {selected.status}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        catColor(selected.category),
                      )}>
                      {CATEGORY_META[selected.category].icon}{' '}
                      {CATEGORY_META[selected.category].label}
                    </span>
                    {selected.testable && (
                      <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                        ✓ Testable locally
                      </span>
                    )}
                    {selected.since && (
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {selected.since}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{selected.name}</h2>
                </div>
                <div className="flex flex-shrink-0 gap-2 ml-3">
                  {customStandards.find((s) => s.id === selected.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-400 h-7 hover:text-red-300"
                      onClick={() => deleteCustom(selected.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => copyInterface(selected)}>
                    {copiedId === selected.id ? (
                      <>
                        <Check className="w-3 h-3 mr-1 text-green-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" /> Copy Interface
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => window.open(selected.url, '_blank')}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Spec ↗
                  </Button>
                </div>
              </div>

              <p className="mb-6 text-sm leading-relaxed text-foreground/80">
                {selected.description}
              </p>

              {/* Functions / Events grid */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider uppercase text-foreground/70">
                    Required Functions
                  </h3>
                  {selected.requiredFunctions.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">None — protocol-level</p>
                  ) : (
                    <div className="space-y-1">
                      {selected.requiredFunctions.map((fn) => {
                        const found = activeAbi?.abi.some(
                          (i) => i.type === 'function' && i.name === fn,
                        );
                        return (
                          <div key={fn} className="flex items-center gap-2 font-mono text-xs">
                            {activeAbi ? (
                              found ? (
                                <CheckCircle2 className="flex-shrink-0 w-3 h-3 text-green-400" />
                              ) : (
                                <XCircle className="flex-shrink-0 w-3 h-3 text-red-400" />
                              )
                            ) : (
                              <CheckCircle2 className="flex-shrink-0 w-3 h-3 text-green-400/40" />
                            )}
                            <span
                              className={
                                activeAbi
                                  ? found
                                    ? 'text-emerald-400/80'
                                    : 'text-red-400/70'
                                  : 'text-emerald-400/80'
                              }>
                              {fn}()
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {selected.optionalFunctions && selected.optionalFunctions.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold tracking-wider uppercase text-foreground/70">
                        Optional
                      </h3>
                      <div className="space-y-1">
                        {selected.optionalFunctions.map((fn) => {
                          const found = activeAbi?.abi.some(
                            (i) => i.type === 'function' && i.name === fn,
                          );
                          return (
                            <div key={fn} className="flex items-center gap-2 font-mono text-xs">
                              <AlertCircle
                                className={cn(
                                  'flex-shrink-0 w-3 h-3',
                                  found ? 'text-green-400' : 'text-amber-400/50',
                                )}
                              />
                              <span className={found ? 'text-green-400/80' : 'text-foreground/40'}>
                                {fn}()
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selected.events && selected.events.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold tracking-wider uppercase text-foreground/70">
                        Events
                      </h3>
                      <div className="space-y-1">
                        {selected.events.map((ev) => {
                          const found = activeAbi?.abi.some(
                            (i) => i.type === 'event' && i.name === ev,
                          );
                          return (
                            <div key={ev} className="flex items-center gap-2 font-mono text-xs">
                              <span
                                className={cn(
                                  'flex-shrink-0 w-3 h-3 text-sm leading-none',
                                  found ? 'text-green-400' : 'text-purple-400',
                                )}>
                                ⚡
                              </span>
                              <span className={found ? 'text-green-400/80' : 'text-purple-400/80'}>
                                {ev}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selected.errors && selected.errors.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold tracking-wider uppercase text-foreground/70">
                        Custom Errors
                      </h3>
                      <div className="space-y-1">
                        {selected.errors.map((er) => (
                          <div key={er} className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-xs text-red-400/80">⚠</span>
                            <span className="text-red-400/70">{er}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Compliance check — active contract */}
              {activeAbi &&
                selected.requiredFunctions.length > 0 &&
                (() => {
                  const { compliance, missing, missingEvents, foundEvents } = detectCompliance(
                    selected,
                    activeAbi,
                  );
                  return (
                    <div className="mb-6">
                      <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-foreground/70">
                        Compliance — {activeAbi.contractName}
                      </h3>
                      <div className="p-4 border rounded-lg bg-card border-border">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1 h-2 rounded-full bg-muted">
                            <div
                              className="h-full transition-all rounded-full"
                              style={{
                                width: `${compliance}%`,
                                backgroundColor:
                                  compliance === 100
                                    ? '#22c55e'
                                    : compliance > 60
                                      ? '#f59e0b'
                                      : '#ef4444',
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              'text-sm font-bold',
                              compliance === 100
                                ? 'text-green-400'
                                : compliance > 60
                                  ? 'text-amber-400'
                                  : 'text-red-400',
                            )}>
                            {compliance}%
                          </span>
                          {compliance === 100 && (
                            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                              ✓ Fully compliant
                            </span>
                          )}
                        </div>
                        {missing.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className="text-[10px] text-muted-foreground mr-1">
                              Missing functions:
                            </span>
                            {missing.map((f) => (
                              <span
                                key={f}
                                className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                        {missingEvents.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-muted-foreground mr-1">
                              Missing events:
                            </span>
                            {missingEvents.map((e) => (
                              <span
                                key={e}
                                className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                                {e}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* No contract selected but there are ABIs */}
              {!activeAbi &&
                (abis.length > 0 || deployedContracts.length > 0) &&
                selected.requiredFunctions.length > 0 && (
                  <div className="p-3 mb-6 border rounded-lg border-border bg-muted/10">
                    <p className="text-xs text-muted-foreground">
                      ↑ Select a contract above to run compliance check
                    </p>
                  </div>
                )}

              {/* Test note */}
              {selected.testNote && (
                <div className="p-4 mb-4 border rounded-lg bg-blue-500/10 border-blue-500/20">
                  <p className="mb-1 text-xs font-semibold text-blue-400">
                    💡 Testing in Hardhat Studio
                  </p>
                  <p className="text-xs leading-relaxed text-foreground/70">{selected.testNote}</p>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
