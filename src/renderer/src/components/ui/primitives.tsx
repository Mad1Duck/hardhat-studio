import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ─── Input ───────────────────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-8 w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs font-mono text-foreground ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
      className
    )}
    ref={ref}
    {...props}
  />
))
Input.displayName = 'Input'
export { Input }

// ─── Textarea ────────────────────────────────────────────────────────────────
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-xs font-mono text-foreground ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors',
      className
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
export { Textarea }

// ─── Label ───────────────────────────────────────────────────────────────────
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80', className)}
      {...props}
    />
  )
)
Label.displayName = 'Label'

// ─── Badge ───────────────────────────────────────────────────────────────────
const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold font-mono tracking-wide transition-colors border',
  {
    variants: {
      variant: {
        default: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        view: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        pure: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        write: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        payable: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
        event: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
        error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        secondary: 'bg-secondary text-secondary-foreground border-border',
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        destructive: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }

// ─── Separator ───────────────────────────────────────────────────────────────
export const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }
>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
))
Separator.displayName = 'Separator'

// ─── ScrollArea ──────────────────────────────────────────────────────────────
export const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-auto', className)} {...props}>
      {children}
    </div>
  )
)
ScrollArea.displayName = 'ScrollArea'
