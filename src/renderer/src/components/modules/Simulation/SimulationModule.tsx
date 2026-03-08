import { SimModule, SimContext, ContractSuggestion, makeUser, HH_ACCOUNTS } from './types';

// ─── OZ contract snippets ────────────────────────────────────────────────────
const OZ_ERC20: ContractSuggestion = {
  interface: 'IERC20 + mint/burn',
  package: '@openzeppelin/contracts',
  import: 'import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";',
  snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimToken is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("SimToken", "SIM") Ownable(msg.sender) {}
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}`,
};

const OZ_ERC721: ContractSuggestion = {
  interface: 'IERC721 + mint',
  package: '@openzeppelin/contracts',
  import: 'import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";',
  snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    constructor() ERC721("SimNFT", "SNFT") Ownable(msg.sender) {}
    function safeMint(address to, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }
}`,
};

const OZ_GOVERNOR: ContractSuggestion = {
  interface: 'IGovernor',
  package: '@openzeppelin/contracts',
  import: 'import "@openzeppelin/contracts/governance/Governor.sol";',
  snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";

contract SimGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes {
    constructor(IVotes _token)
        Governor("SimGovernor") GovernorSettings(1, 50400, 0) GovernorVotes(_token) {}
    function quorum(uint256) public pure override returns (uint256) { return 4e18; }
}`,
};

const UNISWAP_V2_LIKE: ContractSuggestion = {
  interface: 'IUniswapV2Pair-like AMM',
  package: '@uniswap/v2-core or custom',
  import: '// Implement your own or fork Uniswap V2',
  snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// Minimal AMM: x * y = k
contract SimpleAMM {
    uint256 public reserveA;
    uint256 public reserveB;
    mapping(address => uint256) public lpBalance;
    uint256 public totalLP;

    function addLiquidity(uint256 amtA, uint256 amtB) external returns (uint256 lp) {
        reserveA += amtA; reserveB += amtB;
        lp = sqrt(amtA * amtB);
        lpBalance[msg.sender] += lp; totalLP += lp;
    }
    function swap(uint256 amtIn, bool aToB) external returns (uint256 amtOut) {
        uint256 k = reserveA * reserveB;
        if (aToB) { reserveA += amtIn; reserveB = k / reserveA; amtOut = k / reserveA; }
        else { reserveB += amtIn; reserveA = k / reserveB; amtOut = k / reserveB; }
    }
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2; uint256 y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; } return y;
    }
}`,
};

const LENDING_POOL: ContractSuggestion = {
  interface: 'ILendingPool (Aave-like)',
  package: '@aave/core-v3 or custom',
  import: '// Implement custom or use Aave V3 interface',
  snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract SimpleLending {
    mapping(address => uint256) public collateral;
    mapping(address => uint256) public borrowed;
    uint256 public constant LTV = 75; // 75%
    uint256 public constant LIQ_THRESHOLD = 80; // 80%
    uint256 public oraclePrice = 1000e18;

    function deposit(uint256 amount) external { collateral[msg.sender] += amount; }
    function borrow(uint256 amount) external {
        uint256 maxBorrow = collateral[msg.sender] * oraclePrice * LTV / 100 / 1e18;
        require(borrowed[msg.sender] + amount <= maxBorrow, "Undercollateralized");
        borrowed[msg.sender] += amount;
    }
    function healthFactor(address user) public view returns (uint256) {
        if (borrowed[user] == 0) return type(uint256).max;
        return collateral[user] * oraclePrice * LIQ_THRESHOLD / 100 / 1e18 / borrowed[user];
    }
    function liquidate(address user) external {
        require(healthFactor(user) < 1e18, "Healthy");
        collateral[user] = 0; borrowed[user] = 0;
    }
}`,
};

const FLASHLOAN_CONTRACT: ContractSuggestion = {
  interface: 'IFlashLoanReceiver',
  package: '@aave/core-v3 or custom',
  import: '// Implement flash loan receiver interface',
  snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IFlashLoanReceiver {
    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool);
}
contract FlashLoanArb is IFlashLoanReceiver {
    address public pool;
    constructor(address _pool) { pool = _pool; }
    function executeOperation(address asset, uint256 amount, uint256 premium, address, bytes calldata) external override returns (bool) {
        // 1. Do arbitrage here
        // 2. Approve repayment
        uint256 repay = amount + premium;
        IERC20(asset).approve(pool, repay);
        return true;
    }
    function requestFlashLoan(address asset, uint256 amount) external {
        // IPool(pool).flashLoanSimple(address(this), asset, amount, "", 0);
    }
}
interface IERC20 { function approve(address, uint256) external returns (bool); }`,
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (min: number, max: number) => min + Math.random() * (max - min);
const rndInt = (min: number, max: number) => Math.floor(rnd(min, max + 1));
const fakeTx = () =>
  `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

// ─── MODULE 1: ERC20 Token ───────────────────────────────────────────────────
export const TokenModule: SimModule = {
  id: 'token',
  label: 'ERC-20 Token',
  icon: '🪙',
  category: 'Token',
  desc: 'Full ERC-20 lifecycle simulation',
  longDesc:
    'Simulate mint, burn, transfer, approve, transfer-from, fees, blacklists, snapshots, and supply caps.',
  requiredMethods: [
    'mint',
    'burn',
    'transfer',
    'transferFrom',
    'approve',
    'balanceOf',
    'totalSupply',
  ],
  requiredEvents: ['Transfer', 'Approval'],
  suggestedContracts: [OZ_ERC20],
  params: [
    {
      id: 'mintAmount',
      label: 'Mint per user',
      type: 'number',
      default: '1000',
      hint: 'Tokens minted to each user',
    },
    {
      id: 'burnPct',
      label: 'Burn %',
      type: 'number',
      default: '10',
      hint: 'Percentage to burn from user 0',
    },
    { id: 'transferAmount', label: 'Transfer amount', type: 'number', default: '50' },
    {
      id: 'fee',
      label: 'Transfer fee % (sim only)',
      type: 'number',
      default: '0',
      hint: '0 = no fee',
    },
    { id: 'supplyCap', label: 'Supply cap (0=unlimited)', type: 'number', default: '0' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'standard',
      options: ['standard', 'inflation', 'deflation', 'blacklist', 'snapshot', 'permit'],
    },
  ],
  async run(ctx, p) {
    const mint = parseFloat(p.mintAmount) || 1000;
    const burnPct = parseFloat(p.burnPct) || 10;
    const transfer = parseFloat(p.transferAmount) || 50;
    const fee = parseFloat(p.fee) || 0;
    const cap = parseFloat(p.supplyCap) || 0;

    ctx.log('info', 'ERC20', `🚀 Token simulation: ${p.scenario}`);
    await ctx.sleep(200);

    // Mint phase
    for (const [i, u] of ctx.users.entries()) {
      if (ctx.stop()) return;
      await ctx.sleep(300);
      const r = await ctx.callContract(
        'ERC20Token',
        'mint',
        [u.address, mint],
        ctx.users[0].privateKey,
      );
      if (r.ok) {
        ctx.log('mint', u.label, `Minted ${mint.toLocaleString()} tokens`, mint, true, true);
      } else {
        ctx.log(
          'mint',
          u.label,
          `Minted ${mint.toLocaleString()} tokens (simulated)`,
          mint,
          true,
          false,
        );
      }
      ctx.setUsers((prev) =>
        prev.map((x, j) => (j === i ? { ...x, balanceToken: x.balanceToken + mint } : x)),
      );
      ctx.setPool((prev) => ({ ...prev, tokenTotalSupply: prev.tokenTotalSupply + mint }));
    }

    // Supply cap check
    if (cap > 0) {
      const total = mint * ctx.users.length;
      ctx.log(
        'info',
        'ERC20',
        `Supply cap: ${cap.toLocaleString()} | Current: ${total.toLocaleString()} | ${total >= cap ? '⚠️ AT CAP' : '✅ Under cap'}`,
      );
      await ctx.sleep(200);
    }

    // Transfer with optional fee
    if (!ctx.stop() && ctx.users.length >= 2) {
      await ctx.sleep(400);
      const from = ctx.users[0],
        to = ctx.users[1];
      const feeAmt = (transfer * fee) / 100;
      const received = transfer - feeAmt;
      const r = await ctx.callContract(
        'ERC20Token',
        'transfer',
        [to.address, transfer],
        from.privateKey,
      );
      ctx.log(
        'transfer',
        from.label,
        `→ ${to.label}: ${transfer} tokens${feeAmt > 0 ? ` (fee: ${feeAmt.toFixed(2)})` : ''}`,
        transfer,
        true,
        r.ok,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) => {
          if (j === 0) return { ...x, balanceToken: x.balanceToken - transfer };
          if (j === 1) return { ...x, balanceToken: x.balanceToken + received };
          return x;
        }),
      );
    }

    // Approve + transferFrom
    if (!ctx.stop() && ctx.users.length >= 3) {
      await ctx.sleep(400);
      const owner = ctx.users[1],
        spender = ctx.users[2];
      await ctx.callContract('ERC20Token', 'approve', [spender.address, 200], owner.privateKey);
      ctx.log('approve', owner.label, `Approved ${spender.label} to spend 200 tokens`);
      await ctx.sleep(300);
      await ctx.callContract(
        'ERC20Token',
        'transferFrom',
        [owner.address, spender.address, 100],
        spender.privateKey,
      );
      ctx.log(
        'transfer',
        spender.label,
        `transferFrom ${owner.label}: 100 tokens (allowance)`,
        100,
        true,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) => {
          if (j === 1) return { ...x, balanceToken: x.balanceToken - 100 };
          if (j === 2) return { ...x, balanceToken: x.balanceToken + 100 };
          return x;
        }),
      );
    }

    // Scenario-specific
    if (p.scenario === 'snapshot') {
      await ctx.sleep(400);
      ctx.log('info', 'ERC20', '📸 Taking token snapshot (ERC20Snapshot.snapshot())');
      await ctx.callContract('ERC20Token', 'snapshot', []);
      ctx.log('info', 'ERC20', '✅ Snapshot recorded — balances frozen at this block');
    }

    if (p.scenario === 'blacklist') {
      await ctx.sleep(400);
      const target = ctx.users[ctx.users.length - 1];
      ctx.log('warn', 'ERC20', `🚫 Blacklisting ${target.label} — transfers blocked`);
      await ctx.callContract('ERC20Token', 'blacklist', [target.address]);
      await ctx.sleep(300);
      const r = await ctx.callContract(
        'ERC20Token',
        'transfer',
        [target.address, 100],
        ctx.users[0].privateKey,
      );
      ctx.log('error', target.label, `Transfer to blacklisted address → REVERTED`, 0, false, r.ok);
    }

    // Burn phase
    if (!ctx.stop()) {
      await ctx.sleep(400);
      const u = ctx.users[0];
      const burnAmt = (u.balanceToken * burnPct) / 100;
      const r = await ctx.callContract('ERC20Token', 'burn', [burnAmt], u.privateKey);
      ctx.log(
        'burn',
        u.label,
        `🔥 Burned ${burnAmt.toFixed(0)} tokens (${burnPct}%)`,
        burnAmt,
        true,
        r.ok,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) =>
          j === 0 ? { ...x, balanceToken: Math.max(0, x.balanceToken - burnAmt) } : x,
        ),
      );
      ctx.setPool((prev) => ({
        ...prev,
        tokenTotalSupply: Math.max(0, prev.tokenTotalSupply - burnAmt),
      }));
    }

    ctx.log('success', 'ERC20', '✅ Token simulation complete');
  },
};

// ─── MODULE 2: NFT ───────────────────────────────────────────────────────────
export const NFTModule: SimModule = {
  id: 'nft',
  label: 'NFT (ERC-721/1155)',
  icon: '🖼️',
  category: 'NFT',
  desc: 'Mint, transfer, royalties, staking, fractionalization',
  longDesc:
    'Full NFT lifecycle: safe mint, batch mint, URI, burn, royalties (EIP-2981), staking, fractionalization.',
  requiredMethods: ['safeMint', 'transferFrom', 'ownerOf', 'tokenURI'],
  requiredEvents: ['Transfer'],
  suggestedContracts: [OZ_ERC721],
  params: [
    { id: 'mintCount', label: 'NFTs to mint', type: 'number', default: '3' },
    { id: 'royaltyPct', label: 'Royalty %', type: 'number', default: '5' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'lifecycle',
      options: ['lifecycle', 'batch_mint', 'royalty', 'staking', 'fractionalize'],
    },
  ],
  async run(ctx, p) {
    const count = parseInt(p.mintCount) || 3;
    const royalty = parseFloat(p.royaltyPct) || 5;
    ctx.log('info', 'NFT', `🖼️ NFT simulation: ${p.scenario}`);
    await ctx.sleep(200);

    let nextId = 0;

    // Mint NFTs
    for (let i = 0; i < count && !ctx.stop(); i++) {
      await ctx.sleep(350);
      const owner = ctx.users[i % ctx.users.length];
      const tokenId = nextId++;
      const uri = `ipfs://Qm${fakeTx().slice(2, 46)}/${tokenId}`;
      const r = await ctx.callContract(
        'NFT',
        'safeMint',
        [owner.address, uri],
        ctx.users[0].privateKey,
      );
      ctx.log(
        'nft_mint',
        owner.label,
        `Minted NFT #${tokenId} | URI: ${uri.slice(0, 30)}…`,
        tokenId,
        true,
        r.ok,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) =>
          j === i % prev.length ? { ...x, balanceNFT: [...x.balanceNFT, tokenId] } : x,
        ),
      );
      ctx.setPool((prev) => ({ ...prev, nftTotalSupply: prev.nftTotalSupply + 1 }));
    }

    // Transfer NFT
    if (!ctx.stop() && ctx.users.length >= 2 && ctx.users[0].balanceNFT.length > 0) {
      await ctx.sleep(400);
      const from = ctx.users[0],
        to = ctx.users[1];
      const tokenId = from.balanceNFT[0];
      const r = await ctx.callContract(
        'NFT',
        'transferFrom',
        [from.address, to.address, tokenId],
        from.privateKey,
      );
      ctx.log(
        'nft_transfer',
        from.label,
        `Transferred NFT #${tokenId} → ${to.label}`,
        tokenId,
        true,
        r.ok,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) => {
          if (j === 0) return { ...x, balanceNFT: x.balanceNFT.filter((id) => id !== tokenId) };
          if (j === 1) return { ...x, balanceNFT: [...x.balanceNFT, tokenId] };
          return x;
        }),
      );
    }

    if (p.scenario === 'royalty') {
      await ctx.sleep(400);
      const salePrice = 1.0;
      const royaltyAmt = (salePrice * royalty) / 100;
      ctx.log(
        'info',
        'NFT',
        `🏷️ EIP-2981 Royalty: ${royalty}% on ${salePrice} ETH sale = ${royaltyAmt} ETH to creator`,
      );
      ctx.log(
        'nft_sale',
        'Marketplace',
        `NFT #0 sold for ${salePrice} ETH | Creator receives ${royaltyAmt} ETH royalty`,
        salePrice,
      );
    }

    if (p.scenario === 'staking') {
      await ctx.sleep(400);
      const staker = ctx.users[0];
      ctx.log('info', 'NFT', `🔒 Staking NFT #0 — locked in staking contract`);
      await ctx.callContract('NFTStaking', 'stake', [0], staker.privateKey);
      ctx.setUsers((prev) =>
        prev.map((x, j) => (j === 0 ? { ...x, stakedAmount: x.stakedAmount + 1 } : x)),
      );
      ctx.log('info', 'NFT', `⏱️ Accumulating staking rewards over time...`);
      for (let t = 0; t < 3 && !ctx.stop(); t++) {
        await ctx.sleep(500);
        ctx.log(
          'info',
          staker.label,
          `Staking reward: +${(0.01 * (t + 1)).toFixed(3)} tokens (block ${t + 1})`,
        );
      }
    }

    if (p.scenario === 'fractionalize') {
      await ctx.sleep(400);
      ctx.log('info', 'NFT', `✂️ Fractionalization: NFT #0 → 1,000,000 FRAC tokens`);
      ctx.log('info', 'NFT', `Each fraction = ${((1 / 1000000) * 100).toFixed(8)}% ownership`);
      ctx.setPool((prev) => ({ ...prev, tokenTotalSupply: prev.tokenTotalSupply + 1000000 }));
    }

    ctx.log('success', 'NFT', '✅ NFT simulation complete');
  },
};

