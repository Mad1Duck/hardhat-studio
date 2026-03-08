import { useState, useEffect } from 'react'
import { BookOpen, ExternalLink, FileText, Plus, Trash2, Save, BookMarked, Eye } from 'lucide-react'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'

interface DocRef { id: string; title: string; url: string; description?: string; category: string }
interface Props {
  onOpenExternal: (url: string) => void
  projectPath?: string
  onGenerateDocs?: () => void
}

const DEFAULT_REFS: DocRef[] = [
  { id: '1', title: 'Hardhat Docs', url: 'https://hardhat.org/docs', description: 'Official Hardhat documentation', category: 'Hardhat' },
  { id: '2', title: 'Hardhat Network', url: 'https://hardhat.org/hardhat-network', description: 'Local dev network', category: 'Hardhat' },
  { id: '3', title: 'ethers.js v6', url: 'https://docs.ethers.org/v6/', description: 'Ethereum library', category: 'Libraries' },
  { id: '4', title: 'OpenZeppelin Contracts', url: 'https://docs.openzeppelin.com/contracts', description: 'Secure contract templates', category: 'Libraries' },
  { id: '5', title: 'Solidity Docs', url: 'https://docs.soliditylang.org', description: 'Solidity language reference', category: 'Solidity' },
  { id: '6', title: 'Solidity by Example', url: 'https://solidity-by-example.org', description: 'Example contracts', category: 'Solidity' },
  { id: '7', title: 'EIPs', url: 'https://eips.ethereum.org', description: 'Ethereum Improvement Proposals', category: 'Standards' },
  { id: '8', title: 'ERC-20', url: 'https://eips.ethereum.org/EIPS/eip-20', description: 'Token standard', category: 'Standards' },
  { id: '9', title: 'ERC-721', url: 'https://eips.ethereum.org/EIPS/eip-721', description: 'NFT standard', category: 'Standards' },
  { id: '10', title: 'Chainlink Docs', url: 'https://docs.chain.link', description: 'Oracle documentation', category: 'Oracles' },
  { id: '11', title: 'viem Docs', url: 'https://viem.sh', description: 'TypeScript Ethereum library', category: 'Libraries' },
]

export default function DocsPanel({ onOpenExternal, projectPath, onGenerateDocs }: Props) {
  const [refs, setRefs] = useState<DocRef[]>(() => {
    try { return JSON.parse(localStorage.getItem('docRefs') || JSON.stringify(DEFAULT_REFS)) } catch { return DEFAULT_REFS }
  })
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('Custom')
  const [readme, setReadme] = useState<string | null>(null)
  const [showReadme, setShowReadme] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('All')

  useEffect(() => {
    try { localStorage.setItem('docRefs', JSON.stringify(refs)) } catch {}
  }, [refs])

  useEffect(() => {
    if (projectPath) {
      window.api.readReadme(projectPath).then(content => setReadme(content))
    }
  }, [projectPath])

  const addRef = () => {
    if (!newTitle.trim() || !newUrl.trim()) return
    setRefs(prev => [...prev, { id: crypto.randomUUID(), title: newTitle, url: newUrl, description: newDesc, category: newCat }])
    setNewTitle(''); setNewUrl(''); setNewDesc('')
  }

  const removeRef = (id: string) => setRefs(prev => prev.filter(r => r.id !== id))

  const categories = ['All', ...Array.from(new Set(refs.map(r => r.category)))]
  const filtered = activeCategory === 'All' ? refs : refs.filter(r => r.category === activeCategory)

  if (showReadme && readme) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold">README.md</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowReadme(false)}>← Back</Button>
        </div>
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-3xl">
            <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">{readme}</pre>
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Categories */}
      <div className="w-48 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold">Docs & Refs</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {readme && (
            <button
              onClick={() => setShowReadme(true)}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-emerald-400 hover:bg-accent/50 transition-all"
            >
              <Eye className="w-3.5 h-3.5" /> README.md
            </button>
          )}
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn('flex items-center gap-2 w-full px-4 py-1.5 text-xs transition-all',
                activeCategory === cat ? 'text-foreground bg-accent' : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              <BookMarked className="w-3 h-3" />
              {cat}
              <span className="ml-auto text-[10px] text-muted-foreground/40">
                {cat === 'All' ? refs.length : refs.filter(r => r.category === cat).length}
              </span>
            </button>
          ))}
        </nav>

        {onGenerateDocs && (
          <div className="p-3 border-t border-border">
            <Button size="sm" className="w-full text-xs gap-1.5 h-7" variant="outline" onClick={onGenerateDocs}>
              <FileText className="w-3 h-3" /> Generate Obsidian Docs
            </Button>
          </div>
        )}
      </div>

      {/* Refs list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {filtered.map(ref => (
              <div key={ref.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-orange-500/30 transition-all group cursor-pointer"
                onClick={() => onOpenExternal(ref.url)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground group-hover:text-orange-300 transition-colors">{ref.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground/60">{ref.category}</span>
                  </div>
                  {ref.description && <p className="text-xs text-muted-foreground/60 mt-0.5">{ref.description}</p>}
                  <p className="text-[10px] font-mono text-muted-foreground/30 mt-0.5 truncate">{ref.url}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <button onClick={e => { e.stopPropagation(); removeRef(ref.id) }} className="text-muted-foreground/30 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add new ref */}
        <div className="border-t border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-3">Add Reference</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="h-7 text-xs" />
            <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Category" className="h-7 text-xs" />
          </div>
          <div className="flex gap-2">
            <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://…" className="flex-1 h-7 text-xs" />
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="flex-1 h-7 text-xs" />
            <Button size="sm" className="h-7 px-3 gap-1" onClick={addRef} disabled={!newTitle.trim() || !newUrl.trim()}>
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
