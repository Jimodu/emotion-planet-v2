import { OnlineRecognizer, OFFICIAL_MODEL_ENDPOINTS } from '@anov/sherpa-web'
import { normalizeText, joinText, PARTIAL_PREFIX, stripPartialText } from './text.js'

const senseVoice = OFFICIAL_MODEL_ENDPOINTS.senseVoice
const MODEL_DETAIL = {
  modelUrl: senseVoice.model.official,
  tokensUrl: senseVoice.tokens.official,
}
const now = () => performance.now()
const ms = (from, to) => (from == null || to == null ? null : Math.round(to - from))

export const EMPTY_TIMING = Object.freeze({
  micStartedAt: null,
  speechStartAt: null,
  speechEndAt: null,
  zipFirstTextAt: null,
  firstDisplayAt: null,
  senseVoiceStartAt: null,
  senseVoiceEndAt: null,
  finalDisplayAt: null,
  audioDurationMs: null,
})

function formatTiming(t) {
  const base = t.micStartedAt
  const timeline = [
    ['麦克风开始采集', t.micStartedAt],
    ['检测到开始说话', t.speechStartAt],
    ['检测到停止说话', t.speechEndAt],
    ['Zipformer 首次返回文字', t.zipFirstTextAt],
    ['文字首次显示在页面', t.firstDisplayAt],
    ['SenseVoice 终审开始', t.senseVoiceStartAt],
    ['SenseVoice 终审完成', t.senseVoiceEndAt],
    ['最终文字显示在页面', t.finalDisplayAt],
  ].map(([name, v]) => `${name}：${v == null ? '—' : `${ms(base, v)} ms`}`).join('\n')
  const summary = [
    ['首次出字延迟（开始说话→首次显示）', ms(t.speechStartAt, t.firstDisplayAt)],
    ['停止说话后等待（停止说话→最终显示）', ms(t.speechEndAt, t.finalDisplayAt)],
    ['Zipformer 处理耗时（开始说话→首次返回文字）', ms(t.speechStartAt, t.zipFirstTextAt)],
    ['SenseVoice 终审耗时（开始→完成）', ms(t.senseVoiceStartAt, t.senseVoiceEndAt)],
    ['整段识别总耗时（开始说话→最终显示）', ms(t.speechStartAt, t.finalDisplayAt)],
    ['本次采集的音频时长（VAD 实测）', t.audioDurationMs == null ? null : Math.round(t.audioDurationMs)],
  ].map(([name, v]) => `${name}：${v == null ? '—' : `${v} ms`}`).join('\n')
  return `自动计时（相对麦克风开始采集）\n${timeline}\n\n———— 指标 ————\n${summary}`
}

/**
 * 创建 SenseVoice 本地识别引擎（不依赖 COOP/COEP / SharedArrayBuffer）。
 * @param {object} options
 * @param {(evt:object)=>void} options.onEvent 引擎事件，type: partial/final/log/status/progress/speechStart/speechEnd/timing
 */
