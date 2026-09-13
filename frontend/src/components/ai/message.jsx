"use client"

import { ChevronLeftIcon, ChevronRightIcon, PaperclipIcon, XIcon } from "lucide-react"
import { createContext, memo, useContext, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// ── Message ───────────────────────────────────────────────────────────────────

export const Message = ({ className, from, ...props }) => (
  <div
    className={cn(
      "group flex w-full flex-col gap-2",
      from === "user" ? "is-user items-end" : "is-assistant items-start",
      className,
    )}
    {...props}
  />
)

export const MessageContent = ({ children, className, ...props }) => (
  <div
    className={cn(
      "flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export const MessageActions = ({ className, children, ...props }) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
)

export const MessageAction = ({ tooltip, children, label, className, ...props }) => (
  <button
    className={cn("flex items-center justify-center transition-opacity hover:opacity-70", className)}
    title={tooltip || label}
    type="button"
    {...props}
  >
    {children}
    {(label || tooltip) && <span className="sr-only">{label || tooltip}</span>}
  </button>
)

// ── MessageResponse (renders markdown text) ───────────────────────────────────

export const MessageResponse = memo(
  ({ className, children, ...props }) => (
    <div className={cn("min-w-0 leading-relaxed", className)} {...props}>
      {children}
    </div>
  ),
  (prev, next) => prev.children === next.children,
)
MessageResponse.displayName = "MessageResponse"

// ── MessageBranch ─────────────────────────────────────────────────────────────

const MessageBranchContext = createContext(null)

const useMessageBranch = () => {
  const ctx = useContext(MessageBranchContext)
  if (!ctx) throw new Error("MessageBranch components must be used within MessageBranch")
  return ctx
}

export const MessageBranch = ({ defaultBranch = 0, onBranchChange, className, ...props }) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch)
  const [branches, setBranches] = useState([])

  const goToPrevious = () => {
    const n = currentBranch > 0 ? currentBranch - 1 : branches.length - 1
    setCurrentBranch(n); onBranchChange?.(n)
  }
  const goToNext = () => {
    const n = currentBranch < branches.length - 1 ? currentBranch + 1 : 0
    setCurrentBranch(n); onBranchChange?.(n)
  }

  return (
    <MessageBranchContext.Provider value={{ currentBranch, totalBranches: branches.length, goToPrevious, goToNext, branches, setBranches }}>
      <div className={cn("grid w-full gap-2", className)} {...props} />
    </MessageBranchContext.Provider>
  )
}

export const MessageBranchContent = ({ children, ...props }) => {
  const { currentBranch, setBranches, branches } = useMessageBranch()
  const arr = Array.isArray(children) ? children : [children]

  useEffect(() => {
    if (branches.length !== arr.length) setBranches(arr)
  }, [arr, branches, setBranches])

  return arr.map((branch, i) => (
    <div className={cn("grid gap-2 overflow-hidden", i === currentBranch ? "block" : "hidden")} key={branch.key} {...props}>
      {branch}
    </div>
  ))
}

export const MessageBranchSelector = ({ className, ...props }) => {
  const { totalBranches } = useMessageBranch()
  if (totalBranches <= 1) return null
  return <div className={cn("flex items-center", className)} {...props} />
}

export const MessageBranchPrevious = ({ children, ...props }) => {
  const { goToPrevious, totalBranches } = useMessageBranch()
  return (
    <button aria-label="Previous branch" disabled={totalBranches <= 1} onClick={goToPrevious} type="button" {...props}>
      {children ?? <ChevronLeftIcon size={14} />}
    </button>
  )
}

export const MessageBranchNext = ({ children, ...props }) => {
  const { goToNext, totalBranches } = useMessageBranch()
  return (
    <button aria-label="Next branch" disabled={totalBranches <= 1} onClick={goToNext} type="button" {...props}>
      {children ?? <ChevronRightIcon size={14} />}
    </button>
  )
}

export const MessageBranchPage = ({ className, ...props }) => {
  const { currentBranch, totalBranches } = useMessageBranch()
  return (
    <span className={cn("text-xs", className)} {...props}>
      {currentBranch + 1} of {totalBranches}
    </span>
  )
}

// ── MessageAttachment ─────────────────────────────────────────────────────────

export const MessageAttachment = ({ data, className, onRemove, ...props }) => {
  const isImage = data.mediaType?.startsWith("image/") && data.url
  const label = data.filename || (isImage ? "Image" : "Attachment")

  return (
    <div className={cn("group relative size-24 overflow-hidden rounded-lg", className)} {...props}>
      {isImage ? (
        <>
          <img alt={label} className="size-full object-cover" src={data.url} />
          {onRemove && (
            <button
              aria-label="Remove attachment"
              className="absolute top-2 right-2 size-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              onClick={e => { e.stopPropagation(); onRemove() }}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </>
      ) : (
        <div className="flex size-full items-center justify-center rounded-lg" title={label}>
          <PaperclipIcon className="size-4" />
          {onRemove && (
            <button
              aria-label="Remove attachment"
              className="absolute top-2 right-2 size-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              onClick={e => { e.stopPropagation(); onRemove() }}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const MessageAttachments = ({ children, className, ...props }) => {
  if (!children) return null
  return (
    <div className={cn("flex w-fit flex-wrap items-start gap-2", className)} {...props}>
      {children}
    </div>
  )
}

export const MessageToolbar = ({ className, children, ...props }) => (
  <div className={cn("mt-4 flex w-full items-center justify-between gap-4", className)} {...props}>
    {children}
  </div>
)
