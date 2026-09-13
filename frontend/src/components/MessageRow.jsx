import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MessageRow({ msg, isLast, status }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isThinking = isLast && status === 'thinking' && msg.role === 'assistant'
  const isStreaming = isLast && status === 'streaming' && msg.role === 'assistant'

  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <p style={{
          fontSize: '13px', color: 'var(--text-100)',
          maxWidth: '80%', textAlign: 'right', letterSpacing: '0.01em',
          borderBottom: '1px solid var(--text-100)', paddingBottom: '6px',
        }}>
          {msg.content}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {isThinking ? (
        <p style={{ fontSize: '13px', color: 'var(--text-45)', letterSpacing: '0.02em' }}>
          thinking...
        </p>
      ) : (
        <>
          <div className="prose" style={{ fontSize: '14px', color: 'var(--text-100)', lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            {isStreaming && <span className="cursor" />}
          </div>

          {msg.sources?.length > 0 && !isStreaming && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ height: '1px', background: 'var(--rule)' }} />
              <button
                onClick={() => setSourcesOpen(o => !o)}
                style={{
                  fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-45)',
                  textAlign: 'left', fontFamily: 'var(--font-mono)', background: 'none',
                  border: 'none', padding: 0, cursor: 'pointer',
                }}
              >
                {sourcesOpen ? 'hide sources' : `sources (${msg.sources.length})`}
              </button>

              {sourcesOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                  {msg.sources.map((src, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-72)' }}>{src.title}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-45)', letterSpacing: '0.05em' }}>
                        {src.chapter || src.topic}
                        {src.score != null ? ` · score: ${src.score}` : src.chunk_count != null ? ` · ${src.chunk_count} chunks` : ''}
                      </span>
                      {src.chunk_preview && (
                        <span style={{ fontSize: '11px', color: 'var(--text-45)', fontStyle: 'italic', marginTop: '2px', display: 'block' }}>
                          "{src.chunk_preview}"
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
