"use client"

import { cn } from "@/lib/utils"

export const Suggestions = ({ className, children, ...props }) => (
  <div className={cn("flex w-full overflow-x-auto", props)}>
    <div className={cn("flex flex-nowrap items-center gap-2 pb-1", className)}>{children}</div>
  </div>
)

export const Suggestion = ({ suggestion, onClick, className, children, ...props }) => (
  <button
    className={cn("shrink-0 cursor-pointer transition-opacity hover:opacity-70", className)}
    onClick={() => onClick?.(suggestion)}
    type="button"
    {...props}
  >
    {children || suggestion}
  </button>
)
