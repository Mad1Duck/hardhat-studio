import { useState } from 'react';
import { ContractAbi, DeployedContract } from '../../types';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/primitives';
import { cn } from '../../lib/utils';
import {
  Wand2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Copy,
  Info,
} from 'lucide-react';

interface Props {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  projectPath: string | null;
  rpcUrl: string;
  onRunInTerminal: (cmd: string) => void;
}

type ProxyPattern = 'transparent' | 'uups' | 'beacon' | 'diamond' | 'minimal' | 'tup' | 'eternal';

type WizardStep = 'select-pattern' | 'select-contracts' | 'review' | 'generate';

interface StorageVar {
  slot: number;
  name: string;
  type: string;
  bytes: number;
}

// ─── Static colour maps (Tailwind purge-safe) ─────────────────────────────────
const SELECTED_BORDER: Record<ProxyPattern, string> = {
  transparent: 'border-blue-500/50 bg-blue-500/5',
  uups: 'border-purple-500/50 bg-purple-500/5',
  beacon: 'border-emerald-500/50 bg-emerald-500/5',
  diamond: 'border-yellow-500/50 bg-yellow-500/5',
  minimal: 'border-pink-500/50 bg-pink-500/5',
  tup: 'border-cyan-500/50 bg-cyan-500/5',
  eternal: 'border-orange-500/50 bg-orange-500/5',
};

const RADIO_SELECTED: Record<ProxyPattern, string> = {
  transparent: 'border-blue-500',
  uups: 'border-purple-500',
  beacon: 'border-emerald-500',
  diamond: 'border-yellow-500',
  minimal: 'border-pink-500',
  tup: 'border-cyan-500',
  eternal: 'border-orange-500',
};

const DOT_COLOR: Record<ProxyPattern, string> = {
  transparent: 'bg-blue-500',
  uups: 'bg-purple-500',
  beacon: 'bg-emerald-500',
  diamond: 'bg-yellow-500',
  minimal: 'bg-pink-500',
  tup: 'bg-cyan-500',
  eternal: 'bg-orange-500',
};

const BADGE_COLOR: Record<ProxyPattern, string> = {
  transparent: 'bg-blue-500/10 text-blue-300',
  uups: 'bg-purple-500/10 text-purple-300',
  beacon: 'bg-emerald-500/10 text-emerald-300',
  diamond: 'bg-yellow-500/10 text-yellow-300',
  minimal: 'bg-pink-500/10 text-pink-300',
  tup: 'bg-cyan-500/10 text-cyan-300',
  eternal: 'bg-orange-500/10 text-orange-300',
};

// ─── Pattern definitions ───────────────────────────────────────────────────────
interface PatternMeta {
  label: string;
  eip: string;
  desc: string;
  ozPlugin: string;
  risk: string;
  supportsUpgrade: boolean;
}

