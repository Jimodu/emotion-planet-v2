import { createSenseVoiceEngine } from '../lib/sensevoice/engine.js'
import './style.css'

const $ = (id) => document.getElementById(id)
const els = {
  environment: $('environment'),
  prepare: $('prepare'),
  modelStatus: $('model-status'),
  progressBar: $('progress-bar'),
  progressText: $('progress-text'),
  modelDetail: $('model-detail'),
  start: $('start'),
  stop: $('stop'),
  micStatus: $('mic-status'),
  micDetail: $('mic-detail'),
  transcript: $('transcript'),
  resultDiag: $('result-diag'),
  timingDiag: $('timing-diag'),
  metrics: $('metrics'),
  live: $('live'),
  logs: $('logs'),
  clear: $('clear'),
}

function setBadge(el, text, kind = '') {
  el.textContent = text
  el.className = `badge ${kind}`.trim()
}

function log(message, level = 'info') {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const line = `[${time}] ${message}`
  const lines = (els.logs.textContent ? els.logs.textContent.split('\n') : [])
  lines.push(line)
  while (lines.length > 200) lines.shift()
  els.logs.textContent = lines.join('\n')
  els.logs.scrollTop = els.logs.scrollHeight
  els.live.textContent = message
}

function setProgress(percent, text) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0))
  els.progressBar.style.width = `${value}%`
  els.progressText.textContent = text || `${Math.round(value)}%`
}

function renderResultDiag(source, raw, normalized, finalText) {
  els.resultDiag.textContent =
    `结果链路诊断（${source}）\n` +
    `1. 模型原始返回：${raw || '（空）'}\n` +
    `2. 繁简转换后：${normalized || '（空）'}\n` +
    `3. 拼接后完整文字：${finalText || '（空）'}\n` +
    `4. 页面当前显示：${els.transcript.value || '（空）'}`
}

let preparing = false

const engine = createSenseVoiceEngine({
  onEvent: (evt) => {
    switch (evt.type) {
      case 'partial':
        els.transcript.value = evt.display
        renderResultDiag('Zipformer 流式（临时）', evt.raw, evt.normalized, evt.display)
        break
      case 'final':
        els.transcript.value = evt.display
        renderResultDiag(evt.pass, evt.raw, evt.normalized, evt.display)
        els.metrics.textContent =
          `片段 ${evt.segmentCount}｜阶段 ${evt.pass}` +
          `${evt.durationSec ? `｜音频 ${evt.durationSec.toFixed(1)}s` : ''}` +
          `${evt.hadPartial ? '｜临时文字已由终审结果修正' : ''}`
        log(
          `第 ${evt.segmentCount} 段完成（${evt.pass}）：原始「${evt.raw || '（空）'}」` +
          `→转换「${evt.normalized || '（空）'}」→显示区「${evt.display || '（空）'}」`,
          'ok',
        )
        break
      case 'display':
        els.transcript.value = evt.display
        break
      case 'timing':
        els.timingDiag.textContent = evt.text
        break
      case 'progress':
        setProgress(evt.percent, `加载中 ${Math.round(evt.percent)}%`)
        break
      case 'phase':
        setProgress(50, '正在预热 SenseVoice 终审模型…')
        log('正在预热 SenseVoice 终审模型…')
        break
      case 'speechStart':
        setBadge(els.micStatus, '检测到语音', 'active')
        log('检测到语音起点，正在采集…')
        break
      case 'speechEnd':
        setBadge(els.micStatus, '识别中', 'active')
        log('检测到语音终点，等待 Zipformer/SenseVoice 终审…')
        break
      case 'status':
        log(`引擎状态：${evt.status}`)
        break
      case 'log':
        log(`SDK: ${evt.message}`, evt.level)
        break
      default:
        break
    }
  },
})

els.environment.textContent =
  `资源路径（BASE_URL）：${import.meta.env.BASE_URL}｜` +
  `WASM 资产：${engine.localBase}｜` +
  `模型：SenseVoice-Small INT8（239 MB，首次自动下载后缓存）｜` +
  `跨域隔离：${typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? '已启用' : '未启用（不依赖）'}`

els.prepare.addEventListener('click', async () => {
  if (preparing || engine.isPrepared) return
  preparing = true
  els.prepare.disabled = true
  setBadge(els.modelStatus, '加载中', 'active')
  setProgress(0, '正在初始化运行时…')
  const startedAt = performance.now()
  try {
    await engine.prepare()
    const elapsed = Math.round(performance.now() - startedAt)
    setBadge(els.modelStatus, '已就绪', 'ready')
    setProgress(100, `加载完成（${elapsed} ms）`)
    els.modelDetail.textContent =
      `模型：${engine.modelDetail.modelUrl}\n词表：${engine.modelDetail.tokensUrl}\n加载耗时：${elapsed} ms`
    els.start.disabled = false
    log(`SenseVoice 模型加载完成，耗时 ${elapsed} ms。`, 'ok')
  } catch (error) {
    setBadge(els.modelStatus, '加载失败', 'error')
    setProgress(0, '加载失败')
    els.modelDetail.textContent = `错误：${error?.message || String(error)}`
    log(`模型加载失败：${error?.stack || error?.message || String(error)}`, 'err')
  } finally {
    preparing = false
    els.prepare.disabled = false
  }
})

els.start.addEventListener('click', async () => {
  if (!engine.isPrepared || engine.isRunning) return
  try {
    setBadge(els.micStatus, '申请权限中', 'active')
    engine.setBaseline(els.transcript.value)
    await engine.start()
    els.start.disabled = true
    els.stop.disabled = false
    setBadge(els.micStatus, '监听中', 'active')
    els.micDetail.textContent = '麦克风已开启；请说普通话。'
    log('麦克风已开启，开始识别。', 'ok')
  } catch (error) {
    setBadge(els.micStatus, '启动失败', 'error')
    els.micDetail.textContent = `错误：${error?.message || String(error)}`
    log(`麦克风启动失败：${error?.stack || error?.message || String(error)}`, 'err')
  }
})

els.stop.addEventListener('click', async () => {
  if (!engine.isRunning) return
  try {
    await engine.stop()
    log('麦克风已停止；已有文字仍可编辑。', 'ok')
  } catch (error) {
    log(`停止识别出错：${error?.message || String(error)}`, 'err')
  } finally {
    els.start.disabled = false
    els.stop.disabled = true
    setBadge(els.micStatus, '已停止', '')
  }
})

els.clear.addEventListener('click', () => {
  engine.clearText()
  els.transcript.value = ''
  els.metrics.textContent = '暂无'
  els.resultDiag.textContent = '结果链路诊断：已清空，等待识别…'
  log('已清空识别文字与计时。')
})

log('阶段1 测试页就绪。请点击“加载 SenseVoice 模型”。')
