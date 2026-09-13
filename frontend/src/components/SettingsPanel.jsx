import { useEffect, useRef } from 'react'
import { ChevronDownIcon } from 'lucide-react'

export default function SettingsPanel({ open, onClose, settings }) {
  const ref = useRef(null)
  const { provider, setProvider, model, setModel, apiKey, setApiKey, providers, currentProvider } = settings

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 16px)', right: 0,
      background: 'var(--bg)', border: '1px solid var(--rule)',
      padding: '16px', width: '220px', zIndex: 50,
    }}>
      <p style={label}>provider</p>
      <SelectWrap>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          style={select}
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <ChevronDownIcon size={10} style={chevron} />
      </SelectWrap>

      <p style={{ ...label, marginTop: '12px' }}>model</p>
      <SelectWrap>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          style={select}
        >
          {currentProvider?.models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <ChevronDownIcon size={10} style={chevron} />
      </SelectWrap>

      <p style={{ ...label, marginTop: '12px' }}>api key</p>
      <input
        type="password"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        placeholder="uses env default if empty"
        style={{
          width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)',
          color: 'var(--text-72)', background: 'transparent',
          border: '1px solid var(--rule)', padding: '5px 8px', outline: 'none',
          boxSizing: 'border-box',
        }}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}

function SelectWrap({ children }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {children}
    </div>
  )
}

const label = {
  fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-45)', marginBottom: '6px',
}
const select = {
  appearance: 'none', width: '100%',
  fontSize: '12px', fontFamily: 'var(--font-mono)',
  color: 'var(--text-72)', background: 'transparent',
  border: '1px solid var(--rule)', padding: '5px 24px 5px 8px',
  cursor: 'pointer', outline: 'none',
}
const chevron = {
  position: 'absolute', right: '8px', color: 'var(--text-45)', pointerEvents: 'none',
}