const PROXY_PATTERNS: Record<ProxyPattern, PatternMeta> = {
  transparent: {
    label: 'Transparent Proxy',
    eip: 'EIP-1967',
    desc: 'Admin calls proxy directly; users always delegatecall to implementation. ProxyAdmin manages upgrades. Most battle-tested pattern.',
    ozPlugin: '@openzeppelin/hardhat-upgrades',
    risk: 'Admin cannot interact with implementation. Slightly higher gas due to admin check on every call.',
    supportsUpgrade: true,
  },
  uups: {
    label: 'UUPS Proxy',
    eip: 'EIP-1822',
    desc: 'Upgrade logic lives inside the implementation. More gas efficient — no admin check on every call. Implementation must include upgrade function.',
    ozPlugin: '@openzeppelin/hardhat-upgrades',
    risk: 'CRITICAL: If implementation loses upgrade function (missing UUPSUpgradeable), contract is frozen forever.',
    supportsUpgrade: true,
  },
  beacon: {
    label: 'Beacon Proxy',
    eip: 'EIP-1967',
    desc: 'Multiple proxies share a single beacon contract holding the implementation address. Upgrade all instances atomically with one transaction.',
    ozPlugin: '@openzeppelin/hardhat-upgrades',
    risk: 'Beacon is a single point of failure. If beacon is compromised, all proxies are affected simultaneously.',
    supportsUpgrade: true,
  },
  diamond: {
    label: 'Diamond / Multi-Facet',
    eip: 'EIP-2535',
    desc: 'Single proxy delegates to multiple implementation "facets". Allows modular upgrades per function selector. No contract size limit per facet.',
    ozPlugin: 'hardhat-diamond-abi / diamond-3-hardhat',
    risk: 'High complexity. Selector clashes between facets can cause silent bugs. Requires careful facet management.',
    supportsUpgrade: true,
  },
  minimal: {
    label: 'Minimal Proxy (Clone)',
    eip: 'EIP-1167',
    desc: 'Ultra-cheap deployment by cloning an existing implementation with minimal bytecode. Gas savings ~10x on deploy. Not upgradeable.',
    ozPlugin: '@openzeppelin/contracts (Clones library)',
    risk: 'NOT upgradeable. Implementation address is immutable after deployment. Only suitable for non-upgradeable clones.',
    supportsUpgrade: false,
  },
  tup: {
    label: 'Transparent Upgradeable (TUP)',
    eip: 'EIP-1967 + EIP-897',
    desc: 'OpenZeppelin v5 Transparent Upgradeable Proxy with built-in ProxyAdmin. Separates admin management concern cleanly with dedicated admin contract.',
    ozPlugin: '@openzeppelin/hardhat-upgrades v3+',
    risk: 'ProxyAdmin ownership must be secured. Losing admin key = no more upgrades. Transfer to multisig after deploy.',
    supportsUpgrade: true,
  },
  eternal: {
    label: 'Eternal Storage',
    eip: 'ERC-930',
    desc: 'Logic contract reads/writes to a separate eternal storage contract. Storage layout is key-value based — immune to storage collision on upgrades.',
    ozPlugin: 'Custom (no hardhat-upgrades support)',
    risk: 'No tooling support. Higher gas for storage ops. Deprecated pattern — prefer UUPS or Transparent for new projects.',
    supportsUpgrade: true,
  },
};

