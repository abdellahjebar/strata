"use client"

import { BrainIcon, ChevronDownIcon } from "lucide-react"
import { createContext, memo, useContext, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const ReasoningContext = createContext(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) throw new Error("Reasoning components must be used within Reasoning")
  return context
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

export const Reasoning = memo(({ className, isStreaming = false, open, defaultOpen = true, onOpenChange, duration: durationProp, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(open ?? defaultOpen)
  const [duration, setDuration] = useState(durationProp)
  const [hasAutoClosed, setHasAutoClosed] = useState(false)
  const [startTime, setStartTime] = useState(null)

  useEffect(() => {
    if (open !== undefined) setIsOpen(open)
  }, [open])

  useEffect(() => {
    if (isStreaming) {
      if (startTime === null) setStartTime(Date.now())
    } else if (startTime !== null) {
      setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
      setStartTime(null)
    }
  }, [isStreaming, startTime])

  useEffect(() => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => { setIsOpen(false); setHasAutoClosed(true) }, AUTO_CLOSE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, isOpen, defaultOpen, hasAutoClosed])

  const handleOpenChange = (newOpen) => { setIsOpen(newOpen); onOpenChange?.(newOpen) }

  return (
    <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration }}>
      <div className={cn("mb-4", className)} {...props}>
        {/* Collapsible wrapper */}
        <div data-state={isOpen ? "open" : "closed"}>
          {typeof children === "function" ? children({ isOpen, handleOpenChange }) : children}
        </div>
      </div>
    </ReasoningContext.Provider>
  )
})

export const ReasoningTrigger = memo(({ className, children, getThinkingMessage, ...props }) => {
  const { isStreaming, isOpen, setIsOpen, duration } = useReasoning()

  const defaultMessage = () => {
    if (isStreaming || duration === 0) return "Thinking..."
    if (duration === undefined) return "Thought for a few seconds"
    return `Thought for ${duration} seconds`
  }

  return (
    <button
      className={cn("flex w-full items-center gap-2 text-sm transition-colors", className)}
      onClick={() => setIsOpen(!isOpen)}
      type="button"
      {...props}
    >
      {children ?? (
        <>
          <BrainIcon className="size-4" />
          <span className="flex-1 text-left">{getThinkingMessage ? getThinkingMessage(isStreaming, duration) : defaultMessage()}</span>
          <ChevronDownIcon className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
        </>
      )}
    </button>
  )
})

export const ReasoningContent = memo(({ className, children, ...props }) => {
  const { isOpen } = useReasoning()

  if (!isOpen) return null

  return (
    <div
      className={cn("mt-4 text-sm", className)}
      {...props}
    >
      {children}
    </div>
  )
})

Reasoning.displayName = "Reasoning"
ReasoningTrigger.displayName = "ReasoningTrigger"
ReasoningContent.displayName = "ReasoningContent"
