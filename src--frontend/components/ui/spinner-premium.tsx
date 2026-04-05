import { cn } from "@/lib/utils"

interface SpinnerProps extends React.ComponentProps<"div"> {
  variant?: "default" | "glow" | "gradient" | "dots"
  size?: "sm" | "md" | "lg" | "xl"
}

function Spinner({ className, variant = "default", size = "md", ...props }: SpinnerProps) {
  const sizes = {
    sm: "size-4 border-[2px]",
    md: "size-6 border-[2px]",
    lg: "size-10 border-[3px]",
    xl: "size-16 border-4",
  }

  const variants = {
    default: "border-slate-700 border-t-indigo-500",
    glow: "border-indigo-500/30 border-t-indigo-500 shadow-[0_0_20px_rgba(139,92,246,0.5)]",
    gradient: "border-transparent border-t-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
    dots: "border-0 bg-transparent",
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-flex items-center justify-center",
        variant !== "dots" && "rounded-full animate-spin",
        sizes[size],
        variants[variant],
        className
      )}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

function LoadingDots({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("inline-flex gap-1", className)} {...props}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

function PremiumLoader({ className, ...props }: SpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)} {...props}>
      <div className="relative">
        <div className="size-16 rounded-full border-4 border-indigo-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
        </div>
      </div>
      <span className="text-sm font-medium text-slate-400">Loading...</span>
    </div>
  )
}

export { Spinner, LoadingDots, PremiumLoader }
