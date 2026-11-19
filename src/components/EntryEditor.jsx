import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { applyIntensity, moods, normalizeHex } from '../data/moods'
import { getDateKey } from '../data/entries'
import ColorSelector from './ColorSelector'
import IntensitySlider from './IntensitySlider'
import NoteInput from './NoteInput'
import VoiceRecorder from './VoiceRecorder'
import VisibilityToggle from './VisibilityToggle'

export default function EntryEditor({ entry, onSave, onCancel, favoriteColors, recentColors, onToggleFavorite, allowDateEdit = false }) {
  const [baseColor, setBaseColor] = useState(() => normalizeHex(entry.baseColor || entry.color) || moods[0].color)
  const [colorName, setColorName] = useState(entry.colorName || entry.moodLabel || '')
  const [colorId, setColorId] = useState(entry.moodId || 'custom')
  const [intensity, setIntensity] = useState(Number(entry.intensity) || 45)
  const [note, setNote] = useState(entry.note || '')
  const [visibility, setVisibility] = useState(entry.visibility === 'anonymous' ? 'anonymous' : 'private')
  const [voice, setVoice] = useState(entry.voice || null)
  const [dateEnabled, setDateEnabled] = useState(false)
  const [dateValue, setDateValue] = useState(() => getDateKey(entry.createdAt) || '')
  const color = applyIntensity(baseColor, intensity)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleColorChange = (nextColor, meta = {}) => {
    setBaseColor(nextColor)
    setColorName(meta.name || '')
    setColorId(meta.id || 'custom')
  }

  const handleSave = () => {
    const patch = {
      moodId: colorId,
      moodLabel: colorName,
      color,
      baseColor,
      colorName,
      intensity,
      note: note.trim() || '今天没有写下文字，但也认真感受过了。',
      visibility,
      voice: voice?.audioId ? {
        audioId: voice.audioId,
        mimeType: voice.mimeType || '',
        duration: voice.duration || 0,
        transcript: typeof voice.transcript === 'string' ? voice.transcript : '',
        transcriptStatus: voice.transcriptStatus || 'idle',
      } : null,
    }
    if (allowDateEdit && dateEnabled && dateValue) {
      patch.createdAt = new Date(`${dateValue}T12:00:00`).toISOString()
    }
    onSave?.(entry.id, patch)
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel} role="presentation">
      <div
        className="modal-card entry-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="panel-kicker">EDIT RECORD</p>
            <h2 id="editor-title">编辑这条记录</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="关闭编辑">
            <X size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <div className="editor-body">
          <ColorSelector
            value={baseColor}
            onChange={handleColorChange}
            favoriteColors={favoriteColors}
            recentColors={recentColors}
            onToggleFavorite={onToggleFavorite}
          />
          <IntensitySlider value={intensity} onChange={setIntensity} color={color} />
          <NoteInput value={note} onChange={setNote} />
          <VoiceRecorder value={voice} onChange={setVoice} />
          <VisibilityToggle value={visibility} onChange={setVisibility} />

          {allowDateEdit && (
            <div className="field editor-date-field">
              <label className="editor-date-toggle">
                <input type="checkbox" checked={dateEnabled} onChange={(event) => setDateEnabled(event.target.checked)} />
                修改原始记录日期
              </label>
              {dateEnabled ? (
                <input type="date" className="editor-date-input" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
              ) : (
                <p className="editor-date-hint">原日期不会被修改，除非你主动勾选这里。</p>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>取消</button>
          <button type="button" className="save-btn compact-save" onClick={handleSave}>
            <Check size={16} strokeWidth={1.8} aria-hidden="true" />
            保存修改
          </button>
        </div>
      </div>
    </div>
  )
}
