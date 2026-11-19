import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import AlbumAudio from './AlbumAudio'
import Calendar from './Calendar'
import ConfirmDialog from './ConfirmDialog'
import EntryEditor from './EntryEditor'
import { deleteAudio } from '../data/audioStore'
import { formatDateTime, formatFriendlyDate, formatShortDate, fromDateKey, getDateKey, groupByDate, shiftDateKey, sortByDateDesc, toDateKey, todayKey } from '../data/entries'
import { normalizeHex } from '../data/moods'

const EMPTY = '这里还没有留下记录。等你愿意记下什么的时候，它会在这里安静地等你。'

function entryTime(entry) {
  const date = entry?.createdAt ? new Date(entry.createdAt) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
}

function entryColor(entry) {
  return normalizeHex(entry?.baseColor || entry?.color || '')
}

function matchesQuery(entry, query) {
  if (!query.trim()) return true
  const text = `${entry.note || ''} ${entry.voice?.transcript || ''}`.toLowerCase()
  return text.includes(query.trim().toLowerCase())
}

function matchesFilters(entry, filters) {
  const key = getDateKey(entry.createdAt)
  if (filters.range !== 'all') {
    if (!key) return false
    const today = todayKey()
    const days = filters.range === '7d' ? 7 : 30
    const start = shiftDateKey(today, -(days - 1))
    if (key < start || key > today) return false
  }
  if (filters.color !== 'all') {
    if (entryColor(entry) !== filters.color) return false
  }
  if (filters.audio === 'with' && !entry.voice?.audioId) return false
  if (filters.audio === 'without' && entry.voice?.audioId) return false
  return true
}

function monthKeys(anchor) {
  const date = fromDateKey(anchor) || new Date()
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1, 12)
  const start = new Date(first)
  start.setDate(start.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const cursor = new Date(start)
    cursor.setDate(start.getDate() + index)
    return toDateKey(cursor)
  })
}

function RecordCard({ entry, onOpen, onEdit, onDelete, compact = false }) {
  const color = entryColor(entry)
  return (
    <article className={`album-entry ${compact ? 'compact' : ''}`} style={{ '--mood-color': color || 'var(--line-strong)' }}>
      <button type="button" className="album-entry-main" onClick={() => onOpen(entry)}>
        <span className="album-entry-color" aria-hidden="true" />
        <span className="album-entry-info">
          <strong>{entry.colorName || entry.moodLabel || color || '自选颜色'}</strong>
          <span>
            {formatDateTime(entry.createdAt) || '未标注时间'}
            {' · '}
            {Number.isFinite(Number(entry.intensity)) && entry.intensity !== undefined && entry.intensity !== null ? `${entry.intensity}%` : '未记录强度'}
            {' · '}
            {entry.visibility === 'anonymous' ? '匿名公开' : '仅自己可见'}
          </span>
        </span>
        <span className="album-entry-excerpt">
          {entry.note || (entry.voice?.transcript ? '语音记录：' + entry.voice.transcript : '这条记录没有文字。')}
        </span>
      </button>
      <div className="entry-actions">
        {entry.voice?.audioId && <span className="entry-audio-tag">有录音</span>}
        <button type="button" onClick={() => onEdit(entry)} aria-label="编辑这条记录"><Pencil size={14} strokeWidth={1.8} aria-hidden="true" /></button>
        <button type="button" className="danger" onClick={() => onDelete(entry)} aria-label="删除这条记录"><Trash2 size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      </div>
    </article>
  )
}

function DetailModal({ entry, onClose, onEdit }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const color = entryColor(entry)
  const hasIntensity = Number.isFinite(Number(entry.intensity)) && entry.intensity !== undefined && entry.intensity !== null

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal-card album-detail-modal" role="dialog" aria-modal="true" aria-labelledby="album-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker">THE RECORD · 完整记录</p>
            <h2 id="album-detail-title">{formatDateTime(entry.createdAt) || '未标注时间'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭记录详情"><X size={17} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>
        <div className="album-detail-body">
          <div className="album-detail-meta">
            <span className="album-detail-color" style={{ backgroundColor: color || 'var(--line-strong)' }} aria-hidden="true" />
            <span>{color || '未记录颜色'}</span>
            <span>{hasIntensity ? `强度 ${entry.intensity}%` : '未记录强度'}</span>
            <span>{entry.visibility === 'anonymous' ? '匿名公开' : '仅自己可见'}</span>
          </div>
          <div className="album-detail-text">{entry.note || '这条记录没有写下文字。'}</div>
          <AlbumAudio voice={entry.voice} />
          {entry.voice?.transcript && (
            <div className="album-detail-transcript">
              <strong>语音转写文字</strong>
              <p>{entry.voice.transcript}</p>
            </div>
          )}
          <p className="album-detail-time">最后修改：{formatDateTime(entry.updatedAt) || '未记录修改时间'}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>关闭</button>
          <button type="button" className="save-btn compact-save" onClick={() => onEdit(entry)}><Pencil size={15} strokeWidth={1.7} aria-hidden="true" />编辑这条记录</button>
        </div>
      </div>
    </div>
  )
}

