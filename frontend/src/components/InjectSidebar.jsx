/**
 * InjectSidebar — left-side panel for document ingestion and source listing.
 *
 * Two tabs:
 *   - Files: drag-and-drop or pick file (PDF, MD, TXT) + topic tag
 *   - URLs: enter a URL + topic tag to ingest web docs
 *
 * Source list refreshes on open and after each successful ingest.
 */

import { useEffect, useRef, useState } from 'react'
import { PaperclipIcon, XIcon, LinkIcon, RefreshCwIcon } from 'lucide-react'
import { uploadFile, fetchSources, ingestUrl } from '../lib/api'

const ACCEPTED_TYPES = ['.pdf', '.md', '.markdown', '.txt']
const TOPICS = ['general', 'databases', 'architecture', 'python', 'systems', 'algorithms', 'devops', 'cloud']

export default function InjectSidebar({ open, onClose, onToast }) {
  const [tab, setTab] = useState('files') // 'files' | 'urls'
  const [sources, setSources] = useState([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [ingesting, setIngesting] = useState(false)

  // File tab state
  const [fileTopic, setFileTopic] = useState('general')
  const [pendingFiles, setPendingFiles] = useState([])
  const fileInputRef = useRef(null)
  const dragCounter = useRef(0)
  const [fileDragActive, setFileDragActive] = useState(false)

  // URL tab state
  const [url, setUrl] = useState('')
  const [urlTopic, setUrlTopic] = useState('general')
  const [urlTitle, setUrlTitle] = useState('')

  async function refreshSources() {
    setLoadingSources(true)
    try {
      const data = await fetchSources()
      setSources(data)
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    if (open) refreshSources()
  }, [open])

  // ── File drag-and-drop inside the sidebar drop zone ─────────────────────────

  function onDropZoneDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setFileDragActive(true)
  }

  function onDropZoneDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setFileDragActive(false)
  }

  function onDropZoneDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setFileDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  function addFiles(files) {
    const valid = files.filter(f => ACCEPTED_TYPES.some(ext => f.name.toLowerCase().endsWith(ext)))
    if (valid.length === 0) {
      onToast?.('unsupported file type', 'error')
      return
    }
    setPendingFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name))
      const newOnes = valid.filter(f => !existingNames.has(f.name))
      return [...prev, ...newOnes]
    })
  }

  function handleFileInput(e) {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  async function handleIngestFiles() {
    if (!pendingFiles.length || ingesting) return
    setIngesting(true)
    let added = 0
    let failed = 0
    for (const file of pendingFiles) {
      try {
        const result = await uploadFile(file, fileTopic)
        added += result.chunks_added
        onToast?.(`✓ ${result.source_title} — ${result.chunks_added} chunks`, 'ok')
      } catch (err) {
        failed++
        onToast?.(`✗ ${file.name}: ${err.message}`, 'error')
      }
    }
    setPendingFiles([])
    setIngesting(false)
    if (added > 0) refreshSources()
  }

  // ── URL ingest ───────────────────────────────────────────────────────────────

  async function handleIngestUrl(e) {
    e.preventDefault()
    if (!url.trim() || ingesting) return
    setIngesting(true)
    try {
      const result = await ingestUrl(url.trim(), urlTopic, urlTitle.trim() || undefined)
      onToast?.(`✓ ${result.source_title} — ${result.chunks_added} chunks added`, 'ok')
      setUrl('')
      setUrlTitle('')
      refreshSources()
    } catch (err) {
      onToast?.(`error: ${err.message}`, 'error')
    } finally {
      setIngesting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'transparent',
        }}
      />

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '320px', zIndex: 50,
        background: 'var(--bg)', borderRight: '1px solid var(--rule)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--rule)',
        }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-45)' }}>
            inject documents
          </span>
          <button onClick={onClose} style={iconBtn} aria-label="Close sidebar">
            <XIcon size={13} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
          {['files', 'urls'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px',
                fontSize: '11px', letterSpacing: '0.1em',
                fontFamily: 'var(--font-mono)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? 'var(--text-100)' : 'var(--text-45)',
                borderBottom: tab === t ? '1px solid var(--text-100)' : '1px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {tab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Drop zone */}
              <div
                onDragEnter={onDropZoneDragEnter}
                onDragLeave={onDropZoneDragLeave}
                onDragOver={e => e.preventDefault()}
                onDrop={onDropZoneDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1px dashed ${fileDragActive ? 'var(--text-72)' : 'var(--rule)'}`,
                  padding: '32px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  cursor: 'pointer',
                  background: fileDragActive ? 'var(--text-10)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <PaperclipIcon size={16} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-72)' }}>
                  {fileDragActive ? 'drop files' : 'drop or click to select'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-45)', letterSpacing: '0.1em' }}>
                  {ACCEPTED_TYPES.join('  ')}
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />

              {/* Pending files list */}
              {pendingFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {pendingFiles.map(f => (
                    <div key={f.name} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', border: '1px solid var(--rule)',
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPendingFiles(p => p.filter(x => x.name !== f.name)) }}
                        style={{ ...iconBtn, marginLeft: '8px', flexShrink: 0 }}
                      >
                        <XIcon size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Topic */}
              <TopicSelect value={fileTopic} onChange={setFileTopic} />

              {/* Ingest button */}
              <button
                onClick={handleIngestFiles}
                disabled={!pendingFiles.length || ingesting}
                style={{
                  ...actionBtn,
                  opacity: (!pendingFiles.length || ingesting) ? 0.35 : 1,
                }}
              >
                {ingesting ? 'ingesting…' : `ingest ${pendingFiles.length || ''} file${pendingFiles.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {tab === 'urls' && (
            <form onSubmit={handleIngestUrl} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={fieldLabel}>url</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://docs.example.com/..."
                  required
                  style={textInput}
                  spellCheck={false}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={fieldLabel}>title override (optional)</label>
                <input
                  type="text"
                  value={urlTitle}
                  onChange={e => setUrlTitle(e.target.value)}
                  placeholder="auto-detected if empty"
                  style={textInput}
                  spellCheck={false}
                />
              </div>

              <TopicSelect value={urlTopic} onChange={setUrlTopic} />

              <button
                type="submit"
                disabled={!url.trim() || ingesting}
                style={{
                  ...actionBtn,
                  opacity: (!url.trim() || ingesting) ? 0.35 : 1,
                }}
              >
                {ingesting ? 'ingesting…' : 'ingest url'}
              </button>
            </form>
          )}
        </div>

        {/* Source list */}
        <div style={{ borderTop: '1px solid var(--rule)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px 8px',
          }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-45)' }}>
              indexed sources
            </span>
            <button
              onClick={refreshSources}
              disabled={loadingSources}
              style={{ ...iconBtn, opacity: loadingSources ? 0.35 : 0.45 }}
              aria-label="Refresh sources"
            >
              <RefreshCwIcon size={11} />
            </button>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0 20px 16px' }}>
            {sources.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--text-45)', letterSpacing: '0.06em' }}>
                {loadingSources ? 'loading…' : 'no sources indexed yet'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sources.map((src, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-72)' }}>{src.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-45)', letterSpacing: '0.06em' }}>
                      {src.topic} · {src.chunk_count} chunks · {src.source_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function TopicSelect({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={fieldLabel}>topic</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            appearance: 'none', width: '100%',
            fontSize: '12px', fontFamily: 'var(--font-mono)',
            color: 'var(--text-72)', background: 'transparent',
            border: '1px solid var(--rule)', padding: '6px 24px 6px 8px',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-45)', background: 'none', border: 'none',
  cursor: 'pointer', padding: '2px', transition: 'color 0.15s',
}

const actionBtn = {
  width: '100%', padding: '8px',
  fontSize: '11px', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
  color: 'var(--text-72)', background: 'none',
  border: '1px solid var(--rule)', cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const fieldLabel = {
  fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-45)',
}

const textInput = {
  width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
  color: 'var(--text-72)', background: 'transparent',
  border: '1px solid var(--rule)', padding: '6px 8px',
  outline: 'none', boxSizing: 'border-box',
}