export function createSenseVoiceEngine({ onEvent = () => {} } = {}) {
  let eventSink = onEvent
  const localBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sensevoice/`
  let recognizer = null
  let prepared = false
  let running = false
  let senseVoiceWrapped = false
  let confirmedText = ''
  let partialText = ''
  let segmentCount = 0
  let timing = { ...EMPTY_TIMING }

  const emit = (type, payload = {}) => eventSink({ type, ...payload })

  function resetTimingAll() {
    timing = { ...EMPTY_TIMING }
    emit('timing', { timing, text: formatTiming(timing) })
  }

  function resetTimingExceptMic() {
    timing = { ...EMPTY_TIMING, micStartedAt: timing.micStartedAt }
    emit('timing', { timing, text: formatTiming(timing) })
  }

  function wrapSenseVoiceTiming(instance) {
    const rescorer = instance?.twoPassRescorer
    if (!rescorer || typeof rescorer.rescore !== 'function' || senseVoiceWrapped) return
    const original = rescorer.rescore.bind(rescorer)
    rescorer.rescore = async (...args) => {
      timing.senseVoiceStartAt = now()
      try {
        return await original(...args)
      } finally {
        timing.senseVoiceEndAt = now()
      }
    }
    senseVoiceWrapped = true
    emit('log', { message: '已挂载 SenseVoice 终审计时钩子。', level: 'info' })
  }

  function buildRecognizer() {
    return new OnlineRecognizer({
      localBase,
      twoPass: {
        mode: 'always',
        preloadOnIdle: false,
        modelType: 'sense-voice',
        modelPaths: {
          modelPath: senseVoice.model.official,
          tokensPath: senseVoice.tokens.official,
          quantization: 'int8',
          language: 'zh',
          useInverseTextNormalization: true,
        },
      },
      vadMinSilenceDurationMs: 500,
      tailPaddingMs: 200,
      callbacks: {
        onPartial: (text) => {
          const raw = String(text ?? '')
          const value = normalizeText(raw)
          if (!value) return
          if (timing.zipFirstTextAt == null) {
            timing.zipFirstTextAt = now()
            emit('log', { message: `Zipformer 首次返回文字：${value}`, level: 'ok' })
          }
          partialText = value
          if (timing.firstDisplayAt == null) {
            timing.firstDisplayAt = now()
            emit('log', { message: `临时文字已首次显示在识别区：${value}`, level: 'ok' })
          }
          emit('timing', { timing, text: formatTiming(timing) })
          emit('partial', { raw, normalized: value, display: renderDisplay() })
        },
        onFinal: (text, meta) => {
          segmentCount += 1
          const raw = String(text ?? '')
          const value = normalizeText(raw)
          timing.finalDisplayAt = now()
          if (meta?.durationSec != null) timing.audioDurationMs = meta.durationSec * 1000
          const pass = meta?.pass === 2 ? 'SenseVoice 终审' : 'Zipformer 流式'

          const hadPartial = Boolean(partialText)
          partialText = ''
          if (value) {
            if (!confirmedText.trim()) {
              confirmedText = value
            } else {
              confirmedText = joinText(confirmedText, value).text
            }
          }
          const display = renderDisplay()
          emit('timing', { timing, text: formatTiming(timing) })
          emit('final', { raw, normalized: value, display, pass, hadPartial, segmentCount, durationSec: meta?.durationSec ?? null })
        },
        onSpeechStart: () => {
          timing.speechStartAt = now()
          timing.speechEndAt = null
          timing.zipFirstTextAt = null
          timing.firstDisplayAt = null
          timing.senseVoiceStartAt = null
          timing.senseVoiceEndAt = null
          timing.finalDisplayAt = null
          timing.audioDurationMs = null
          partialText = ''
          emit('speechStart')
          emit('timing', { timing, text: formatTiming(timing) })
        },
        onSpeechEnd: () => {
          timing.speechEndAt = now()
          emit('speechEnd')
          emit('timing', { timing, text: formatTiming(timing) })
        },
        onStatusChange: (status) => emit('status', { status }),
        onProgress: (info) => {
          const percent = info?.percent ?? (info?.total ? (info.loaded / info.total) * 100 : 0)
          emit('progress', { percent })
        },
        onLog: (message, level) => emit('log', { message, level: level || 'info' }),
      },
    })
  }

  function renderDisplay() {
    return `${confirmedText}${partialText ? `${PARTIAL_PREFIX}${partialText}` : ''}`
  }

  return {
    setEventSink(fn) { eventSink = typeof fn === 'function' ? fn : () => {} },
    get localBase() { return localBase },
    get modelDetail() { return MODEL_DETAIL },
    get isPrepared() { return prepared },
    get isRunning() { return running },
    get segmentCount() { return segmentCount },
    get timing() { return timing },

    setBaseline(text) {
      confirmedText = stripPartialText(text)
      partialText = ''
      emit('display', { display: renderDisplay() })
    },
    getDisplay() { return renderDisplay() },
    getFinalDisplay() { return stripPartialText(renderDisplay()) },
    releaseAudio() {
      try { recognizer?.audioSource?.dispose?.() } catch { /* noop */ }
    },
    clearText() {
      confirmedText = ''
      partialText = ''
      segmentCount = 0
      resetTimingAll()
      emit('display', { display: renderDisplay() })
    },

    async prepare() {
      if (prepared || !recognizer) {
        // 允许重复调用时复用已有实例
        if (recognizer && prepared) return
      }
      recognizer = buildRecognizer()
      await recognizer.init()
      wrapSenseVoiceTiming(recognizer)
      emit('phase', { phase: 'senseVoiceWarmup' })
      await recognizer.initTwoPass()
      prepared = true
    },

    async start() {
      if (!prepared || !recognizer || running) return
      await recognizer.start()
      running = true
      timing.micStartedAt = now()
      resetTimingExceptMic()
    },

    async stop() {
      if (!running || !recognizer) return
      await recognizer.stop()
      try { recognizer.audioSource?.dispose?.() } catch { /* noop */ }
      running = false
      emit('stopped', { display: stripPartialText(renderDisplay()) })
    },

    dispose() {
      try { recognizer?.audioSource?.dispose?.() } catch { /* noop */ }
      try { recognizer?.dispose?.() } catch { /* noop */ }
      recognizer = null
      prepared = false
      running = false
      senseVoiceWrapped = false
      partialText = ''
    },
  }
}
