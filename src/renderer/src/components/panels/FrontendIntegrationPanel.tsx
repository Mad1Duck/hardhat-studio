import { useState, useEffect } from 'react'
import { ContractAbi, AbiItem, DeployedContract } from '../../types'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'
import { Code2, Copy, Check, Zap, RefreshCw, ChevronDown, Package, Layers } from 'lucide-react'

interface Props {
  abis: ContractAbi[]
  deployedContracts: DeployedContract[]
  rpcUrl: string
}

type Framework = 'ethers' | 'viem' | 'wagmi' | 'web3js' | 'rainbowkit'
type Style = 'hook' | 'async-fn' | 'class'

const FRAMEWORK_META: Record<Framework, { label: string; color: string; pkg: string }> = {
  ethers:     { label: 'ethers.js v6', color: 'text-blue-400',    pkg: 'ethers' },
  viem:       { label: 'viem',          color: 'text-purple-400',  pkg: 'viem' },
  wagmi:      { label: 'wagmi + viem',  color: 'text-pink-400',    pkg: 'wagmi' },
  web3js:     { label: 'web3.js',       color: 'text-yellow-400',  pkg: 'web3' },
  rainbowkit: { label: 'RainbowKit',    color: 'text-orange-400',  pkg: '@rainbow-me/rainbowkit' },
}

