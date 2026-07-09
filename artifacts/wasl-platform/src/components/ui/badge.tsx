import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/20 text-primary-foreground border-primary/30",
        secondary:
          "border-transparent bg-secondary/20 text-secondary-foreground border-secondary/30",
        destructive:
          "border-transparent bg-destructive/20 text-destructive border-destructive/30",
        warning: 
          "border-transparent bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
        success: 
          "border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        outline: "text-foreground",
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
