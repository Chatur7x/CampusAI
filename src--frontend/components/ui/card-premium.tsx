import * as React from "react"
import { cn } from "@/lib/utils"

interface PremiumCardProps extends React.ComponentProps<"div"> {
  variant?: "default" | "glass" | "gradient" | "glow" | "bordered"
  glowColor?: "primary" | "cyan" | "emerald" | "gold" | "pink" | "purple"
  animate?: boolean
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ className, variant = "default", glowColor = "primary", animate = false, ...props }, ref) => {
    const glowClasses = {
      primary: "group-hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.4)]",
      cyan: "group-hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]",
      emerald: "group-hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]",
      gold: "group-hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.4)]",
      pink: "group-hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.4)]",
      purple: "group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]",
    }

    const variants = {
      default: "bg-slate-900/80 border-slate-800/80 shadow-xl shadow-black/20",
      glass: "bg-white/5 backdrop-blur-xl border-white/10 shadow-lg shadow-black/10",
      gradient: "bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/90 border-slate-700/50 shadow-xl shadow-black/30",
      glow: `bg-slate-900/90 border-slate-700/50 shadow-xl shadow-black/20 ${glowClasses[glowColor]} transition-shadow duration-500`,
      bordered: "bg-transparent border-2 border-slate-700/50",
    }

    return (
      <div
        ref={ref}
        data-slot="premium-card"
        className={cn(
          "rounded-2xl border p-6 transition-all duration-500",
          variants[variant],
          animate && "group hover:scale-[1.02] active:scale-[0.98]",
          className
        )}
        {...props}
      />
    )
  }
)
PremiumCard.displayName = "PremiumCard"

function PremiumCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col space-y-1.5 pb-4", className)}
      {...props}
    />
  )
}

function PremiumCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent",
        className
      )}
      {...props}
    />
  )
}

function PremiumCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-slate-400", className)}
      {...props}
    />
  )
}

function PremiumCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("pt-2", className)}
      {...props}
    />
  )
}

function PremiumCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center pt-4 border-t border-slate-800/50", className)}
      {...props}
    />
  )
}

function AnimatedCard({ className, children, delay = 0, ...props }: PremiumCardProps & { delay?: number }) {
  return (
    <div
      className="animate-[fade-in-up_0.5s_ease-out_forwards]"
      style={{ animationDelay: `${delay}ms`, opacity: 0 }}
    >
      <PremiumCard className={className} {...props}>
        {children}
      </PremiumCard>
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  change, 
  trend = "up", 
  icon: Icon,
  className 
}: { 
  label: string
  value: string | number
  change?: string
  trend?: "up" | "down" | "neutral"
  icon?: React.ComponentType<{ className?: string }>
  className?: string 
}) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400"
  }

  return (
    <PremiumCard variant="glow" glowColor="purple" className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
          {Icon && <Icon className="w-5 h-5 text-purple-400" />}
        </div>
        <div className="text-3xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent mb-2">
          {value}
        </div>
        {change && (
          <div className={cn("text-sm font-semibold", trendColors[trend])}>
            {trend === "up" && "+"}
            {change}
          </div>
        )}
      </div>
    </PremiumCard>
  )
}

export {
  PremiumCard,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardDescription,
  PremiumCardContent,
  PremiumCardFooter,
  AnimatedCard,
  StatCard,
}