function generateEthersHook(abi: ContractAbi, deployed?: DeployedContract): string {
  const fns = abi.abi.filter(i => i.type === 'function')
  const reads = fns.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure')
  const writes = fns.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
  const addr = deployed?.address || '0x...'
  const name = abi.contractName

  const readHooks = reads.slice(0, 4).map(fn => {
    const fnName = fn.name || 'call'
    const params = (fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')
    return `
  const ${fnName} = useCallback(async (${params}) => {
    if (!contract) return null
    try {
      const result = await contract.${fnName}(${(fn.inputs || []).map(i => i.name || 'arg').join(', ')})
      return result
    } catch (err) {
      console.error('${fnName} failed:', err)
      return null
    }
  }, [contract])`
  }).join('\n')

  const writeHooks = writes.slice(0, 4).map(fn => {
    const fnName = fn.name || 'call'
    const params = (fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')
    return `
  const ${fnName} = useCallback(async (${params}) => {
    if (!signer) throw new Error('Wallet not connected')
    const tx = await contract.connect(signer).${fnName}(${(fn.inputs || []).map(i => i.name || 'arg').join(', ')})
    const receipt = await tx.wait()
    return receipt
  }, [contract, signer])`
  }).join('\n')

  return `import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import ${name}ABI from './abis/${name}.json'

const CONTRACT_ADDRESS = '${addr}'

export function use${name}() {
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [provider, setProvider] = useState<ethers.Provider | null>(null)
  const [connected, setConnected] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      // Read-only provider (fallback)
      const roProv = new ethers.JsonRpcProvider('${deployed?.rpcUrl || 'http://127.0.0.1:8545'}')
      const roContract = new ethers.Contract(CONTRACT_ADDRESS, ${name}ABI, roProv)
      setProvider(roProv)
      setContract(roContract)
    }
    init()
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('No wallet detected')
    const web3Prov = new ethers.BrowserProvider(window.ethereum)
    const accounts = await web3Prov.send('eth_requestAccounts', [])
    const sgnr = await web3Prov.getSigner()
    const net = await web3Prov.getNetwork()
    const writeContract = new ethers.Contract(CONTRACT_ADDRESS, ${name}ABI, sgnr)
    setSigner(sgnr)
    setContract(writeContract)
    setChainId(Number(net.chainId))
    setAccount(accounts[0])
    setConnected(true)
  }, [])

  const disconnect = useCallback(() => {
    setSigner(null)
    setConnected(false)
    setAccount(null)
  }, [])
${readHooks}
${writeHooks}

  return {
    contract, signer, provider, connected, chainId, account,
    connect, disconnect,
    ${[...reads, ...writes].slice(0, 8).map(f => f.name).join(', ')}
  }
}
`
}

function generateViemHook(abi: ContractAbi, deployed?: DeployedContract): string {
  const name = abi.contractName
  const addr = deployed?.address || '0x...'
  const reads = abi.abi.filter(i => i.type === 'function' && (i.stateMutability === 'view' || i.stateMutability === 'pure')).slice(0, 4)
  const writes = abi.abi.filter(i => i.type === 'function' && i.stateMutability !== 'view' && i.stateMutability !== 'pure').slice(0, 4)

  return `import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, createWalletClient, http, custom, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'
import ${name}ABI from './abis/${name}.json'

const CONTRACT_ADDRESS = '${addr}' as const

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('${deployed?.rpcUrl || 'http://127.0.0.1:8545'}'),
})

export function use${name}() {
  const [walletClient, setWalletClient] = useState<ReturnType<typeof createWalletClient> | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('No wallet detected')
    const client = createWalletClient({
      chain: mainnet,
      transport: custom(window.ethereum),
    })
    const [addr] = await client.requestAddresses()
    setWalletClient(client)
    setAccount(addr)
    setConnected(true)
  }, [])

${reads.map(fn => `  const read${capitalize(fn.name || 'data')} = useCallback(async (${(fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')}) => {
    return publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ${name}ABI,
      functionName: '${fn.name}',${fn.inputs?.length ? `\n      args: [${(fn.inputs || []).map(i => i.name || 'arg').join(', ')}],` : ''}
    })
  }, [])`).join('\n\n')}

${writes.map(fn => `  const write${capitalize(fn.name || 'tx')} = useCallback(async (${(fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')}) => {
    if (!walletClient || !account) throw new Error('Not connected')
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ${name}ABI,
      functionName: '${fn.name}',${fn.inputs?.length ? `\n      args: [${(fn.inputs || []).map(i => i.name || 'arg').join(', ')}],` : ''}
      account: account as \`0x\${string}\`,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    return receipt
  }, [walletClient, account])`).join('\n\n')}

  return {
    publicClient, walletClient, account, connected, connect,
    ${reads.map(fn => `read${capitalize(fn.name || 'data')}`).join(', ')},
    ${writes.map(fn => `write${capitalize(fn.name || 'tx')}`).join(', ')}
  }
}
`
}

function generateWagmiHook(abi: ContractAbi, deployed?: DeployedContract): string {
  const name = abi.contractName
  const addr = deployed?.address || '0x...'
  const reads = abi.abi.filter(i => i.type === 'function' && (i.stateMutability === 'view' || i.stateMutability === 'pure')).slice(0, 3)
  const writes = abi.abi.filter(i => i.type === 'function' && i.stateMutability !== 'view' && i.stateMutability !== 'pure').slice(0, 3)

  return `import { useReadContract, useWriteContract, useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import ${name}ABI from './abis/${name}.json'

const CONTRACT_ADDRESS = '${addr}' as const

//  Read hooks 
${reads.map(fn => `export function use${name}${capitalize(fn.name || 'Read')}(${(fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')}) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ${name}ABI,
    functionName: '${fn.name}',${fn.inputs?.length ? `\n    args: [${(fn.inputs || []).map(i => i.name || 'arg').join(', ')}],` : ''}
  })
}`).join('\n\n')}

//  Write hooks 
${writes.map(fn => `export function use${name}${capitalize(fn.name || 'Write')}() {
  const { writeContract, isPending, isSuccess, data: txHash } = useWriteContract()
  const execute = (${(fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')}) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ${name}ABI,
      functionName: '${fn.name}',${fn.inputs?.length ? `\n      args: [${(fn.inputs || []).map(i => i.name || 'arg').join(', ')}],` : ''}
    })
  }
  return { execute, isPending, isSuccess, txHash }
}`).join('\n\n')}

//  Wallet connection 
export function use${name}Wallet() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  return {
    address,
    isConnected,
    connect: () => connect({ connector: injected() }),
  }
}
`
}

function generateRainbowKitSetup(abi: ContractAbi): string {
  const name = abi.contractName
  return `// RainbowKit + wagmi v2 setup
// Install: npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query

// 1. wagmi.config.ts
import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, base } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const config = getDefaultConfig({
  appName: 'My App',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // from cloud.walletconnect.com
  chains: [mainnet, sepolia, base],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
  },
})

// 2. _app.tsx / main.tsx wrapper
import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi.config'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <YourApp />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

// 3. Use ConnectButton anywhere
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { use${name}Read, use${name}Write } from './hooks/use${name}'

function ${name}Component() {
  const { data: result } = use${name}Read()
  const { execute, isPending } = use${name}Write()

  return (
    <div>
      <ConnectButton />
      <p>Result: {result?.toString()}</p>
      <button onClick={() => execute()} disabled={isPending}>
        {isPending ? 'Pending...' : 'Execute'}
      </button>
    </div>
  )
}
`
}

function generateWeb3JsHook(abi: ContractAbi, deployed?: DeployedContract): string {
  const name = abi.contractName
  const addr = deployed?.address || '0x...'
  const reads = abi.abi.filter(i => i.type === 'function' && (i.stateMutability === 'view' || i.stateMutability === 'pure')).slice(0, 3)
  const writes = abi.abi.filter(i => i.type === 'function' && i.stateMutability !== 'view' && i.stateMutability !== 'pure').slice(0, 3)

  return `import { useState, useEffect, useCallback } from 'react'
import Web3 from 'web3'
import ${name}ABI from './abis/${name}.json'

const CONTRACT_ADDRESS = '${addr}'

export function use${name}() {
  const [web3, setWeb3] = useState<Web3 | null>(null)
  const [contract, setContract] = useState<any>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Read-only provider
    const roWeb3 = new Web3('${deployed?.rpcUrl || 'http://127.0.0.1:8545'}')
    const roContract = new roWeb3.eth.Contract(${name}ABI as any, CONTRACT_ADDRESS)
    setWeb3(roWeb3)
    setContract(roContract)
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('No wallet detected')
    const w3 = new Web3(window.ethereum as any)
    const accounts = await w3.eth.requestAccounts()
    const c = new w3.eth.Contract(${name}ABI as any, CONTRACT_ADDRESS)
    setWeb3(w3)
    setContract(c)
    setAccount(accounts[0])
    setConnected(true)
  }, [])

${reads.map(fn => `  const ${fn.name} = useCallback(async (${(fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')}) => {
    return contract?.methods.${fn.name}(${(fn.inputs || []).map(i => i.name || 'arg').join(', ')}).call()
  }, [contract])`).join('\n\n')}

${writes.map(fn => `  const ${fn.name} = useCallback(async (${(fn.inputs || []).map(i => `${i.name || 'arg'}: ${solToTs(i.type)}`).join(', ')}) => {
    if (!account) throw new Error('Not connected')
    return contract?.methods.${fn.name}(${(fn.inputs || []).map(i => i.name || 'arg').join(', ')}).send({ from: account })
  }, [contract, account])`).join('\n\n')}

  return { web3, contract, account, connected, connect }
}
`
}

function solToTs(type: string): string {
  if (type.startsWith('uint') || type.startsWith('int')) return 'bigint'
  if (type === 'bool') return 'boolean'
  if (type === 'address') return 'string'
  if (type.startsWith('bytes')) return 'string'
  if (type === 'string') return 'string'
  if (type.endsWith('[]')) return `${solToTs(type.slice(0, -2))}[]`
  return 'unknown'
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function generateAbiJson(abi: ContractAbi): string {
  return JSON.stringify(abi.abi, null, 2)
}

export default function FrontendIntegrationPanel({ abis, deployedContracts, rpcUrl }: Props) {
  const [selectedAbi, setSelectedAbi] = useState<ContractAbi | null>(null)
  const [framework, setFramework] = useState<Framework>('ethers')
  const [style, setStyle] = useState<Style>('hook')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'hook' | 'abi' | 'setup'>('hook')

  useEffect(() => {
    if (abis.length > 0 && !selectedAbi) setSelectedAbi(abis[0])
  }, [abis])

  const deployed = selectedAbi
    ? deployedContracts.find(c => c.name === selectedAbi.contractName || c.name === selectedAbi.name)
    : undefined

  const getCode = () => {
    if (!selectedAbi) return '// Select a contract above'
    if (activeTab === 'abi') return generateAbiJson(selectedAbi)
    if (activeTab === 'setup' && framework === 'rainbowkit') return generateRainbowKitSetup(selectedAbi)
    switch (framework) {
      case 'ethers': return generateEthersHook(selectedAbi, deployed)
      case 'viem': return generateViemHook(selectedAbi, deployed)
      case 'wagmi': return generateWagmiHook(selectedAbi, deployed)
      case 'rainbowkit': return generateWagmiHook(selectedAbi, deployed)
      case 'web3js': return generateWeb3JsHook(selectedAbi, deployed)
    }
  }

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const code = getCode()
  const meta = FRAMEWORK_META[framework]

  const fns = selectedAbi?.abi.filter(i => i.type === 'function') || []
  const reads = fns.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure')
  const writes = fns.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
  const events = selectedAbi?.abi.filter(i => i.type === 'event') || []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-violet-400"/>
          <span className="text-sm font-semibold">Frontend Integration Helper</span>
          <span className="text-[10px] text-muted-foreground/50 bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded">Auto-generate code</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left config */}
        <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-card/50 overflow-y-auto">
          {/* Contract selector */}
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Contract</label>
            <select
              value={selectedAbi?.path || ''}
              onChange={e => setSelectedAbi(abis.find(a => a.path === e.target.value) || null)}
              className="w-full h-7 text-xs bg-background border border-border rounded px-2 outline-none"
            >
              <option value="">Select contract…</option>
              {abis.map(a => <option key={a.path} value={a.path}>{a.contractName}</option>)}
            </select>

            {deployed && (
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                ✓ Deployed: {deployed.address.slice(0, 10)}…
              </div>
            )}
          </div>

          {/* Framework picker */}
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Framework</label>
            <div className="space-y-1">
              {(Object.entries(FRAMEWORK_META) as [Framework, typeof FRAMEWORK_META[Framework]][]).map(([key, val]) => (
                <button key={key} onClick={() => setFramework(key)}
                  className={cn('w-full text-left px-2.5 py-2 rounded text-xs transition-all flex items-center justify-between',
                    framework === key ? 'bg-accent text-foreground' : 'hover:bg-accent/40 text-muted-foreground')}>
                  <span className={framework === key ? val.color : ''}>{val.label}</span>
                  {framework === key && <span className="text-[9px] text-muted-foreground/40 font-mono">{val.pkg}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Install command */}
          <div className="p-3 border-b border-border">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 block mb-2">Install</label>
            <div className="flex items-center gap-1 bg-muted/20 border border-border rounded px-2 py-1.5">
              <code className="text-[10px] font-mono text-muted-foreground/70 flex-1 truncate">npm i {meta.pkg}</code>
              <button onClick={() => copy('install', `npm i ${meta.pkg}`)} className="flex-shrink-0">
                {copiedKey === 'install' ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground"/>}
              </button>
            </div>
          </div>

          {/* ABI summary */}
          {selectedAbi && (
            <div className="p-3 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">ABI Summary</label>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground/50 flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-blue-400"/> Read functions</span>
                  <span className="font-mono text-blue-400">{reads.length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground/50 flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-orange-400"/> Write functions</span>
                  <span className="font-mono text-orange-400">{writes.length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground/50 flex items-center gap-1"><Layers className="w-2.5 h-2.5 text-violet-400"/> Events</span>
                  <span className="font-mono text-violet-400">{events.length}</span>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {reads.slice(0, 5).map(fn => (
                  <div key={fn.name} className="text-[9px] font-mono text-blue-300/60 truncate px-1">{fn.name}()</div>
                ))}
                {writes.slice(0, 5).map(fn => (
                  <div key={fn.name} className="text-[9px] font-mono text-orange-300/60 truncate px-1">{fn.name}()</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Code output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-0 px-4 border-b border-border bg-card/50">
            {(['hook', 'abi', 'setup'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn('px-4 py-2.5 text-xs font-medium border-b-2 transition-all capitalize',
                  activeTab === tab ? 'border-violet-500 text-violet-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground')}>
                {tab === 'hook' ? (framework === 'wagmi' || framework === 'rainbowkit' ? 'Wagmi Hooks' : 'React Hook') : tab === 'abi' ? 'ABI JSON' : 'Setup Guide'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 py-2">
              <span className={cn('text-[10px] font-medium', meta.color)}>{meta.label}</span>
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => copy('code', code)}>
                {copiedKey === 'code' ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
                Copy
              </Button>
            </div>
          </div>

          {/* Code block */}
          <div className="flex-1 overflow-auto bg-[#0d1117] font-mono">
            <div className="flex">
              {/* Line numbers */}
              <div className="select-none text-right pr-3 pl-4 py-4 text-[11px] leading-[1.6rem] text-muted-foreground/20 bg-muted/5 border-r border-border/20 flex-shrink-0 min-w-[36px]">
                {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <pre className="flex-1 p-4 text-[12px] leading-[1.6rem] text-emerald-100/75 overflow-x-auto whitespace-pre">
                <code className="language-typescript">{code}</code>
              </pre>
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-4 py-1.5 border-t border-border/50 bg-card/30 flex items-center gap-4 text-[10px] text-muted-foreground/40">
            <Package className="w-3 h-3"/>
            <span>Place ABI JSON at <code className="font-mono">./abis/{selectedAbi?.contractName || 'Contract'}.json</code></span>
            {deployed && <span className="ml-auto text-emerald-400/60">Contract address auto-filled from deployed contracts</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