// ─── MODULE 3: NFT Marketplace ───────────────────────────────────────────────
export const NFTMarketModule: SimModule = {
  id: 'nft_market',
  label: 'NFT Marketplace',
  icon: '🏪',
  category: 'NFT',
  desc: 'List, buy, auction, bid wars, Dutch auction',
  longDesc:
    'Simulate full marketplace flows: fixed price listing, English auction, Dutch auction, bid wars, and fee distribution.',
  requiredMethods: ['list', 'buy', 'cancelListing', 'createAuction', 'bid'],
  requiredEvents: ['Listed', 'Sale', 'BidPlaced'],
  suggestedContracts: [OZ_ERC721],
  params: [
    { id: 'listPrice', label: 'List Price (ETH)', type: 'number', default: '1.5' },
    { id: 'marketFee', label: 'Marketplace Fee %', type: 'number', default: '2.5' },
    { id: 'royaltyPct', label: 'Royalty %', type: 'number', default: '5' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'fixed',
      options: ['fixed', 'auction', 'dutch', 'bid_war', 'cancel'],
    },
    { id: 'bidders', label: 'Number of bidders', type: 'number', default: '3' },
  ],
  async run(ctx, p) {
    const price = parseFloat(p.listPrice) || 1.5;
    const fee = parseFloat(p.marketFee) || 2.5;
    const royalty = parseFloat(p.royaltyPct) || 5;
    const bidderCount = parseInt(p.bidders) || 3;
    ctx.log('info', 'Marketplace', `🏪 NFT Marketplace: ${p.scenario}`);
    await ctx.sleep(200);

    if (p.scenario === 'fixed') {
      const seller = ctx.users[0],
        buyer = ctx.users[1] || ctx.users[0];
      ctx.log('nft_list', seller.label, `Listed NFT #0 at ${price} ETH`);
      await ctx.sleep(400);
      const feeAmt = (price * fee) / 100;
      const royaltyAmt = (price * royalty) / 100;
      const sellerReceives = price - feeAmt - royaltyAmt;
      const r = await ctx.callContract('NFTMarketplace', 'buy', [0], buyer.privateKey);
      ctx.log('nft_sale', buyer.label, `Bought NFT #0 for ${price} ETH`, price, true, r.ok);
      ctx.log(
        'info',
        'Marketplace',
        `Fee: ${feeAmt.toFixed(4)} ETH | Royalty: ${royaltyAmt.toFixed(4)} ETH | Seller nets: ${sellerReceives.toFixed(4)} ETH`,
      );
    }

    if (p.scenario === 'auction') {
      const seller = ctx.users[0];
      ctx.log(
        'info',
        'Marketplace',
        `🔨 Starting English auction for NFT #0 | Reserve: ${price} ETH`,
      );
      await ctx.sleep(400);
      let highBid = price;
      let highBidder = '';
      for (let i = 0; i < Math.min(bidderCount, ctx.users.length - 1) && !ctx.stop(); i++) {
        await ctx.sleep(500);
        const bidder = ctx.users[i + 1];
        const bid = highBid * (1.05 + Math.random() * 0.1);
        highBid = bid;
        highBidder = bidder.label;
        await ctx.callContract('NFTMarketplace', 'bid', [0, bid], bidder.privateKey);
        ctx.log('nft_bid', bidder.label, `Bid: ${bid.toFixed(4)} ETH 🔥`, bid);
      }
      await ctx.sleep(400);
      ctx.log(
        'nft_sale',
        highBidder,
        `SOLD to ${highBidder} for ${highBid.toFixed(4)} ETH`,
        highBid,
      );
    }

    if (p.scenario === 'dutch') {
      const startPrice = price * 2;
      const endPrice = price * 0.5;
      const steps = 6;
      const drop = (startPrice - endPrice) / steps;
      ctx.log(
        'info',
        'Marketplace',
        `📉 Dutch auction: ${startPrice.toFixed(2)} → ${endPrice.toFixed(2)} ETH`,
      );
      let current = startPrice;
      for (let i = 0; i <= steps && !ctx.stop(); i++) {
        await ctx.sleep(500);
        ctx.log('price', 'Dutch', `Price: ${current.toFixed(4)} ETH`, current);
        if (current <= price && i > 2) {
          const buyer = ctx.users[1] || ctx.users[0];
          ctx.log(
            'nft_sale',
            buyer.label,
            `Bought at ${current.toFixed(4)} ETH — Dutch auction ended`,
            current,
          );
          break;
        }
        current -= drop;
      }
    }

    if (p.scenario === 'bid_war') {
      ctx.log('info', 'Marketplace', `⚔️ Bid war simulation!`);
      let bid = price;
      const bidWarUsers = ctx.users.slice(0, Math.min(bidderCount, ctx.users.length));
      for (let round = 0; round < 5 && !ctx.stop(); round++) {
        const bidder = bidWarUsers[round % bidWarUsers.length];
        bid *= 1.08 + Math.random() * 0.07;
        await ctx.sleep(350);
        ctx.log('nft_bid', bidder.label, `🔥 ${bid.toFixed(4)} ETH (outbid!)`, bid);
      }
      ctx.log('nft_sale', ctx.users[0].label, `FINAL: ${bid.toFixed(4)} ETH`, bid);
    }

    ctx.log('success', 'Marketplace', '✅ Marketplace simulation complete');
  },
};

