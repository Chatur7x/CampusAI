/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const premiumButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]",
        premium: "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98] ring-2 ring-amber-300/50",
        platinum: "bg-gradient-to-br from-slate-200 via-gray-100 to-slate-300 text-slate-900 shadow-lg shadow-slate-500/20 hover:shadow-slate-500/40 hover:scale-[1.02] active:scale-[0.98] ring-1 ring-white/50",
        gradient: "bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]",
        outline: "border-2 border-slate-700 bg-slate-900/50 backdrop-blur-sm text-slate-200 hover:bg-slate-800 hover:border-slate-600 hover:scale-[1.02] active:scale-[0.98]",
        ghost: "bg-slate-800/50 backdrop-blur-sm text-slate-200 hover:bg-slate-700 hover:text-white hover:scale-[1.02] active:scale-[0.98]",
        glass: "bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 hover:border-white/30 shadow-lg shadow-black/10",
        glow: "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.5)] hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "size-11 rounded-xl",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof premiumButtonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(premiumButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

function ButtonShimmer({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <Button
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {props.children}
    </Button>
  )
}

export { Button, premiumButtonVariants, ButtonShimmer }
