import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, Mail, Pencil, Send, Trash2, X } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { formatFriendlyDate, shiftDateKey, todayKey } from '../data/entries'
import {
  clearLetterDraft,
  createLetter,
  daysUntil,
  isValidFutureDate,
  isValidPastDate,
  letterStatus,
  persistLetterDraft,
  persistLetters,
  readLetterDraft,
  readLetters,
  sortLetters,
} from '../data/letters'

const EMPTY = '还没有寄出的信。有些话，可以等你准备好了再写。'

function LetterComposer({ type, draft, editing = false, onSave, onCancel, onNotify }) {
  const [title, setTitle] = useState(draft?.title || '')
  const [writtenOn, setWrittenOn] = useState(draft?.writtenOn || todayKey())
  const [targetDate, setTargetDate] = useState(draft?.targetDate || '')
  const [body, setBody] = useState(draft?.body || '')
  const isFuture = type === 'future'

  useEffect(() => {
    if (editing) return
    persistLetterDraft({ type, title, writtenOn, targetDate, body })
  }, [editing, type, title, writtenOn, targetDate, body])

  const targetInvalid = targetDate
    ? (isFuture ? !isValidFutureDate(targetDate, writtenOn) : !isValidPastDate(targetDate, writtenOn))
    : false

  const submit = () => {
    if (!body.trim()) {
      onNotify?.('先写下一些话，再寄出这封信吧。')
      return
    }
    if (!targetDate || targetInvalid) {
      onNotify?.(isFuture ? '开启日期需要晚于写信日期。' : '寄回日期不能晚于写信日期。')
      return
    }
    onSave(createLetter({ type, title: title.trim(), writtenOn, targetDate, body: body.trim() }))
  }

  return (
    <section className="letter-composer" aria-labelledby="composer-title">
      <div className="composer-head">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="返回时光机"><ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" /></button>
        <div>
          <p className="panel-kicker">{isFuture ? 'TO THE FUTURE' : 'TO THE PAST'}</p>
          <h3 id="composer-title">{isFuture ? '写给未来的自己' : '写给过去的自己'}</h3>
        </div>
      </div>
      <p className="composer-hint">信默认只属于你自己，不会公开，也不会进入情绪统计。本地清除数据后可能无法恢复。</p>

      <label className="composer-field">
        信件标题（可不填）
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这封信一个名字" />
      </label>
      <div className="composer-row">
        <label className="composer-field">
          写信日期
          <input type="date" value={writtenOn} onChange={(event) => setWrittenOn(event.target.value)} />
        </label>
        <label className="composer-field">
          {isFuture ? '开启日期' : '寄回日期'}
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            min={isFuture ? shiftDateKey(writtenOn, 1) : undefined}
            max={!isFuture ? writtenOn : undefined}
          />
        </label>
      </div>
      {targetInvalid && (
        <p className="composer-error">{isFuture ? '开启日期必须晚于写信日期。' : '寄回日期不能晚于写信日期。'}</p>
      )}
      <label className="composer-field">
        信件正文
        <textarea rows={9} value={body} onChange={(event) => setBody(event.target.value)} placeholder="想对自己说些什么……" />
      </label>
      <div className="composer-actions">
        <span className="draft-status">草稿已自动保存在本机</span>
        <button type="button" className="ghost-btn" onClick={onCancel}>稍后再写</button>
        <button type="button" className="save-btn compact-save" onClick={submit} disabled={!body.trim() || !targetDate || targetInvalid}>
          <Send size={15} strokeWidth={1.7} aria-hidden="true" />
          {isFuture ? '封存给未来' : '寄回那一天'}
        </button>
      </div>
    </section>
  )
}

