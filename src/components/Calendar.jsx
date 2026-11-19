import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { fromDateKey, getMonthGrid, todayKey } from '../data/entries'

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

export default function Calendar({ value, onChange, dayColors = {}, label = '选择日期' }) {
  const [cursor, setCursor] = useState(() => {
    const initial = fromDateKey(value) || new Date()
    return { year: initial.getFullYear(), month: initial.getMonth() }
  })

  useEffect(() => {
    if (!value) return
    const date = fromDateKey(value)
    if (date) setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }, [value])

  const cells = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor.year, cursor.month])
  const today = todayKey()

  const shiftMonth = (amount) => {
    const date = new Date(cursor.year, cursor.month + amount, 1, 12)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }

  const goToday = () => {
    const date = fromDateKey(today)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
    onChange?.(today)
  }

  return (
    <div className="calendar" aria-label={label}>
      <div className="calendar-head">
        <button type="button" className="calendar-nav" onClick={() => shiftMonth(-1)} aria-label="上个月">
          <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <strong>{cursor.year}年{cursor.month + 1}月</strong>
        <div className="calendar-head-actions">
          <button type="button" className="calendar-today" onClick={goToday} aria-label="回到今天">
            <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
            今天
          </button>
          <button type="button" className="calendar-nav" onClick={() => shiftMonth(1)} aria-label="下个月">
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="calendar-grid">
        {cells.map((cell) => {
          const color = dayColors[cell.key]
          const selected = value === cell.key
          const isToday = cell.key === today
          return (
            <button
              key={cell.key}
              type="button"
              className={`calendar-cell ${cell.inMonth ? '' : 'outside'} ${selected ? 'selected' : ''} ${isToday ? 'today' : ''} ${color ? 'has-color' : ''}`}
              onClick={() => onChange?.(selected ? null : cell.key)}
              aria-label={`${cell.key}${color ? '，有记录' : ''}`}
              aria-pressed={selected}
            >
              <span className="calendar-day-number">{cell.day}</span>
              {color && <i className="calendar-color-dot" style={{ backgroundColor: color }} />}
              {isToday && <em className="calendar-today-mark">今</em>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
