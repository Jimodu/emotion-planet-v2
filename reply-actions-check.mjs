import fs from 'node:fs'

const url = 'http://127.0.0.1:5173/'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = targets.find((target) => target.type === 'page')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let id = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  }
})

function send(method, params = {}) {
  id += 1
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(expression, timeout = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await evaluate(expression).catch(() => null)
    if (value) return value
    await sleep(120)
  }
  throw new Error(`timeout: ${expression}`)
}

async function navigate() {
  const loaded = new Promise((resolve) => {
    const handler = (event) => {
      const message = JSON.parse(event.data)
      if (message.method === 'Page.loadEventFired') {
        socket.removeEventListener('message', handler)
        resolve()
      }
    }
    socket.addEventListener('message', handler)
  })
  await send('Page.navigate', { url })
  await loaded
  await waitFor("!!document.querySelector('.whisper-card')")
  await sleep(250)
}

await navigate()

const mock = await evaluate(`import('/src/data/mockData.js').then((m) => ({
  replies: m.demoReplies,
  target: m.whispers.find((w) => w.id === m.demoReplies[0]?.targetId)?.note,
}))`)
const targetId = mock.replies[0].targetId
console.log(`DEMO_TARGET ${targetId} replies=${mock.replies.length}`)

async function seed(theme) {
  await evaluate(`(() => {
    localStorage.setItem('emotion-planet-theme', '${theme}')
    localStorage.setItem('emotion-planet-comments', JSON.stringify([{
      id: 'real-reply-check', targetId: ${JSON.stringify(targetId)}, text: '这是一条真实本地回复，用于检查操作一致性。',
      createdAt: new Date().toISOString(), isMine: true,
    }]))
    localStorage.setItem('emotion-planet-hidden-comments', '[]')
    localStorage.setItem('emotion-planet-reported-comments', '[]')
  })()`)
  await navigate()
}

async function openTarget() {
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('.whisper-card')].find((el) => el.textContent.includes(${JSON.stringify(mock.target.slice(0, 10))}))
    if (!card) throw new Error('target card missing')
    card.click()
  })()`)
  await waitFor("!!document.querySelector('.whisper-card.expanded')")
  await sleep(150)
}

const replyMetrics = `(() => {
  const card = document.querySelector('.whisper-card.expanded').getBoundingClientRect()
  const notes = [...document.querySelectorAll('.whisper-card.expanded .anonymous-note')]
  return {
    count: notes.length,
    demoCount: notes.filter((n) => n.classList.contains('demo-reply')).length,
    allHaveActions: notes.every((n) => n.querySelectorAll('.note-actions button').length >= 2),
    actionsInside: notes.every((n) => [...n.querySelectorAll('.note-actions button')].every((b) => {
      const r = b.getBoundingClientRect()
      return r.left >= card.left - 1 && r.right <= card.right + 1
    })),
    textInside: notes.every((n) => {
      const r = n.querySelector('p').getBoundingClientRect()
      return r.left >= card.left - 1 && r.right <= card.right + 1
    }),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    actionColor: getComputedStyle(notes[0].querySelector('.note-action')).color,
  }
})()`

for (const [width, height, theme] of [[390, 844, 'day'], [320, 700, 'day'], [390, 844, 'night']]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true })
  await seed(theme)
  await openTarget()
  console.log(`REPLY_LAYOUT ${theme} ${width}x${height} ${JSON.stringify(await evaluate(replyMetrics))}`)
  if (width === 320) await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then((shot) => fs.writeFileSync(new URL('./reply-actions-320.png', import.meta.url), Buffer.from(shot.data, 'base64')))
}

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await seed('day')
await openTarget()

const beforeReport = await evaluate("document.querySelectorAll('.whisper-card.expanded .anonymous-note.demo-reply .note-action[aria-label=\"举报这条回复\"]').length")
await evaluate("document.querySelector('.whisper-card.expanded .anonymous-note.demo-reply .note-action[aria-label=\"举报这条回复\"]').click()")
await waitFor("!!document.querySelector('.report-card')")
const dialog = await evaluate(`(() => ({
  reasons: [...document.querySelectorAll('.report-reason span')].map((s) => s.textContent),
  demoLabel: document.querySelector('.report-demo-note')?.textContent || '',
  confirmDisabled: document.querySelector('.report-card .compact-save').disabled,
  description: document.querySelector('.report-card .confirm-description').textContent,
}))()`)
console.log(`REPORT_DIALOG ${JSON.stringify({ triggerCount: beforeReport, ...dialog })}`)

await evaluate("[...document.querySelectorAll('.report-reason')].find((l) => l.textContent.includes('辱骂或骚扰')).click()")
await sleep(100)
const enabled = await evaluate("!document.querySelector('.report-card .compact-save').disabled")
await evaluate("document.querySelector('.report-card .compact-save').click()")
await waitFor("JSON.parse(localStorage.getItem('emotion-planet-reported-comments') || '[]').length === 1")
const reported = await evaluate(`(() => ({
  record: JSON.parse(localStorage.getItem('emotion-planet-reported-comments') || '[]')[0],
  disabled: document.querySelector('.anonymous-note.demo-reply .note-action[aria-label="已举报这条回复"]')?.disabled ?? null,
  toast: document.querySelector('.toast')?.textContent || '',
}))()`)
console.log(`REPORT_SAVED ${JSON.stringify({ enabledAfterReason: enabled, ...reported })}`)

const countBeforeHide = await evaluate("document.querySelectorAll('.whisper-card.expanded .anonymous-note').length")
await evaluate("document.querySelector('.anonymous-note.demo-reply .note-action[aria-label=\"隐藏这条回复\"]').click()")
await sleep(150)
const hidden = await evaluate(`(() => ({
  count: document.querySelectorAll('.whisper-card.expanded .anonymous-note').length,
  stored: JSON.parse(localStorage.getItem('emotion-planet-hidden-comments') || '[]'),
  restore: [...document.querySelectorAll('.text-btn')].map((b) => b.textContent).find((t) => t.includes('已隐藏')) || '',
}))()`)
console.log(`HIDE ${JSON.stringify({ before: countBeforeHide, ...hidden })}`)

await evaluate("[...document.querySelectorAll('.text-btn')].find((b) => b.textContent.includes('已隐藏')).click()")
await sleep(150)
console.log(`RESTORE ${await evaluate("document.querySelectorAll('.whisper-card.expanded .anonymous-note').length")}`)

socket.close()
