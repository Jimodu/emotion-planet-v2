import * as OpenCC from 'opencc-js'

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' })
const TAIL_PUNCT = /[，,。！？!?；;：:、…]$/
const START_PUNCT = /^[，,。！？!?；;：:、…]/

export const PARTIAL_PREFIX = '【识别中】'

export function normalizeText(text) {
  return toSimplified(String(text || ''))
    .replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
}

export function trimLeadingOverlap(current, incoming) {
  if (!current) return incoming
  if (incoming.length >= 4 && current.endsWith(incoming)) return ''
  const maxOverlap = Math.min(20, current.length, incoming.length)
  for (let size = maxOverlap; size >= 4; size -= 1) {
    if (current.slice(-size) === incoming.slice(0, size)) return incoming.slice(size)
  }
  return incoming
}

export function stripPartialText(text) {
  const value = String(text || '')
  const index = value.lastIndexOf(PARTIAL_PREFIX)
  if (index < 0) return value
  return value.slice(0, index).replace(/[ \t\r\n]+$/, '')
}

export function hasPartialText(text) {
  return String(text || '').includes(PARTIAL_PREFIX)
}

export function joinText(current, incoming) {
  const deduped = trimLeadingOverlap(current.replace(/[ \t\r\n]+$/, ''), incoming)
  if (!deduped) return { text: current, deduped: '', skipped: true }
  const joiner = !TAIL_PUNCT.test(current) && !START_PUNCT.test(deduped) ? '，' : ''
  return { text: `${current.replace(/[ \t\r\n]+$/, '')}${joiner}${deduped}`, deduped, skipped: false }
}
