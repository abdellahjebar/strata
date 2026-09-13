import { useState } from 'react'
import { MoonIcon, SunIcon, SettingsIcon, DatabaseIcon } from 'lucide-react'

import { useSettings } from './hooks/useSettings'
import { useChat } from './hooks/useChat'
import { useIngest } from './hooks/useIngest'

import ChatWindow from './components/ChatWindow'
import InputBar from './components/InputBar'
import SettingsPanel from './components/SettingsPanel'
import InjectSidebar from './components/InjectSidebar'
import Toast from './components/Toast'

export default function App() {
  const settings = useSettings()
  const { messages, status, busy, submit } = useChat(settings)
  const { toast, dragActive, dragHandlers, ingestFile, showToast } = useIngest()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', overflow: 'hidden',
        background: 'var(--bg)', color: 'var(--text-100)',
        fontFamily: 'var(--font-mono)',
        position: 'relative',
      }}
      {...dragHandlers}
    >
      {/* Global drag overlay */}
      {dragActive && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--bg)', opacity: 0.96,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '40px 56px', border: '1px solid var(--text-10)',
          }}>
            <span style={{ fontSize: '13px', letterSpacing: '0.08em', color: 'var(--text-72)' }}>
              drop to ingest
            </span>
            <span style={{ marginTop: '8px', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-45)' }}>
              .pdf  .md  .txt
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '20px var(--pad-x)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '13px', fontWeight: 400, letterSpacing: '0.08em' }}>strata</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.15em', color: 'var(--text-45)' }}>
            knowledge base
          </span>

          {/* Inject sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={headerBtn}
            aria-label="Open inject panel"
            title="Inject documents"
          >
            <DatabaseIcon size={13} />
          </button>

          {/* Settings toggle */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              style={{ ...headerBtn, color: settingsOpen ? 'var(--text-72)' : 'var(--text-45)' }}
              aria-label="Model settings"
            >
              <SettingsIcon size={13} />
            </button>
            <SettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              settings={settings}
            />
          </div>

          {/* Theme toggle */}
          <button
            onClick={settings.toggleDark}
            style={headerBtn}
            aria-label="Toggle theme"
          >
            {settings.dark ? <SunIcon size={13} /> : <MoonIcon size={13} />}
          </button>
        </div>
      </header>

      <div style={{ height: '1px', background: 'var(--rule)', flexShrink: 0 }} />

      {/* Chat area */}
      <ChatWindow messages={messages} status={status} onSuggestion={submit} />

      <div style={{ height: '1px', background: 'var(--rule)', flexShrink: 0 }} />

      {/* Input */}
      <InputBar onSubmit={submit} busy={busy} onIngest={ingestFile} />

      {/* Inject sidebar */}
      <InjectSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToast={showToast}
      />

      {/* Toast */}
      <Toast toast={toast} />

      {/* Watermark */}
      <span style={{
        position: 'fixed', bottom: '12px', right: 'var(--pad-x)',
        fontSize: '9px', letterSpacing: '0.34em', color: 'var(--text-08)',
        pointerEvents: 'none', fontFamily: 'var(--font-mono)',
      }}>
        STRATUM
      </span>
    </div>
  )
}

const headerBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-45)', background: 'none', border: 'none',
  cursor: 'pointer', padding: 0, transition: 'color 0.15s',
}
