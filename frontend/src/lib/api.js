/**
 * API client — fetch wrappers for all backend endpoints.
 *
 * sendMessage  → POST /chat  (SSE streaming)
 * uploadFile   → POST /upload (multipart/form-data file ingestion)
 * ingestUrl    → POST /ingest (JSON URL/path ingestion)
 * fetchSources → GET /sources
 */

/**
 * SSE streaming chat request.
 * Calls onToken(delta) for each token, onSources(sources) at the end.
 */
export async function sendMessage({
  message,
  history = [],
  topicFilter = '',
  provider = '',
  model = '',
  apiKey = '',
  onToken,
  onSources,
  onError,
}) {
  const response = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      topic_filter: topicFilter,
      provider: provider || undefined,
      model: model || undefined,
      api_key: apiKey || undefined,
    }),
  })

  if (!response.ok) {
    onError?.(`Server error: ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete line

    let eventType = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (eventType === 'token') {
          try { onToken?.(JSON.parse(data)) } catch { onToken?.(data) }
        } else if (eventType === 'sources') {
          try { onSources?.(JSON.parse(data)) } catch {}
        } else if (eventType === 'error') {
          try { onError?.(JSON.parse(data).error) } catch { onError?.(data) }
        }
        eventType = ''
      }
    }
  }
}

/**
 * Upload a file to be ingested into the knowledge base.
 * Backend endpoint: POST /upload (multipart/form-data)
 * Returns: { status, chunks_added, chunks_skipped, source_title }
 */
export async function uploadFile(file, topic = 'general') {
  const form = new FormData()
  form.append('file', file)
  form.append('topic', topic)

  const res = await fetch('/upload', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status))
    throw new Error(text)
  }

  return res.json()
}

/**
 * Ingest a URL or file path into the knowledge base.
 * Backend endpoint: POST /ingest (JSON body)
 * Returns: { status, chunks_added, chunks_skipped, source_title }
 */
export async function ingestUrl(source, topic = 'general', title = '') {
  const res = await fetch('/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, topic, title }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status))
    throw new Error(text)
  }

  return res.json()
}

/**
 * List all indexed sources.
 * Backend endpoint: GET /sources
 */
export async function fetchSources() {
  const res = await fetch('/sources')
  if (!res.ok) return []
  return res.json()
}
