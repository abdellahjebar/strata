"use client"

import { cn } from "@/lib/utils"

export const Actions = ({ className, children, ...props }) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
)

export const Action = ({ tooltip, children, label, className, ...props }) => (
  <button
    className={cn(
      "flex items-center justify-center transition-opacity hover:opacity-70",
      className
    )}
    title={tooltip || label}
    type="button"
    {...props}
  >
    {children}
    {(label || tooltip) && <span className="sr-only">{label || tooltip}</span>}
  </button>
)
