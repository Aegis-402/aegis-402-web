import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700",
        secondary:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800",
        outline:
          "border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400",
        emerald:
          "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
        amber:
          "bg-amber-500/10 text-amber-500 border border-amber-500/20",
        destructive:
          "bg-rose-500/10 text-rose-500 border border-rose-500/20",
        paypal:
          "bg-[#0070ba]/10 text-[#0070ba] border border-[#0070ba]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