// ─── MODULE 4: AMM / DEX ─────────────────────────────────────────────────────
export const AMMModule: SimModule = {
  id: 'amm',
  label: 'AMM / DEX',
  icon: '🔄',
  category: 'DeFi',
  desc: 'Liquidity, swaps, slippage, impermanent loss, TWAP',
  longDesc:
    'Simulate Uniswap V2-style AMM: add/remove liquidity, swaps, price impact, slippage, impermanent loss, arbitrage, and TWAP.',
  requiredMethods: ['addLiquidity', 'removeLiquidity', 'swap', 'getReserves', 'quote'],
  requiredEvents: ['Swap', 'Mint', 'Burn', 'Sync'],
  suggestedContracts: [UNISWAP_V2_LIKE],
  params: [
    { id: 'reserveA', label: 'Reserve A', type: 'number', default: '100000' },
    { id: 'reserveB', label: 'Reserve B', type: 'number', default: '100000' },
    { id: 'swapAmount', label: 'Swap Amount', type: 'number', default: '1000' },
    { id: 'slippageTolerance', label: 'Slippage Tolerance %', type: 'number', default: '0.5' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'swap',
      options: [
        'swap',
        'add_liquidity',
        'remove_liquidity',
        'impermanent_loss',
        'arbitrage',
        'multihop',
        'twap',
      ],
    },
    { id: 'steps', label: 'Steps', type: 'number', default: '5' },
  ],
  async run(ctx, p) {
    let rA = parseFloat(p.reserveA) || 100000;
    let rB = parseFloat(p.reserveB) || 100000;
    const swapAmt = parseFloat(p.swapAmount) || 1000;
    const slippage = parseFloat(p.slippageTolerance) || 0.5;
    const steps = parseInt(p.steps) || 5;

    ctx.setPool((prev) => ({ ...prev, reserveA: rA, reserveB: rB }));
    ctx.log(
      'info',
      'AMM',
      `🔄 AMM simulation: ${p.scenario} | Pool: ${rA.toLocaleString()} A / ${rB.toLocaleString()} B`,
    );
    await ctx.sleep(200);

    const price = () => rB / rA;
    const spotPrice = () => (rA / rB).toFixed(6);
    const kInvariant = () => rA * rB;

    if (p.scenario === 'swap' || p.scenario === 'multihop') {
      for (let i = 0; i < (p.scenario === 'multihop' ? 3 : steps) && !ctx.stop(); i++) {
        await ctx.sleep(400);
        const amt = swapAmt * (0.8 + Math.random() * 0.4);
        const prevPrice = price();
        const k = kInvariant();
        const newRa = rA + amt;
        const newRb = k / newRa;
        const received = rB - newRb;
        const priceImpact = Math.abs(((price() - (rB - received) / (rA + amt)) / price()) * 100);
        const minOut = received * (1 - slippage / 100);

        if (priceImpact > slippage) {
          ctx.log(
            'warn',
            'AMM',
            `⚠️ Price impact ${priceImpact.toFixed(2)}% > tolerance ${slippage}%`,
          );
        }

        rA = newRa;
        rB = newRb;
        const user = ctx.users[i % ctx.users.length];
        const r = await ctx.callContract('AMM', 'swap', [amt, true, minOut], user.privateKey);
        ctx.log(
          'swap',
          user.label,
          `Swap ${amt.toFixed(0)} A → ${received.toFixed(2)} B | Impact: ${priceImpact.toFixed(3)}%`,
          received,
          true,
          r.ok,
        );
        ctx.setPool((prev) => ({ ...prev, reserveA: rA, reserveB: rB }));
        if (p.scenario === 'multihop')
          ctx.log('swap', user.label, `↳ Multi-hop hop ${i + 1}: via intermediate pool`, received);
      }
    }

    if (p.scenario === 'add_liquidity') {
      const user = ctx.users[0];
      const addA = swapAmt,
        addB = swapAmt * price();
      const lp = Math.sqrt(addA * addB);
      const r = await ctx.callContract('AMM', 'addLiquidity', [addA, addB], user.privateKey);
      ctx.log(
        'addLiq',
        user.label,
        `Added ${addA.toFixed(0)} A + ${addB.toFixed(0)} B → ${lp.toFixed(2)} LP tokens`,
        lp,
        true,
        r.ok,
      );
      rA += addA;
      rB += addB;
      ctx.setUsers((prev) =>
        prev.map((x, j) => (j === 0 ? { ...x, lpTokens: x.lpTokens + lp } : x)),
      );
      ctx.setPool((prev) => ({
        ...prev,
        reserveA: rA,
        reserveB: rB,
        lpTotalSupply: prev.lpTotalSupply + lp,
      }));
    }

    if (p.scenario === 'impermanent_loss') {
      ctx.log('info', 'AMM', `📊 Impermanent Loss Analysis`);
      const initPrice = price();
      const amounts = [0.5, 0.75, 1.25, 1.5, 2.0, 3.0];
      for (const priceRatio of amounts) {
        await ctx.sleep(350);
        const newPrice = initPrice * priceRatio;
        const newRa = Math.sqrt(kInvariant() / newPrice);
        const newRb = Math.sqrt(kInvariant() * newPrice);
        const valueLP = 2 * Math.sqrt(newRa * newRb * initPrice * (newPrice / initPrice));
        const valueHODL = rA * newPrice + rB;
        const il = (valueLP / valueHODL - 1) * 100;
        ctx.log(
          'info',
          'AMM',
          `Price ${(priceRatio * 100).toFixed(0)}% → IL: ${il.toFixed(2)}%`,
          Math.abs(il),
        );
      }
    }

    if (p.scenario === 'arbitrage') {
      ctx.log('info', 'AMM', `⚡ Arbitrage simulation`);
      const marketPrice = price() * 1.05;
      ctx.log(
        'info',
        'AMM',
        `Pool price: ${spotPrice()} | Market price: ${marketPrice.toFixed(6)}`,
      );
      await ctx.sleep(400);
      const arbAmt = Math.sqrt(kInvariant() * marketPrice) - rA;
      const profit = arbAmt * (marketPrice - price()) * 0.8;
      ctx.log(
        'swap',
        'Arbitrageur',
        `Arb swap: ${arbAmt.toFixed(2)} A → profit: $${profit.toFixed(2)}`,
        profit,
      );
    }

    if (p.scenario === 'twap') {
      ctx.log('info', 'AMM', `⏱️ TWAP Oracle simulation`);
      let cumPrice = 0;
      for (let i = 0; i < steps && !ctx.stop(); i++) {
        await ctx.sleep(400);
        const amt = rnd(100, 1000);
        rA += amt * (Math.random() > 0.5 ? 1 : -0.5);
        rB = kInvariant() / rA;
        cumPrice += price();
        ctx.log(
          'oracle',
          'TWAP',
          `Block ${i + 1}: spot=${spotPrice()} | TWAP=${(cumPrice / (i + 1)).toFixed(6)}`,
          price(),
        );
        ctx.setPool((prev) => ({ ...prev, reserveA: rA, reserveB: rB }));
      }
    }

    ctx.log('success', 'AMM', '✅ AMM simulation complete');
  },
};

// ─── MODULE 5: Lending Protocol ──────────────────────────────────────────────
export const LendingModule: SimModule = {
  id: 'lending',
  label: 'Lending Protocol',
  icon: '🏦',
  category: 'DeFi',
  desc: 'Deposit, borrow, repay, health factor, interest',
  longDesc:
    'Simulate Aave/Compound-like lending: collateral deposit, variable-rate borrow, interest accrual, repayment, and liquidation engine.',
  requiredMethods: ['deposit', 'borrow', 'repay', 'withdraw', 'liquidate', 'healthFactor'],
  requiredEvents: ['Deposit', 'Borrow', 'Repay', 'Liquidate'],
  suggestedContracts: [LENDING_POOL],
  params: [
    { id: 'depositAmt', label: 'Deposit per user (ETH)', type: 'number', default: '500' },
    { id: 'borrowPct', label: 'Borrow % of max', type: 'number', default: '70' },
    { id: 'ltv', label: 'LTV %', type: 'number', default: '75' },
    { id: 'liqThreshold', label: 'Liquidation threshold %', type: 'number', default: '80' },
    { id: 'baseRate', label: 'Base interest rate %', type: 'number', default: '3' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'lifecycle',
      options: ['lifecycle', 'interest_accrual', 'near_liquidation', 'variable_rate'],
    },
  ],
  async run(ctx, p) {
    const deposit = parseFloat(p.depositAmt) || 500;
    const borrowPct = parseFloat(p.borrowPct) / 100 || 0.7;
    const ltv = parseFloat(p.ltv) / 100 || 0.75;
    const liqTh = parseFloat(p.liqThreshold) / 100 || 0.8;
    const baseRate = parseFloat(p.baseRate) || 3;
    const price = ctx.pool.collateralPrice;

    ctx.log(
      'info',
      'Lending',
      `🏦 Lending: ${p.scenario} | LTV: ${p.ltv}% | LiqTh: ${p.liqThreshold}%`,
    );
    await ctx.sleep(200);

    // Deposit phase
    for (const [i, u] of ctx.users.entries()) {
      if (ctx.stop()) return;
      await ctx.sleep(350);
      const r = await ctx.callContract('LendingPool', 'deposit', [deposit], u.privateKey);
      ctx.log('deposit', u.label, `Deposited ${deposit} ETH as collateral`, deposit, true, r.ok);
      ctx.setUsers((prev) =>
        prev.map((x, j) =>
          j === i ? { ...x, balanceCollateral: x.balanceCollateral + deposit } : x,
        ),
      );
      ctx.setPool((prev) => ({ ...prev, totalDeposited: prev.totalDeposited + deposit }));
    }

    // Borrow phase
    let totalBorrowed = 0;
    for (const [i, u] of ctx.users.entries()) {
      if (ctx.stop()) return;
      await ctx.sleep(450);
      const maxBorrow = deposit * price * ltv;
      const actualBorrow = maxBorrow * borrowPct;
      const hf = (deposit * price * liqTh) / actualBorrow;
      const r = await ctx.callContract('LendingPool', 'borrow', [actualBorrow], u.privateKey);
      ctx.log(
        'borrow',
        u.label,
        `Borrowed $${actualBorrow.toFixed(0)} | HF: ${hf.toFixed(2)} | Rate: ${(baseRate + (totalBorrowed / (deposit * ctx.users.length * price)) * 15).toFixed(2)}%`,
        actualBorrow,
        true,
        r.ok,
      );
      totalBorrowed += actualBorrow;
      ctx.setUsers((prev) =>
        prev.map((x, j) =>
          j === i ? { ...x, borrowedAmount: x.borrowedAmount + actualBorrow, healthFactor: hf } : x,
        ),
      );
      ctx.setPool((prev) => ({
        ...prev,
        totalBorrowed: prev.totalBorrowed + actualBorrow,
        utilizationRate:
          ((prev.totalBorrowed + actualBorrow) / (prev.totalDeposited * price)) * 100,
        interestRate: baseRate + (totalBorrowed / (deposit * ctx.users.length * price)) * 15,
      }));
    }

    if (p.scenario === 'interest_accrual') {
      ctx.log('info', 'Lending', `⏱️ Simulating interest accrual over time...`);
      for (let day = 1; day <= 5 && !ctx.stop(); day++) {
        await ctx.sleep(400);
        const util = ctx.pool.utilizationRate / 100;
        const rate = baseRate + util * 15;
        const dailyRate = rate / 365 / 100;
        totalBorrowed *= 1 + dailyRate;
        ctx.log(
          'info',
          'Lending',
          `Day ${day}: Rate ${rate.toFixed(2)}% | Total debt: $${totalBorrowed.toFixed(0)} (daily +${(dailyRate * 100).toFixed(4)}%)`,
        );
        ctx.setPool((prev) => ({ ...prev, totalBorrowed, interestRate: rate }));
      }
    }

    // Repay (first user, 50%)
    if (!ctx.stop() && ctx.users[0].borrowedAmount > 0) {
      await ctx.sleep(500);
      const repay = ctx.users[0].borrowedAmount * 0.5;
      const r = await ctx.callContract('LendingPool', 'repay', [repay], ctx.users[0].privateKey);
      ctx.log(
        'repay',
        ctx.users[0].label,
        `Repaid $${repay.toFixed(0)} (50% of debt)`,
        repay,
        true,
        r.ok,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) =>
          j === 0
            ? {
                ...x,
                borrowedAmount: x.borrowedAmount - repay,
                healthFactor: Math.min(999, x.healthFactor * 2),
              }
            : x,
        ),
      );
      ctx.setPool((prev) => ({ ...prev, totalBorrowed: Math.max(0, prev.totalBorrowed - repay) }));
    }

    ctx.log('success', 'Lending', '✅ Lending simulation complete');
  },
};

