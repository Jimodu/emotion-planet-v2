import { fromDateKey, getDateKey, todayKey } from './entries'
import { STORAGE_KEYS } from './storage'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function readLetters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.letters)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => (
      item
      && (item.id || item.letterId)
      && (item.type === 'past' || item.type === 'future')
      && typeof item.body === 'string'
    )).map((item) => ({
      ...item,
      id: item.id || item.letterId,
      title: typeof item.title === 'string' ? item.title : '',
      writtenOn: DATE_PATTERN.test(item.writtenOn) ? item.writtenOn : (getDateKey(item.createdAt) || todayKey()),
      targetDate: DATE_PATTERN.test(item.targetDate) ? item.targetDate : '',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      openedAt: item.openedAt || null,
    }))
  } catch {
    return []
  }
}

export function persistLetters(letters) {
  try {
    localStorage.setItem(STORAGE_KEYS.letters, JSON.stringify(letters))
    return true
  } catch {
    return false
  }
}

export function readLetterDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.letterDraft)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || (draft.type !== 'past' && draft.type !== 'future')) return null
    return {
      type: draft.type,
      title: typeof draft.title === 'string' ? draft.title : '',
      writtenOn: DATE_PATTERN.test(draft.writtenOn) ? draft.writtenOn : todayKey(),
      targetDate: DATE_PATTERN.test(draft.targetDate) ? draft.targetDate : '',
      body: typeof draft.body === 'string' ? draft.body : '',
    }
  } catch {
    return null
  }
}

export function persistLetterDraft(draft) {
  try {
    if (!draft || !draft.body?.trim() && !draft.title?.trim()) {
      localStorage.removeItem(STORAGE_KEYS.letterDraft)
      return
    }
    localStorage.setItem(STORAGE_KEYS.letterDraft, JSON.stringify(draft))
  } catch {
    /* 本地存储不可用时忽略 */
  }
}

export function clearLetterDraft() {
  try {
    localStorage.removeItem(STORAGE_KEYS.letterDraft)
  } catch {
    /* 本地存储不可用时忽略 */
  }
}

export function createLetter({ type, title, writtenOn, targetDate, body }) {
  const now = new Date().toISOString()
  return {
    id: `letter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: type === 'future' ? 'future' : 'past',
    title: title || '',
    writtenOn: DATE_PATTERN.test(writtenOn) ? writtenOn : todayKey(),
    targetDate: DATE_PATTERN.test(targetDate) ? targetDate : '',
    body,
    createdAt: now,
    updatedAt: now,
    openedAt: null,
  }
}

function localDayNumber(key) {
  const date = fromDateKey(key)
  if (!date) return null
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

export function daysBetween(fromKey, toKey) {
  const from = localDayNumber(fromKey)
  const to = localDayNumber(toKey)
  if (from === null || to === null) return null
  return to - from
}

export function letterStatus(letter, referenceKey = todayKey()) {
  if (!letter) return 'invalid'
  if (letter.type === 'past') {
    return DATE_PATTERN.test(letter.targetDate) ? 'ready' : 'invalid'
  }
  if (!DATE_PATTERN.test(letter.targetDate)) return 'invalid'
  const remaining = daysBetween(referenceKey, letter.targetDate)
  if (remaining === null) return 'invalid'
  return remaining > 0 ? 'sealed' : 'ready'
}

export function daysUntil(letter, referenceKey = todayKey()) {
  if (!letter || letter.type !== 'future' || !DATE_PATTERN.test(letter.targetDate)) return null
  const remaining = daysBetween(referenceKey, letter.targetDate)
  return remaining === null ? null : Math.max(0, remaining)
}

export function isValidFutureDate(targetDate, writtenOn = todayKey()) {
  if (!DATE_PATTERN.test(targetDate) || !DATE_PATTERN.test(writtenOn)) return false
  const diff = daysBetween(writtenOn, targetDate)
  return diff !== null && diff > 0
}

export function isValidPastDate(targetDate, writtenOn = todayKey()) {
  if (!DATE_PATTERN.test(targetDate) || !DATE_PATTERN.test(writtenOn)) return false
  const diff = daysBetween(targetDate, writtenOn)
  return diff !== null && diff >= 0
}

export function sortLetters(letters) {
  return [...letters].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime() || 0
    const bTime = new Date(b.createdAt || 0).getTime() || 0
    return bTime - aTime
  })
}
