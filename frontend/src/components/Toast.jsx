export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: '32px', left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '11px', letterSpacing: '0.06em',
      color: 'var(--text-72)', background: 'var(--bg)',
      border: `1px solid ${toast.type === 'error' ? 'var(--text-45)' : 'var(--rule)'}`,
      padding: '8px 16px',
      pointerEvents: 'none', zIndex: 200,
      whiteSpace: 'nowrap',
    }}>
      {toast.text}
    </div>
  )
}