// ─── MODULE 6: Liquidation ───────────────────────────────────────────────────
export const LiquidationModule: SimModule = {
  id: 'liquidation',
  label: 'Liquidation Engine',
  icon: '🔴',
  category: 'DeFi',
  desc: 'Single, cascade, bad debt, liquidation bonus',
  longDesc:
    'Simulate liquidation engine: single liquidation, cascade events, bad debt, liquidation bonus math.',
  requiredMethods: ['liquidate', 'healthFactor', 'getAccountData'],
  requiredEvents: ['Liquidate', 'BadDebt'],
  suggestedContracts: [LENDING_POOL],
  params: [
    { id: 'users', label: 'Users at risk', type: 'number', default: '4' },
    { id: 'bonus', label: 'Liquidation bonus %', type: 'number', default: '5' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'single',
      options: ['single', 'cascade', 'bad_debt', 'failed'],
    },
  ],
  async run(ctx, p) {
    const bonus = parseFloat(p.bonus) / 100 || 0.05;
    const count = parseInt(p.users) || 4;
    ctx.log('info', 'Liquidation', `🔴 Liquidation simulation: ${p.scenario}`);
    await ctx.sleep(200);

    // Set up at-risk positions
    const atRisk = ctx.users.slice(0, Math.min(count, ctx.users.length)).map((u, i) => ({
      ...u,
      borrowedAmount: 400 + i * 50,
      balanceCollateral: 0.5 + i * 0.1,
      healthFactor: 0.95 + i * 0.05,
    }));
    ctx.setUsers((prev) => prev.map((x, i) => (i < atRisk.length ? atRisk[i] : x)));

    for (const [i, u] of atRisk.entries()) {
      if (ctx.stop()) return;
      if (p.scenario === 'single' && i > 0) break;

      await ctx.sleep(400);
      const hf = u.healthFactor;
      const collateralValue = u.balanceCollateral * ctx.pool.collateralPrice;
      const bonusAmt = u.borrowedAmount * bonus;
      const liquidatorProfit = bonusAmt;

      if (p.scenario === 'failed') {
        ctx.log(
          'error',
          'Liquidator',
          `Liquidation attempt failed — HF ${hf.toFixed(3)} > 1.0 (position healthy)`,
          0,
          false,
        );
        break;
      }

      if (p.scenario === 'bad_debt' && i === atRisk.length - 1) {
        const shortfall = u.borrowedAmount - collateralValue;
        ctx.log(
          'error',
          'Protocol',
          `🚨 BAD DEBT: Collateral $${collateralValue.toFixed(0)} < Debt $${u.borrowedAmount.toFixed(0)} | Shortfall: $${shortfall.toFixed(0)}`,
          shortfall,
          false,
        );
        ctx.log(
          'warn',
          'Protocol',
          `Protocol must absorb $${shortfall.toFixed(0)} bad debt from reserve fund`,
        );
        continue;
      }

      const r = await ctx.callContract(
        'LendingPool',
        'liquidate',
        [u.address, u.borrowedAmount * 0.5],
        ctx.users[0].privateKey,
      );
      ctx.log(
        'liquidate',
        'Liquidator',
        `🔴 LIQUIDATED ${u.label} | HF: ${hf.toFixed(3)} | Debt: $${u.borrowedAmount.toFixed(0)} | Bonus: $${bonusAmt.toFixed(0)}`,
        u.borrowedAmount,
        true,
        r.ok,
      );
      ctx.setUsers((prev) =>
        prev.map((x, j) =>
          j === i ? { ...x, borrowedAmount: 0, balanceCollateral: 0, healthFactor: 0 } : x,
        ),
      );

      if (p.scenario === 'cascade') {
        await ctx.sleep(200);
        ctx.log(
          'warn',
          'Liquidation',
          `↳ Cascade: liquidation sale lowers price → triggers next liquidation`,
        );
        ctx.setPool((prev) => ({ ...prev, collateralPrice: prev.collateralPrice * 0.97 }));
      }
    }

    ctx.log('success', 'Liquidation', '✅ Liquidation simulation complete');
  },
};

// ─── MODULE 7: Flash Loan ────────────────────────────────────────────────────
export const FlashLoanModule: SimModule = {
  id: 'flashloan',
  label: 'Flash Loan',
  icon: '⚡',
  category: 'DeFi',
  desc: 'Flash borrow, arb, repay, attack vectors',
  longDesc:
    'Simulate flash loans: borrow-arb-repay in single block, flash liquidations, and flash loan attack vectors.',
  requiredMethods: ['flashLoan', 'flashLoanSimple', 'executeOperation'],
  requiredEvents: ['FlashLoan'],
  suggestedContracts: [FLASHLOAN_CONTRACT],
  params: [
    { id: 'loanAmount', label: 'Loan Amount ($)', type: 'number', default: '100000' },
    { id: 'fee', label: 'Fee %', type: 'number', default: '0.09' },
    { id: 'arbProfit', label: 'Arb Profit ($)', type: 'number', default: '500' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'arb',
      options: ['arb', 'flash_liquidation', 'attack', 'failed_repay'],
    },
  ],
  async run(ctx, p) {
    const amount = parseFloat(p.loanAmount) || 100000;
    const fee = (amount * parseFloat(p.fee)) / 100;
    const profit = parseFloat(p.arbProfit) || 500;
    const actor = ctx.users[0]?.label || 'Arbitrageur';
    ctx.log('info', 'FlashLoan', `⚡ Flash Loan: ${p.scenario} | $${amount.toLocaleString()}`);
    await ctx.sleep(200);

    ctx.log(
      'flashloan',
      actor,
      `📋 Requesting flash loan: $${amount.toLocaleString()} (fee: $${fee.toFixed(2)})`,
      amount,
    );
    await ctx.sleep(400);
    ctx.log(
      'flashloan',
      actor,
      `✅ Loan received in tx — must repay $${(amount + fee).toLocaleString()} before end`,
    );

    if (p.scenario === 'arb') {
      await ctx.sleep(500);
      ctx.log('swap', actor, `→ DEX A: $${amount.toLocaleString()} USDC → tokens at rate 1.000`);
      await ctx.sleep(300);
      ctx.log(
        'swap',
        actor,
        `→ DEX B: tokens → $${(amount + profit).toLocaleString()} USDC at rate 1.005`,
      );
      await ctx.sleep(400);
      const netProfit = profit - fee;
      const r = await ctx.callContract(
        'FlashLoan',
        'flashLoanSimple',
        [amount],
        ctx.users[0].privateKey,
      );
      if (netProfit > 0) {
        ctx.log(
          'success',
          actor,
          `🎉 Net profit: $${netProfit.toFixed(2)} | In ONE block`,
          netProfit,
          true,
          r.ok,
        );
      } else {
        ctx.log(
          'error',
          actor,
          `❌ Unprofitable: profit $${profit} < fee $${fee.toFixed(2)} → TX REVERTED`,
          0,
          false,
        );
      }
    }

    if (p.scenario === 'flash_liquidation') {
      ctx.log('flashloan', actor, `→ Used flash loan to liquidate undercollateralized position`);
      await ctx.sleep(400);
      const liqProfit = amount * 0.05;
      ctx.log(
        'liquidate',
        actor,
        `→ Liquidated: received ${(amount + liqProfit).toLocaleString()} collateral`,
        liqProfit,
      );
      await ctx.sleep(300);
      ctx.log(
        'flashloan',
        actor,
        `→ Repaid ${(amount + fee).toLocaleString()} | Net: $${(liqProfit - fee).toFixed(2)}`,
      );
    }

    if (p.scenario === 'attack') {
      ctx.log('warn', 'Security', `⚠️ Flash loan governance attack simulation`);
      await ctx.sleep(400);
      ctx.log('flashloan', actor, `→ Borrowed ${amount.toLocaleString()} governance tokens`);
      await ctx.sleep(300);
      ctx.log('vote', actor, `→ Voted with flash-borrowed voting power — QUORUM MET`);
      await ctx.sleep(300);
      ctx.log(
        'error',
        'Security',
        `🚨 ATTACK: Malicious proposal passed using flash-borrowed votes`,
        0,
        false,
      );
      ctx.log(
        'warn',
        'Mitigation',
        `✅ Fix: use ERC20Snapshot or block.number check for voting power`,
      );
    }

    if (p.scenario === 'failed_repay') {
      await ctx.sleep(500);
      ctx.log('error', actor, `❌ Insufficient funds to repay loan + fee → REVERT`, 0, false);
      ctx.log(
        'info',
        'FlashLoan',
        `↳ Transaction reverted — no state changes committed. Funds safe.`,
      );
    }

    ctx.log('success', 'FlashLoan', '✅ Flash loan simulation complete');
  },
};

