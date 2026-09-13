"use client"

import {
  CornerDownLeftIcon,
  ImageIcon,
  Loader2Icon,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react"
import { nanoid } from "nanoid"
import {
  Children,
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { cn } from "@/lib/utils"

// ============================================================================
// Provider Context & Types
// ============================================================================

const PromptInputController = createContext(null)
const ProviderAttachmentsContext = createContext(null)

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController)
  if (!ctx) throw new Error("Wrap your component inside <PromptInputProvider>")
  return ctx
}

const useOptionalPromptInputController = () => useContext(PromptInputController)

export const useProviderAttachments = () => {
  const ctx = useContext(ProviderAttachmentsContext)
  if (!ctx) throw new Error("Wrap your component inside <PromptInputProvider>")
  return ctx
}

const useOptionalProviderAttachments = () => useContext(ProviderAttachmentsContext)

export function PromptInputProvider({ initialInput = "", children }) {
  const [textInput, setTextInput] = useState(initialInput)
  const clearInput = useCallback(() => setTextInput(""), [])

  const [attachmentFiles, setAttachmentFiles] = useState([])
  const fileInputRef = useRef(null)
  const openRef = useRef(() => {})

  const add = useCallback((files) => {
    const incoming = Array.from(files)
    if (!incoming.length) return
    setAttachmentFiles(prev =>
      prev.concat(incoming.map(file => ({
        id: nanoid(), type: "file",
        url: URL.createObjectURL(file),
        mediaType: file.type, filename: file.name,
      })))
    )
  }, [])

  const remove = useCallback((id) => {
    setAttachmentFiles(prev => {
      const found = prev.find(f => f.id === id)
      if (found?.url) URL.revokeObjectURL(found.url)
      return prev.filter(f => f.id !== id)
    })
  }, [])

  const clear = useCallback(() => {
    setAttachmentFiles(prev => { prev.forEach(f => f.url && URL.revokeObjectURL(f.url)); return [] })
  }, [])

  const attachmentsRef = useRef(attachmentFiles)
  attachmentsRef.current = attachmentFiles
  useEffect(() => () => { attachmentsRef.current.forEach(f => f.url && URL.revokeObjectURL(f.url)) }, [])

  const openFileDialog = useCallback(() => openRef.current?.(), [])

  const attachments = useMemo(() => ({
    files: attachmentFiles, add, remove, clear, openFileDialog, fileInputRef,
  }), [attachmentFiles, add, remove, clear, openFileDialog])

  const __registerFileInput = useCallback((ref, open) => {
    fileInputRef.current = ref.current
    openRef.current = open
  }, [])

  const controller = useMemo(() => ({
    textInput: { value: textInput, setInput: setTextInput, clear: clearInput },
    attachments,
    __registerFileInput,
  }), [textInput, clearInput, attachments, __registerFileInput])

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  )
}

// ============================================================================
// Local Attachments Context
// ============================================================================

const LocalAttachmentsContext = createContext(null)

export const usePromptInputAttachments = () => {
  const provider = useOptionalProviderAttachments()
  const local = useContext(LocalAttachmentsContext)
  const context = provider ?? local
  if (!context) throw new Error("usePromptInputAttachments must be used within PromptInput or PromptInputProvider")
  return context
}

// ============================================================================
// PromptInput (main form)
// ============================================================================

