import { useEffect, useRef, useState } from 'react'
import { CornerDownLeftIcon, PaperclipIcon, XIcon } from 'lucide-react'

const ACCEPTED_TYPES = ['.pdf', '.md', '.markdown', '.txt']

export default function InputBar({ onSubmit, busy, onIngest }) {
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  async function handleSubmit() {
    const text = input.trim()
    if (!text || busy) return

    // Ingest any attached files first
    if (attachedFiles.length > 0 && onIngest) {
      for (const { file } of attachedFiles) {
        await onIngest(file)
      }
      setAttachedFiles([])
    }

    setInput('')
    onSubmit(text)
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files)
    const valid = files.filter(f => ACCEPTED_TYPES.some(ext => f.name.toLowerCase().endsWith(ext)))
    setAttachedFiles(prev => [...prev, ...valid.map(f => ({ name: f.name, file: f }))])
    e.target.value = ''
  }

  function removeAttachment(name) {
    setAttachedFiles(prev => prev.filter(f => f.name !== name))
  }

  const canSend = input.trim() && !busy

  return (
    <div style={{ flexShrink: 0, padding: '20px var(--pad-x) 28px' }}>
      {/* Attachment chips */}
      {attachedFiles.length > 0 && (
        <div style={{
          maxWidth: 'var(--max-w)', margin: '0 auto 10px',
          display: 'flex', flexWrap: 'wrap', gap: '6px',
        }}>
          {attachedFiles.map(({ name }) => (
            <span key={name} style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text-45)',
              border: '1px solid var(--rule)', padding: '3px 6px', gap: '2px',
            }}>
              <PaperclipIcon size={9} style={{ marginRight: '4px', opacity: 0.6 }} />
              {name}
              <button
                onClick={() => removeAttachment(name)}
                style={{
                  display: 'flex', alignItems: 'center', color: 'var(--text-45)',
                  marginLeft: '4px', cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                }}
                aria-label="Remove"
              >
                <XIcon size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{
        maxWidth: 'var(--max-w)', margin: '0 auto',
        display: 'flex', alignItems: 'flex-end', gap: '12px',
      }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-100)', flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px', opacity: busy ? 0.25 : 0.45,
            transition: 'opacity 0.15s',
          }}
          aria-label="Attach file"
          title="Attach and ingest file"
        >
          <PaperclipIcon size={13} />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          style={{
            flex: 1, fontSize: '14px', color: 'var(--text-100)',
            background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
            padding: 0, minHeight: '22px', maxHeight: '160px', overflowY: 'auto',
          }}
          disabled={busy}
        />

        <button
          onClick={handleSubmit}
          disabled={!canSend}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-100)', flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px', opacity: canSend ? 1 : 0.25,
            transition: 'opacity 0.15s',
          }}
          aria-label="Send"
        >
          <CornerDownLeftIcon size={14} />
        </button>
      </div>

      <p style={{
        maxWidth: 'var(--max-w)', margin: '6px auto 0',
        fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-45)',
      }}>
        shift + enter for new line · drag files to ingest
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  )
}
