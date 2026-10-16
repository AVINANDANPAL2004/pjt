import { useCallback, useEffect, useRef, useState } from 'react'

type Recording = {
  id: string
  title: string
  mime_type: string
  duration_ms: number
  size_bytes: number
  inserted_at: string
  audio_url: string
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(date))

export default function App() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [apiOk, setApiOk] = useState(true)
  const [micReady, setMicReady] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const loadRecordings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/recordings')
      if (!response.ok) throw new Error('The API could not load your recordings.')
      const data = await response.json() as { recordings: Recording[] }
      setRecordings(data.recordings)
      setApiOk(true)
    } catch (err) {
      setApiOk(false)
      setError(err instanceof Error ? err.message : 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecordings()
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // previewUrl is intentionally not a dependency; cleanup runs on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRecordings])

  const startRecording = async () => {
    setError('')
    setNotice('')
    setAudioBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setDurationMs(0)
    setElapsed(0)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser. Use localhost or HTTPS.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => setError('The browser could not record audio. Please try again.')
      recorder.onstop = () => {
        const duration = Math.max(0, Date.now() - startedAtRef.current)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setDurationMs(duration)
        setAudioBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setRecording(false)
        setMicReady(false)
        if (timerRef.current !== null) window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      recorder.start(250)
      setRecording(true)
      setMicReady(true)
      timerRef.current = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250)
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setRecording(false)
      setMicReady(false)
      setError(err instanceof Error ? err.message : 'Microphone permission was denied or unavailable.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  const saveRecording = async () => {
    if (!audioBlob || audioBlob.size === 0) {
      setError('Record a short clip before saving.')
      return
    }
    if (audioBlob.size > 25 * 1024 * 1024) {
      setError('This recording is larger than the 25 MB upload limit. Record a shorter clip.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData()
    form.append('audio', audioBlob, `recording.${audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm'}`)
    form.append('title', title.trim() || `Recording ${new Date().toLocaleString()}`)
    form.append('duration_ms', String(durationMs))
    form.append('mime_type', audioBlob.type || 'audio/webm')
    try {
      const response = await fetch('/api/recordings', { method: 'POST', body: form })
      const data = await response.json() as { recording?: Recording; error?: string; errors?: Record<string, string[]> }
      if (!response.ok || !data.recording) {
        const details = data.error || Object.values(data.errors ?? {}).flat().join(' ')
        throw new Error(details || 'Could not save this recording.')
      }
      setRecordings((current) => [data.recording!, ...current])
      setTitle('')
      setAudioBlob(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setDurationMs(0)
      setElapsed(0)
      setNotice('Recording saved. It will be here when you return.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this recording. Check that the API is running.')
    } finally {
      setBusy(false)
    }
  }

  const deleteRecording = async (item: Recording) => {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
    setError('')
    try {
      const response = await fetch(`/api/recordings/${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete this recording.')
      setRecordings((current) => current.filter((record) => record.id !== item.id))
      setNotice('Recording deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this recording.')
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#17202b]">
      <header className="border-b border-[#e5e9ef] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-3 no-underline">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#263dce] text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" strokeLinecap="round"/></svg>
            </span>
            <span><span className="block text-lg font-bold tracking-tight">timbre</span><span className="block text-xs text-[#7b8492]">Voice notes, kept simple</span></span>
          </a>
          <div className="flex items-center gap-2 rounded-full border border-[#e5e9ef] bg-[#fbfcfd] px-3 py-2 text-xs font-medium text-[#596575]">
            <span className={`h-2 w-2 rounded-full ${apiOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {apiOk ? 'Storage connected' : 'API disconnected'}
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="mb-9 grid gap-5 md:grid-cols-[1.3fr_.7fr] md:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#5365db]">Your personal audio space</p>
            <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Capture a thought.<br className="hidden sm:block" /> Keep it for later.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#6c7685] sm:text-base">Record directly from your microphone, give it a name, and save it to your library. Your saved clips stay available after you refresh.</p>
          </div>
          <div className="flex gap-3 rounded-2xl border border-[#e5e9ef] bg-white p-4 shadow-[0_4px_20px_rgba(22,34,54,.03)]">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-[#3547cb]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M4 12h2l2-6 4 12 3-9 2 3h3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div><p className="text-sm font-semibold">Made for quick notes</p><p className="mt-1 text-xs leading-5 text-[#7b8492]">No account or setup required. Microphone permission is only used when you press record.</p></div>
          </div>
        </section>

        {(error || notice) && <div role="status" className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <span className="font-bold">{error ? '!' : '✓'}</span><p>{error || notice}</p><button onClick={() => { setError(''); setNotice('') }} className="ml-auto font-semibold opacity-70 hover:opacity-100" aria-label="Dismiss message">×</button>
        </div>}

        <section className="overflow-hidden rounded-3xl border border-[#e2e7ef] bg-white shadow-[0_10px_40px_rgba(25,38,60,.045)]">
          <div className="border-b border-[#edf0f4] px-5 py-4 sm:px-7"><p className="text-sm font-semibold">New recording</p><p className="mt-1 text-xs text-[#87909e]">Step 1 · Record a clip, then save it to your library</p></div>
          <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl bg-[#f6f7ff] px-5 py-6 text-center">
              <div className={`mb-4 grid h-16 w-16 place-items-center rounded-full ${recording ? 'bg-rose-100 text-rose-600' : 'bg-white text-[#3547cb] shadow-sm'}`}>
                {recording ? <span className="h-5 w-5 animate-pulse rounded-md bg-rose-500" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-7 w-7"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" strokeLinecap="round"/></svg>}
              </div>
              <p className="font-mono text-3xl font-semibold tracking-wider text-[#202a3a]">{formatTime(recording ? elapsed : durationMs)}</p>
              <p className="mt-2 text-xs text-[#7b8492]">{recording ? 'Recording in progress…' : audioBlob ? 'Clip ready to save' : 'Your next idea starts here'}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {!recording ? <button onClick={() => void startRecording()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#3547cb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2939b6] disabled:opacity-50"><span className="h-2.5 w-2.5 rounded-full bg-white" />{audioBlob ? 'Record again' : 'Start recording'}</button> : <button onClick={stopRecording} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"><span className="h-3 w-3 rounded-sm bg-white" />Stop recording</button>}
              </div>
              <p className="mt-3 text-[11px] text-[#929baa]">{micReady ? 'Microphone is active' : 'Your browser will ask for microphone access'}</p>
            </div>

            <div className="space-y-5">
              <div><label htmlFor="recording-title" className="mb-2 block text-sm font-semibold">Give your recording a name <span className="font-normal text-[#98a0ac]">(optional)</span></label><input id="recording-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Project ideas, daily journal…" className="w-full rounded-xl border border-[#dfe4ec] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#a4acb8] focus:border-[#6574e0] focus:ring-4 focus:ring-[#3547cb]/10" /></div>
              {previewUrl ? <div className="rounded-xl border border-[#e8ebf1] p-3"><p className="mb-2 text-xs font-semibold text-[#596575]">Preview your clip</p><audio controls src={previewUrl} className="w-full" /></div> : <div className="rounded-xl border border-dashed border-[#dfe4ec] px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f3f5f9] text-[#778294]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="M4 9v6m4-10v14m4-9v4m4-8v12m4-9v6" strokeLinecap="round"/></svg></span><div><p className="text-sm font-medium text-[#4c5665]">Your audio preview appears here</p><p className="mt-1 text-xs text-[#929baa]">Listen before saving</p></div></div></div>}
              <button onClick={() => void saveRecording()} disabled={!audioBlob || recording || busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17202b] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2d3949] disabled:cursor-not-allowed disabled:bg-[#c8cdd6]">{busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Saving recording…</> : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M5 4h12l3 3v13H4V4h1Zm3 0v6h8V4M8 20v-7h8v7" strokeLinejoin="round"/></svg>Save to library</>}</button>
              <p className="text-center text-[11px] text-[#98a0ac]">Web audio · Up to 25 MB per recording</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#5365db]">Your collection</p><h2 className="mt-1 text-xl font-bold tracking-tight">Saved recordings <span className="ml-1 rounded-full bg-[#e9ecff] px-2 py-1 align-middle text-xs font-semibold text-[#3547cb]">{recordings.length}</span></h2></div><button onClick={() => void loadRecordings()} className="rounded-lg border border-[#e0e5ed] bg-white px-3 py-2 text-xs font-semibold text-[#596575] transition hover:bg-[#f8f9fb]">Refresh list</button></div>
          {loading ? <div className="rounded-2xl border border-[#e5e9ef] bg-white p-8 text-center text-sm text-[#7b8492]">Loading your library…</div> : recordings.length === 0 ? <div className="rounded-2xl border border-dashed border-[#dce2eb] bg-white px-6 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f0f2ff] text-[#5365db]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6"><path d="M4 9v6m4-10v14m4-9v4m4-8v12m4-9v6" strokeLinecap="round"/></svg></span><h3 className="mt-4 text-sm font-semibold">Nothing recorded yet</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#87909e]">Your saved clips will show up here. Make your first recording above and it will be ready to play whenever you need it.</p></div> : <div className="space-y-3">{recordings.map((item) => <article key={item.id} className="rounded-2xl border border-[#e4e8ef] bg-white p-4 shadow-[0_2px_10px_rgba(25,38,60,.02)] sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-[#3547cb]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="M4 9v6m4-10v14m4-9v4m4-8v12m4-9v6" strokeLinecap="round"/></svg></div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{item.title}</h3><p className="mt-1 text-xs text-[#87909e]">{formatDate(item.inserted_at)} <span className="mx-1.5">·</span>{formatTime(item.duration_ms)} <span className="mx-1.5">·</span>{formatBytes(item.size_bytes)}</p></div><button onClick={() => void deleteRecording(item)} className="self-start rounded-lg px-3 py-2 text-xs font-semibold text-[#9a5260] transition hover:bg-rose-50 sm:self-center">Delete</button></div><audio controls preload="metadata" src={item.audio_url} className="mt-4 w-full" /></article>)}</div>}
        </section>
        <footer className="mt-12 border-t border-[#e4e8ef] pt-5 text-center text-xs text-[#98a0ac]">Timbre · Part 1 — Record, save, and play back your voice notes</footer>
      </main>
    </div>
  )
}