export default function Album({ entries, onUpdateEntry, onDeleteEntry, onNotify, favoriteColors, recentColors, onToggleFavorite }) {
  const [mode, setMode] = useState('timeline')
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ range: 'all', color: 'all', audio: 'all' })
  const [anchor, setAnchor] = useState(todayKey)
  const [selectedDate, setSelectedDate] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [audioDeleteFailed, setAudioDeleteFailed] = useState(false)

  const sorted = useMemo(() => sortByDateDesc(entries), [entries])
  const colors = useMemo(() => {
    const set = new Set()
    entries.forEach((entry) => { const color = entryColor(entry); if (color) set.add(color) })
    return [...set].sort()
  }, [entries])

  const filtered = useMemo(
    () => sorted.filter((entry) => matchesQuery(entry, query) && matchesFilters(entry, filters)),
    [sorted, query, filters],
  )

  const grouped = useMemo(() => {
    const { map, undated } = groupByDate(filtered)
    const dates = [...map.keys()].sort((a, b) => b.localeCompare(a))
    return { map, undated, dates }
  }, [filtered])

  const calendarDays = useMemo(() => monthKeys(anchor), [anchor])
  const calendarDateMap = useMemo(() => {
    const { map } = groupByDate(filtered)
    return map
  }, [filtered])
  const anchorDate = fromDateKey(anchor) || new Date()
  const monthLabel = `${anchorDate.getFullYear()}年${anchorDate.getMonth() + 1}月`
  const selectedDayEntries = selectedDate ? (calendarDateMap.get(selectedDate) || []) : []

  const activeFilterCount = (filters.range !== 'all' ? 1 : 0) + (filters.color !== 'all' ? 1 : 0) + (filters.audio !== 'all' ? 1 : 0)
  const hasAnyFilter = Boolean(query.trim()) || activeFilterCount > 0

  const clearAll = () => {
    setQuery('')
    setFilters({ range: 'all', color: 'all', audio: 'all' })
  }

  const chooseDate = (key) => {
    setSelectedDate(key)
    if (key) setAnchor(key)
  }

  const shiftMonth = (amount) => {
    const next = shiftDateKey(anchor, amount, 'month')
    setAnchor(next)
    setSelectedDate(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const audioId = deleteTarget.voice?.audioId
    if (audioId) {
      deleteAudio(audioId)
        .then(() => setAudioDeleteFailed(false))
        .catch(() => setAudioDeleteFailed(true))
    } else {
      setAudioDeleteFailed(false)
    }
    const wasPublic = deleteTarget.visibility === 'anonymous'
    onDeleteEntry?.(deleteTarget.id)
    setDetail(null)
    setDeleteTarget(null)
    onNotify?.(audioDeleteFailed
      ? (wasPublic ? '记录与树洞中的对应内容已撤回，但录音删除失败，请稍后重试。' : '记录已删除，但对应录音删除失败，请稍后重试。')
      : (wasPublic ? '记录已删除，树洞中的对应内容也已撤回。' : '这条记录已经删除。'))
  }

  const hasResults = filtered.length > 0

  return (
    <div className="subpage album-page">
      <header className="page-head album-head">
        <p className="eyebrow">THE ALBUM · 记录册</p>
        <h2>记录册</h2>
        <p className="page-desc">那些曾经出现过的情绪，都值得被认真收藏。</p>
        <span className="album-total">真实记录 {entries.length} 条</span>
      </header>

      <div className="album-toolbar">
        <label className="album-search">
          <Search size={15} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文字或转写内容"
            aria-label="搜索记录文字"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="清除搜索"><X size={14} aria-hidden="true" /></button>}
        </label>
        <div className="album-mode-switch" role="group" aria-label="浏览方式">
          <button type="button" className={mode === 'timeline' ? 'active' : ''} onClick={() => setMode('timeline')}>时间轴</button>
          <button type="button" className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')}>日历</button>
        </div>
        <button type="button" className={`album-filter-btn ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen((v) => !v)} aria-label="打开筛选">
          <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </div>

      {filtersOpen && (
        <section className="album-filters" aria-label="筛选条件">
          <label>
            时间
            <select value={filters.range} onChange={(event) => setFilters((v) => ({ ...v, range: event.target.value }))}>
              <option value="all">全部</option>
              <option value="7d">近7天</option>
              <option value="30d">近30天</option>
            </select>
          </label>
          <label>
            颜色
            <select value={filters.color} onChange={(event) => setFilters((v) => ({ ...v, color: event.target.value }))}>
              <option value="all">全部颜色</option>
              {colors.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
          </label>
          <label>
            录音
            <select value={filters.audio} onChange={(event) => setFilters((v) => ({ ...v, audio: event.target.value }))}>
              <option value="all">全部</option>
              <option value="with">包含录音</option>
              <option value="without">没有录音</option>
            </select>
          </label>
          {hasAnyFilter && <button type="button" className="text-btn" onClick={clearAll}>清除全部筛选</button>}
        </section>
      )}

      {entries.length === 0 ? (
        <p className="gentle-empty album-empty">{EMPTY}</p>
      ) : !hasResults ? (
        <p className="gentle-empty album-empty">没有找到符合条件的记录。换个词或清除筛选，再慢慢找找。</p>
      ) : mode === 'timeline' ? (
        <section className="album-timeline" aria-label="记录时间轴">
          {grouped.dates.map((key) => (
            <div className="timeline-group" key={key}>
              <div className="timeline-date">
                <strong>{formatFriendlyDate(key)}</strong>
                <span>{grouped.map.get(key).length} 条</span>
              </div>
              <div className="timeline-list">
                {grouped.map.get(key).map((entry) => (
                  <RecordCard key={entry.id} entry={entry} onOpen={setDetail} onEdit={setEditingEntry} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          ))}
          {grouped.undated.length > 0 && (
            <div className="timeline-group">
              <div className="timeline-date"><strong>未标注日期</strong><span>{grouped.undated.length} 条</span></div>
              <div className="timeline-list">
                {grouped.undated.map((entry) => (
                  <RecordCard key={entry.id} entry={entry} onOpen={setDetail} onEdit={setEditingEntry} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="album-calendar-view" aria-label="记录日历">
          <div className="album-nav">
            <button type="button" className="calendar-nav" onClick={() => shiftMonth(-1)} aria-label="上个月"><ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" /></button>
            <strong>{monthLabel}</strong>
            <button type="button" className="calendar-nav" onClick={() => shiftMonth(1)} aria-label="下个月"><ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
          <Calendar
            value={selectedDate}
            onChange={chooseDate}
            dayColors={Object.fromEntries([...calendarDateMap.entries()].map(([key, items]) => [key, entryColor(items[0]) || '']))}
            label="记录册月历"
          />
          {selectedDate ? (
            <div className="album-day-list">
              <div className="section-title-row">
                <h3>{formatFriendlyDate(selectedDate)}的记录</h3>
                <span className="count-tag">{selectedDayEntries.length} 条</span>
              </div>
              {selectedDayEntries.length ? selectedDayEntries.map((entry) => (
                <RecordCard key={entry.id} entry={entry} onOpen={setDetail} onEdit={setEditingEntry} onDelete={setDeleteTarget} compact />
              )) : (
                <p className="gentle-empty">这一天还没有记录。空白也是一种诚实的答案。</p>
              )}
            </div>
          ) : (
            <p className="gentle-empty">点一个日期，就能看到那天留下的记录。</p>
          )}
        </section>
      )}

      {detail && <DetailModal entry={detail} onClose={() => setDetail(null)} onEdit={(entry) => { setDetail(null); setEditingEntry(entry) }} />}

      {editingEntry && (
        <EntryEditor
          entry={editingEntry}
          onSave={(id, patch) => {
            onUpdateEntry?.(id, patch)
            setEditingEntry(null)
          }}
          onCancel={() => setEditingEntry(null)}
          favoriteColors={favoriteColors}
          recentColors={recentColors}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title="删除这条记录？"
          description="删除后无法恢复，记录册和情绪页面统计都会同步更新。若这条记录已匿名公开，树洞中的对应内容也会同步撤回。若有录音，也会一并从本机删除。"
          details={[deleteTarget.note || '这条记录没有文字']}
          confirmText="删除记录"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
