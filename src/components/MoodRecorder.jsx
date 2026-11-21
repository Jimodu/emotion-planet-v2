import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { applyIntensity, moods, normalizeHex } from '../data/moods'
import { clearDraft, STORAGE_KEYS } from '../data/storage'
import { deleteAudio } from '../data/audioStore'
import ColorSelector from './ColorSelector'
import ConfirmDialog from './ConfirmDialog'
import IntensitySlider from './IntensitySlider'
import NoteInput from './NoteInput'
import VoiceRecorder from './VoiceRecorder'
import VisibilityToggle from './VisibilityToggle'

const defaults = {
  baseColor: moods[0].color,
  colorName: '',
  colorId: moods[0].id,
  intensity: 45,
  note: '',
  visibility: 'private',
  voice: null,
}

function readDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.draft)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || typeof draft !== 'object') return null
    const voice = draft.voice && typeof draft.voice === 'object' ? {
      audioId: typeof draft.voice.audioId === 'string' ? draft.voice.audioId : '',
      mimeType: typeof draft.voice.mimeType === 'string' ? draft.voice.mimeType : '',
      duration: Math.max(0, Number(draft.voice.duration) || 0),
      transcript: typeof draft.voice.transcript === 'string' ? draft.voice.transcript : '',
      transcriptStatus: typeof draft.voice.transcriptStatus === 'string' ? draft.voice.transcriptStatus : 'idle',
    } : null
    return {
      baseColor: normalizeHex(draft.baseColor) || defaults.baseColor,
      colorName: typeof draft.colorName === 'string' ? draft.colorName : '',
      colorId: typeof draft.colorId === 'string' ? draft.colorId : defaults.colorId,
      intensity: Math.min(100, Math.max(0, Number(draft.intensity) || 45)),
      note: typeof draft.note === 'string' ? draft.note : '',
      visibility: draft.visibility === 'anonymous' ? 'anonymous' : 'private',
      voice,
    }
  } catch {
    return null
  }
}

