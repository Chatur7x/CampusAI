import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<"div"> {
  value?: number
  max?: number
  variant?: "default" | "gradient" | "glow" | "striped"
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  animated?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = "default", size = "md", showValue = false, animated = true, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const sizes = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    }

    const variants = {
      default: "bg-slate-700",
      gradient: "",
      glow: "",
      striped: "",
    }

    const indicatorVariants = {
      default: "bg-slate-400",
      gradient: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
      glow: "bg-gradient-to-r from-indigo-500 to-purple-600 shadow-[0_0_10px_rgba(139,92,246,0.5)]",
      striped: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-[length:1rem_1rem]",
    }

    return (
      <div className={cn("relative", className)} ref={ref} {...props}>
        <div
          className={cn(
            "w-full rounded-full overflow-hidden bg-slate-800",
            sizes[size],
            animated && variant === "striped" && "animate-[shimmer_2s_linear_infinite]"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              indicatorVariants[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showValue && (
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-slate-400">{value}</span>
            <span className="text-indigo-400 font-medium">{percentage.toFixed(0)}%</span>
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

function CircularProgress({
  value = 0,
  max = 100,
  size = 100,
  strokeWidth = 8,
  variant = "gradient",
  showValue = true,
  className,
  ...props
}: { value?: number; max?: number; size?: number; strokeWidth?: number; variant?: "default" | "gradient" | "glow" | "striped"; showValue?: boolean; className?: string }) {
  const percentage = Math.min(Math.max(((value ?? 0) / (max ?? 100)) * 100, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  const gradientId = React.useId()

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} {...props}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={variant === "gradient" ? `url(#${gradientId})` : "currentColor"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}

function SkillBar({ label, value, max = 100, variant = "glow" }: { label: string; value: number; max?: number; variant?: "default" | "gradient" | "glow" }) {
  const percentage = (value / max) * 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-indigo-400 font-bold">{value}/{max}</span>
      </div>
      <Progress value={percentage} variant={variant} size="md" />
    </div>
  )
}

export { Progress, CircularProgress, SkillBar }
