import { useEffect, useState } from 'react'
import { Check, Heart, X } from 'lucide-react'
import { getContrastColor, hexToHsl, hslToHex, moods, normalizeHex } from '../data/moods'

const tabs = [
  { id: 'classic', label: '经典色' },
  { id: 'custom', label: '自定义' },
  { id: 'favorite', label: '我的收藏' },
  { id: 'recent', label: '最近使用' },
]

export default function ColorSelector({ value, onChange, favoriteColors = [], recentColors = [], onToggleFavorite }) {
  const [tab, setTab] = useState('classic')
  const normalized = normalizeHex(value) || moods[0].color
  const [hexInput, setHexInput] = useState(normalized.slice(1))
  const hsl = hexToHsl(normalized)
  const isFavorite = favoriteColors.some((item) => item.toUpperCase() === normalized)

  useEffect(() => {
    setHexInput(normalized.slice(1))
  }, [normalized])

  const pick = (color, meta = {}) => onChange(color, meta)

  const commitHex = () => {
    const next = normalizeHex(hexInput)
    if (next) pick(next, { source: 'custom', name: '' })
    else setHexInput(normalized.slice(1))
  }

  const updateHsl = (key, nextValue) => {
    const next = { ...hsl, [key]: Number(nextValue) }
    pick(hslToHex(next.h, next.s, next.l), { source: 'custom', name: '' })
  }

  const renderSwatch = (color, meta, removable = false) => (
    <div className="saved-color" key={color}>
      <button
        type="button"
        className={`color-option compact ${normalized === color ? 'active' : ''}`}
        style={{ '--swatch': color, color: getContrastColor(color) }}
        onClick={() => pick(color, meta)}
        aria-pressed={normalized === color}
        title={color}
      >
        <span className="color-swatch">
          {normalized === color && <Check size={15} strokeWidth={2.4} aria-hidden="true" />}
        </span>
        <span className="color-name">{color.slice(1)}</span>
      </button>
      {removable && (
        <button
          type="button"
          className="remove-color"
          onClick={() => onToggleFavorite?.(color)}
          aria-label={`移除收藏 ${color}`}
          title="移除收藏"
        >
          <X size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div className="field color-field">
      <p className="field-label">01 &nbsp; 今天，你靠近哪一种颜色？</p>
      <p className="field-hint">颜色只是你的表达，不替你判断情绪好坏。</p>

      <div className="color-tabs" role="tablist" aria-label="颜色分类">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`color-tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'classic' && (
        <div className="color-grid" role="group" aria-label="经典色">
          {moods.map((mood) => {
            const active = normalized === mood.color
            return (
              <button
                key={mood.id}
                type="button"
                className={`color-option ${active ? 'active' : ''}`}
                style={{ '--swatch': mood.color, color: getContrastColor(mood.color) }}
                onClick={() => pick(mood.color, { id: mood.id, name: mood.label, source: 'classic' })}
                aria-pressed={active}
                title={mood.hint}
              >
                <span className="color-swatch">
                  {active && <Check size={17} strokeWidth={2.4} aria-hidden="true" />}
                </span>
                <span className="color-name">{mood.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'custom' && (
        <div className="custom-color">
          <div className="color-disc" role="group" aria-label="完整色盘">
            {Array.from({ length: 12 }, (_, index) => {
              const hue = index * 30
              const color = hslToHex(hue, 62, 72)
              return (
                <button
                  key={hue}
                  type="button"
                  className={`color-disc-item ${normalized.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => pick(color, { source: 'custom', name: '' })}
                  aria-label={`选择色相 ${hue} 度`}
                  title={`${color} · 色相 ${hue}°`}
                />
              )
            })}
          </div>
          <div className="custom-color-row">
            <label className="color-picker-wrap" style={{ background: normalized }} title="打开颜色选择器">
              <input
                type="color"
                value={normalized}
                onChange={(event) => pick(event.target.value, { source: 'custom', name: '' })}
                aria-label="选择自定义颜色"
              />
            </label>
            <div className="hex-field">
              <span aria-hidden="true">#</span>
              <input
                type="text"
                value={hexInput}
                maxLength={6}
                spellCheck={false}
                onChange={(event) => setHexInput(event.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase())}
                onBlur={commitHex}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitHex()
                }}
                aria-label="输入 HEX 色值"
              />
            </div>
            <span className="custom-color-preview" style={{ '--swatch': normalized }} aria-hidden="true" />
          </div>

          <div className="hsl-controls">
            <label className="hsl-control">
              <span>色相 <em>{hsl.h}°</em></span>
              <input
                type="range"
                min="0"
                max="360"
                value={hsl.h}
                className="range-input hue-slider"
                style={{ '--selected': normalized }}
                onChange={(event) => updateHsl('h', event.target.value)}
                aria-label="调整色相"
              />
            </label>
            <label className="hsl-control">
              <span>饱和度 <em>{hsl.s}%</em></span>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.s}
                className="range-input"
                style={{
                  '--selected': normalized,
                  background: `linear-gradient(to right, hsl(${hsl.h} 0% ${hsl.l}%), hsl(${hsl.h} 100% ${hsl.l}%))`,
                }}
                onChange={(event) => updateHsl('s', event.target.value)}
                aria-label="调整饱和度"
              />
            </label>
            <label className="hsl-control">
              <span>明度 <em>{hsl.l}%</em></span>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.l}
                className="range-input"
                style={{
                  '--selected': normalized,
                  background: `linear-gradient(to right, hsl(${hsl.h} ${hsl.s}% 10%), hsl(${hsl.h} ${hsl.s}% 90%))`,
                }}
                onChange={(event) => updateHsl('l', event.target.value)}
                aria-label="调整明度"
              />
            </label>
          </div>
        </div>
      )}

      {tab === 'favorite' && (
        favoriteColors.length ? (
          <div className="color-grid" role="group" aria-label="我的收藏">
            {favoriteColors.map((color) => renderSwatch(color, { source: 'favorite', name: '' }, true))}
          </div>
        ) : (
          <p className="color-empty">还没有收藏的颜色。选好后点下方的「收藏当前颜色」就可以保存。</p>
        )
      )}

      {tab === 'recent' && (
        recentColors.length ? (
          <div className="color-grid" role="group" aria-label="最近使用">
            {recentColors.map((color) => renderSwatch(color, { source: 'recent', name: '' }))}
          </div>
        ) : (
          <p className="color-empty">保存过记录后，这里会记得你最近用过的颜色。</p>
        )
      )}

      <div className="color-actions">
        <button
          type="button"
          className={`favorite-current ${isFavorite ? 'active' : ''}`}
          onClick={() => onToggleFavorite?.(normalized)}
        >
          <Heart size={14} strokeWidth={1.7} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          {isFavorite ? '已收藏当前颜色' : '收藏当前颜色'}
        </button>
        <span className="current-color-code">{normalized}</span>
      </div>
    </div>
  )
}