// ─── MODULE 8: Oracle ────────────────────────────────────────────────────────
export const OracleModule: SimModule = {
  id: 'oracle',
  label: 'Oracle Mock',
  icon: '📡',
  category: 'Infrastructure',
  desc: 'Price feeds, stale oracle, manipulation, TWAP',
  longDesc:
    'Test oracle dependencies: price updates, stale price detection, oracle manipulation attacks, TWAP smoothing, and Chainlink-style fallbacks.',
  requiredMethods: ['updatePrice', 'getPrice', 'latestRoundData'],
  requiredEvents: ['PriceUpdated', 'AnswerUpdated'],
  suggestedContracts: [
    {
      interface: 'AggregatorV3Interface (Chainlink)',
      package: '@chainlink/contracts',
      import: 'import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";',
      snippet: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
contract MockOracle is AggregatorV3Interface {
    int256 public price;
    uint256 public updatedAt;
    constructor(int256 _price) { price = _price; updatedAt = block.timestamp; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, updatedAt, 1);
    }
    function updatePrice(int256 _price) external { price = _price; updatedAt = block.timestamp; }
    function decimals() external pure returns (uint8) { return 8; }
    function description() external pure returns (string memory) { return "Mock"; }
    function version() external pure returns (uint256) { return 1; }
    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, updatedAt, 1);
    }
}`,
    },
  ],
  params: [
    { id: 'startPrice', label: 'Start Price ($)', type: 'number', default: '2000' },
    { id: 'endPrice', label: 'End Price ($)', type: 'number', default: '1800' },
    { id: 'steps', label: 'Update steps', type: 'number', default: '6' },
    { id: 'staleThreshold', label: 'Stale threshold (s)', type: 'number', default: '3600' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'update',
      options: ['update', 'stale', 'manipulation', 'twap', 'failure', 'delay'],
    },
  ],
  async run(ctx, p) {
    const priceA = parseFloat(p.startPrice) || 2000;
    const priceB = parseFloat(p.endPrice) || 1800;
    const steps = parseInt(p.steps) || 6;
    const stale = parseInt(p.staleThreshold) || 3600;
    let currentPrice = priceA;

    ctx.log('info', 'Oracle', `📡 Oracle: ${p.scenario} | ${priceA} → ${priceB}`);
    ctx.setPool((prev) => ({ ...prev, oraclePrice: currentPrice, collateralPrice: currentPrice }));
    await ctx.sleep(200);

    if (p.scenario === 'update') {
      const step = (priceB - priceA) / steps;
      for (let i = 0; i <= steps && !ctx.stop(); i++) {
        await ctx.sleep(500);
        currentPrice = priceA + step * i;
        const dir = currentPrice > priceA + step * (i - 1) ? '📈' : '📉';
        const r = await ctx.callContract(
          'Oracle',
          'updatePrice',
          [currentPrice],
          ctx.users[0].privateKey,
        );
        ctx.log(
          'oracle',
          'Chainlink',
          `${dir} Price: $${currentPrice.toFixed(2)} | Block: ${1000 + i}`,
          currentPrice,
          true,
          r.ok,
        );
        ctx.setPool((prev) => ({
          ...prev,
          oraclePrice: currentPrice,
          collateralPrice: currentPrice,
        }));
        for (const u of ctx.users) {
          if (u.borrowedAmount > 0) {
            const hf = (u.balanceCollateral * currentPrice * 0.8) / u.borrowedAmount;
            if (hf < 1.2)
              ctx.log('warn', u.label, `⚠️ HF: ${hf.toFixed(3)} — approaching liquidation!`);
          }
        }
      }
    }

    if (p.scenario === 'stale') {
      ctx.log('oracle', 'Oracle', `Last update: ${stale}s ago — checking staleness...`);
      await ctx.sleep(400);
      ctx.log(
        'error',
        'Oracle',
        `⚠️ STALE PRICE: ${stale}s > threshold — oracle heartbeat missed!`,
        0,
        false,
      );
      await ctx.sleep(300);
      ctx.log(
        'warn',
        'Protocol',
        `Protocol paused price-dependent functions until fresh oracle data`,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: if (block.timestamp - updatedAt > MAX_DELAY) revert("Stale oracle")`,
      );
    }

    if (p.scenario === 'manipulation') {
      ctx.log('warn', 'Oracle', `⚠️ Oracle manipulation attack simulation`);
      await ctx.sleep(400);
      ctx.log(
        'oracle',
        'Attacker',
        `Spot manipulation: price pumped to $${(priceA * 3).toFixed(0)}`,
      );
      ctx.setPool((prev) => ({ ...prev, oraclePrice: priceA * 3, collateralPrice: priceA * 3 }));
      await ctx.sleep(300);
      ctx.log('error', 'Attacker', `Borrowed against inflated collateral — extracted value`);
      await ctx.sleep(300);
      ctx.setPool((prev) => ({
        ...prev,
        oraclePrice: priceA * 0.5,
        collateralPrice: priceA * 0.5,
      }));
      ctx.log(
        'error',
        'Oracle',
        `Price crashed back to $${(priceA * 0.5).toFixed(0)} — positions underwater`,
        0,
        false,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: Use Chainlink + TWAP hybrid. Reject prices >X% from TWAP`,
      );
    }

    if (p.scenario === 'twap') {
      let cumPrice = 0,
        twap = currentPrice;
      for (let i = 0; i < steps && !ctx.stop(); i++) {
        await ctx.sleep(400);
        const spot = priceA + (priceB - priceA) * (i / steps) + rnd(-100, 100);
        cumPrice += spot;
        twap = cumPrice / (i + 1);
        ctx.log(
          'oracle',
          'TWAP',
          `Spot: $${spot.toFixed(2)} | TWAP: $${twap.toFixed(2)} (${i + 1} samples)`,
          twap,
        );
      }
    }

    ctx.log('success', 'Oracle', '✅ Oracle simulation complete');
  },
};

// ─── MODULE 9: MEV ───────────────────────────────────────────────────────────
export const MEVModule: SimModule = {
  id: 'mev',
  label: 'MEV Simulation',
  icon: '🤖',
  category: 'Advanced',
  desc: 'Frontrun, sandwich attack, backrun, arbitrage bot',
  longDesc:
    'Simulate Maximal Extractable Value: frontrunning, sandwich attacks, backrunning, and arbitrage bot strategies.',
  requiredMethods: ['swap', 'transfer'],
  requiredEvents: ['Swap', 'Transfer'],
  suggestedContracts: [UNISWAP_V2_LIKE],
  params: [
    { id: 'victimAmount', label: 'Victim swap amount', type: 'number', default: '10000' },
    { id: 'slippage', label: 'Victim slippage tolerance %', type: 'number', default: '1' },
    {
      id: 'scenario',
      label: 'Attack type',
      type: 'select',
      default: 'sandwich',
      options: ['sandwich', 'frontrun', 'backrun', 'arb_bot'],
    },
    { id: 'mevProfit', label: 'Expected MEV profit ($)', type: 'number', default: '200' },
  ],
  async run(ctx, p) {
    const victimAmt = parseFloat(p.victimAmount) || 10000;
    const slippage = parseFloat(p.slippage) || 1;
    ctx.log('info', 'MEV', `🤖 MEV: ${p.scenario}`);
    await ctx.sleep(200);

    if (p.scenario === 'sandwich') {
      ctx.log(
        'warn',
        'MEV Bot',
        `👀 Detected victim tx in mempool: swap $${victimAmt.toLocaleString()}`,
      );
      await ctx.sleep(300);
      const frontAmt = victimAmt * 0.5;
      ctx.log(
        'mev',
        'MEV Bot',
        `⬆️ FRONTRUN: Buy ${frontAmt.toLocaleString()} (gasPrice +50%) — pushes price up`,
      );
      await ctx.sleep(200);
      const impact = (victimAmt / 100000) * 100;
      ctx.log(
        'swap',
        'Victim',
        `😢 Victim swap fills at ${impact.toFixed(2)}% worse price (slippage exploited)`,
        victimAmt,
      );
      await ctx.sleep(200);
      const backProfit = frontAmt * 0.03;
      ctx.log(
        'mev',
        'MEV Bot',
        `⬇️ BACKRUN: Sell tokens → profit $${backProfit.toFixed(2)}`,
        backProfit,
      );
      ctx.log(
        'error',
        'Victim',
        `😱 Victim lost: ~$${((victimAmt * impact) / 100).toFixed(2)} to sandwich`,
        0,
        false,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: use tight slippage, private mempool (Flashbots), commit-reveal`,
      );
    }

    if (p.scenario === 'frontrun') {
      ctx.log('warn', 'MEV Bot', `👀 Frontrun: spotted NFT purchase tx in mempool`);
      await ctx.sleep(400);
      ctx.log('mev', 'MEV Bot', `🏃 Submit same tx with +100 gwei → confirmed first`);
      await ctx.sleep(300);
      ctx.log('error', 'Victim', `❌ Victim tx reverted — NFT already bought by bot`, 0, false);
      ctx.log('mev', 'MEV Bot', `💰 Flipped NFT for profit: +$${p.mevProfit}`);
    }

    if (p.scenario === 'arb_bot') {
      ctx.log('mev', 'Arb Bot', `⚡ Continuously scanning DEX pairs for price discrepancy`);
      for (let i = 0; i < 4 && !ctx.stop(); i++) {
        await ctx.sleep(500);
        const spread = rnd(0.05, 0.8);
        const profit = spread * 1000;
        if (spread > 0.1) {
          ctx.log(
            'mev',
            'Arb Bot',
            `Found spread: ${spread.toFixed(3)}% | Executing arb → profit $${profit.toFixed(2)}`,
            profit,
          );
        } else {
          ctx.log(
            'info',
            'Arb Bot',
            `Spread ${spread.toFixed(3)}% — below gas cost threshold, skip`,
          );
        }
      }
    }

    ctx.log('success', 'MEV', '✅ MEV simulation complete');
  },
};

// ─── MODULE 10: Governance / DAO ─────────────────────────────────────────────
export const GovernanceModule: SimModule = {
  id: 'governance',
  label: 'Governance / DAO',
  icon: '🏛️',
  category: 'Advanced',
  desc: 'Proposals, voting, quorum, attacks, timelock',
  longDesc:
    'Simulate DAO governance: proposal lifecycle, voting, quorum checks, whale takeover, flash loan governance attack, and timelock execution.',
  requiredMethods: ['propose', 'castVote', 'execute', 'queue', 'cancel'],
  requiredEvents: ['ProposalCreated', 'VoteCast', 'ProposalExecuted'],
  suggestedContracts: [OZ_GOVERNOR],
  params: [
    { id: 'quorum', label: 'Quorum % of supply', type: 'number', default: '4' },
    { id: 'timelockDelay', label: 'Timelock delay (blocks)', type: 'number', default: '50400' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'lifecycle',
      options: ['lifecycle', 'whale_takeover', 'flashloan_attack', 'failed_quorum', 'cancel'],
    },
    { id: 'votingPeriod', label: 'Voting period (blocks)', type: 'number', default: '50400' },
  ],
  async run(ctx, p) {
    const quorum = parseFloat(p.quorum) / 100 || 0.04;
    ctx.log('info', 'Gov', `🏛️ Governance: ${p.scenario}`);
    await ctx.sleep(200);

    // Distribute voting power
    const totalPower = 1000000;
    ctx.setUsers((prev) =>
      prev.map((x, i) => ({ ...x, votingPower: totalPower * (i === 0 ? 0.4 : 0.15) })),
    );
    ctx.setPool((prev) => ({ ...prev, totalVotingPower: totalPower }));

    if (p.scenario === 'lifecycle') {
      ctx.log(
        'propose',
        ctx.users[0].label,
        `📜 Created proposal #1: "Increase protocol fee to 0.5%"`,
      );
      ctx.setPool((prev) => ({ ...prev, proposalCount: prev.proposalCount + 1 }));
      await ctx.sleep(400);
      ctx.log('info', 'Gov', `Voting period: ${p.votingPeriod} blocks (~7 days)`);
      for (const [i, u] of ctx.users.slice(0, 4).entries()) {
        if (ctx.stop()) return;
        await ctx.sleep(350);
        const support = i < 3;
        const r = await ctx.callContract(
          'Governor',
          'castVote',
          [1, support ? 1 : 0],
          u.privateKey,
        );
        ctx.log(
          'vote',
          u.label,
          `${support ? '✅ FOR' : '❌ AGAINST'} | Power: ${(u.votingPower || 150000).toLocaleString()}`,
          u.votingPower,
          true,
          r.ok,
        );
      }
      await ctx.sleep(500);
      const quorumMet = true;
      ctx.log(
        'info',
        'Gov',
        `Quorum: ${(quorum * 100).toFixed(1)}% required — ${quorumMet ? '✅ MET' : '❌ NOT MET'}`,
      );
      await ctx.sleep(300);
      ctx.log('info', 'Gov', `⏳ Queued in timelock: ${p.timelockDelay} blocks delay`);
      await ctx.sleep(400);
      const r = await ctx.callContract('Governor', 'execute', [1], ctx.users[0].privateKey);
      ctx.log('execute', 'Timelock', `✅ Proposal #1 EXECUTED — fee updated`, 0, true, r.ok);
    }

    if (p.scenario === 'whale_takeover') {
      ctx.log('warn', 'Gov', `🐳 Whale accumulating governance tokens...`);
      await ctx.sleep(400);
      ctx.setUsers((prev) =>
        prev.map((x, i) =>
          i === 0
            ? { ...x, votingPower: totalPower * 0.6 }
            : { ...x, votingPower: totalPower * 0.05 },
        ),
      );
      ctx.log(
        'propose',
        ctx.users[0].label,
        `📜 Whale proposes: "Transfer treasury to whale address"`,
      );
      await ctx.sleep(300);
      ctx.log('vote', ctx.users[0].label, `✅ FOR with 60% voting power — PASSED solo`);
      ctx.log(
        'error',
        'Gov',
        `🚨 Whale takeover: malicious proposal passed. Treasury at risk.`,
        0,
        false,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: vote delegation, time-locks, guardian veto, quorum thresholds`,
      );
    }

    if (p.scenario === 'flashloan_attack') {
      ctx.log('warn', 'Gov', `⚡ Flash loan governance attack`);
      await ctx.sleep(400);
      ctx.log('flashloan', 'Attacker', `Borrowed 400,000 governance tokens via flash loan`);
      await ctx.sleep(300);
      ctx.log('vote', 'Attacker', `Voted on proposal with flash-borrowed power`);
      await ctx.sleep(300);
      ctx.log(
        'error',
        'Gov',
        `🚨 Attack blocked: OpenZeppelin Governor uses block-1 snapshot`,
        0,
        false,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ ERC20Votes.getPastVotes(account, block.number - 1) prevents flash attacks`,
      );
    }

    if (p.scenario === 'failed_quorum') {
      ctx.log('propose', ctx.users[0].label, `📜 Proposal: "Upgrade contract to v2"`);
      await ctx.sleep(400);
      ctx.log('vote', ctx.users[0].label, `✅ FOR — but only 2% of supply voted`);
      await ctx.sleep(400);
      ctx.log(
        'error',
        'Gov',
        `❌ Proposal DEFEATED: quorum not reached (2% < ${(quorum * 100).toFixed(1)}% required)`,
        0,
        false,
      );
    }

    ctx.log('success', 'Gov', '✅ Governance simulation complete');
  },
};