export const PromptInput = ({
  className, accept, multiple, globalDrop, maxFiles, maxFileSize,
  onError, onSubmit, children, ...props
}) => {
  const controller = useOptionalPromptInputController()
  const usingProvider = !!controller
  const inputRef = useRef(null)
  const formRef = useRef(null)
  const [items, setItems] = useState([])
  const files = usingProvider ? controller.attachments.files : items
  const filesRef = useRef(files)
  filesRef.current = files

  const openFileDialogLocal = useCallback(() => inputRef.current?.click(), [])

  const matchesAccept = useCallback((f) => {
    if (!accept?.trim()) return true
    return accept.split(",").map(s => s.trim()).some(p =>
      p.endsWith("/*") ? f.type.startsWith(p.slice(0, -1)) : f.type === p
    )
  }, [accept])

  const addLocal = useCallback((fileList) => {
    const incoming = Array.from(fileList)
    const accepted = incoming.filter(f => matchesAccept(f))
    if (incoming.length && !accepted.length) { onError?.({ code: "accept", message: "No files match accepted types." }); return }
    const sized = accepted.filter(f => maxFileSize ? f.size <= maxFileSize : true)
    if (accepted.length && !sized.length) { onError?.({ code: "max_file_size", message: "All files exceed max size." }); return }
    setItems(prev => {
      const capacity = typeof maxFiles === "number" ? Math.max(0, maxFiles - prev.length) : undefined
      const capped = typeof capacity === "number" ? sized.slice(0, capacity) : sized
      if (typeof capacity === "number" && sized.length > capacity) onError?.({ code: "max_files", message: "Too many files." })
      return prev.concat(capped.map(file => ({ id: nanoid(), type: "file", url: URL.createObjectURL(file), mediaType: file.type, filename: file.name })))
    })
  }, [matchesAccept, maxFiles, maxFileSize, onError])

  const removeLocal = useCallback((id) =>
    setItems(prev => { const f = prev.find(f => f.id === id); if (f?.url) URL.revokeObjectURL(f.url); return prev.filter(f => f.id !== id) }), [])

  const clearLocal = useCallback(() =>
    setItems(prev => { prev.forEach(f => f.url && URL.revokeObjectURL(f.url)); return [] }), [])

  const add = usingProvider ? controller.attachments.add : addLocal
  const remove = usingProvider ? controller.attachments.remove : removeLocal
  const clear = usingProvider ? controller.attachments.clear : clearLocal
  const openFileDialog = usingProvider ? controller.attachments.openFileDialog : openFileDialogLocal

  useEffect(() => {
    if (!usingProvider) return
    controller.__registerFileInput(inputRef, () => inputRef.current?.click())
  }, [usingProvider, controller])

  useEffect(() => {
    const form = formRef.current
    if (!form || globalDrop) return
    const onDragOver = e => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault() }
    const onDrop = e => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); if (e.dataTransfer?.files?.length) add(e.dataTransfer.files) }
    form.addEventListener("dragover", onDragOver)
    form.addEventListener("drop", onDrop)
    return () => { form.removeEventListener("dragover", onDragOver); form.removeEventListener("drop", onDrop) }
  }, [add, globalDrop])

  useEffect(() => {
    if (!globalDrop) return
    const onDragOver = e => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault() }
    const onDrop = e => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); if (e.dataTransfer?.files?.length) add(e.dataTransfer.files) }
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("drop", onDrop)
    return () => { document.removeEventListener("dragover", onDragOver); document.removeEventListener("drop", onDrop) }
  }, [add, globalDrop])

  useEffect(() => () => { if (!usingProvider) filesRef.current.forEach(f => f.url && URL.revokeObjectURL(f.url)) }, [usingProvider])

  const handleChange = (e) => { if (e.currentTarget.files) add(e.currentTarget.files); e.currentTarget.value = "" }

  const convertBlobToDataUrl = async (url) => {
    try {
      const blob = await fetch(url).then(r => r.blob())
      return new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(blob) })
    } catch { return null }
  }

  const ctx = useMemo(() => ({ files: files.map(i => ({ ...i })), add, remove, clear, openFileDialog, fileInputRef: inputRef }), [files, add, remove, clear, openFileDialog])

  const handleSubmit = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const text = usingProvider ? controller.textInput.value : (new FormData(form).get("message") || "")
    if (!usingProvider) form.reset()
    Promise.all(files.map(async ({ id, ...item }) => {
      if (item.url?.startsWith("blob:")) { const dataUrl = await convertBlobToDataUrl(item.url); return { ...item, url: dataUrl ?? item.url } }
      return item
    })).then(convertedFiles => {
      try {
        const result = onSubmit({ text, files: convertedFiles }, event)
        if (result instanceof Promise) {
          result.then(() => { clear(); if (usingProvider) controller.textInput.clear() }).catch(() => {})
        } else { clear(); if (usingProvider) controller.textInput.clear() }
      } catch {}
    }).catch(() => {})
  }

  const inner = (
    <>
      <input accept={accept} aria-label="Upload files" className="hidden" multiple={multiple} onChange={handleChange} ref={inputRef} title="Upload files" type="file" />
      <form className={cn("w-full", className)} onSubmit={handleSubmit} ref={formRef} {...props}>
        <div className="overflow-hidden">{children}</div>
      </form>
    </>
  )

  return usingProvider ? inner : <LocalAttachmentsContext.Provider value={ctx}>{inner}</LocalAttachmentsContext.Provider>
}

export const PromptInputBody = ({ className, ...props }) => <div className={cn("contents", className)} {...props} />

export const PromptInputTextarea = ({ onChange, className, placeholder = "Ask anything...", ...props }) => {
  const controller = useOptionalPromptInputController()
  const attachments = usePromptInputAttachments()
  const [isComposing, setIsComposing] = useState(false)

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing || e.shiftKey) return
      e.preventDefault()
      const submit = e.currentTarget.form?.querySelector('button[type="submit"]')
      if (submit?.disabled) return
      e.currentTarget.form?.requestSubmit()
    }
    if (e.key === "Backspace" && e.currentTarget.value === "" && attachments.files.length > 0) {
      e.preventDefault()
      const last = attachments.files.at(-1)
      if (last) attachments.remove(last.id)
    }
  }

  const handlePaste = (event) => {
    const items = event.clipboardData?.items
    if (!items) return
    const files = []
    for (const item of items) { if (item.kind === "file") { const f = item.getAsFile(); if (f) files.push(f) } }
    if (files.length) { event.preventDefault(); attachments.add(files) }
  }

  const controlledProps = controller
    ? { value: controller.textInput.value, onChange: (e) => { controller.textInput.setInput(e.currentTarget.value); onChange?.(e) } }
    : { onChange }

  return (
    <textarea
      className={cn("w-full resize-none bg-transparent outline-none", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      rows={1}
      {...props}
      {...controlledProps}
    />
  )
}

export const PromptInputFooter = ({ className, ...props }) => (
  <div className={cn("flex items-center justify-between gap-1", className)} {...props} />
)

export const PromptInputTools = ({ className, ...props }) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
)

export const PromptInputSubmit = ({ className, status, children, disabled, ...props }) => {
  let icon = <CornerDownLeftIcon className="size-4" />
  if (status === "submitted") icon = <Loader2Icon className="size-4 animate-spin" />
  else if (status === "streaming") icon = <SquareIcon className="size-4" />

  return (
    <button
      aria-label="Submit"
      className={cn("flex items-center justify-center transition-opacity disabled:opacity-30", className)}
      disabled={disabled}
      type="submit"
      {...props}
    >
      {children ?? icon}
    </button>
  )
}
