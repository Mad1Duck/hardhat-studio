import { useState } from 'react'
import { ContractAbi, DeployedContract } from '../../types'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'
import { ShieldCheck, ExternalLink, RefreshCw, Check, X, Copy, AlertCircle, ChevronDown, Plus, Trash2 } from 'lucide-react'

interface Props {
  abis: ContractAbi[]
  deployedContracts: DeployedContract[]
  projectPath: string | null
  rpcUrl: string
}

interface Explorer {
  id: string; name: string; color: string
  apiBase: string; uiBase: string; chainId?: number
}

const EXPLORERS: Explorer[] = [
  { id: 'etherscan',   name: 'Etherscan',      color: 'text-blue-400',    apiBase: 'https://api.etherscan.io/api',                     uiBase: 'https://etherscan.io/address/', chainId: 1 },
  { id: 'basescan',    name: 'Basescan',        color: 'text-sky-400',     apiBase: 'https://api.basescan.org/api',                      uiBase: 'https://basescan.org/address/', chainId: 8453 },
  { id: 'sepolia',     name: 'Sepolia',         color: 'text-purple-400',  apiBase: 'https://api-sepolia.etherscan.io/api',              uiBase: 'https://sepolia.etherscan.io/address/', chainId: 11155111 },
  { id: 'baseSepolia', name: 'Base Sepolia',    color: 'text-cyan-400',    apiBase: 'https://api-sepolia.basescan.org/api',              uiBase: 'https://sepolia.basescan.org/address/', chainId: 84532 },
  { id: 'lisk',        name: 'Lisk Sepolia',    color: 'text-teal-400',    apiBase: 'https://sepolia-blockscout.lisk.com/api',           uiBase: 'https://sepolia-blockscout.lisk.com/address/', chainId: 4202 },
  { id: 'polygon',     name: 'Polygonscan',     color: 'text-purple-300',  apiBase: 'https://api.polygonscan.com/api',                   uiBase: 'https://polygonscan.com/address/', chainId: 137 },
  { id: 'optimism',    name: 'Optimism',        color: 'text-red-400',     apiBase: 'https://api-optimistic.etherscan.io/api',          uiBase: 'https://optimistic.etherscan.io/address/', chainId: 10 },
  { id: 'arbitrum',    name: 'Arbiscan',        color: 'text-cyan-300',    apiBase: 'https://api.arbiscan.io/api',                       uiBase: 'https://arbiscan.io/address/', chainId: 42161 },
  { id: 'blockscout',  name: 'Blockscout',      color: 'text-emerald-400', apiBase: 'https://blockscout.com/api',                        uiBase: 'https://blockscout.com/address/' },
]

const SOLIDITY_VERSIONS = [
  '0.8.28','0.8.27','0.8.26','0.8.24','0.8.20','0.8.19','0.8.17',
  '0.8.15','0.8.13','0.8.9','0.7.6','0.6.12'
]

interface VerifyResult {
  status: 'success' | 'pending' | 'failed' | 'already'
  message: string
  guid?: string
  explorerUrl?: string
}