// ─── MODULE 11: Multi-User ───────────────────────────────────────────────────
export const MultiUserModule: SimModule = {
  id: 'multiuser',
  label: 'Multi-User Load',
  icon: '👥',
  category: 'Testing',
  desc: '10–100 users, whale behavior, bot simulation',
  longDesc:
    'Simulate real network activity with many concurrent users, whale wallets, and bot interactions.',
  requiredMethods: ['transfer', 'swap', 'deposit'],
  requiredEvents: ['Transfer'],
  suggestedContracts: [OZ_ERC20],
  params: [
    { id: 'userCount', label: 'Users', type: 'number', default: '8', max: 8 },
    { id: 'rounds', label: 'Action rounds', type: 'number', default: '4' },
    { id: 'whalePct', label: 'Whale % of supply', type: 'number', default: '40' },
    {
      id: 'botActivity',
      label: 'Bot activity %',
      type: 'number',
      default: '20',
      hint: 'Percentage of actions from bots',
    },
    {
      id: 'scenario',
      label: 'User type',
      type: 'select',
      default: 'mixed',
      options: ['mixed', 'whale', 'bots', 'retail'],
    },
  ],
  async run(ctx, p) {
    const count = Math.min(parseInt(p.userCount) || 8, HH_ACCOUNTS.length);
    const rounds = parseInt(p.rounds) || 4;
    const whalePct = parseFloat(p.whalePct) / 100 || 0.4;
    const botPct = parseFloat(p.botActivity) / 100 || 0.2;
    ctx.log('info', 'MultiUser', `👥 ${count} users, ${rounds} rounds, ${p.scenario}`);

    const simUsers = Array.from({ length: count }, (_, i) => makeUser(i));
    ctx.setUsers(simUsers);
    await ctx.sleep(300);

    const actionTypes = ['swap', 'deposit', 'borrow', 'transfer', 'mint'] as const;
    const isBot = (i: number) => i / count < botPct;
    const isWhale = (i: number) => i === 0 && p.scenario !== 'retail';

    for (let r = 0; r < rounds && !ctx.stop(); r++) {
      ctx.log('info', 'Round', `── Round ${r + 1}/${rounds} ──`);
      await ctx.sleep(200);
      for (let i = 0; i < count && !ctx.stop(); i++) {
        await ctx.sleep(isBot(i) ? 80 : rnd(150, 300));
        const u = simUsers[i];
        const action = actionTypes[rndInt(0, actionTypes.length - 1)];
        const scale = isWhale(i) ? whalePct * 10000 : isBot(i) ? rnd(10, 100) : rnd(50, 500);
        const success = Math.random() > (isBot(i) ? 0.05 : 0.1);
        const tag = isBot(i) ? '🤖 Bot' : isWhale(i) ? '🐳 Whale' : '👤 User';
        ctx.log(
          action,
          `${tag} ${u.label}`,
          `${action}: ${scale.toFixed(0)} | gas: ${rndInt(21000, 150000)}`,
          scale,
          success,
        );
        if (success) {
          ctx.onTxRecorded({
            id: crypto.randomUUID(),
            hash: fakeTx(),
            contractName: 'Protocol',
            functionName: action,
            args: [u.address, scale],
            status: 'success',
            gasUsed: String(rndInt(30000, 150000)),
            timestamp: Date.now(),
          });
        }
      }
    }

    ctx.log('success', 'MultiUser', `✅ ${count * rounds} total actions simulated`);
  },
};

// ─── MODULE 12: Tokenomics ───────────────────────────────────────────────────
export const TokenomicsModule: SimModule = {
  id: 'tokenomics',
  label: 'Tokenomics',
  icon: '📊',
  category: 'Token',
  desc: 'Vesting, airdrop, emission, inflation/deflation',
  longDesc:
    'Analyze token economic models: vesting schedules, airdrop distribution, emission curves, inflation, deflationary burn mechanics.',
  requiredMethods: ['mint', 'burn', 'release', 'claim'],
  requiredEvents: ['Transfer', 'TokensReleased'],
  suggestedContracts: [OZ_ERC20],
  params: [
    { id: 'totalSupply', label: 'Total supply', type: 'number', default: '1000000000' },
    { id: 'vestingPeriod', label: 'Vesting period (months)', type: 'number', default: '24' },
    { id: 'cliffMonths', label: 'Cliff (months)', type: 'number', default: '6' },
    { id: 'emissionRate', label: 'Monthly emission %', type: 'number', default: '2' },
    { id: 'burnRate', label: 'Burn rate % per tx', type: 'number', default: '0.5' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'vesting',
      options: ['vesting', 'airdrop', 'emission', 'deflationary'],
    },
  ],
  async run(ctx, p) {
    const supply = parseFloat(p.totalSupply) || 1e9;
    const vestingMonths = parseInt(p.vestingPeriod) || 24;
    const cliff = parseInt(p.cliffMonths) || 6;
    const emission = parseFloat(p.emissionRate) / 100 || 0.02;
    const burn = parseFloat(p.burnRate) / 100 || 0.005;

    ctx.log(
      'info',
      'Tokenomics',
      `📊 Total supply: ${supply.toLocaleString()} | Scenario: ${p.scenario}`,
    );
    ctx.setPool((prev) => ({ ...prev, tokenTotalSupply: supply }));
    await ctx.sleep(300);

    if (p.scenario === 'vesting') {
      ctx.log(
        'info',
        'Vesting',
        `Cliff: ${cliff}m | Linear vesting: ${vestingMonths}m | ${ctx.users.length} beneficiaries`,
      );
      for (let month = 0; month <= vestingMonths && !ctx.stop(); month += 3) {
        await ctx.sleep(350);
        const unlocked =
          month < cliff
            ? 0
            : ((month - cliff) / (vestingMonths - cliff)) * (supply / ctx.users.length);
        const status = month < cliff ? '🔒 Locked (cliff)' : `🔓 Unlocked: ${unlocked.toFixed(0)}`;
        ctx.log('vest', 'Vesting', `Month ${month}: ${status}`, unlocked);
        if (month >= cliff) {
          ctx.setUsers((prev) =>
            prev.map((x, i) =>
              i === 0 ? { ...x, balanceToken: x.balanceToken + unlocked * 0.1 } : x,
            ),
          );
        }
      }
    }

    if (p.scenario === 'airdrop') {
      ctx.log('info', 'Airdrop', `🪂 Airdropping to ${ctx.users.length} addresses`);
      const allocations = [0.3, 0.2, 0.15, 0.1, 0.08, 0.07, 0.05, 0.05];
      for (const [i, u] of ctx.users.entries()) {
        if (ctx.stop()) break;
        await ctx.sleep(250);
        const alloc = supply * (allocations[i] || 0.03);
        ctx.log(
          'airdrop',
          u.label,
          `Received ${alloc.toLocaleString()} tokens (${((allocations[i] || 0.03) * 100).toFixed(1)}%)`,
          alloc,
        );
        ctx.setUsers((prev) =>
          prev.map((x, j) => (j === i ? { ...x, balanceToken: x.balanceToken + alloc } : x)),
        );
      }
    }

    if (p.scenario === 'emission') {
      let circ = supply * 0.3;
      ctx.log(
        'info',
        'Emission',
        `Circulating: ${circ.toLocaleString()} | Monthly rate: ${(emission * 100).toFixed(1)}%`,
      );
      for (let m = 1; m <= 12 && !ctx.stop(); m++) {
        await ctx.sleep(300);
        const emitted = circ * emission;
        circ += emitted;
        ctx.log(
          'mint',
          'Emission',
          `Month ${m}: +${emitted.toFixed(0)} | Circulating: ${circ.toFixed(0)}`,
          emitted,
        );
        ctx.setPool((prev) => ({ ...prev, tokenTotalSupply: circ }));
      }
    }

    if (p.scenario === 'deflationary') {
      let sup = supply;
      ctx.log(
        'info',
        'Deflation',
        `Burn rate: ${(burn * 100).toFixed(2)}% per tx | Initial: ${sup.toLocaleString()}`,
      );
      for (let tx = 0; tx < 10 && !ctx.stop(); tx++) {
        await ctx.sleep(300);
        const txAmt = rnd(1000, 50000);
        const burnAmt = txAmt * burn;
        sup -= burnAmt;
        ctx.log(
          'burn',
          'Protocol',
          `Tx ${tx + 1}: burned ${burnAmt.toFixed(2)} tokens | Supply: ${sup.toFixed(0)}`,
          burnAmt,
        );
        ctx.setPool((prev) => ({
          ...prev,
          tokenTotalSupply: Math.max(0, prev.tokenTotalSupply - burnAmt),
        }));
      }
    }

    ctx.log('success', 'Tokenomics', '✅ Tokenomics simulation complete');
  },
};

// ─── MODULE 13: Network / Gas ────────────────────────────────────────────────
export const NetworkModule: SimModule = {
  id: 'network',
  label: 'Network Simulation',
  icon: '🌐',
  category: 'Infrastructure',
  desc: 'Gas spikes, congestion, reorg, block delay, fork',
  longDesc:
    'Simulate network-level conditions: gas price spikes, mempool congestion, block reorganizations, delayed blocks.',
  requiredMethods: [],
  requiredEvents: [],
  suggestedContracts: [],
  params: [
    { id: 'baseFee', label: 'Base fee (gwei)', type: 'number', default: '20' },
    { id: 'blocks', label: 'Blocks to simulate', type: 'number', default: '10' },
    { id: 'congestionPct', label: 'Congestion spike %', type: 'number', default: '500' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'gas_spike',
      options: ['gas_spike', 'congestion', 'reorg', 'block_delay'],
    },
  ],
  async run(ctx, p) {
    const baseFee = parseFloat(p.baseFee) || 20;
    const blocks = parseInt(p.blocks) || 10;
    const spike = parseFloat(p.congestionPct) / 100 || 5;
    ctx.log('info', 'Network', `🌐 Network: ${p.scenario}`);
    await ctx.sleep(200);

    if (p.scenario === 'gas_spike') {
      let fee = baseFee;
      for (let b = 0; b < blocks && !ctx.stop(); b++) {
        await ctx.sleep(350);
        const factor =
          b < blocks / 2
            ? 1 + (spike * b) / (blocks / 2)
            : 1 + spike * (1 - (b - blocks / 2) / (blocks / 2));
        fee = baseFee * factor;
        ctx.log(
          'gas',
          'Network',
          `Block ${b + 1}: gas ${fee.toFixed(1)} gwei ${fee > baseFee * 2 ? '🔥' : ''}`,
          fee,
        );
      }
    }

    if (p.scenario === 'congestion') {
      ctx.log('gas', 'Network', `Mempool filling up...`);
      for (let b = 0; b < blocks && !ctx.stop(); b++) {
        await ctx.sleep(350);
        const pending = rndInt(1000, 5000) * (b + 1);
        const fee = baseFee * (1 + pending / 10000);
        ctx.log(
          'gas',
          'Network',
          `Block ${b + 1}: ${pending.toLocaleString()} pending | base fee: ${fee.toFixed(1)} gwei`,
          pending,
        );
      }
    }

    if (p.scenario === 'reorg') {
      ctx.log('block', 'Network', `Chain advancing normally...`);
      for (let b = 0; b < 5 && !ctx.stop(); b++) {
        await ctx.sleep(300);
        ctx.log('block', 'Network', `Block ${1000 + b} mined`);
      }
      await ctx.sleep(400);
      ctx.log('warn', 'Network', `⚠️ REORG DETECTED: blocks 1002–1004 orphaned!`);
      await ctx.sleep(300);
      ctx.log('error', 'Network', `Transactions in orphaned blocks reverted`, 0, false);
      ctx.log('info', 'Mitigation', `✅ Fix: wait for confirmations before considering tx final`);
    }

    if (p.scenario === 'block_delay') {
      ctx.log('block', 'Network', `Normal block time: ~12s`);
      for (let b = 0; b < blocks && !ctx.stop(); b++) {
        await ctx.sleep(rnd(200, 800));
        const delay = rnd(10, 45);
        ctx.log(
          'block',
          'Network',
          `Block ${1000 + b}: ${delay.toFixed(1)}s ${delay > 20 ? '⏰ slow' : ''}`,
          delay,
        );
      }
    }

    ctx.log('success', 'Network', '✅ Network simulation complete');
  },
};

