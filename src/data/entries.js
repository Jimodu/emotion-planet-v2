const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function pad(value) {
  return String(value).padStart(2, '0')
}

export function toDateKey(date) {
  if (!date || Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getDateKey(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return toDateKey(date)
}

export function fromDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return Number.isNaN(date.getTime()) ? null : date
}

export function todayKey() {
  return toDateKey(new Date())
}

export function formatFriendlyDate(key) {
  const date = fromDateKey(key)
  if (!date) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdayNames[date.getDay()]}`
}

export function formatShortDate(key) {
  const date = fromDateKey(key)
  if (!date) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function shiftDateKey(key, amount, unit = 'day') {
  const date = fromDateKey(key)
  if (!date) return todayKey()
  if (unit === 'month') date.setMonth(date.getMonth() + amount)
  else if (unit === 'year') date.setFullYear(date.getFullYear() + amount)
  else date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1, 12)
  const start = new Date(first)
  start.setDate(start.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    }
  })
}

export function getWeekDays(key) {
  const date = fromDateKey(key) || new Date()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return toDateKey(day)
  })
}

export function getYearDays(year) {
  const days = []
  const date = new Date(year, 0, 1, 12)
  while (date.getFullYear() === year) {
    days.push(toDateKey(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

export function groupByDate(items) {
  const map = new Map()
  const undated = []
  items.forEach((item) => {
    const key = getDateKey(item.createdAt || item.publishedAt)
    if (!key) {
      undated.push(item)
      return
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  })
  return { map, undated }
}

export function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.publishedAt || 0).getTime() || 0
    const bTime = new Date(b.createdAt || b.publishedAt || 0).getTime() || 0
    return bTime - aTime
  })
}

export function isSameAnniversary(key, referenceKey) {
  if (!key || !referenceKey) return false
  return key.slice(5) === referenceKey.slice(5)
}

export function isPastYear(key, referenceKey) {
  return Boolean(key && referenceKey) && key.slice(0, 4) < referenceKey.slice(0, 4)
}
