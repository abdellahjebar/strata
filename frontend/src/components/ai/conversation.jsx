"use client"

import { ArrowDownIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Scroll-to-bottom container — no external dependency, self-contained
export const Conversation = ({ className, children, ...props }) => {
  const ref = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = useCallback((behavior = "smooth") => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (isAtBottom) scrollToBottom("smooth")
  })

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setIsAtBottom(atBottom)
  }

  return (
    <div
      className={cn("relative flex-1 overflow-y-auto", className)}
      onScroll={handleScroll}
      ref={ref}
      role="log"
      {...props}
    >
      {children}
      <ConversationScrollButton isAtBottom={isAtBottom} scrollToBottom={scrollToBottom} />
    </div>
  )
}

export const ConversationContent = ({ className, ...props }) => (
  <div className={cn("flex flex-col", className)} {...props} />
)

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Ask a question to get started",
  icon,
  children,
  ...props
}) => (
  <div
    className={cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className)}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div>{icon}</div>}
        <div className="space-y-1">
          <p className="text-sm">{title}</p>
          {description && <p className="text-sm opacity-45">{description}</p>}
        </div>
      </>
    )}
  </div>
)

const ConversationScrollButton = ({ isAtBottom, scrollToBottom }) => {
  if (isAtBottom) return null

  return (
    <button
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full border transition-opacity hover:opacity-70"
      onClick={() => scrollToBottom("smooth")}
      type="button"
    >
      <ArrowDownIcon className="size-4" />
    </button>
  )
}
