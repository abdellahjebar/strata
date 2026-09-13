/**
 * useSettings — manages provider/model/apiKey selection.
 *
 * Provider and model are persisted in localStorage so they survive page refresh.
 * apiKey is intentionally NOT persisted (security) — users re-enter per session.
 * Dark mode is also managed here and persisted.
 */

import { useEffect, useState } from 'react'

export const PROVIDERS = [
  {
    id: 'groq',
    label: 'Groq',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
]

const DEFAULT_MODELS = Object.fromEntries(PROVIDERS.map(p => [p.id, p.models[0]]))

function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function useSettings() {
  const [provider, setProviderRaw] = useState(() => readLocal('strata:provider', 'groq'))
  const [model, setModelRaw] = useState(() => readLocal('strata:model', DEFAULT_MODELS.groq))
  const [apiKey, setApiKey] = useState('')  // never persisted
  const [dark, setDarkRaw] = useState(() => readLocal('strata:theme', 'light') === 'dark')

  // Persist provider/model/theme changes
  useEffect(() => { localStorage.setItem('strata:provider', provider) }, [provider])
  useEffect(() => { localStorage.setItem('strata:model', model) }, [model])
  useEffect(() => {
    localStorage.setItem('strata:theme', dark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Apply stored theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function setProvider(pid) {
    setProviderRaw(pid)
    // Reset model to first for this provider
    const p = PROVIDERS.find(p => p.id === pid)
    if (p) {
      setModelRaw(p.models[0])
    }
  }

  function setModel(m) {
    setModelRaw(m)
    localStorage.setItem('strata:model', m)
  }

  function toggleDark() {
    setDarkRaw(d => !d)
  }

  return {
    provider, setProvider,
    model, setModel,
    apiKey, setApiKey,
    dark, toggleDark,
    providers: PROVIDERS,
    currentProvider: PROVIDERS.find(p => p.id === provider),
  }
}
