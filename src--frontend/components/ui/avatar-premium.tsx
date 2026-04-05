import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.ComponentProps<"div"> {
  src?: string
  alt?: string
  fallback?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  variant?: "default" | "glow" | "gradient" | "bordered"
  status?: "online" | "offline" | "away" | "busy"
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt = "", fallback, size = "md", variant = "default", status, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)

    const sizes = {
      xs: "size-6 text-[10px]",
      sm: "size-8 text-xs",
      md: "size-10 text-sm",
      lg: "size-12 text-base",
      xl: "size-16 text-lg",
      "2xl": "size-20 text-xl",
    }

    const variants = {
      default: "bg-slate-700 text-slate-200",
      glow: "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30",
      gradient: "bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 text-white",
      bordered: "border-2 border-slate-600 bg-slate-700 text-slate-200",
    }

    const statusColors = {
      online: "bg-emerald-500",
      offline: "bg-slate-500",
      away: "bg-amber-500",
      busy: "bg-red-500",
    }

    const initials = fallback
      ? fallback
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : alt
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "?"

    return (
      <div ref={ref} className={cn("relative inline-block", className)} {...props}>
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-bold overflow-hidden",
            sizes[size],
            variants[variant]
          )}
        >
          {src && !imageError ? (
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-slate-900",
              statusColors[status],
              size === "xs" || size === "sm" ? "size-2" : "size-3"
            )}
          />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

function AvatarGroup({
  children,
  max = 4,
  size = "md",
  className,
}: {
  children: React.ReactNode
  max?: number
  size?: AvatarProps["size"]
  className?: string
}) {
  const childArray = React.Children.toArray(children)
  const visible = childArray.slice(0, max)
  const remaining = childArray.length - max

  return (
    <div className={cn("flex -space-x-3", className)}>
      {visible.map((child, index) => (
        <div key={index} className="ring-2 ring-slate-900 rounded-full">
          {React.isValidElement<AvatarProps>(child)
            ? React.cloneElement(child, { size })
            : child}
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "rounded-full bg-slate-700 text-slate-300 font-bold ring-2 ring-slate-900 flex items-center justify-center",
            size === "xs" && "size-6 text-[10px]",
            size === "sm" && "size-8 text-xs",
            size === "md" && "size-10 text-sm",
            size === "lg" && "size-12 text-base",
            size === "xl" && "size-16 text-lg",
            size === "2xl" && "size-20 text-xl"
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

export { Avatar, AvatarGroup }
