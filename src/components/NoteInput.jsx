import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { createSenseVoiceEngine } from '../lib/sensevoice/engine.js'
import { hasPartialText, stripPartialText } from '../lib/sensevoice/text.js'

const speechStatusMessages = {
  idle: '可以先确认隐私说明再开启语音输入；不开启也能正常手动输入。',
  confirming: '请确认隐私说明后再开启语音输入。',
  preparing: '正在准备本地识别模型…',
  listening: '正在本地识别语音… 文字会实时进入上方文字框，也可以随时手动修改。',
  success: '语音输入已停止，文字已保留在上方，可继续编辑或删除。',
  failed: '本地语音识别未能完成，已输入的文字仍保留，可手动补充。',
  denied: '麦克风权限被拒绝，手动输入可正常使用。',
  unavailable: '当前环境不支持本地语音识别，手动输入可正常使用。',
  disabled: '请先停止当前录音，再使用语音输入。',
}

let sharedEngine = null
let activeEngineHandler = () => {}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    sharedEngine?.dispose()
    sharedEngine = null
  })
}

export default function NoteInput({ value, onChange, speechDisabled = false, onActiveChange }) {
  const [displayValue, setDisplayValue] = useState(value || '')
  const [speechStatus, setSpeechStatus] = useState('idle')
  const [speechNotice, setSpeechNotice] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  if (!sharedEngine) {
    sharedEngine = createSenseVoiceEngine({
      onEvent: (event) => activeEngineHandler(event),
    })
  }
  const engineRef = useRef(sharedEngine)
  const eventHandlerRef = useRef(() => {})
  const listeningRef = useRef(false)
  const preparingRef = useRef(false)
  const cancelPrepareRef = useRef(false)
  const activeNotifiedRef = useRef(false)
  const displayRef = useRef(value || '')
  const lastSentRef = useRef(value || '')
  const onActiveChangeRef = useRef(onActiveChange)
  const speechDisabledRef = useRef(speechDisabled)

  activeEngineHandler = (event) => eventHandlerRef.current(event)

  const setDisplay = (next) => {
    const safe = String(next ?? '')
    displayRef.current = safe
    setDisplayValue(safe)
  }

  const emitValue = (next, display = next) => {
    const clean = stripPartialText(next)
    if (clean !== lastSentRef.current) {
      lastSentRef.current = clean
      onChange?.(clean)
    }
    setDisplay(display)
  }

  const notifyActive = (active) => {
    if (activeNotifiedRef.current === active) return
    activeNotifiedRef.current = active
    onActiveChangeRef.current?.(active)
  }

  const stopRecognition = async (nextStatus = 'success') => {
    cancelPrepareRef.current = true
    const wasListening = listeningRef.current
    const wasPreparing = preparingRef.current
    if (!wasListening && !wasPreparing) return

    if (wasListening) {
      try {
        await engineRef.current.stop()
      } catch {
        // 停止失败时仍清理 UI 与引擎，避免占用麦克风。
      }
    }

    listeningRef.current = false
    preparingRef.current = false
    const finalText = stripPartialText(displayRef.current)
    emitValue(finalText, finalText)
    engineRef.current.releaseAudio()
    notifyActive(false)
    setSpeechStatus(nextStatus)
    setSpeechNotice('')
  }

  eventHandlerRef.current = (event) => {
    if (event.type === 'progress') {
      const percent = Math.max(0, Math.min(100, Number(event.percent) || 0))
      setProgressPercent(percent)
      setSpeechNotice(`首次加载本地识别模型 ${Math.round(percent)}%；后续会优先使用浏览器缓存。`)
      return
    }
    if (event.type === 'phase') {
      setSpeechNotice('本地声学模型就绪，正在准备 SenseVoice 终审模型…')
      return
    }
    if (event.type === 'speechStart') {
      setSpeechStatus('listening')
      setSpeechNotice('')
      return
    }
    if (event.type === 'speechEnd') {
      setSpeechNotice('这句话已采集完成，正在整理最终文字…')
      return
    }
    if (event.type === 'partial') {
      if (!listeningRef.current && !preparingRef.current) return
      emitValue(event.display, event.display)
      return
    }
    if (event.type === 'final') {
      const clean = stripPartialText(event.display)
      emitValue(clean, clean)
      return
    }
    if (event.type === 'stopped') {
      const clean = stripPartialText(event.display)
      emitValue(clean, clean)
      return
    }
    if (event.type === 'display') {
      const clean = stripPartialText(event.display)
      emitValue(clean, clean)
      return
    }
    if (event.type === 'status') {
      if (event.status && event.status !== 'idle') setSpeechNotice(`识别引擎：${event.status}`)
      return
    }
    if (event.type === 'log') {
      // 诊断日志保留在引擎事件中，正式界面不展示旧 Web Speech 调试面板。
      if (event.level === 'err') setSpeechStatus('failed')
    }
  }

  useEffect(() => {
    onActiveChangeRef.current = onActiveChange
  }, [onActiveChange])

  useEffect(() => {
    speechDisabledRef.current = speechDisabled
    if (speechDisabled && (listeningRef.current || preparingRef.current)) {
      void stopRecognition('disabled')
    }
  }, [speechDisabled])

  useEffect(() => {
    const incoming = value || ''
    if (incoming === lastSentRef.current) return

    lastSentRef.current = incoming
    if (!listeningRef.current && !preparingRef.current) {
      setDisplay(incoming)
    } else {
      engineRef.current.setBaseline(incoming)
      setDisplay(incoming)
    }
  }, [value])

  useEffect(() => () => {
    cancelPrepareRef.current = true
    if (listeningRef.current) {
      void engineRef.current.stop().catch(() => {})
    }
    engineRef.current.releaseAudio()
    notifyActive(false)
  }, [])

  const handleTextChange = (event) => {
    const raw = event.target.value
    const clean = stripPartialText(raw)
    if (listeningRef.current || preparingRef.current) {
      lastSentRef.current = clean
      setDisplay(clean)
      engineRef.current.setBaseline(clean)
      return
    }
    if (clean !== lastSentRef.current) {
      lastSentRef.current = clean
      onChange?.(clean)
    }
    setDisplay(clean)
  }

  const startRecognition = async () => {
    if (speechDisabledRef.current) {
      setSpeechStatus('disabled')
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setSpeechStatus('unavailable')
      return
    }

    cancelPrepareRef.current = false
    preparingRef.current = true
    setSpeechStatus('preparing')
    setSpeechNotice('正在准备本地识别模型…')
    setProgressPercent(0)

    try {
      await engineRef.current.prepare()
      if (cancelPrepareRef.current) {
        engineRef.current.releaseAudio()
        notifyActive(false)
        return
      }
      if (speechDisabledRef.current) {
        preparingRef.current = false
        setSpeechStatus('disabled')
        engineRef.current.releaseAudio()
        notifyActive(false)
        return
      }

      engineRef.current.setBaseline(stripPartialText(displayRef.current))
      notifyActive(true)
      await engineRef.current.start()
      preparingRef.current = false
      listeningRef.current = true
      setSpeechStatus('listening')
      setSpeechNotice('')
    } catch (error) {
      preparingRef.current = false
      listeningRef.current = false
      const name = error?.name || ''
      setSpeechStatus(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'failed')
      setSpeechNotice('本地语音识别启动失败，已输入的文字仍保留，可手动补充。')
      engineRef.current.releaseAudio()
      notifyActive(false)
    }
  }

  const handleSpeechButton = () => {
    if (listeningRef.current || preparingRef.current) {
      void stopRecognition('success')
      return
    }
    if (speechDisabled) {
      setSpeechStatus('disabled')
      return
    }
    setSpeechStatus('confirming')
    setPrivacyOpen(true)
  }

  const isBusy = listeningRef.current || preparingRef.current
  const effectiveStatus = speechDisabled ? 'disabled' : speechStatus
  const statusClass =
    effectiveStatus === 'success'
      ? 'success'
      : ['failed', 'denied', 'disabled', 'unavailable'].includes(effectiveStatus)
        ? 'failed'
        : ''

  const statusText =
    speechNotice ||
    (effectiveStatus === 'preparing' && progressPercent > 0
      ? `正在下载本地识别模型 ${Math.round(progressPercent)}%；音频不会上传，也不会保存录音。`
      : speechStatusMessages[effectiveStatus])

  return (
    <div className="field">
      <p className="field-label">03 &nbsp; 想对自己说点什么？</p>
      <textarea
        className="note-area"
        value={displayValue}
        rows={6}
        onChange={handleTextChange}
        placeholder="写下一句话就好，哪怕只是「有点累」。"
        aria-label="今天的心情文字"
      />
      <div className="voice-controls">
        <button
          type="button"
          className={`voice-btn ${isBusy ? 'stop' : 'start'}`}
          onClick={handleSpeechButton}
          disabled={speechDisabled}
        >
          {isBusy ? (
            <Square size={14} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Mic size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
          {isBusy ? '停止语音输入' : '语音输入'}
        </button>
      </div>
      <p className={`voice-transcript-status ${statusClass}`.trim()}>
        {statusText}
      </p>
      <p className="field-hint" aria-live="polite">
        本地识别：音频只在浏览器中临时处理，不上传，也不会保存录音。{hasPartialText(displayValue) ? '正在显示临时识别文字，终审后会自动修正。' : ''}
      </p>
      <div className="char-count">{stripPartialText(displayValue).length} 字</div>

      {privacyOpen && (
        <ConfirmDialog
          title="使用语音输入前，请先了解"
          description="开启语音输入前，请确认以下说明。"
          details={[
            '识别在浏览器本地完成，不调用云端语音识别服务。',
            '音频只在内存中临时处理，不上传，也不会保存为录音文件。',
            '首次使用会自动下载本地识别模型并显示进度，之后会优先使用浏览器缓存。',
            '识别出的文字会直接进入当前心情文字框；你可以随时停止、继续编辑或删除。',
          ]}
          confirmText="同意并开始语音输入"
          cancelText="暂不开启"
          onCancel={() => {
            setPrivacyOpen(false)
            setSpeechStatus('idle')
          }}
          onConfirm={() => {
            setPrivacyOpen(false)
            void startRecognition()
          }}
        />
      )}
    </div>
  )
}
