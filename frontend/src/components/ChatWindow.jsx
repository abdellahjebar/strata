/**
 * ChatWindow — scrollable message feed.
 * Integrates auto-scroll logic (adapted from components/ai/conversation.jsx).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownIcon } from 'lucide-react'
import MessageRow from './MessageRow'

const SUGGESTIONS = [
  'What is a bounded context?',
  'Explain the difference between core and supporting subdomains.',
  'What books are in the knowledge base?',
]

export default function ChatWindow({ messages, status, onSuggestion }) {
  const scrollRef = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (isAtBottom) scrollToBottom('smooth')
  })

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{ flex: 1, overflowY: 'auto', padding: '0 var(--pad-x)', position: 'relative' }}
      role="log"
    >
      <div style={{
        maxWidth: 'var(--max-w)', margin: '0 auto',
        paddingTop: '40px', paddingBottom: '40px',
        display: 'flex', flexDirection: 'column', gap: '40px',
      }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: '60px' }}>
            <p style={{ fontSize: '14px', fontWeight: 400, marginBottom: '6px' }}>Ask anything.</p>
            <p style={{ fontSize: '13px', color: 'var(--text-45)', marginBottom: '32px' }}>
              Answers come from your indexed books, docs, and notes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {SUGGESTIONS.map(sg => (
                <button
                  key={sg}
                  onClick={() => onSuggestion(sg)}
                  style={{
                    fontSize: '12px', color: 'var(--text-72)', textAlign: 'left',
                    padding: '10px 0', fontFamily: 'var(--font-mono)',
                    background: 'none', border: 'none',
                    borderBottom: '1px solid var(--rule)', cursor: 'pointer',
                    letterSpacing: '0.01em', transition: 'color 0.15s',
                  }}
                >
                  {sg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageRow
            key={i}
            msg={msg}
            isLast={i === messages.length - 1}
            status={status}
          />
        ))}
      </div>

      {/* Scroll-to-bottom button */}
      {!isAtBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          style={{
            position: 'sticky', bottom: '16px',
            left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px',
            background: 'var(--bg)', border: '1px solid var(--rule)',
            cursor: 'pointer', color: 'var(--text-45)',
            borderRadius: 0,
          }}
        >
          <ArrowDownIcon size={14} />
        </button>
      )}
    </div>
  )
}
