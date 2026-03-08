import { FolderOpen, Cpu, Server, Layers, Rocket, Zap, Bug, BookOpen } from 'lucide-react'
import { Button } from '../ui/button'

interface Props {
  onSelect: () => void
  lastProject: string | null
}

export default function ProjectSelector({ onSelect, lastProject }: Props) {
  return (
    <div className="w-screen h-screen bg-background flex items-center justify-center overflow-hidden relative">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(hsl(213 18% 90%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 18% 90%) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 animate-slide-in">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center"
              style={{ boxShadow: '0 0 40px rgba(247, 147, 26, 0.2)' }}>
              <Cpu className="w-8 h-8 text-orange-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-orange-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-black">HS</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">Hardhat Studio</h1>
          <p className="text-sm text-muted-foreground">Professional Smart Contract Development Environment</p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-2 mb-8">
          {[
            { icon: Server, label: 'Local Node', desc: 'Run Hardhat network', color: '#f7931a' },
            { icon: Layers, label: 'Compile & Deploy', desc: 'One-click workflows', color: '#38bdf8' },
            { icon: Zap, label: 'Contract Interact', desc: 'Call any function', color: '#34d399' },
            { icon: Bug, label: 'Debug Console', desc: 'Trace errors & txs', color: '#a78bfa' },
            { icon: BookOpen, label: 'Docs & Refs', desc: 'Quick access links', color: '#fbbf24' },
            { icon: Rocket, label: 'ABI Explorer', desc: 'Browse all ABIs', color: '#fb7185' }
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="p-3 rounded-lg bg-card border border-border hover:border-border/80 transition-colors">
              <Icon className="w-4 h-4 mb-1.5" style={{ color }} />
              <div className="text-xs font-semibold text-foreground">{label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
            </div>
          ))}
        </div>

        <Button
          className="w-full h-11 text-sm font-bold gap-2"
          style={{ boxShadow: '0 0 24px rgba(247, 147, 26, 0.3)' }}
          onClick={onSelect}
        >
          <FolderOpen className="w-4 h-4" />
          Open Hardhat Project
        </Button>

        {lastProject && (
          <p className="text-center text-[11px] text-muted-foreground mt-3 font-mono truncate">
            Last: {lastProject}
          </p>
        )}

        <p className="text-center text-[10px] text-muted-foreground/40 mt-6 font-mono">
          Select a folder with hardhat.config.js or hardhat.config.ts
        </p>
      </div>
    </div>
  )
}
