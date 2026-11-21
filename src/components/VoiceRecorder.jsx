import { useEffect, useRef, useState } from 'react'
import { Check, Mic, MicOff, Pause, Play, Trash2 } from 'lucide-react'
import { deleteAudio, isAudioSupported, loadAudio, saveAudio } from '../data/audioStore'

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

async function checkMicrophonePermission() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'microphone' })
    return status.state
  } catch {
    return 'unknown'
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  const rest = String(total % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

export default function VoiceRecorder({ value, onChange, onNotify, onActiveChange, disabled = false }) {
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [transcriptStatus, setTranscriptStatus] = useState(value?.transcriptStatus || 'idle')
  const [audioUrl, setAudioUrl] = useState('')
  const [speechAvailable, setSpeechAvailable] = useState(() => Boolean(getSpeechRecognition()))
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef(value?.transcript || '')
  const urlRef = useRef('')
  const activeRef = useRef(false)

  const voice = value || null

  const setActive = (active) => {
    if (activeRef.current === active) return
    activeRef.current = active
    onActiveChange?.(active)
  }

  useEffect(() => {
    let cancelled = false
    if (!voice?.audioId) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = ''
      setAudioUrl('')
      return undefined
    }
    loadAudio(voice.audioId)
      .then((record) => {
        if (cancelled || !record?.blob) return
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const url = URL.createObjectURL(record.blob)
        urlRef.current = url
        setAudioUrl(url)
      })
      .catch(() => {
        if (!cancelled) onNotify?.('暂时无法读取这条录音。')
      })
    return () => { cancelled = true }
  }, [voice?.audioId, onNotify])

  useEffect(() => {
    transcriptRef.current = voice?.transcript || ''
    if (voice?.transcriptStatus) setTranscriptStatus(voice.transcriptStatus)
  }, [voice?.transcript, voice?.transcriptStatus])

  useEffect(() => () => {
    setActive(false)
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop())
    if (recognitionRef.current) recognitionRef.current.abort()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const emit = (patch) => onChange?.({ ...(voice || {}), ...patch })

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setSeconds((current) => current + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const start = async () => {
    if (disabled) {
      onNotify?.('请先停止语音输入，再开始录音。')
      return
    }
    if (!isAudioSupported()) {
      onNotify?.('当前浏览器不支持录音，可以直接在下方输入文字。')
      return
    }
    const permission = await checkMicrophonePermission()
    if (permission === 'denied') {
      onNotify?.('麦克风权限已被拒绝。请在浏览器设置中允许麦克风，或直接用文字记录。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        stopTimer()
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
        const elapsed = seconds || 0
        if (!chunksRef.current.length) {
          setActive(false)
          setRecording(false)
          return
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        try {
          const meta = await saveAudio(id, blob, { duration: elapsed, mimeType: blob.type })
          emit({ audioId: meta.id, mimeType: meta.mimeType, duration: meta.duration })
          onNotify?.('录音已经保存，可以继续修改下面的文字。')
        } catch {
          onNotify?.('录音没能保存下来，可以重新录一次或直接输入文字。')
        }
        setActive(false)
        setRecording(false)
        setPaused(false)
      }
      recorder.start()
      setSeconds(0)
      setActive(true)
      setRecording(true)
      setPaused(false)
      startTimer()

      const SpeechRecognition = getSpeechRecognition()
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition()
          recognition.lang = 'zh-CN'
          recognition.continuous = true
          recognition.interimResults = false
          recognition.onresult = (event) => {
            const parts = []
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              if (event.results[index].isFinal) parts.push(event.results[index][0].transcript)
            }
            if (parts.length) {
              transcriptRef.current = `${transcriptRef.current}${parts.join('')}`
              emit({ transcript: transcriptRef.current, transcriptStatus: 'success' })
            }
          }
          recognition.onerror = () => {
            setTranscriptStatus('failed')
            emit({ transcriptStatus: 'failed' })
          }
          recognition.onend = () => {
            if (recorderRef.current && recorderRef.current.state === 'recording') {
              try { recognition.start() } catch { /* 忽略重复的语音识别启动 */ }
            }
          }
          recognitionRef.current = recognition
          setSpeechAvailable(true)
          setTranscriptStatus('listening')
          emit({ transcriptStatus: 'listening' })
          recognition.start()
        } catch {
          setSpeechAvailable(false)
          setTranscriptStatus('failed')
          emit({ transcriptStatus: 'failed' })
        }
      } else {
        setSpeechAvailable(false)
        setTranscriptStatus('unsupported')
        emit({ transcriptStatus: 'unsupported' })
      }
    } catch (error) {
      const name = error?.name || ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        onNotify?.('麦克风权限被拒绝，录音没有开始。请在浏览器设置中允许麦克风，或直接用文字记录。')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        onNotify?.('没有找到可用的麦克风，可以直接用文字记录。')
      } else {
        onNotify?.('录音没能开始，可以直接用文字记录。')
      }
      setActive(false)
      setRecording(false)
      setPaused(false)
    }
  }

  const pause = () => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      stopTimer()
      setPaused(true)
      if (recognitionRef.current) recognitionRef.current.abort()
    } else if (recorder.state === 'paused') {
      recorder.resume()
      startTimer()
      setPaused(false)
      if (recognitionRef.current) {
        try { recognitionRef.current.start() } catch { /* 忽略重复的语音识别启动 */ }
      }
    }
  }

  const stop = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setTranscriptStatus((current) => (current === 'listening' ? 'success' : current))
    emit({ transcriptStatus: transcriptRef.current ? 'success' : (speechAvailable ? 'empty' : 'unsupported') })
  }

  const removeAudio = async () => {
    if (voice?.audioId) {
      try {
        await deleteAudio(voice.audioId)
      } catch {
        onNotify?.('录音文件删除失败，可能仍保留在本机，请稍后重试。')
        return
      }
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = ''
    }
    setAudioUrl('')
    setSeconds(0)
    onChange?.({ ...(voice || {}), audioId: '', mimeType: '', duration: 0 })
    onNotify?.('录音已经移除。')
  }

  const removeTranscript = () => {
    transcriptRef.current = ''
    onChange?.({ ...(voice || {}), transcript: '', transcriptStatus: speechAvailable ? 'idle' : 'manual' })
    onNotify?.('转写文字已经移除，可以直接输入新的文字。')
  }

  const transcriptMessage = {
    idle: '转写状态：等待录音。录音后如果浏览器支持，会在这里生成文字。',
    listening: '转写状态：正在听，结束录音后可以看到结果。',
    success: '转写状态：转写成功，可以修改下面的文字。',
    failed: '转写状态：转写失败，录音仍然保留，可以自己写下文字。',
    unsupported: '转写状态：当前浏览器不支持语音转文字，可以手动输入文字。',
    empty: '转写状态：没有识别到清晰的文字，可以自己写下来。',
    manual: '转写状态：已使用手动输入的文字。',
  }[transcriptStatus] || '转写状态：等待录音。'

  return (
    <div className="field voice-field">
      <p className="field-label">04 &nbsp; 也可以用声音说一会儿</p>
      <p className="field-hint">录音和文字会分开保存，转写只是帮手，说得不准也没关系。</p>

      <div className="voice-controls">
        {!recording && !voice?.audioId && (
          <button type="button" className="voice-btn start" onClick={start} disabled={disabled}>
            <Mic size={16} strokeWidth={1.8} aria-hidden="true" />
            开始录音
          </button>
        )}
        {recording && (
          <>
            <button type="button" className={`voice-btn ${paused ? 'resume' : 'pause'}`} onClick={pause}>
              {paused ? <Play size={16} strokeWidth={1.8} aria-hidden="true" /> : <Pause size={16} strokeWidth={1.8} aria-hidden="true" />}
              {paused ? '继续' : '暂停'}
            </button>
            <button type="button" className="voice-btn stop" onClick={stop}>
              <MicOff size={16} strokeWidth={1.8} aria-hidden="true" />
              结束录音
            </button>
          </>
        )}
        <span className={`voice-timer ${recording ? 'live' : ''}`}>{formatDuration(voice?.duration || seconds)}</span>
      </div>

      {!isAudioSupported() && (
        <p className="voice-note">当前浏览器不支持录音，可以直接在文字区域记录。</p>
      )}

      {voice?.audioId && (
        <div className="voice-state-saved">
          <Check size={14} strokeWidth={1.8} aria-hidden="true" />
          录音状态：录音已保存到本机
        </div>
      )}

      {voice?.audioId && audioUrl && (
        <div className="voice-playback">
          <audio controls src={audioUrl} aria-label="播放刚才的录音" />
          <button type="button" className="text-btn" onClick={removeAudio}>
            <Trash2 size={13} strokeWidth={1.7} aria-hidden="true" />
            删除录音
          </button>
        </div>
      )}

      {voice?.audioId && (
        <div className={`voice-transcript-status ${transcriptStatus}`}>
          {transcriptStatus === 'success' && <Check size={14} strokeWidth={1.8} aria-hidden="true" />}
          {transcriptMessage}
        </div>
      )}

      {(voice?.transcript || !speechAvailable) && (
        <div className="voice-transcript-edit">
          <label htmlFor="voice-transcript">
            {speechAvailable ? '转写文字（可以修改）' : '手动文字输入（当前浏览器不支持语音转写）'}
          </label>
          <textarea
            id="voice-transcript"
            rows={3}
            value={voice?.transcript || ''}
            onChange={(event) => emit({
              transcript: event.target.value,
              transcriptStatus: speechAvailable ? 'success' : 'manual',
            })}
            aria-label="修改或输入转写文字"
          />
          {voice?.transcript && (
            <button type="button" className="text-btn" onClick={removeTranscript}>删除转写文字</button>
          )}
        </div>
      )}
    </div>
  )
}
