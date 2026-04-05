import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends Omit<React.ComponentProps<"input">, 'size'> {
  inputVariant?: "default" | "glass" | "filled" | "underlined"
  inputSize?: "sm" | "md" | "lg"
  icon?: React.ReactNode
  suffix?: React.ReactNode
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputVariant = "default", inputSize = "md", icon, suffix, error, type = "text", ...props }, ref) => {
    const sizes = {
      sm: "h-9 text-sm",
      md: "h-11 text-base",
      lg: "h-14 text-lg",
    }

    const variants = {
      default: "bg-slate-900/80 border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20",
      glass: "bg-white/5 border-white/10 text-white placeholder:text-slate-400 backdrop-blur-sm focus:border-purple-500 focus:ring-purple-500/20",
      filled: "bg-slate-800/80 border-slate-700/30 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20",
      underlined: "bg-transparent border-b-2 border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-none px-0 focus:border-indigo-500",
    }

    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex w-full rounded-xl border shadow-sm transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            variants[inputVariant],
            sizes[inputSize],
            icon && "pl-10",
            suffix && "pr-10",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {suffix}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

function FloatingInput({ 
  label, 
  className, 
  ...props 
}: Omit<InputProps, 'inputVariant'> & { label: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = React.useState(false)
  const hasValue = React.useMemo(() => {
    return props.value !== undefined && props.value !== ""
  }, [props.value])

  return (
    <div className="relative pt-6">
      <label
        className={cn(
          "absolute left-3 transition-all duration-300 pointer-events-none",
          isFocused || hasValue
            ? "-top-1 text-xs font-medium text-indigo-400"
            : "top-1/2 -translate-y-1/2 text-slate-400",
          className
        )}
      >
        {label}
      </label>
      <Input
        ref={inputRef}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="pt-2"
        {...props}
      />
    </div>
  )
}

function SearchInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg
          className="size-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <Input
        type="search"
        placeholder="Search..."
        inputVariant="default"
        className={cn("pl-12 pr-4 bg-slate-900/50 border-slate-800/50", className)}
        {...props}
      />
    </div>
  )
}

function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
      >
        {showPassword ? (
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  )
}

export { Input, FloatingInput, SearchInput, PasswordInput }