// ─── MODULE 14: Security Attacks ─────────────────────────────────────────────
export const SecurityModule: SimModule = {
  id: 'security',
  label: 'Security Attacks',
  icon: '🔒',
  category: 'Security',
  desc: 'Reentrancy, overflow, access control, delegatecall',
  longDesc:
    'Simulate common smart contract attack vectors with educational explanations and fix recommendations.',
  requiredMethods: [],
  requiredEvents: [],
  suggestedContracts: [],
  params: [
    {
      id: 'attack',
      label: 'Attack type',
      type: 'select',
      default: 'reentrancy',
      options: [
        'reentrancy',
        'overflow',
        'access_control',
        'delegatecall',
        'selfdestruct',
        'tx_origin',
      ],
    },
    { id: 'amount', label: 'Attack value ($)', type: 'number', default: '100000' },
  ],
  async run(ctx, p) {
    const amount = parseFloat(p.amount) || 100000;
    ctx.log('info', 'Security', `🔒 Attack simulation: ${p.attack}`);
    await ctx.sleep(200);

    if (p.attack === 'reentrancy') {
      ctx.log(
        'warn',
        'Attacker',
        `Deploying malicious contract with fallback() that re-enters withdraw()`,
      );
      await ctx.sleep(400);
      ctx.log('attack', 'Attacker', `Step 1: Deposit 1 ETH to victim contract`);
      await ctx.sleep(300);
      ctx.log('attack', 'Attacker', `Step 2: Call withdraw() — victim sends ETH`);
      await ctx.sleep(300);
      ctx.log(
        'attack',
        'Attacker',
        `Step 3: fallback() triggers! Calls withdraw() AGAIN before state updated`,
      );
      await ctx.sleep(300);
      for (let i = 0; i < 4; i++) {
        await ctx.sleep(200);
        ctx.log(
          'attack',
          'Attacker',
          `↳ Recursive call ${i + 1}: draining ${(amount / 8).toFixed(0)} ETH...`,
        );
      }
      ctx.log(
        'error',
        'Victim',
        `💀 Contract drained: $${amount.toLocaleString()} stolen`,
        amount,
        false,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: ReentrancyGuard modifier | CEI pattern | checks-effects-interactions`,
      );
    }

    if (p.attack === 'overflow') {
      ctx.log('warn', 'Attacker', `Integer overflow in unchecked math (Solidity < 0.8.0)`);
      await ctx.sleep(400);
      ctx.log('attack', 'Attacker', `uint256 max = 2^256-1. Adding 1 → wraps to 0`);
      ctx.log('attack', 'Attacker', `balance[attacker] = MAX_UINT + 1 = 0 ... in old compiler`);
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: Solidity ^0.8.0 (auto-reverts) | SafeMath for older versions`,
      );
    }

    if (p.attack === 'access_control') {
      ctx.log('attack', 'Attacker', `Calling admin function: transferOwnership()`);
      await ctx.sleep(400);
      ctx.log('error', 'Contract', `❌ No onlyOwner check — anyone can call!`, 0, false);
      await ctx.sleep(300);
      ctx.log(
        'attack',
        'Attacker',
        `Transferred ownership to attacker, drained treasury $${amount.toLocaleString()}`,
        amount,
      );
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: OpenZeppelin Ownable | AccessControl | role-based permissions`,
      );
    }

    if (p.attack === 'delegatecall') {
      ctx.log('attack', 'Attacker', `Exploit delegatecall — executes in caller's storage context`);
      await ctx.sleep(400);
      ctx.log('attack', 'Attacker', `Malicious implementation overwrites slot[0] (owner)`);
      await ctx.sleep(300);
      ctx.log('error', 'Proxy', `🚨 Storage collision! Attacker is now owner`, 0, false);
      ctx.log(
        'info',
        'Mitigation',
        `✅ Fix: EIP-1967 storage slots | OpenZeppelin TransparentUpgradeableProxy`,
      );
    }

    if (p.attack === 'tx_origin') {
      ctx.log('attack', 'Attacker', `Phishing: victim calls attacker contract in a tx`);
      await ctx.sleep(400);
      ctx.log('attack', 'Attacker', `Victim contract uses tx.origin instead of msg.sender`);
      ctx.log('error', 'Victim', `tx.origin == victim EOA → authorization bypassed`, 0, false);
      ctx.log('info', 'Mitigation', `✅ Fix: NEVER use tx.origin for auth. Use msg.sender always.`);
    }

    ctx.log('success', 'Security', '✅ Security simulation complete');
  },
};

// ─── MODULE 15: Stress Test ──────────────────────────────────────────────────
export const StressModule: SimModule = {
  id: 'stress',
  label: 'Stress Test',
  icon: '💥',
  category: 'Testing',
  desc: 'Bank run, mass liquidation, whale withdrawal, drain',
  longDesc:
    'Simulate extreme market events: bank run scenarios, mass liquidation cascades, whale exits, and total liquidity drain.',
  requiredMethods: ['withdraw', 'liquidate', 'removeLiquidity'],
  requiredEvents: ['Withdraw', 'Liquidate'],
  suggestedContracts: [LENDING_POOL],
  params: [
    { id: 'crashPct', label: 'Price crash %', type: 'number', default: '50' },
    { id: 'users', label: 'Users', type: 'number', default: '8', max: 8 },
    { id: 'steps', label: 'Crash steps', type: 'number', default: '10' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'mass_liquidation',
      options: ['mass_liquidation', 'bank_run', 'whale_exit', 'liquidity_drain'],
    },
  ],
  async run(ctx, p) {
    const crash = parseFloat(p.crashPct) / 100 || 0.5;
    const count = Math.min(parseInt(p.users) || 8, HH_ACCOUNTS.length);
    const steps = parseInt(p.steps) || 10;
    const startPrice = ctx.pool.collateralPrice || 1000;
    const targetPrice = startPrice * (1 - crash);
    const stepDrop = (startPrice - targetPrice) / steps;

    const stressUsers = Array.from({ length: count }, (_, i) => ({
      ...makeUser(i),
      balanceCollateral: rnd(100, 1000),
      borrowedAmount: rnd(50, 400),
      healthFactor: rnd(1.1, 2.0),
    }));
    ctx.setUsers(stressUsers);

    ctx.log('info', 'Stress', `💥 ${p.scenario}: ${crash * 100}% crash over ${steps} steps`);
    await ctx.sleep(300);

    let currentPrice = startPrice;
    let liquidated = 0;

    if (p.scenario === 'mass_liquidation') {
      for (let s = 0; s < steps && !ctx.stop(); s++) {
        await ctx.sleep(400);
        currentPrice -= stepDrop;
        const changePct = (((currentPrice - startPrice) / startPrice) * 100).toFixed(1);
        ctx.log('price', 'Market', `📉 $${currentPrice.toFixed(0)} (${changePct}%)`, currentPrice);
        ctx.setPool((prev) => ({
          ...prev,
          collateralPrice: currentPrice,
          oraclePrice: currentPrice,
        }));

        for (const [i, u] of stressUsers.entries()) {
          if (u.borrowedAmount <= 0) continue;
          const hf = (u.balanceCollateral * currentPrice * 0.8) / u.borrowedAmount;
          stressUsers[i].healthFactor = hf;
          if (hf < 1.0) {
            liquidated++;
            await ctx.sleep(150);
            ctx.log(
              'liquidate',
              'Bot',
              `🔴 LIQUIDATED ${u.label} | HF: ${hf.toFixed(3)}`,
              u.borrowedAmount,
              false,
            );
            stressUsers[i].borrowedAmount = 0;
            stressUsers[i].balanceCollateral = 0;
            ctx.setPool((prev) => ({ ...prev, collateralPrice: currentPrice * 0.99 })); // cascade
          } else if (hf < 1.2) {
            ctx.log('warn', u.label, `⚠️ HF ${hf.toFixed(2)} — near liquidation`);
          }
        }
      }
    }

    if (p.scenario === 'bank_run') {
      ctx.log('warn', 'BankRun', `🏦 Panic withdrawal event`);
      for (const [i, u] of stressUsers.entries()) {
        if (ctx.stop()) break;
        await ctx.sleep(300);
        const withdrawAmt = u.balanceCollateral * 0.8;
        ctx.log(
          'deposit',
          u.label,
          `Withdrawing ${withdrawAmt.toFixed(0)} ETH (panic)`,
          withdrawAmt,
        );
        ctx.setPool((prev) => ({
          ...prev,
          totalDeposited: Math.max(0, prev.totalDeposited - withdrawAmt),
        }));
      }
      ctx.log(
        'error',
        'Protocol',
        `🚨 Liquidity critically low — withdrawal queue forming`,
        0,
        false,
      );
    }

    if (p.scenario === 'whale_exit') {
      ctx.log('warn', 'Whale', `🐳 Whale removing all liquidity`);
      await ctx.sleep(500);
      const whaleLP = 500000;
      ctx.log(
        'removeLiq',
        'Whale',
        `Removing ${whaleLP.toLocaleString()} LP tokens — ${((whaleLP / ctx.pool.lpTotalSupply) * 100 || 60).toFixed(1)}% of pool`,
      );
      ctx.setPool((prev) => ({
        ...prev,
        reserveA: prev.reserveA * 0.4,
        reserveB: prev.reserveB * 0.4,
        lpTotalSupply: Math.max(0, prev.lpTotalSupply - whaleLP),
      }));
      await ctx.sleep(400);
      ctx.log(
        'error',
        'AMM',
        `💀 Pool depth collapsed — slippage now 40%+ for normal trades`,
        0,
        false,
      );
    }

    if (p.scenario === 'liquidity_drain') {
      ctx.log('warn', 'Drain', `🕳️ Protocol liquidity drain scenario`);
      for (let i = 0; i < steps && !ctx.stop(); i++) {
        await ctx.sleep(300);
        const drainPct = rnd(5, 15);
        ctx.log('flashloan', `Attacker ${i}`, `Draining ${drainPct.toFixed(1)}% of liquidity`);
        ctx.setPool((prev) => ({
          ...prev,
          reserveA: prev.reserveA * (1 - drainPct / 100),
          reserveB: prev.reserveB * (1 - drainPct / 100),
        }));
      }
      ctx.log(
        'error',
        'Protocol',
        `🚨 Protocol liquidity drained — emergency pause triggered`,
        0,
        false,
      );
    }

    const solvent = stressUsers.filter((u) => u.healthFactor > 1.0).length;
    ctx.log('info', 'Stress', `Liquidated: ${liquidated}/${count} | Solvent: ${solvent}`);
    if (liquidated / count > 0.5)
      ctx.log('error', 'Stress', `🚨 INSOLVENCY RISK: >50% positions liquidated`, 0, false);
    else ctx.log('success', 'Stress', `✅ Protocol survived stress test`);
    ctx.log('success', 'Stress', '✅ Stress test complete');
  },
};

