/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const premiumBadgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30",
        premium: "bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-lg shadow-amber-500/30",
        platinum: "bg-gradient-to-r from-slate-300 to-gray-100 text-slate-900 shadow-lg shadow-slate-300/30",
        success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30",
        warning: "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30",
        danger: "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/30",
        info: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30",
        ghost: "bg-white/10 text-white border border-white/20 backdrop-blur-sm",
        outline: "border-2 border-current bg-transparent",
        glow: "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        default: "px-3 py-1",
        lg: "px-4 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function PremiumBadge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof premiumBadgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(premiumBadgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function StatusBadge({ status }: { status: "online" | "offline" | "away" | "busy" }) {
  const variants = {
    online: "bg-emerald-500 text-white",
    offline: "bg-slate-500 text-slate-200",
    away: "bg-amber-500 text-black",
    busy: "bg-red-500 text-white",
  }

  return (
    <span className={cn("relative inline-flex items-center gap-1.5", variants[status])}>
      <span className="relative flex h-2 w-2">
        {status === "online" && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", variants[status])} />
      </span>
      <span className="sr-only">{status}</span>
    </span>
  )
}

function RiskBadge({ level }: { level: "low" | "medium" | "high" | "critical" }) {
  const config = {
    low: {
      variant: "success" as const,
      label: "LOW RISK",
      icon: "✓",
    },
    medium: {
      variant: "warning" as const,
      label: "MEDIUM RISK",
      icon: "⚠",
    },
    high: {
      variant: "danger" as const,
      label: "HIGH RISK",
      icon: "⚡",
    },
    critical: {
      variant: "danger" as const,
      label: "CRITICAL",
      icon: "🚨",
    },
  }

  const { variant, label, icon } = config[level]

  return (
    <PremiumBadge variant={variant} size="sm" className="gap-1">
      <span>{icon}</span>
      <span>{label}</span>
    </PremiumBadge>
  )
}

function AttendanceBadge({ percentage }: { percentage: number }) {
  let variant: "success" | "warning" | "danger" | "info" = "success"
  let label = "Excellent"
  
  if (percentage < 65) {
    variant = "danger"
    label = "Critical"
  } else if (percentage < 75) {
    variant = "warning"
    label = "At Risk"
  } else if (percentage < 85) {
    variant = "info"
    label = "Good"
  }

  return (
    <PremiumBadge variant={variant} size="sm">
      {label} ({percentage}%)
    </PremiumBadge>
  )
}

export { PremiumBadge, premiumBadgeVariants, StatusBadge, RiskBadge, AttendanceBadge }
