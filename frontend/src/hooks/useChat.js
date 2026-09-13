/**
 * useChat — all chat state and streaming logic.
 *
 * Takes settings (from useSettings) as input.
 * Returns messages, status, submit function, and busy flag.
 */

import { useCallback, useState } from 'react'
import { sendMessage } from '../lib/api'

export function useChat({ provider, model, apiKey }) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'thinking' | 'streaming'

  const busy = status !== 'idle'

  const submit = useCallback(async (question) => {
    const text = typeof question === 'string' ? question.trim() : question
    if (!text || busy) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', sources: [] },
    ])
    setStatus('thinking')

    await sendMessage({
      message: text,
      history,
      provider,
      model,
      apiKey,
      onToken: (delta) => {
        setStatus('streaming')
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
        })
      },
      onSources: (sources) => {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, sources }]
        })
      },
      onError: (err) => {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, content: `Error: ${err}`, isError: true }]
        })
      },
    })

    setStatus('idle')
  }, [messages, busy, provider, model, apiKey])

  function clearMessages() {
    setMessages([])
  }

  return { messages, status, busy, submit, clearMessages }
}