// ─── MODULE 16: Time Simulation ──────────────────────────────────────────────
export const TimeModule: SimModule = {
  id: 'time',
  label: 'Time Simulation',
  icon: '⏰',
  category: 'Infrastructure',
  desc: 'Advance blocks, time, interest, vesting unlock',
  longDesc:
    'Simulate time-based contract mechanics: mine blocks, advance time, interest accrual, vesting schedules, lock periods.',
  requiredMethods: [],
  requiredEvents: [],
  suggestedContracts: [],
  params: [
    { id: 'blocks', label: 'Blocks to mine', type: 'number', default: '100' },
    { id: 'timeSeconds', label: 'Time to advance (s)', type: 'number', default: '86400' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'blocks',
      options: ['blocks', 'vesting_unlock', 'interest_accrual', 'timelock'],
    },
  ],
  async run(ctx, p) {
    const blocks = parseInt(p.blocks) || 100;
    const seconds = parseInt(p.timeSeconds) || 86400;

    ctx.log('info', 'Time', `⏰ Time simulation: ${p.scenario}`);
    await ctx.sleep(200);

    if (p.scenario === 'blocks') {
      for (let b = 0; b < Math.min(blocks, 10) && !ctx.stop(); b++) {
        await ctx.sleep(300);
        const r = await ctx.callContract('Hardhat', 'evm_mine', []);
        ctx.log(
          'block',
          'Chain',
          `⛏️ Mined block ${b + 1}/${blocks}${r.ok ? ' (on-chain)' : ' (sim)'}`,
          b + 1,
          true,
          r.ok,
        );
      }
      ctx.log(
        'info',
        'Time',
        `Total: ${blocks} blocks mined (~${((blocks * 12) / 3600).toFixed(1)} hours)`,
      );
    }

    if (p.scenario === 'vesting_unlock') {
      const vestingDays = Math.floor(seconds / 86400);
      ctx.log('info', 'Time', `Fast-forwarding ${vestingDays} days...`);
      const r = await ctx.callContract('Hardhat', 'evm_increaseTime', [seconds]);
      await ctx.sleep(400);
      ctx.log(
        'block',
        'Chain',
        `Time advanced ${vestingDays} days${r.ok ? ' (on-chain)' : ' (sim)'}`,
      );
      await ctx.sleep(300);
      const unlocked = 50000 * (vestingDays / 365);
      ctx.log(
        'vest',
        ctx.users[0]?.label || 'Beneficiary',
        `🔓 Vesting unlocked: ${unlocked.toFixed(0)} tokens`,
        unlocked,
      );
      ctx.setUsers((prev) =>
        prev.map((x, i) => (i === 0 ? { ...x, balanceToken: x.balanceToken + unlocked } : x)),
      );
    }

    if (p.scenario === 'interest_accrual') {
      let debt = 10000,
        rate = 0.05 / 365;
      ctx.log('info', 'Time', `Simulating daily interest: ${(rate * 365 * 100).toFixed(1)}% APR`);
      for (let d = 0; d < 10 && !ctx.stop(); d++) {
        await ctx.sleep(300);
        debt *= 1 + rate;
        ctx.log(
          'borrow',
          'Interest',
          `Day ${d + 1}: Debt $${debt.toFixed(2)} (+${(rate * 100).toFixed(4)}%/day)`,
          debt,
        );
      }
    }

    if (p.scenario === 'timelock') {
      const delay = 50400;
      ctx.log('info', 'Timelock', `Proposal queued. Timelock: ${delay} blocks (~7 days)`);
      for (let b = 0; b <= 3 && !ctx.stop(); b++) {
        await ctx.sleep(400);
        const pct = ((b / 3) * 100).toFixed(0);
        ctx.log(
          'block',
          'Timelock',
          `Progress: ${pct}% (${Math.floor((b / 3) * delay).toLocaleString()}/${delay} blocks)`,
        );
      }
      const r = await ctx.callContract('Timelock', 'execute', [], ctx.users[0].privateKey);
      ctx.log('execute', 'Timelock', `✅ Timelock expired — proposal executed`, 0, true, r.ok);
    }

    ctx.log('success', 'Time', '✅ Time simulation complete');
  },
};

// ─── MODULE 17: Cross-Protocol ───────────────────────────────────────────────
export const CrossProtocolModule: SimModule = {
  id: 'cross_protocol',
  label: 'Cross-Protocol',
  icon: '🔗',
  category: 'Advanced',
  desc: 'Composability: borrow A, swap B, repay, bridge',
  longDesc:
    'Simulate DeFi composability: cross-protocol interactions, borrow-swap-repay, yield strategies, and bridge mechanics.',
  requiredMethods: ['deposit', 'borrow', 'swap', 'repay'],
  requiredEvents: ['Deposit', 'Swap', 'Repay'],
  suggestedContracts: [LENDING_POOL, UNISWAP_V2_LIKE],
  params: [
    { id: 'amount', label: 'Starting capital ($)', type: 'number', default: '10000' },
    {
      id: 'scenario',
      label: 'Strategy',
      type: 'select',
      default: 'leverage',
      options: ['leverage', 'yield_farming', 'bridge', 'upgrade'],
    },
  ],
  async run(ctx, p) {
    const amount = parseFloat(p.amount) || 10000;
    const actor = ctx.users[0]?.label || 'User';
    ctx.log('info', 'Cross', `🔗 Cross-protocol: ${p.scenario}`);
    await ctx.sleep(200);

    if (p.scenario === 'leverage') {
      ctx.log('info', actor, `Starting capital: $${amount.toLocaleString()}`);
      await ctx.sleep(300);
      const r1 = await ctx.callContract(
        'LendingPool',
        'deposit',
        [amount],
        ctx.users[0]?.privateKey,
      );
      ctx.log(
        'deposit',
        actor,
        `Protocol A: Deposited $${amount.toLocaleString()} as collateral`,
        amount,
        true,
        r1.ok,
      );
      await ctx.sleep(400);
      const borrowed = amount * 0.7;
      const r2 = await ctx.callContract(
        'LendingPool',
        'borrow',
        [borrowed],
        ctx.users[0]?.privateKey,
      );
      ctx.log(
        'borrow',
        actor,
        `Protocol A: Borrowed $${borrowed.toLocaleString()} (70% LTV)`,
        borrowed,
        true,
        r2.ok,
      );
      await ctx.sleep(400);
      const r3 = await ctx.callContract('AMM', 'swap', [borrowed, true], ctx.users[0]?.privateKey);
      ctx.log(
        'swap',
        actor,
        `Protocol B: Swapped $${borrowed.toFixed(0)} → tokens on DEX`,
        borrowed,
        true,
        r3.ok,
      );
      await ctx.sleep(300);
      const r4 = await ctx.callContract(
        'LendingPool',
        'deposit',
        [borrowed * 0.98],
        ctx.users[0]?.privateKey,
      );
      ctx.log(
        'deposit',
        actor,
        `Protocol A: Re-deposited for 1.7x leverage`,
        borrowed * 0.98,
        true,
        r4.ok,
      );
      ctx.log(
        'info',
        actor,
        `Effective exposure: $${(amount * 1.7).toFixed(0)} | Liquidation risk: increased`,
      );
    }

    if (p.scenario === 'bridge') {
      ctx.log('info', actor, `🌉 Bridge simulation: ETH Mainnet → Polygon`);
      await ctx.sleep(400);
      ctx.log('bridge', actor, `Lock ${amount.toLocaleString()} USDC on L1 bridge contract`);
      await ctx.sleep(500);
      ctx.log('bridge', actor, `↳ Waiting for L1 finality (~256 blocks)...`);
      await ctx.sleep(400);
      ctx.log('bridge', actor, `↳ Relayer submits proof to L2`);
      await ctx.sleep(300);
      ctx.log(
        'mint',
        actor,
        `Minted ${(amount * 0.999).toLocaleString()} wUSDC on L2 (0.1% bridge fee)`,
        amount * 0.999,
      );
    }

    if (p.scenario === 'upgrade') {
      ctx.log('info', 'Upgrade', `🔧 Proxy upgrade simulation (UUPS pattern)`);
      await ctx.sleep(400);
      ctx.log(
        'upgrade',
        ctx.users[0].label,
        `Deployed new implementation: 0x${fakeTx().slice(2, 42)}`,
      );
      await ctx.sleep(400);
      ctx.log('upgrade', ctx.users[0].label, `Calling upgradeToAndCall() on proxy...`);
      await ctx.sleep(300);
      ctx.log('info', 'Upgrade', `Storage slots preserved | New logic active | Old state intact`);
      ctx.log('success', 'Upgrade', `✅ Upgrade complete — proxy now points to v2`);
    }

    if (p.scenario === 'yield_farming') {
      ctx.log('info', actor, `🌾 Yield farming strategy`);
      let capital = amount;
      const steps = [
        'Deposit USDC on Aave → earn aUSDC',
        'Stake aUSDC on Curve → earn CRV',
        'Sell CRV for more USDC on Uniswap',
        'Repeat (auto-compound)',
      ];
      for (const [i, step] of steps.entries()) {
        if (ctx.stop()) break;
        await ctx.sleep(450);
        const yield_ = capital * 0.002 * (i + 1);
        capital += yield_;
        ctx.log(
          'swap',
          actor,
          `Step ${i + 1}: ${step} | Capital: $${capital.toFixed(2)} (+${yield_.toFixed(2)})`,
          yield_,
        );
      }
      ctx.log('info', actor, `Estimated APY: ${((capital / amount - 1) * 100 * 12).toFixed(1)}%`);
    }

    ctx.log('success', 'Cross', '✅ Cross-protocol simulation complete');
  },
};

// ─── MODULE 18: Event / Indexer ──────────────────────────────────────────────
export const EventModule: SimModule = {
  id: 'events',
  label: 'Events & Indexer',
  icon: '📋',
  category: 'Infrastructure',
  desc: 'Event emission, indexer compatibility, schema changes',
  longDesc:
    'Test event-driven architectures: emit events, validate indexer compatibility, handle schema changes, and test subgraph queries.',
  requiredMethods: ['transfer', 'swap'],
  requiredEvents: ['Transfer', 'Swap'],
  suggestedContracts: [OZ_ERC20],
  params: [
    { id: 'eventCount', label: 'Events to emit', type: 'number', default: '10' },
    {
      id: 'scenario',
      label: 'Scenario',
      type: 'select',
      default: 'emit',
      options: ['emit', 'indexer_sync', 'schema_change', 'backfill'],
    },
  ],
  async run(ctx, p) {
    const count = parseInt(p.eventCount) || 10;
    ctx.log('info', 'Events', `📋 Event simulation: ${p.scenario}`);
    await ctx.sleep(200);

    if (p.scenario === 'emit') {
      const eventTypes = ['Transfer', 'Approval', 'Swap', 'Deposit', 'Borrow'];
      for (let i = 0; i < count && !ctx.stop(); i++) {
        await ctx.sleep(250);
        const etype = eventTypes[i % eventTypes.length];
        const user = ctx.users[i % ctx.users.length];
        ctx.log(
          'info',
          'Contract',
          `📤 Emit ${etype}(${user.address.slice(0, 10)}…, ${rndInt(100, 10000)})`,
        );
      }
      ctx.log('info', 'Indexer', `✅ ${count} events ready for indexing`);
    }

    if (p.scenario === 'indexer_sync') {
      ctx.log('info', 'Subgraph', `Starting indexer from block 0`);
      for (let b = 0; b < 5 && !ctx.stop(); b++) {
        await ctx.sleep(350);
        const evts = rndInt(5, 30);
        ctx.log('info', 'Indexer', `Block ${b * 1000}–${(b + 1) * 1000}: processed ${evts} events`);
      }
      ctx.log('success', 'Indexer', `✅ Indexer synced — ready for queries`);
    }

    if (p.scenario === 'schema_change') {
      ctx.log('warn', 'Subgraph', `Schema change detected: new Transfer field 'memo'`);
      await ctx.sleep(400);
      ctx.log('error', 'Indexer', `❌ Old events missing 'memo' field — indexer fails`, 0, false);
      ctx.log('info', 'Fix', `✅ Add handleBlock migration or use try-catch in mapping`);
    }

    ctx.log('success', 'Events', '✅ Event simulation complete');
  },
};

// ─── All modules export ───────────────────────────────────────────────────────
export const ALL_MODULES: SimModule[] = [
  TokenModule,
  NFTModule,
  NFTMarketModule,
  AMMModule,
  LendingModule,
  LiquidationModule,
  FlashLoanModule,
  OracleModule,
  MEVModule,
  GovernanceModule,
  MultiUserModule,
  TokenomicsModule,
  NetworkModule,
  SecurityModule,
  StressModule,
  TimeModule,
  CrossProtocolModule,
  EventModule,
];

export const MODULE_CATEGORIES = [
  {
    id: 'Token',
    icon: '🪙',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    id: 'NFT',
    icon: '🖼️',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
  },
  {
    id: 'DeFi',
    icon: '🏦',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    id: 'Advanced',
    icon: '⚡',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    id: 'Testing',
    icon: '🧪',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  {
    id: 'Infrastructure',
    icon: '🌐',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
  },
  {
    id: 'Security',
    icon: '🔒',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
];
