import { cn } from "@/lib/utils"

interface SkeletonProps extends React.ComponentProps<"div"> {
  variant?: "default" | "glow" | "gradient"
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full"
}

function Skeleton({ className, variant = "default", rounded = "md", ...props }: SkeletonProps) {
  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  }

  const variants = {
    default: "bg-slate-800/50",
    glow: "bg-gradient-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 bg-[length:200%_100%] animate-shimmer",
    gradient: "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%] animate-shimmer",
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(
        roundedClasses[rounded],
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

function SkeletonText({ className, lines = 3, ...props }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 && "w-3/4"
          )}
        />
      ))}
    </div>
  )
}

function SkeletonAvatar({ size = "md", className, ...props }: SkeletonProps & { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "size-8",
    md: "size-10",
    lg: "size-12",
    xl: "size-16",
  }

  return (
    <Skeleton
      variant="glow"
      rounded="full"
      className={cn(sizes[size], className)}
      {...props}
    />
  )
}

function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800/50 bg-slate-900/80 p-6 space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        <SkeletonAvatar size="lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={3} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5, cols = 4, className, ...props }: SkeletonProps & { rows?: number; cols?: number }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      <div className="flex gap-4 pb-3 border-b border-slate-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 py-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonChart({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div className="flex items-end justify-between gap-2 h-40">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="glow"
            className="flex-1"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-12" />
        ))}
      </div>
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonTable, SkeletonChart }
