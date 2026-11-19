import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { formatDateTime, formatFriendlyDate, formatShortDate, getDateKey, shiftDateKey, sortByDateDesc, todayKey } from '../data/entries'
import { normalizeHex } from '../data/moods'

const ranges = [
  { id: '7d', label: '近7天', days: 7 },
  { id: '30d', label: '近30天', days: 30 },
  { id: 'all', label: '全部记录', days: null },
]

const EMPTY_TEXT = '这里暂时还没有留下太多痕迹，等你愿意记录时，我们再一起回头看看。'

function hasIntensity(entry) {
  const value = Number(entry?.intensity)
  return Number.isFinite(value) && value >= 0 && value <= 100
}

function entryColor(entry) {
  return normalizeHex(entry?.baseColor || entry?.color || '')
}

function colorLabel(color, entry) {
  if (entry?.colorName) return entry.colorName
  if (entry?.moodLabel) return entry.moodLabel
  return color
}

function buildDateKeys(range) {
  if (range.id === 'all') return null
  const today = todayKey()
  const start = shiftDateKey(today, -(range.days - 1))
  const keys = []
  let cursor = start
  for (let index = 0; index < range.days; index += 1) {
    keys.push(cursor)
    cursor = shiftDateKey(cursor, 1)
  }
  return keys
}

function inRange(entry, range, keys) {
  const key = getDateKey(entry.createdAt)
  if (!key) return range.id === 'all'
  if (!keys) return true
  return keys.includes(key)
}

function timeOf(entry) {
  const date = entry?.createdAt ? new Date(entry.createdAt) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
}

function DetailDialog({ entry, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!entry) return null
  const color = entryColor(entry)

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="modal-card emotion-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emotion-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="panel-kicker">A MOMENT · 那一刻</p>
            <h2 id="emotion-detail-title">{formatFriendlyDate(getDateKey(entry.createdAt)) || '未标注日期'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭记录详情">
            <X size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="emotion-detail-body">
          <div className="emotion-detail-meta">
            <span className="emotion-detail-dot" style={{ backgroundColor: color || 'var(--ink-faint)' }} aria-hidden="true" />
            <span>{hasIntensity(entry) ? `强度 ${entry.intensity}%` : '未记录强度'}</span>
            <span>{entry.visibility === 'anonymous' ? '匿名公开' : '仅自己可见'}</span>
          </div>
          <p className="emotion-detail-note">{entry.note || '这条记录没有写下文字。'}</p>
          <p className="emotion-detail-time">{formatDateTime(entry.createdAt) || '未标注时间'}</p>
        </div>
      </div>
    </div>
  )
}

