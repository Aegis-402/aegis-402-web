import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

export interface InputProps extends React.ComponentProps<"input"> {
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, ...props }, ref) => {
    if (startIcon || endIcon) {
      return (
        <div className="relative flex items-center w-full">
          {startIcon && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-zinc-500 flex items-center justify-center shrink-0">
              {startIcon}
            </div>
          )}
          <InputPrimitive
            ref={ref}
            type={type}
            data-slot="input"
            className={cn(
              "h-8 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-2.5 py-1 text-xs font-mono transition-colors outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
              startIcon && "pl-8",
              endIcon && "pr-8",
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 flex items-center justify-center shrink-0">
              {endIcon}
            </div>
          )}
        </div>
      )
    }

    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-2.5 py-1 text-xs font-mono transition-colors outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