export default function MoodRecorder({ onSave, onNotify, onCancel, favoriteColors, recentColors, onToggleFavorite }) {
  const [draft] = useState(readDraft)
  const [baseColor, setBaseColor] = useState(draft?.baseColor || defaults.baseColor)
  const [colorName, setColorName] = useState(draft?.colorName || defaults.colorName)
  const [colorId, setColorId] = useState(draft?.colorId || defaults.colorId)
  const [intensity, setIntensity] = useState(draft?.intensity ?? defaults.intensity)
  const [note, setNote] = useState(draft?.note || defaults.note)
  const [visibility, setVisibility] = useState(draft?.visibility || defaults.visibility)
  const [voice, setVoice] = useState(draft?.voice || null)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [senseInputActive, setSenseInputActive] = useState(false)
  const [hasDraft, setHasDraft] = useState(Boolean(draft))
  const [clearOpen, setClearOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirtyRef = useRef(false)
  const color = applyIntensity(baseColor, intensity)

  useEffect(() => {
    if (!dirtyRef.current) return
    try {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ baseColor, colorName, colorId, intensity, note, visibility, voice }))
    } catch {
      /* 本地存储不可用时，仅保留当前会话数据 */
    }
  }, [baseColor, colorName, colorId, intensity, note, visibility, voice])

  const markDirty = () => {
    dirtyRef.current = true
    setHasDraft(true)
  }

  const handleColorChange = (nextColor, meta = {}) => {
    markDirty()
    setBaseColor(nextColor)
    setColorName(meta.name || '')
    setColorId(meta.id || 'custom')
  }

  const handleNoteChange = (value) => {
    markDirty()
    setNote(value)
  }

  const handleIntensityChange = (value) => {
    markDirty()
    setIntensity(value)
  }

  const handleVisibilityChange = (value) => {
    markDirty()
    setVisibility(value)
  }

  const handleVoiceChange = (next) => {
    markDirty()
    setVoice(next)
  }

  const resetForm = () => {
    setBaseColor(defaults.baseColor)
    setColorName(defaults.colorName)
    setColorId(defaults.colorId)
    setIntensity(defaults.intensity)
    setNote(defaults.note)
    setVisibility(defaults.visibility)
    setVoice(null)
  }

  const clearDraftNow = () => {
    const removed = voice?.audioId
      ? deleteAudio(voice.audioId).then(() => true).catch(() => false)
      : Promise.resolve(true)
    clearDraft()
    dirtyRef.current = false
    setHasDraft(false)
    setClearOpen(false)
    resetForm()
    removed.then((ok) => {
      onNotify?.(ok
        ? '草稿已经清空。'
        : '草稿已清空，但录音文件删除失败，可能仍留在浏览器中。')
    })
  }

  const cancelNow = () => {
    setCancelOpen(false)
    resetForm()
    onCancel?.()
  }

  const handleSave = () => {
    if (saving) return
    const trimmed = note.trim()
    if (!trimmed && !voice?.audioId && !voice?.transcript?.trim()) {
      onNotify?.('写下一句，或者录一段声音，再保存吧。')
      return
    }
    setSaving(true)
    const now = new Date().toISOString()
    onSave?.({
      id: Date.now(),
      moodId: colorId,
      moodLabel: colorName,
      color,
      baseColor,
      colorName,
      intensity,
      note: trimmed || (voice?.transcript || '').trim() || '这一天没有写下文字，但认真感受过了。',
      visibility,
      voice: voice?.audioId ? {
        audioId: voice.audioId,
        mimeType: voice.mimeType || '',
        duration: voice.duration || 0,
        transcript: typeof voice.transcript === 'string' ? voice.transcript : '',
        transcriptStatus: voice.transcriptStatus || 'idle',
      } : null,
      createdAt: now,
      updatedAt: now,
    })
    clearDraft()
    dirtyRef.current = false
    setHasDraft(false)
    resetForm()
    window.setTimeout(() => setSaving(false), 600)
  }

  return (
    <section className="mood-panel" aria-labelledby="record-title">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">A NEW RECORD</p>
          <h2 id="record-title">慢慢记下这一刻</h2>
        </div>
        <div className="panel-head-side">
          {hasDraft && <span className="draft-status">草稿已保存</span>}
          {onCancel && (
            <button type="button" className="icon-btn" onClick={() => setCancelOpen(true)} aria-label="取消记录">
              <X size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          <span className="panel-mark" aria-hidden="true" />
        </div>
      </div>

      <ColorSelector
        value={baseColor}
        onChange={handleColorChange}
        favoriteColors={favoriteColors}
        recentColors={recentColors}
        onToggleFavorite={onToggleFavorite}
      />
      <IntensitySlider value={intensity} onChange={handleIntensityChange} color={color} />
      <NoteInput
        value={note}
        onChange={handleNoteChange}
        speechDisabled={voiceRecording}
        onActiveChange={setSenseInputActive}
      />
      <VoiceRecorder
        value={voice}
        onChange={handleVoiceChange}
        onNotify={onNotify}
        onActiveChange={setVoiceRecording}
        disabled={senseInputActive}
      />
      <VisibilityToggle value={visibility} onChange={handleVisibilityChange} />

      <div className="record-actions">
        {onCancel && (
          <button type="button" className="ghost-btn" onClick={() => setCancelOpen(true)}>取消</button>
        )}
        <button type="button" className="save-btn" onClick={handleSave} disabled={saving}>
          <Sparkles size={16} strokeWidth={1.6} aria-hidden="true" />
          {saving ? '正在轻轻收好…' : '让这份心情，在这里靠岸。'}
          <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
      <div className="record-footer-row">
        <p className="panel-footnote">不用写得很好，真实就已经足够。</p>
        {hasDraft && (
          <button type="button" className="text-btn draft-clear" onClick={() => setClearOpen(true)}>清空草稿</button>
        )}
      </div>

      {clearOpen && (
        <ConfirmDialog
          title="清空当前草稿？"
          description="清空后，未保存的文字、颜色、深浅、录音和可见范围都会恢复默认。"
          details={['当前输入的文字', '已选颜色与深浅', '录音与转写文字', '可见范围选择']}
          confirmText="清空草稿"
          onCancel={() => setClearOpen(false)}
          onConfirm={clearDraftNow}
        />
      )}

      {cancelOpen && (
        <ConfirmDialog
          title="离开这次记录？"
          description="草稿会继续保留，下次点加号时可以接着写。录音也会留在本地。"
          details={['草稿会保留', '录音不会丢失']}
          confirmText="离开记录"
          cancelText="继续记录"
          onCancel={() => setCancelOpen(false)}
          onConfirm={cancelNow}
        />
      )}
    </section>
  )
}
