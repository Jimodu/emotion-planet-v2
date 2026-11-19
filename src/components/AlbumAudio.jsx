import { useEffect, useState } from 'react'
import { AudioLines, LoaderCircle } from 'lucide-react'
import { loadAudio } from '../data/audioStore'

export default function AlbumAudio({ voice }) {
  const [status, setStatus] = useState('loading')
  const [url, setUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    if (!voice?.audioId) {
      setStatus('none')
      setUrl('')
      return undefined
    }
    setStatus('loading')
    loadAudio(voice.audioId)
      .then((record) => {
        if (cancelled) return
        if (!record?.blob) {
          setStatus('missing')
          return
        }
        objectUrl = URL.createObjectURL(record.blob)
        setUrl(objectUrl)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [voice?.audioId])

  if (!voice?.audioId) {
    return <p className="album-audio-status none">这条记录没有录音。</p>
  }

  const seconds = Math.max(0, Math.floor(Number(voice.duration) || 0))

  return (
    <div className="album-audio">
      <div className="album-audio-head">
        <AudioLines size={15} strokeWidth={1.7} aria-hidden="true" />
        <span>原始录音 · {seconds} 秒</span>
      </div>
      {status === 'loading' && (
        <p className="album-audio-status"><LoaderCircle size={14} className="spinning" aria-hidden="true" />正在从本机读取录音…</p>
      )}
      {status === 'ready' && url && (
        <audio className="album-audio-player" controls src={url} aria-label="播放这条记录的录音" />
      )}
      {status === 'missing' && (
        <p className="album-audio-status warning">本机没有找到这条录音文件，原始音频可能已被清除。转写文字仍然保留。</p>
      )}
      {status === 'failed' && (
        <p className="album-audio-status warning">录音读取失败，暂时无法播放。文字内容仍然可以阅读。</p>
      )}
    </div>
  )
}