export default function VerificationHelperPanel({ abis, deployedContracts, projectPath, rpcUrl }: Props) {
  const [selectedContract, setSelectedContract] = useState<DeployedContract | null>(null)
  const [selectedExplorer, setSelectedExplorer] = useState<Explorer>(EXPLORERS[0])
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('etherscan_api_key') || '' } catch { return '' }
  })
  const [solidityVersion, setSolidityVersion] = useState('0.8.28')
  const [optimizationEnabled, setOptimizationEnabled] = useState(true)
  const [optimizationRuns, setOptimizationRuns] = useState('200')
  const [constructorArgs, setConstructorArgs] = useState('')
  const [sourceCode, setSourceCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [checkStatusGuid, setCheckStatusGuid] = useState('')
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [contractName, setContractName] = useState('')
  const [licenseType, setLicenseType] = useState('3') // MIT

  const saveApiKey = (key: string) => {
    setApiKey(key)
    try { localStorage.setItem('etherscan_api_key', key) } catch {}
  }

  const [customExplorers, setCustomExplorers] = useState<Explorer[]>(() => {
    try { return JSON.parse(localStorage.getItem('verify_custom_explorers') || '[]') } catch { return [] }
  })
  const [showAddExplorer, setShowAddExplorer] = useState(false)
  const [newExplorer, setNewExplorer] = useState({ name: '', apiBase: '', uiBase: '' })
  const allExplorers = [...EXPLORERS, ...customExplorers]

  const addCustomExplorer = () => {
    if (!newExplorer.name || !newExplorer.apiBase) return
    const ex: Explorer = {
      id: `custom-${Date.now()}`,
      name: newExplorer.name,
      color: 'text-emerald-400',
      apiBase: newExplorer.apiBase,
      uiBase: newExplorer.uiBase || newExplorer.apiBase.replace('/api','') + '/address/',
    }
    const updated = [...customExplorers, ex]
    setCustomExplorers(updated)
    try { localStorage.setItem('verify_custom_explorers', JSON.stringify(updated)) } catch {}
    setSelectedExplorer(ex)
    setNewExplorer({ name: '', apiBase: '', uiBase: '' })
    setShowAddExplorer(false)
  }

  const removeCustomExplorer = (id: string) => {
    const updated = customExplorers.filter(n => n.id !== id)
    setCustomExplorers(updated)
    try { localStorage.setItem('verify_custom_explorers', JSON.stringify(updated)) } catch {}
    if (selectedExplorer.id === id) setSelectedExplorer(EXPLORERS[0])
  }

  const loadSourceFromAbi = async () => {
    if (!selectedContract || !projectPath) return
    try {
      // Try to find source file
      const abi = abis.find(a => a.contractName === selectedContract.name || a.name === selectedContract.name)
      if (abi?.sourceName) {
        const content = await window.api.readFile(`${projectPath}/${abi.sourceName}`)
        if (content) setSourceCode(content)
      }
    } catch {}
  }

  const handleSelectContract = (deployed: DeployedContract) => {
    setSelectedContract(deployed)
    setContractName(deployed.name)
    setResult(null)
    // Auto-fill constructor args
    if (deployed.constructorArgs) {
      const args = Object.values(deployed.constructorArgs).join(',')
      setConstructorArgs(args)
    }
  }

  const verify = async () => {
    if (!selectedContract || !sourceCode.trim() || !contractName.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const params = new URLSearchParams({
        module: 'contract',
        action: 'verifysourcecode',
        apikey: apiKey || 'YourApiKeyToken',
        contractaddress: selectedContract.address,
        sourceCode: sourceCode,
        contractname: contractName,
        compilerversion: `v${solidityVersion}+commit.${getCommitHash(solidityVersion)}`,
        optimizationUsed: optimizationEnabled ? '1' : '0',
        runs: optimizationRuns,
        constructorArguements: constructorArgs.replace(/^0x/, ''),
        licenseType: licenseType,
        evmversion: 'default',
      })

      const resp = await fetch(selectedExplorer.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      })
      const data = await resp.json()

      if (data.status === '1') {
        setResult({
          status: 'pending',
          message: 'Verification submitted! GUID: ' + data.result,
          guid: data.result,
          explorerUrl: selectedExplorer.uiBase + selectedContract.address,
        })
        setCheckStatusGuid(data.result)
      } else if (data.result?.includes('already verified') || data.result?.includes('Already Verified')) {
        setResult({
          status: 'already',
          message: 'Contract is already verified on ' + selectedExplorer.name,
          explorerUrl: selectedExplorer.uiBase + selectedContract.address,
        })
      } else {
        setResult({ status: 'failed', message: data.result || 'Verification failed' })
      }
    } catch (err: any) {
      setResult({ status: 'failed', message: err?.message || 'Network error' })
    }

    setLoading(false)
  }

  const checkStatus = async () => {
    if (!checkStatusGuid) return
    setChecking(true)
    try {
      const url = `${selectedExplorer.apiBase}?module=contract&action=checkverifystatus&guid=${checkStatusGuid}&apikey=${apiKey || 'YourApiKeyToken'}`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.result === 'Pass - Verified') {
        setResult(prev => prev ? {
          ...prev, status: 'success', message: '✓ Contract verified successfully!',
          explorerUrl: selectedExplorer.uiBase + (selectedContract?.address || '')
        } : null)
      } else if (data.result?.includes('Fail')) {
        setResult(prev => prev ? { ...prev, status: 'failed', message: data.result } : null)
      } else {
        setResult(prev => prev ? { ...prev, message: 'Status: ' + data.result } : null)
      }
    } catch {}
    setChecking(false)
  }

  const hardhatVerifyCmd = selectedContract
    ? `npx hardhat verify --network ${getNetworkName(selectedExplorer)} ${selectedContract.address}${constructorArgs ? ' ' + constructorArgs.split(',').join(' ') : ''}`
    : ''

  const copyCmd = async () => {
    await navigator.clipboard.writeText(hardhatVerifyCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <ShieldCheck className="w-4 h-4 text-emerald-400"/>
        <span className="text-sm font-semibold">Verification Helper</span>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">Etherscan / Blockscout</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Config panel */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card/50 overflow-y-auto">
          {/* Explorer picker */}
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Explorer</label>
            <div className="grid grid-cols-2 gap-1">
              {allExplorers.map(ex => (
                <div key={ex.id} className="relative group">
                  <button onClick={() => setSelectedExplorer(ex)}
                    className={cn('w-full text-[10px] px-2 py-1.5 rounded border transition-all text-left',
                      selectedExplorer.id === ex.id
                        ? `border-emerald-500/40 bg-emerald-500/10 ${ex.color}`
                        : 'border-border text-muted-foreground/40 hover:border-muted-foreground/30')}>
                    {ex.name}
                  </button>
                  {(ex as any).id?.startsWith('custom-') && (
                    <button onClick={() => removeCustomExplorer(ex.id)}
                      className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-2.5 h-2.5"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Add custom explorer */}
          <button onClick={() => setShowAddExplorer(p => !p)}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 mt-1">
            <Plus className="w-2.5 h-2.5"/> Add custom explorer
          </button>
          {showAddExplorer && (
            <div className="space-y-1.5 p-2 rounded border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-[10px] font-semibold text-emerald-400">Custom Network / Explorer</p>
              <Input value={newExplorer.name} onChange={e => setNewExplorer(p => ({...p, name: e.target.value}))}
                placeholder="Network name (e.g. Moonbeam)" className="h-6 text-[10px]"/>
              <Input value={newExplorer.apiBase} onChange={e => setNewExplorer(p => ({...p, apiBase: e.target.value}))}
                placeholder="API URL (e.g. https://api-moonbeam.moonscan.io/api)" className="h-6 text-[10px] font-mono"/>
              <Input value={newExplorer.uiBase} onChange={e => setNewExplorer(p => ({...p, uiBase: e.target.value}))}
                placeholder="Explorer URL base (optional)" className="h-6 text-[10px] font-mono"/>
              <div className="flex gap-1">
                <button onClick={addCustomExplorer}
                  className="flex-1 text-[10px] py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white">Add</button>
                <button onClick={() => setShowAddExplorer(false)}
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground/50">Cancel</button>
              </div>
            </div>
          )}

          {/* API Key */}
          <div className="p-3 border-b border-border space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => saveApiKey(e.target.value)}
              placeholder="Get from etherscan.io/myapikey"
              className="h-7 text-xs font-mono"
            />
            <button
              onClick={() => window.api.openExternal('https://etherscan.io/myapikey')}
              className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
              <ExternalLink className="w-2.5 h-2.5"/> Get free API key
            </button>
          </div>

          {/* Contract selector */}
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Deployed Contract</label>
            {deployedContracts.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40">No deployed contracts found. Deploy first.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {deployedContracts.map(dc => (
                  <button key={dc.id} onClick={() => handleSelectContract(dc)}
                    className={cn('w-full text-left px-2 py-1.5 rounded border text-[10px] transition-all',
                      selectedContract?.id === dc.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border hover:border-muted-foreground/30')}>
                    <div className="font-semibold text-foreground/80">{dc.name}</div>
                    <div className="font-mono text-muted-foreground/40 truncate">{dc.address}</div>
                    <div className="text-muted-foreground/30">{dc.network}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compiler settings */}
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Compiler</label>
            <div>
              <Label className="text-[10px] mb-1 block">Solidity Version</Label>
              <select value={solidityVersion} onChange={e => setSolidityVersion(e.target.value)}
                className="w-full h-7 text-xs bg-background border border-border rounded px-2 outline-none">
                {SOLIDITY_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="opt" checked={optimizationEnabled} onChange={e => setOptimizationEnabled(e.target.checked)} className="rounded"/>
              <label htmlFor="opt" className="text-xs text-muted-foreground/70">Optimization</label>
              {optimizationEnabled && (
                <Input value={optimizationRuns} onChange={e => setOptimizationRuns(e.target.value)}
                  className="h-6 text-xs w-16 ml-auto" placeholder="runs"/>
              )}
            </div>
          </div>

          {/* Advanced toggle */}
          <div className="p-3 space-y-2">
            <button onClick={() => setShowAdvanced(p => !p)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 w-full">
              <ChevronDown className={cn('w-3 h-3 transition-transform', showAdvanced && 'rotate-180')}/>
              Advanced options
            </button>
            {showAdvanced && (
              <div className="space-y-2">
                <div>
                  <Label className="text-[10px] mb-1 block">Contract Name (in file)</Label>
                  <Input value={contractName} onChange={e => setContractName(e.target.value)} className="h-7 text-xs"/>
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block">Constructor Args (ABI-encoded)</Label>
                  <Input value={constructorArgs} onChange={e => setConstructorArgs(e.target.value)} className="h-7 text-xs font-mono" placeholder="0x..."/>
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block">License</Label>
                  <select value={licenseType} onChange={e => setLicenseType(e.target.value)}
                    className="w-full h-7 text-xs bg-background border border-border rounded px-2 outline-none">
                    <option value="1">No License</option>
                    <option value="3">MIT</option>
                    <option value="4">Apache-2.0</option>
                    <option value="5">GPL-2.0</option>
                    <option value="6">GPL-3.0</option>
                    <option value="7">LGPL-2.1</option>
                    <option value="10">BSL</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Hardhat verify command */}
          {selectedContract && (
            <div className="px-4 py-2.5 border-b border-border bg-card/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground/50">HARDHAT VERIFY COMMAND</span>
                <button onClick={copyCmd} className="text-[10px] flex items-center gap-1 text-muted-foreground/40 hover:text-muted-foreground">
                  {copied ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
                  Copy
                </button>
              </div>
              <code className="text-[11px] font-mono text-emerald-300/60 break-all">{hardhatVerifyCmd}</code>
            </div>
          )}

          {/* Source code input */}
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Source Code (Flattened Solidity)</Label>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={loadSourceFromAbi}>
                <RefreshCw className="w-2.5 h-2.5"/> Load from project
              </Button>
            </div>
            <textarea
              value={sourceCode}
              onChange={e => setSourceCode(e.target.value)}
              placeholder={"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n// Paste flattened source code here\n// Tip: npx hardhat flatten contracts/YourContract.sol > flat.sol"}
              className="flex-1 w-full resize-none rounded border border-border bg-[#0d1117] p-3 text-[11px] font-mono text-emerald-100/70 outline-none focus:border-emerald-500/30 min-h-[160px]"
            />

            {/* Flatten hint */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2.5 text-[10px] text-amber-400/70 flex items-start gap-2">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0"/>
              <div>
                <strong>Tip:</strong> Flatten your contract first: <code className="font-mono">npx hardhat flatten contracts/YourContract.sol &gt; flat.sol</code>
                <br/>Remove duplicate SPDX and pragma lines from the flattened file.
              </div>
            </div>

            {/* Verify button */}
            <Button
              onClick={verify}
              disabled={!selectedContract || !sourceCode.trim() || !contractName.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-500 gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <ShieldCheck className="w-4 h-4"/>}
              {loading ? 'Submitting…' : `Verify on ${selectedExplorer.name}`}
            </Button>

            {/* Result */}
            {result && (
              <div className={cn('rounded-lg border p-3 space-y-2', {
                'border-emerald-500/40 bg-emerald-500/10': result.status === 'success' || result.status === 'already',
                'border-amber-500/40 bg-amber-500/10': result.status === 'pending',
                'border-rose-500/40 bg-rose-500/10': result.status === 'failed',
              })}>
                <div className="flex items-start gap-2">
                  {result.status === 'success' || result.status === 'already'
                    ? <Check className="w-4 h-4 text-emerald-400 mt-0.5"/>
                    : result.status === 'pending'
                    ? <RefreshCw className="w-4 h-4 text-amber-400 mt-0.5"/>
                    : <X className="w-4 h-4 text-rose-400 mt-0.5"/>}
                  <p className={cn('text-xs', {
                    'text-emerald-400': result.status === 'success' || result.status === 'already',
                    'text-amber-400': result.status === 'pending',
                    'text-rose-400': result.status === 'failed',
                  })}>{result.message}</p>
                </div>

                {result.status === 'pending' && result.guid && (
                  <div className="flex items-center gap-2">
                    <Input value={checkStatusGuid} readOnly className="h-6 text-[10px] font-mono flex-1"/>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-shrink-0" onClick={checkStatus} disabled={checking}>
                      {checking ? <RefreshCw className="w-3 h-3 animate-spin"/> : 'Check status'}
                    </Button>
                  </div>
                )}

                {result.explorerUrl && (
                  <button onClick={() => window.api.openExternal(result.explorerUrl!)}
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline">
                    <ExternalLink className="w-3 h-3"/> View on {selectedExplorer.name}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getNetworkName(ex: Explorer): string {
  const map: Record<string, string> = {
    etherscan: 'mainnet', basescan: 'base', sepolia: 'sepolia',
    baseSepolia: 'base-sepolia', lisk: 'lisk-sepolia', polygon: 'polygon',
    optimism: 'optimism', arbitrum: 'arbitrum',
  }
  return map[ex.id] || 'mainnet'
}

function getCommitHash(version: string): string {
  const hashes: Record<string, string> = {
    '0.8.28': 'b9e4b827', '0.8.27': 'e8a9f5a3', '0.8.26': '8a97fa74',
    '0.8.24': 'e11b9ed9', '0.8.20': '9a516f46', '0.8.19': '7dd6d40',
    '0.8.17': '8df45f84', '0.8.15': 'e14f2057', '0.8.13': 'abaa5c0e',
    '0.8.9': 'e5eed63a', '0.7.6': '3af952a7', '0.6.12': '27d51765',
  }
  return hashes[version] || 'b9e4b827'
}
