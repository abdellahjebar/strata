/**
 * useIngest — file drag-and-drop and ingestion state.
 *
 * Provides drag handlers, ingestFile function, and toast notifications.
 */

import { useRef, useState } from 'react'
import { uploadFile } from '../lib/api'

const ACCEPTED_TYPES = ['.pdf', '.md', '.markdown', '.txt']

export function useIngest() {
  const [dragActive, setDragActive] = useState(false)
  const [toast, setToast] = useState(null)      // { text, type: 'info'|'ok'|'error' }
  const [ingesting, setIngesting] = useState(false)
  const dragCounter = useRef(0)

  function showToast(text, type = 'info') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function ingestFile(file, topic = 'general') {
    setIngesting(true)
    showToast(`ingesting ${file.name}…`, 'info')
    try {
      const result = await uploadFile(file, topic)
      showToast(`✓ ${result.source_title} — ${result.chunks_added} chunks added`, 'ok')
      return result
    } catch (err) {
      showToast(`error: ${err.message}`, 'error')
      throw err
    } finally {
      setIngesting(false)
    }
  }

  // Drag event handlers — attach these to the root shell element
  const dragHandlers = {
    onDragEnter(e) {
      e.preventDefault()
      dragCounter.current++
      if (e.dataTransfer.items?.length > 0) setDragActive(true)
    },
    onDragLeave(e) {
      e.preventDefault()
      dragCounter.current--
      if (dragCounter.current === 0) setDragActive(false)
    },
    onDragOver(e) {
      e.preventDefault()
    },
    async onDrop(e) {
      e.preventDefault()
      dragCounter.current = 0
      setDragActive(false)

      const files = Array.from(e.dataTransfer.files)
      const valid = files.filter(f => ACCEPTED_TYPES.some(ext => f.name.toLowerCase().endsWith(ext)))
      if (valid.length === 0) {
        showToast('unsupported file type', 'error')
        return
      }
      for (const file of valid) {
        await ingestFile(file)
      }
    },
  }

  return {
    dragActive,
    dragHandlers,
    toast,
    ingesting,
    ingestFile,
    showToast,
    acceptedTypes: ACCEPTED_TYPES,
  }
}