export default function UpgradeWizardPanel({
  abis,
  deployedContracts,
  projectPath,
  rpcUrl,
  onRunInTerminal,
}: Props) {
  const [step, setStep] = useState<WizardStep>('select-pattern');
  const [pattern, setPattern] = useState<ProxyPattern>('uups');
  const [implContract, setImplContract] = useState('');
  const [newImplContract, setNewImplContract] = useState('');
  const [proxyAddress, setProxyAddress] = useState('');
  const [initArgs, setInitArgs] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [collisionWarnings, setCollisionWarnings] = useState<string[]>([]);

  const patternMeta = PROXY_PATTERNS[pattern];

  const checkCollisions = () => {
    const warnings: string[] = [];
    if (implContract && newImplContract && implContract !== newImplContract) {
      const old = abis.find((a) => a.contractName === implContract);
      const next = abis.find((a) => a.contractName === newImplContract);
      if (old && next) {
        const oldFns = new Set(old.abi.filter((i) => i.type === 'function').map((i) => i.name));
        const newFns = new Set(next.abi.filter((i) => i.type === 'function').map((i) => i.name));
        const removed = [...oldFns].filter((f) => !newFns.has(f));
        if (removed.length > 0)
          warnings.push(`Removed functions: ${removed.join(', ')} — verify intentional`);
        if (pattern === 'uups') {
          const hasUpgrade = [...newFns].some((f) => f?.toLowerCase().includes('upgrade'));
          if (!hasUpgrade)
            warnings.push(
              'CRITICAL: No upgrade function detected in new implementation. UUPS proxy will be bricked after upgrade!',
            );
        }
        if (pattern === 'diamond') {
          warnings.push(
            'Diamond: verify no function selector clashes between existing facets and new facet',
          );
        }
        const oldHasInit = oldFns.has('initialize') || oldFns.has('init');
        const newHasInit = newFns.has('initialize') || newFns.has('init');
        if (!oldHasInit && newHasInit)
          warnings.push('New impl adds initializer — ensure not re-initialized on existing proxy');
      }
    }
    setCollisionWarnings(warnings);
  };

  const generateScript = () => {
    if (!implContract) return;
    const args = initArgs
      ? initArgs
          .split(',')
          .map((a) => `"${a.trim()}"`)
          .join(', ')
      : '';

    let script = '';

    // ── Fresh deploy ──
    if (!proxyAddress) {
      switch (pattern) {
        case 'transparent':
        case 'tup':
          script = `// Deploy ${patternMeta.label} for ${implContract}
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await ethers.getContractFactory("${implContract}");
  const proxy = await upgrades.deployProxy(Factory, [${args}], {
    initializer: "initialize",
    kind: "transparent",
  });
  await proxy.waitForDeployment();

  const proxyAddr = await proxy.getAddress();
  console.log("✅ Proxy deployed to:", proxyAddr);
  console.log("Implementation:", await upgrades.erc1967.getImplementationAddress(proxyAddr));
  console.log("Admin:", await upgrades.erc1967.getAdminAddress(proxyAddr));
}

main().catch(console.error);`;
          break;

        case 'uups':
          script = `// Deploy UUPS Proxy for ${implContract}
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await ethers.getContractFactory("${implContract}");
  const proxy = await upgrades.deployProxy(Factory, [${args}], {
    initializer: "initialize",
    kind: "uups",
  });
  await proxy.waitForDeployment();

  const proxyAddr = await proxy.getAddress();
  console.log("✅ Proxy deployed to:", proxyAddr);
  console.log("Implementation:", await upgrades.erc1967.getImplementationAddress(proxyAddr));
}

main().catch(console.error);`;
          break;

        case 'beacon':
          script = `// Deploy Beacon Proxy for ${implContract}
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("${implContract}");
  const beacon = await upgrades.deployBeacon(Factory);
  await beacon.waitForDeployment();
  const beaconAddr = await beacon.getAddress();
  console.log("✅ Beacon deployed:", beaconAddr);

  const proxy = await upgrades.deployBeaconProxy(beaconAddr, Factory, [${args}]);
  await proxy.waitForDeployment();
  console.log("✅ Proxy deployed:", await proxy.getAddress());
}

main().catch(console.error);`;
          break;

        case 'diamond':
          script = `// Deploy Diamond (EIP-2535) for ${implContract}
const { ethers } = require("hardhat");

// Helper: get function selectors from ABI
function getSelectors(contract) {
  const signatures = Object.keys(contract.interface.functions);
  return signatures
    .filter((s) => s !== "init(bytes)")
    .map((s) => contract.interface.getSighash(s));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Diamond with:", deployer.address);

  // Deploy facets
  const ${implContract}Facet = await (await ethers.getContractFactory("${implContract}")).deploy();
  await ${implContract}Facet.waitForDeployment();
  console.log("Facet deployed:", await ${implContract}Facet.getAddress());

  // Deploy DiamondCutFacet
  const DiamondCutFacet = await (await ethers.getContractFactory("DiamondCutFacet")).deploy();
  await DiamondCutFacet.waitForDeployment();

  // Deploy Diamond
  const Diamond = await (await ethers.getContractFactory("Diamond")).deploy(
    deployer.address,
    await DiamondCutFacet.getAddress()
  );
  await Diamond.waitForDeployment();
  const diamondAddr = await Diamond.getAddress();
  console.log("✅ Diamond deployed:", diamondAddr);

  // Add facets via diamondCut
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddr);
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  await diamondCut.diamondCut([
    {
      facetAddress: await ${implContract}Facet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(${implContract}Facet),
    },
  ], ethers.ZeroAddress, "0x");

  console.log("✅ Facets registered");
}

main().catch(console.error);`;
          break;

        case 'minimal':
          script = `// Deploy Minimal Proxy / Clone (EIP-1167) of ${implContract}
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Deploy implementation once
  const Impl = await (await ethers.getContractFactory("${implContract}")).deploy();
  await Impl.waitForDeployment();
  const implAddr = await Impl.getAddress();
  console.log("Implementation deployed:", implAddr);

  // Deploy ClonesFactory or use OZ Clones directly
  // Option A: using OpenZeppelin Clones library in a factory contract
  const ClonesFactory = await (await ethers.getContractFactory("ClonesFactory")).deploy(implAddr);
  await ClonesFactory.waitForDeployment();
  console.log("Factory deployed:", await ClonesFactory.getAddress());

  // Create a clone
  const tx = await ClonesFactory.createClone();
  const receipt = await tx.wait();
  console.log("✅ Clone created — check CloneCreated event in receipt");
  console.log("⚠️  NOTE: EIP-1167 clones are NOT upgradeable");
}

main().catch(console.error);`;
          break;

        case 'eternal':
          script = `// Deploy Eternal Storage pattern (ERC-930) for ${implContract}
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // 1. Deploy EternalStorage contract
  const EternalStorage = await (await ethers.getContractFactory("EternalStorage")).deploy();
  await EternalStorage.waitForDeployment();
  const storageAddr = await EternalStorage.getAddress();
  console.log("EternalStorage deployed:", storageAddr);

  // 2. Deploy logic contract, passing storage address
  const Logic = await (await ethers.getContractFactory("${implContract}")).deploy(storageAddr);
  await Logic.waitForDeployment();
  const logicAddr = await Logic.getAddress();
  console.log("Logic deployed:", logicAddr);

  // 3. Authorize logic contract as writer on storage
  await EternalStorage.setAssociatedContract(logicAddr);
  console.log("✅ Logic authorized on storage");

  // To upgrade: deploy new logic, call setAssociatedContract with new address
}

main().catch(console.error);`;
          break;

        default:
          script = '// Pattern not supported for code generation';
      }
    } else {
      // ── Upgrade existing proxy ──
      const newName = newImplContract || implContract;
      switch (pattern) {
        case 'diamond':
          script = `// Upgrade Diamond facet at ${proxyAddress}
const { ethers } = require("hardhat");

function getSelectors(contract) {
  return Object.keys(contract.interface.functions)
    .filter((s) => s !== "init(bytes)")
    .map((s) => contract.interface.getSighash(s));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  const NewFacet = await (await ethers.getContractFactory("${newName}")).deploy();
  await NewFacet.waitForDeployment();
  const newFacetAddr = await NewFacet.getAddress();
  console.log("New facet deployed:", newFacetAddr);

  const diamondCut = await ethers.getContractAt("IDiamondCut", "${proxyAddress}");
  await diamondCut.diamondCut([
    {
      facetAddress: newFacetAddr,
      action: FacetCutAction.Replace,
      functionSelectors: getSelectors(NewFacet),
    },
  ], ethers.ZeroAddress, "0x");

  console.log("✅ Diamond facet upgraded");
}

main().catch(console.error);`;
          break;

        case 'beacon':
          script = `// Upgrade Beacon implementation at ${proxyAddress}
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const NewFactory = await ethers.getContractFactory("${newName}");
  await upgrades.upgradeBeacon("${proxyAddress}", NewFactory);

  const beaconImpl = await upgrades.beacon.getImplementationAddress("${proxyAddress}");
  console.log("✅ Beacon implementation upgraded to:", beaconImpl);
}

main().catch(console.error);`;
          break;

        case 'eternal':
          script = `// Upgrade Eternal Storage logic to ${newName}
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // storageAddr = the EternalStorage contract address
  const storageAddr = "${proxyAddress}";

  const NewLogic = await (await ethers.getContractFactory("${newName}")).deploy(storageAddr);
  await NewLogic.waitForDeployment();
  const newLogicAddr = await NewLogic.getAddress();
  console.log("New logic deployed:", newLogicAddr);

  const storage = await ethers.getContractAt("EternalStorage", storageAddr);
  await storage.setAssociatedContract(newLogicAddr);
  console.log("✅ Eternal storage now pointing to:", newLogicAddr);
}

main().catch(console.error);`;
          break;

        default:
          // transparent / uups / tup
          script = `// Upgrade proxy at ${proxyAddress} to ${newName}
const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = "${proxyAddress}";
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  const currentImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Current implementation:", currentImpl);

  const NewFactory = await ethers.getContractFactory("${newName}");
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    NewFactory,
    ${pattern === 'uups' ? '{ kind: "uups" }' : '{}'}
  );
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("✅ Upgraded! New implementation:", newImpl);
}

main().catch(console.error);`;
      }
    }

    setGeneratedScript(script);
    setStep('generate');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 1500);
  };

  const STEPS: WizardStep[] = ['select-pattern', 'select-contracts', 'review', 'generate'];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <Wand2 className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold">Upgrade Wizard</span>
        <div className="flex items-center gap-1 ml-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={cn(
                  'w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold cursor-default',
                  step === s
                    ? 'bg-purple-600 text-white'
                    : STEPS.indexOf(step) > i
                      ? 'bg-green-600 text-white'
                      : 'bg-muted text-muted-foreground',
                )}>
                {STEPS.indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-2xl p-6 overflow-auto">
        {/* ── Step 1: Pattern ── */}
        {step === 'select-pattern' && (
          <div>
            <h2 className="mb-1 text-lg font-bold">Choose Proxy Pattern</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              Select the upgradeable proxy architecture for your contract
            </p>

            <div className="mb-6 space-y-2">
              {(Object.entries(PROXY_PATTERNS) as [ProxyPattern, PatternMeta][]).map(
                ([key, meta]) => (
                  <div
                    key={key}
                    onClick={() => setPattern(key)}
                    className={cn(
                      'border rounded-xl p-3.5 cursor-pointer transition-all select-none',
                      pattern === key
                        ? SELECTED_BORDER[key]
                        : 'border-border hover:border-muted-foreground/30',
                    )}>
                    <div className="flex items-center gap-3 mb-1.5">
                      {/* ✅ Static radio circle — no dynamic colour class */}
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          pattern === key ? RADIO_SELECTED[key] : 'border-muted-foreground/30',
                        )}>
                        {pattern === key && (
                          <div className={cn('w-2 h-2 rounded-full', DOT_COLOR[key])} />
                        )}
                      </div>
                      <span className="text-sm font-semibold">{meta.label}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-mono',
                          BADGE_COLOR[key],
                        )}>
                        {meta.eip}
                      </span>
                      {!meta.supportsUpgrade && (
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded ml-auto">
                          Not upgradeable
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/65 ml-7 mb-1.5">
                      {meta.desc}
                    </p>
                    <div className="ml-7 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-amber-400/80">{meta.risk}</p>
                    </div>
                  </div>
                ),
              )}
            </div>

            <Button className="w-full" onClick={() => setStep('select-contracts')}>
              Continue with {patternMeta.label} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Contracts ── */}
        {step === 'select-contracts' && (
          <div>
            <h2 className="mb-1 text-lg font-bold">Configure Contracts</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              Select implementation contract(s) and configure deployment
            </p>

            <div className="space-y-4">
              <div>
                <Label className="text-xs">Implementation Contract</Label>
                <select
                  value={implContract}
                  onChange={(e) => setImplContract(e.target.value)}
                  className="w-full h-8 px-2 mt-1 text-xs border rounded bg-muted/20 border-border">
                  <option value="">Select contract from ABI...</option>
                  {abis.map((a) => (
                    <option key={a.contractName} value={a.contractName}>
                      {a.contractName}
                    </option>
                  ))}
                </select>
                {implContract &&
                  !abis
                    .find((a) => a.contractName === implContract)
                    ?.abi.some((i) => i.name === 'initialize') && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      ⚠️ No initialize() function found — upgradeable contracts should use
                      initialize() instead of constructor
                    </p>
                  )}
              </div>

              {pattern !== 'minimal' && pattern !== 'eternal' && (
                <div>
                  <Label className="text-xs">
                    Initialize Arguments (optional, comma separated)
                  </Label>
                  <Input
                    value={initArgs}
                    onChange={(e) => setInitArgs(e.target.value)}
                    placeholder='e.g. "MyToken", "MTK", 1000000'
                    className="mt-1 text-xs h-7"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <Label className="text-xs">
                  Existing Proxy Address{' '}
                  <span className="text-muted-foreground">(leave empty for fresh deploy)</span>
                </Label>
                <Input
                  value={proxyAddress}
                  onChange={(e) => setProxyAddress(e.target.value)}
                  placeholder="0x... (optional — for upgrading existing proxy)"
                  className="mt-1 font-mono text-xs h-7"
                />
              </div>

              {proxyAddress && (
                <div>
                  <Label className="text-xs">New Implementation Contract</Label>
                  <select
                    value={newImplContract}
                    onChange={(e) => {
                      setNewImplContract(e.target.value);
                      checkCollisions();
                    }}
                    className="w-full h-8 px-2 mt-1 text-xs border rounded bg-muted/20 border-border">
                    <option value="">Same contract (re-deploy)</option>
                    {abis
                      .filter((a) => a.contractName !== implContract)
                      .map((a) => (
                        <option key={a.contractName} value={a.contractName}>
                          {a.contractName}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Pattern-specific hints */}
              {pattern === 'diamond' && (
                <div className="p-3 border rounded-lg bg-yellow-500/5 border-yellow-500/20 text-[10px] text-yellow-300/80 space-y-1">
                  <p className="font-semibold text-yellow-300">Diamond (EIP-2535) requirements:</p>
                  <p>
                    • Need <code className="bg-muted px-0.5 rounded">DiamondCutFacet</code>,{' '}
                    <code className="bg-muted px-0.5 rounded">Diamond</code>, and{' '}
                    <code className="bg-muted px-0.5 rounded">IDiamondCut</code> in your project
                  </p>
                  <p>
                    • Install:{' '}
                    <code className="bg-muted px-0.5 rounded">npm i diamond-3-hardhat</code>
                  </p>
                </div>
              )}
              {pattern === 'eternal' && (
                <div className="p-3 border rounded-lg bg-orange-500/5 border-orange-500/20 text-[10px] text-orange-300/80 space-y-1">
                  <p className="font-semibold text-orange-300">Eternal Storage requirements:</p>
                  <p>
                    • Need <code className="bg-muted px-0.5 rounded">EternalStorage.sol</code> with{' '}
                    <code className="bg-muted px-0.5 rounded">setAssociatedContract()</code>
                  </p>
                  <p>• Logic contract reads from storage via key-value mapping</p>
                </div>
              )}
              {pattern === 'minimal' && (
                <div className="p-3 border rounded-lg bg-pink-500/5 border-pink-500/20 text-[10px] text-pink-300/80 space-y-1">
                  <p className="font-semibold text-pink-300">Minimal Proxy (EIP-1167) notes:</p>
                  <p>• Clones are NOT upgradeable — implementation is fixed at creation</p>
                  <p>
                    • Need a <code className="bg-muted px-0.5 rounded">ClonesFactory</code> contract
                    or use OZ <code className="bg-muted px-0.5 rounded">Clones.clone()</code>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setStep('select-pattern')}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  checkCollisions();
                  setStep('review');
                }}
                disabled={!implContract}>
                Review <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 'review' && (
          <div>
            <h2 className="mb-1 text-lg font-bold">Review & Check</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              Verify configuration before generating the deployment script
            </p>

            {/* Summary */}
            <div className="p-4 mb-4 border bg-card border-border rounded-xl">
              <h3 className="mb-3 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Configuration
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Pattern', value: `${patternMeta.label} (${patternMeta.eip})` },
                  { label: 'Implementation', value: implContract },
                  {
                    label: 'Action',
                    value: proxyAddress
                      ? `Upgrade proxy at ${proxyAddress.slice(0, 10)}…`
                      : 'Fresh deploy',
                  },
                  ...(proxyAddress && newImplContract
                    ? [{ label: 'New Implementation', value: newImplContract }]
                    : []),
                  ...(initArgs ? [{ label: 'Init Args', value: initArgs }] : []),
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collision warnings */}
            {collisionWarnings.length > 0 && (
              <div className="p-4 mb-4 border bg-red-500/10 border-red-500/20 rounded-xl">
                <h3 className="mb-2 text-xs font-semibold text-red-400">
                  ⚠️ Storage / Compatibility Warnings
                </h3>
                <ul className="space-y-1">
                  {collisionWarnings.map((w, i) => (
                    <li key={i} className="text-xs text-red-400/80 flex items-start gap-1.5">
                      <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {collisionWarnings.length === 0 && (implContract || newImplContract) && (
              <div className="p-4 mb-4 border bg-green-500/10 border-green-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  No obvious compatibility issues detected from ABI analysis
                </div>
                <p className="text-[10px] text-foreground/50 mt-1">
                  Full storage check requires Solidity source. Use{' '}
                  <code className="bg-muted px-0.5 rounded">slither-check-upgradeability</code> for
                  production.
                </p>
              </div>
            )}

            {/* Prerequisites */}
            <div className="p-4 mb-4 border bg-blue-500/10 border-blue-500/20 rounded-xl">
              <h3 className="mb-2 text-xs font-semibold text-blue-400">📋 Prerequisites</h3>
              <ul className="space-y-1 text-xs text-foreground/70">
                <li>
                  • Install:{' '}
                  <code className="bg-muted px-1 rounded text-[10px]">{patternMeta.ozPlugin}</code>
                </li>
                {pattern !== 'minimal' && pattern !== 'eternal' && (
                  <li>
                    • Contract inherits from{' '}
                    <code className="bg-muted px-1 rounded text-[10px]">
                      {pattern === 'uups'
                        ? 'UUPSUpgradeable'
                        : pattern === 'diamond'
                          ? 'IDiamondCut'
                          : 'Initializable'}
                    </code>
                  </li>
                )}
                {(pattern === 'transparent' || pattern === 'uups' || pattern === 'tup') && (
                  <li>
                    • No <code className="bg-muted px-1 rounded text-[10px]">constructor</code> with
                    state — use{' '}
                    <code className="bg-muted px-1 rounded text-[10px]">initialize()</code>
                  </li>
                )}
                {pattern === 'uups' && (
                  <li>
                    • Implementation has{' '}
                    <code className="bg-muted px-1 rounded text-[10px]">_authorizeUpgrade()</code>
                  </li>
                )}
                {pattern === 'tup' && (
                  <li>• Transfer ProxyAdmin ownership to multisig after deploy</li>
                )}
                {pattern === 'diamond' && (
                  <>
                    <li>
                      • <code className="bg-muted px-1 rounded text-[10px]">DiamondCutFacet</code>{' '}
                      and <code className="bg-muted px-1 rounded text-[10px]">Diamond</code>{' '}
                      contracts in project
                    </li>
                    <li>• No selector clashes between facets</li>
                  </>
                )}
                {pattern === 'minimal' && (
                  <li>• Implementation is finalized and non-upgradeable</li>
                )}
                {pattern === 'eternal' && (
                  <li>
                    • <code className="bg-muted px-1 rounded text-[10px]">EternalStorage.sol</code>{' '}
                    with key-value mappings deployed
                  </li>
                )}
              </ul>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('select-contracts')}>
                Back
              </Button>
              <Button className="flex-1" onClick={generateScript}>
                Generate Script <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Generated script ── */}
        {step === 'generate' && (
          <div>
            <h2 className="mb-1 text-lg font-bold">Generated Script</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Copy to your <code className="px-1 rounded bg-muted">scripts/</code> folder and run it
              with Hardhat
            </p>

            <div className="relative">
              <pre className="text-[11px] font-mono text-emerald-400/80 bg-muted/20 rounded-xl p-4 border border-border overflow-auto whitespace-pre leading-relaxed max-h-[420px]">
                {generatedScript}
              </pre>
              <Button size="sm" className="absolute text-xs top-2 right-2 h-7" onClick={copyScript}>
                {copiedScript ? (
                  <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 mr-1" />
                )}
                {copiedScript ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep('review')}>
                Back
              </Button>
              <Button variant="outline" className="flex-1" onClick={copyScript}>
                <Copy className="w-3 h-3 mr-1" /> Copy to Clipboard
              </Button>
            </div>

            <div className="p-3 mt-4 border rounded-lg bg-muted/20 border-border">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Save as <code className="px-1 rounded bg-muted">scripts/deploy_upgrade.js</code>,
                then run:
                <br />
                <code className="text-blue-400">
                  npx hardhat run scripts/deploy_upgrade.js --network localhost
                </code>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