export default function EmotionPage({ entries = [] }) {
  const [rangeId, setRangeId] = useState('7d')
  const [detail, setDetail] = useState(null)
  const [dayDetail, setDayDetail] = useState(null)

  const range = ranges.find((item) => item.id === rangeId) || ranges[0]
  const keys = useMemo(() => buildDateKeys(range), [rangeId])

  const allEntries = useMemo(() => sortByDateDesc(entries), [entries])
  const scoped = useMemo(
    () => allEntries.filter((entry) => inRange(entry, range, keys)),
    [allEntries, rangeId, keys],
  )

  const intensityPoints = useMemo(() => {
    const valid = scoped.filter(hasIntensity).sort((a, b) => timeOf(a) - timeOf(b))
    return valid.map((entry) => ({
      entry,
      key: getDateKey(entry.createdAt),
      value: Number(entry.intensity),
      time: timeOf(entry),
    }))
  }, [scoped])

  const frequency = useMemo(() => {
    let dayKeys
    if (range.id === 'all') {
      const dated = scoped.map((entry) => getDateKey(entry.createdAt)).filter(Boolean).sort()
      if (!dated.length) return []
      dayKeys = [dated[0]]
      let cursor = dated[0]
      const today = todayKey()
      let guard = 0
      while (cursor !== today && guard < 3660) {
        cursor = shiftDateKey(cursor, 1)
        dayKeys.push(cursor)
        guard += 1
      }
    } else {
      dayKeys = keys
    }
    const map = new Map()
    scoped.forEach((entry) => {
      const key = getDateKey(entry.createdAt)
      if (!key) return
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    })
    return dayKeys.map((key) => ({
      key,
      count: (map.get(key) || []).length,
      entries: (map.get(key) || []).slice().sort((a, b) => timeOf(a) - timeOf(b)),
    }))
  }, [scoped, rangeId, keys])

  const distribution = useMemo(() => {
    const map = new Map()
    scoped.forEach((entry) => {
      const color = entryColor(entry)
      if (!color) return
      const current = map.get(color) || { color, count: 0, labels: [] }
      current.count += 1
      const label = colorLabel(color, entry)
      if (label && !current.labels.includes(label)) current.labels.push(label)
      map.set(color, current)
    })
    const total = scoped.reduce((sum, entry) => sum + (entryColor(entry) ? 1 : 0), 0)
    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .map((item) => ({ ...item, percent: total ? Math.round((item.count / total) * 100) : 0 }))
  }, [scoped])

  const memory = useMemo(() => {
    const withText = scoped.filter((entry) => typeof entry.note === 'string' && entry.note.trim())
    return withText.length ? withText[0] : null
  }, [scoped])

  const selectedRangeLabel = range.label

  return (
    <div className="subpage emotion-page">
      <header className="page-head emotion-page-head">
        <p className="eyebrow">EMOTION · 情绪</p>
        <h2>情绪</h2>
        <p className="page-desc">情绪没有固定的形状，回头看看，你会发现它们都曾留下痕迹。</p>
      </header>

      <div className="emotion-range" role="group" aria-label="时间范围">
        {ranges.map((item) => (
          <button
            key={item.id}
            type="button"
            className={rangeId === item.id ? 'active' : ''}
            onClick={() => { setRangeId(item.id); setDayDetail(null) }}
            aria-pressed={rangeId === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {allEntries.length === 0 ? (
        <p className="gentle-empty emotion-empty">{EMPTY_TEXT}</p>
      ) : scoped.length === 0 ? (
        <p className="gentle-empty emotion-empty">这个时间范围里还没有记录。换个时间范围，或者先去记下此刻。</p>
      ) : (
        <>
          <section className="emotion-card intensity-card" aria-labelledby="intensity-title">
            <div className="section-title-row">
              <h3 id="intensity-title">情绪强度</h3>
              <span className="count-tag">真实记录 · {intensityPoints.length} 个强度点</span>
            </div>
            {intensityPoints.length < 2 ? (
              <p className="gentle-empty">只有一条或没有强度记录时，还画不出趋势。等再多一点痕迹，我们再一起看看。</p>
            ) : (
              <IntensityChart points={intensityPoints} onSelect={(entry) => setDetail(entry)} />
            )}
          </section>

          <section className="emotion-card frequency-card" aria-labelledby="frequency-title">
            <div className="section-title-row">
              <h3 id="frequency-title">记录频率</h3>
              <span className="count-tag">{selectedRangeLabel} · 按天汇总</span>
            </div>
            <FrequencyChart days={frequency} onSelect={(day) => day.entries.length && setDayDetail(day)} />
          </section>

          <section className="emotion-card color-card" aria-labelledby="color-title">
            <div className="section-title-row">
              <h3 id="color-title">情绪颜色分布</h3>
              <span className="count-tag">{scoped.length} 条记录</span>
            </div>
            {distribution.length ? (
              <div className="color-bars">
                {distribution.map((item) => (
                  <div className="color-bar-row" key={item.color}>
                    <span className="color-bar-label">
                      <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                      {item.labels[0] || item.color}
                    </span>
                    <span className="color-bar-track">
                      <span className="color-bar-fill" style={{ width: `${Math.max(4, item.percent)}%`, backgroundColor: item.color }} />
                    </span>
                    <span className="color-bar-count">{item.count} · {item.percent}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="gentle-empty">这些记录还没有可用的颜色字段，暂时无法统计颜色分布。</p>
            )}
          </section>

          <section className="emotion-card memory-card" aria-labelledby="memory-title">
            <p className="memory-kicker" id="memory-title">一句话回忆</p>
            {memory ? (
              <>
                <p className="memory-text">「{memory.note}」</p>
                <span className="memory-date">{formatFriendlyDate(getDateKey(memory.createdAt)) || '未标注日期'}</span>
                <button type="button" className="text-btn memory-link" onClick={() => setDetail(memory)}>看看这条记录</button>
              </>
            ) : (
              <p className="gentle-empty">这个时间范围里还没有写下的文字。等有一句话愿意留下，它会在这里等你。</p>
            )}
          </section>
        </>
      )}

      {detail && <DetailDialog entry={detail} onClose={() => setDetail(null)} />}

      {dayDetail && (
        <div className="modal-overlay" onMouseDown={() => setDayDetail(null)} role="presentation">
          <div
            className="modal-card emotion-day-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="panel-kicker">THAT DAY · 那一天</p>
                <h2 id="day-detail-title">{formatFriendlyDate(dayDetail.key) || dayDetail.key}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setDayDetail(null)} aria-label="关闭当天记录">
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <p className="day-detail-count">这天有 {dayDetail.count} 条记录</p>
            <div className="day-detail-list">
              {dayDetail.entries.map((entry) => (
                <button
                  type="button"
                  className="day-detail-item"
                  key={entry.id}
                  onClick={() => { setDayDetail(null); setDetail(entry) }}
                >
                  <span className="day-detail-dot" style={{ backgroundColor: entryColor(entry) || 'var(--ink-faint)' }} aria-hidden="true" />
                  <span>{hasIntensity(entry) ? `${entry.intensity}%` : '未标强度'}</span>
                  <em>{entry.note || (entry.voice?.transcript ? '语音记录' : '没有文字')}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IntensityChart({ points, onSelect }) {
  const width = 560
  const height = 170
  const padX = 22
  const padY = 20
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0
  const x = (index) => padX + index * step
  const y = (value) => height - padY - (Math.min(100, Math.max(0, value)) / 100) * (height - padY * 2)
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const area = points.length > 1
    ? `${path} L${x(points.length - 1).toFixed(1)},${height - padY} L${x(0).toFixed(1)},${height - padY} Z`
    : ''
  const labelIndexes = points.length <= 8
    ? points.map((_, index) => index)
    : points.map((_, index) => index).filter((index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0)

  return (
    <div className="chart-scroll">
      <svg className="trend-svg intensity-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="情绪强度曲线">
        <line className="trend-grid" x1={padX} x2={width - padX} y1={y(50)} y2={y(50)} />
        <line className="trend-grid" x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} />
        {area && <path className="trend-area" d={area} />}
        {path && <path className="trend-line" d={path} />}
        {points.map((point, index) => (
          <g key={point.entry.id} className="chart-point" onClick={() => onSelect(point.entry)} role="button" tabIndex={0}
            aria-label={`${point.key} 强度 ${point.value}%`}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(point.entry) } }}
          >
            <circle className="trend-hit" cx={x(index)} cy={y(point.value)} r="12" />
            <circle className="trend-dot" cx={x(index)} cy={y(point.value)} r="3.4" />
          </g>
        ))}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        {labelIndexes.map((index) => (
          <span key={index}>{formatShortDate(points[index].key)}</span>
        ))}
      </div>
      <p className="chart-caption">
        从 {formatShortDate(first.key)} 的 {first.value}% 到 {formatShortDate(last.key)} 的 {last.value}%，点按圆点可查看记录。
      </p>
    </div>
  )
}

function FrequencyChart({ days, onSelect }) {
  const barCount = days.length
  const chartWidth = Math.max(320, barCount * 22)
  const width = chartWidth
  const height = 150
  const padX = 12
  const padY = 18
  const max = Math.max(1, ...days.map((day) => day.count))
  const slot = barCount ? (width - padX * 2) / barCount : width - padX * 2
  const barWidth = Math.max(4, Math.min(14, slot * 0.6))
  const baseY = height - padY
  const labelEvery = barCount <= 10 ? 1 : Math.ceil(barCount / 8)

  return (
    <div className="chart-scroll">
      <svg className="trend-svg frequency-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每天记录数量柱状图" style={{ minWidth: width }}>
        <line className="trend-grid" x1={padX} x2={width - padX} y1={baseY} y2={baseY} />
        {days.map((day, index) => {
          const barHeight = (day.count / max) * (height - padY * 2)
          const cx = padX + slot * index + slot / 2
          return (
            <g key={day.key} className={`bar-group ${day.count ? 'has-data' : ''}`} onClick={() => onSelect(day)}
              role={day.count ? 'button' : undefined}
              tabIndex={day.count ? 0 : undefined}
              aria-label={`${day.key} ${day.count} 条记录`}
              onKeyDown={(event) => { if (day.count && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(day) } }}
            >
              <rect className="bar-hit" x={padX + slot * index} y={padY} width={slot} height={height - padY * 2} fill="transparent" />
              <rect className="frequency-bar" x={cx - barWidth / 2} y={baseY - barHeight} width={barWidth} height={Math.max(barHeight, 1)} rx="3" />
              {day.count > 0 && <text className="bar-value" x={cx} y={baseY - barHeight - 4} textAnchor="middle">{day.count}</text>}
            </g>
          )
        })}
      </svg>
      <div className="chart-axis frequency-axis" aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.key}>{index % labelEvery === 0 || index === days.length - 1 ? formatShortDate(day.key) : ''}</span>
        ))}
      </div>
      <p className="chart-caption">没有记录的日期记为 0；点按有记录的柱子可查看当天内容。</p>
    </div>
  )
}
