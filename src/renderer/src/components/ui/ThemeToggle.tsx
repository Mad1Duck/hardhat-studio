import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { cn } from '../../lib/utils'

export function ThemeToggle({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'
  const iconDim = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative flex items-center justify-center rounded-md border border-border',
        'text-muted-foreground hover:text-foreground hover:bg-accent transition-all',
        dim, className
      )}
    >
      <Sun className={cn('absolute transition-all duration-300', iconDim,
        isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100 text-orange-400')} />
      <Moon className={cn('absolute transition-all duration-300', iconDim,
        isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50')} />
    </button>
  )
}