function LetterDetail({ letter, status, referenceKey, onClose, onEdit, onDelete }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const canEdit = letter.type === 'past' || status === 'sealed'
  const remaining = daysUntil(letter, referenceKey)

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal-card letter-detail-modal" role="dialog" aria-modal="true" aria-labelledby="letter-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="panel-kicker">A LETTER · 一封信</p>
            <h2 id="letter-detail-title">{letter.title || (letter.type === 'past' ? '寄回过去' : '寄给未来')}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭信件"><X size={17} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>
        <div className="letter-detail-body">
          <div className="letter-detail-meta">
            <span>写信日期：{formatFriendlyDate(letter.writtenOn) || letter.writtenOn}</span>
            <span>{letter.type === 'past' ? '寄回' : '开启日期'}：{formatFriendlyDate(letter.targetDate) || letter.targetDate}</span>
            <span>{status === 'ready' ? (letter.type === 'future' ? '已开启' : '可阅读') : `待开启 · 还有 ${remaining} 天`}</span>
          </div>
          {status === 'sealed' ? (
            <div className="letter-sealed-note">
              <Clock3 size={18} strokeWidth={1.6} aria-hidden="true" />
              <p>这封信还在封存中。到 {formatFriendlyDate(letter.targetDate)} 就可以拆开阅读了。</p>
            </div>
          ) : (
            <div className={`letter-detail-text ${letter.type === 'future' ? 'just-opened' : ''}`} key={letter.openedAt || 'open'}>{letter.body}</div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-btn danger" onClick={onDelete}><Trash2 size={14} strokeWidth={1.7} aria-hidden="true" />删除</button>
          {canEdit && <button type="button" className="save-btn compact-save" onClick={onEdit}><Pencil size={14} strokeWidth={1.7} aria-hidden="true" />编辑信件</button>}
        </div>
      </div>
    </div>
  )
}

export default function TimeMachine({ onNotify }) {
  const [letters, setLetters] = useState(() => readLetters())
  const [referenceKey, setReferenceKey] = useState(() => todayKey())
  const [composer, setComposer] = useState(null)
  const [draft, setDraft] = useState(() => readLetterDraft())
  const [detailId, setDetailId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setLetters(readLetters())
    setReferenceKey(todayKey())
    const timer = window.setInterval(() => {
      const current = todayKey()
      setReferenceKey((previous) => (previous === current ? previous : current))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [])

  const decorated = useMemo(
    () => sortLetters(letters).map((letter) => ({ letter, status: letterStatus(letter, referenceKey) })),
    [letters, referenceKey],
  )

  const sealed = decorated.filter((item) => item.status === 'sealed')
  const replies = decorated.filter((item) => item.status === 'ready' || item.status === 'invalid')
  const detailItem = decorated.find((item) => item.letter.id === detailId) || null

  const update = (next) => {
    setLetters(next)
    if (!persistLetters(next)) onNotify?.('信件保存失败，请检查本地存储空间。')
  }

  const openComposer = (type) => {
    setDraft(readLetterDraft())
    setComposer(type)
    setNotice('')
  }

  const saveLetter = (letter) => {
    update([letter, ...letters])
    clearLetterDraft()
    setDraft(null)
    setComposer(null)
    setNotice(letter.type === 'future' ? '信已经封存，到开启日期才能读到正文。' : '信已经寄回那一天。')
    onNotify?.(letter.type === 'future' ? '信已经封存。' : '信已经寄出。')
  }

  const updateLetter = (id, patch) => {
    const next = letters.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item))
    update(next)
    setEditing(null)
    setDetailId(null)
    onNotify?.('信件已经更新。')
  }

  const removeLetter = () => {
    if (!deleteTarget) return
    update(letters.filter((item) => item.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDetailId(null)
    onNotify?.('信件已经删除。')
  }

  if (composer) {
    return (
      <div className="subpage time-page">
        <LetterComposer
          type={composer}
          draft={draft?.type === composer ? draft : null}
          onSave={saveLetter}
          onCancel={() => { setComposer(null); setDraft(readLetterDraft()) }}
          onNotify={onNotify}
        />
      </div>
    )
  }

  if (editing) {
    return (
      <div className="subpage time-page">
        <LetterComposer
          type={editing.type}
          draft={editing}
          editing
          onSave={(letter) => updateLetter(editing.id, {
            title: letter.title,
            writtenOn: letter.writtenOn,
            targetDate: letter.targetDate,
            body: letter.body,
          })}
          onCancel={() => setEditing(null)}
          onNotify={onNotify}
        />
      </div>
    )
  }

  return (
    <div className="subpage time-page">
      <div className="time-decor" aria-hidden="true">
        <span className="time-envelope env-one" />
        <span className="time-envelope env-two" />
        <span className="time-star star-one" />
        <span className="time-star star-two" />
      </div>

      <header className="page-head">
        <p className="eyebrow">TIME MACHINE · 时光机</p>
        <h2>时光机</h2>
        <p className="page-desc">有些话，想留给未来的自己；有些心情，想寄回曾经的时光。</p>
        <p className="demo-note">信件只保存在这台设备上，清除本地数据后可能无法恢复。没有后台推送，开启状态在你再次打开时光机时检查。</p>
      </header>

      {notice && <p className="letter-notice">{notice}</p>}

      <section className="time-compose" aria-label="写一封信">
        <div className="section-title-row"><h3>写一封信</h3></div>
        <div className="time-compose-grid">
          <button type="button" className="compose-entry past" onClick={() => openComposer('past')}>
            <Mail size={20} strokeWidth={1.5} aria-hidden="true" />
            <strong>写给过去的自己</strong>
            <span>选一个已经过去的日子，把话寄回去。写好后就能读。</span>
          </button>
          <button type="button" className="compose-entry future" onClick={() => openComposer('future')}>
            <Clock3 size={20} strokeWidth={1.5} aria-hidden="true" />
            <strong>写给未来的自己</strong>
            <span>选一个还没到来的日子，信会安静封存，到那天再打开。</span>
          </button>
        </div>
        {draft && (
          <button type="button" className="text-btn draft-resume" onClick={() => { setComposer(draft.type); setDraft(readLetterDraft()) }}>
            继续写上次未完成的{draft.type === 'past' ? '过去' : '未来'}之信
          </button>
        )}
      </section>

      <section className="time-sealed" aria-label="待开启的信">
        <div className="section-title-row">
          <h3>待开启的信</h3>
          <span className="count-tag">{sealed.length} 封</span>
        </div>
        {sealed.length ? (
          <div className="sealed-list">
            {sealed.map(({ letter }) => {
              const remaining = daysUntil(letter, referenceKey)
              return (
                <button type="button" className="sealed-card" key={letter.id} onClick={() => setDetailId(letter.id)}>
                  <span className="sealed-icon" aria-hidden="true">✦</span>
                  <span className="sealed-info">
                    <strong>{letter.title || '写给未来的自己'}</strong>
                    <span>写信：{formatFriendlyDate(letter.writtenOn) || letter.writtenOn}</span>
                    <span>开启：{formatFriendlyDate(letter.targetDate) || letter.targetDate}</span>
                    <span>还有 {remaining} 天 · 封存中</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="gentle-empty">没有正在封存的信。想对未来的自己说点什么，随时可以写。</p>
        )}
      </section>

      <section className="time-replies" aria-label="时光回信">
        <div className="section-title-row">
          <h3>时光回信</h3>
          <span className="count-tag">{replies.length} 封</span>
        </div>
        {replies.length ? (
          <div className="reply-list">
            {replies.map(({ letter }) => (
              <button type="button" className="reply-card" key={letter.id} onClick={() => setDetailId(letter.id)}>
                <span className="reply-date">{formatFriendlyDate(letter.targetDate) || letter.targetDate}</span>
                <strong>{letter.title || (letter.type === 'past' ? '寄回过去' : '寄给未来')}</strong>
                <span className="reply-excerpt">{letter.type === 'future' ? '这封信已经可以开启' : '写给过去的自己'}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="gentle-empty">{EMPTY}</p>
        )}
      </section>

      {detailItem && (
        <LetterDetail
          letter={detailItem.letter}
          status={detailItem.status}
          referenceKey={referenceKey}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const letter = detailItem.letter
            setDetailId(null)
            setEditing(letter)
          }}
          onDelete={() => setDeleteTarget(detailItem.letter)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title="删除这封信？"
          description="删除后无法恢复，本地数据清除后信件也可能无法找回。"
          details={[deleteTarget.title || (deleteTarget.type === 'past' ? '寄回过去' : '寄给未来')]}
          confirmText="删除信件"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeLetter}
        />
      )}
    </div>
  )
}
