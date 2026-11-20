import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Flag, Globe, Heart, Inbox, MessageCircle, Send, Shuffle, Sparkles, Star, Undo2, X } from 'lucide-react'
import Calendar from './Calendar'
import ConfirmDialog from './ConfirmDialog'
import FloatingField from './FloatingField'
import { STORAGE_KEYS } from '../data/storage'
import { formatDateTime, formatFriendlyDate, getDateKey, groupByDate, sortByDateDesc } from '../data/entries'

const NOTE_COOLDOWN_MS = 30_000
const REPORT_REASONS = ['不适当内容', '辱骂或骚扰', '广告或引流', '其他']

const NOTE_BLOCK_RULES = [
  { pattern: /(https?:\/\/|www\.|t\.me\/|discord\.gg\/)/i, message: '留言里暂时不能放链接。' },
  { pattern: /(加(微|微信|v|V)|微信号|qq群|QQ群|扫码|联系电话|联系方式|手机号)/i, message: '留言里暂时不能留联系方式或引流信息。' },
  { pattern: /(刷单|返利|兼职赚钱|日入|代开发票|博彩|贷款广告)/i, message: '这段内容看起来像广告，暂时不能发送。' },
  { pattern: /(去死|滚蛋|傻[逼bB]|废物|贱人|神经病|弄死你|杀了你)/i, message: '请温柔一点，这句话可能会伤到别人。' },
]

function hash(value) {
  return [...String(value)].reduce((total, char) => total + char.charCodeAt(0), 0)
}

function checkNoteSafety(text) {
  const hit = NOTE_BLOCK_RULES.find((rule) => rule.pattern.test(text))
  return hit?.message || ''
}

function readIdSet(key) {
  try {
    const raw = localStorage.getItem(key)
    const value = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(value) ? value.map(String) : [])
  } catch {
    return new Set()
  }
}

function persistIdSet(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    /* 本地存储不可用时，仅保留当前会话状态 */
  }
}

function readReportRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reportedComments)
    const value = raw ? JSON.parse(raw) : []
    if (!Array.isArray(value)) return []
    return value.map((entry) => {
      if (typeof entry === 'string') return { id: entry, reason: '' }
      if (entry && entry.id != null) return { id: String(entry.id), reason: String(entry.reason || '') }
      return null
    }).filter(Boolean)
  } catch {
    return []
  }
}

function persistReportRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEYS.reportedComments, JSON.stringify(records))
  } catch {
    /* 本地存储不可用时，仅保留当前会话状态 */
  }
}

function reactionState(reactions, targetId) {
  const mine = reactions.filter((item) => item.targetId === targetId && item.isMine)
  return {
    hugged: mine.some((item) => item.type === 'hug'),
    starred: mine.some((item) => item.type === 'star'),
    hugCount: reactions.filter((item) => item.targetId === targetId && item.type === 'hug').length,
    starCount: reactions.filter((item) => item.targetId === targetId && item.type === 'star').length,
  }
}

export default function TreeHole({ entries, treeItems, comments, reactions = [], profile, onRetract, onToggleReaction, onAddComment, onDeleteComment, onNotify }) {
  const [section, setSection] = useState('drift')
  const [selectedDate, setSelectedDate] = useState(null)
  const [sortMode, setSortMode] = useState('latest')
  const [seed, setSeed] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [echoDate, setEchoDate] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [retractTarget, setRetractTarget] = useState(null)
  const [bottleOpen, setBottleOpen] = useState(false)
  const [bottleVisible, setBottleVisible] = useState(() => Math.random() < 0.45)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')
  const [noteCooldown, setNoteCooldown] = useState(0)
  const [lastNoteAt, setLastNoteAt] = useState(() => {
    const value = Number(localStorage.getItem(STORAGE_KEYS.commentCooldown))
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const [hiddenNoteIds, setHiddenNoteIds] = useState(() => readIdSet(STORAGE_KEYS.hiddenComments))
  const [reportRecords, setReportRecords] = useState(readReportRecords)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [showHiddenNotes, setShowHiddenNotes] = useState(false)
  const reportedNoteIds = useMemo(
    () => new Set(reportRecords.map((record) => record.id)),
    [reportRecords],
  )
  const feedbackTimer = useRef(null)

  useEffect(() => {
    if (!lastNoteAt) {
      setNoteCooldown(0)
      return undefined
    }
    const update = () => setNoteCooldown(Math.max(0, NOTE_COOLDOWN_MS - (Date.now() - lastNoteAt)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [lastNoteAt])

  useEffect(() => {
    setNoteOpen(false)
    setNoteText('')
    setNoteError('')
    setShowHiddenNotes(false)
  }, [expandedId])

  useEffect(() => {
    if (!reportTarget) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setReportTarget(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reportTarget])

  const treeByEntryId = useMemo(() => {
    const map = new Map()
    treeItems.forEach((item) => {
      if (item.sourceEntryId != null) map.set(String(item.sourceEntryId), item)
    })
    return map
  }, [treeItems])

  const allItems = useMemo(() => sortByDateDesc(treeItems), [treeItems])

  const dayColors = useMemo(() => {
    const grouped = groupByDate(allItems)
    const colors = {}
    grouped.map.forEach((items, key) => {
      colors[key] = items[0]?.color
    })
    return colors
  }, [allItems])

  const visibleItems = useMemo(() => {
    const filtered = selectedDate
      ? allItems.filter((item) => getDateKey(item.publishedAt) === selectedDate)
      : allItems
    if (sortMode === 'random') {
      return [...filtered].sort((a, b) => hash(`${a.id}-${seed}`) - hash(`${b.id}-${seed}`))
    }
    return filtered
  }, [allItems, selectedDate, sortMode, seed])

  const myPublishedIds = useMemo(
    () => new Set(treeItems.filter((item) => item.sourceEntryId && !item.isDemo).map((item) => item.id)),
    [treeItems],
  )

  const echoList = useMemo(() => {
    const mine = reactions
      .filter((item) => item.isMine)
      .map((item) => ({
        id: item.id,
        targetId: item.targetId,
        type: item.type,
        author: '我（仅本机）',
        note: item.type === 'star' ? '送去了一颗星星。' : '送出了一个抱抱。',
        createdAt: item.createdAt,
        source: 'mine',
      }))
    const legacy = comments
      .filter((item) => showHiddenNotes || !hiddenNoteIds.has(String(item.id)))
      .map((item) => ({
        id: item.id,
        targetId: item.targetId,
        type: 'note',
        author: '一位匿名的人',
        note: item.text,
        createdAt: item.createdAt,
        source: 'local-note',
      }))
    return sortByDateDesc([...mine, ...legacy])
  }, [reactions, comments, hiddenNoteIds, showHiddenNotes])

  const echoDayColors = useMemo(() => {
    const colors = {}
    echoList.forEach((item) => {
      const key = getDateKey(item.createdAt)
      if (key && !colors[key]) colors[key] = '#A6C9DD'
    })
    return colors
  }, [echoList])

  const visibleEchoes = useMemo(
    () => (echoDate ? echoList.filter((item) => getDateKey(item.createdAt) === echoDate) : echoList),
    [echoList, echoDate],
  )

  const bottleItem = useMemo(() => allItems[1] || allItems[0] || null, [allItems])

  const goTo = (next) => {
    setSection(next)
    setExpandedId(null)
  }

  const refresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setExpandedId(null)
    setBottleOpen(false)
    window.setTimeout(() => {
      setSeed((value) => value + 1)
      setBottleVisible(Math.random() < 0.45)
      setIsRefreshing(false)
    }, 280)
  }

  const openCard = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const sendReaction = (item, type) => {
    onToggleReaction?.(item.id, type)
    setFeedback({ id: item.id, type })
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 620)
  }

  const submitNote = (item) => {
    const text = noteText.trim()
    if (!text) {
      setNoteError('写下一句再送出吧。')
      return
    }
    const safetyMessage = checkNoteSafety(text)
    if (safetyMessage) {
      setNoteError(safetyMessage)
      return
    }
    if (noteCooldown > 0) {
      setNoteError(`稍等 ${Math.ceil(noteCooldown / 1000)} 秒，再送下一条留言。`)
      return
    }
    if (onAddComment?.(item.id, text, item.color) === false) {
      setNoteError('这条留言暂时没有送出去，请再试一次。')
      return
    }
    const now = Date.now()
    setLastNoteAt(now)
    try {
      localStorage.setItem(STORAGE_KEYS.commentCooldown, String(now))
    } catch {
      /* 本地存储不可用时，冷却仅保留在当前会话 */
    }
    setNoteText('')
    setNoteError('')
    setNoteOpen(false)
    onNotify?.('匿名留言已经放在这条悄悄话下面，仅保存在这台设备上。')
  }

  const hideNote = (id) => {
    const next = new Set(hiddenNoteIds)
    next.add(String(id))
    setHiddenNoteIds(next)
    persistIdSet(STORAGE_KEYS.hiddenComments, next)
    onNotify?.('这条回复已经对你隐藏，举报与隐藏是分开的。')
  }

  const openReport = (note) => {
    const id = String(note.id)
    if (reportedNoteIds.has(id)) return
    setReportTarget({ id, text: note.text, isDemo: note.source === 'demo' })
    setReportReason('')
  }

  const confirmReport = () => {
    if (!reportTarget || !reportReason) return
    const next = [
      ...reportRecords.filter((record) => record.id !== reportTarget.id),
      { id: reportTarget.id, reason: reportReason },
    ]
    setReportRecords(next)
    persistReportRecords(next)
    setReportTarget(null)
    setReportReason('')
    onNotify?.(`已记录举报原因：${reportReason}（本地模拟，不会发送到服务器）。`)
  }

  const openEcho = (echo) => {
    const target = allItems.find((item) => item.id === echo.targetId)
    if (!target) {
      onNotify?.('这条回声对应的悄悄话已经不在当前的漂流中。')
      return
    }
    setSelectedDate(null)
    setSortMode('latest')
    setSection('drift')
    setExpandedId(echo.targetId)
  }

  const echoLabel = (echo) => {
    if (echo.type === 'hug') return '送来一个抱抱'
    if (echo.type === 'star') return '送来一颗星星'
    return '留下了一句话'
  }

  const excerpt = (targetId) => {
    const target = allItems.find((item) => item.id === targetId)
    return target ? (target.note || target.text) : '原悄悄话已撤回'
  }

  return (
    <div className="subpage tree-page">
      <div className="tree-decor" aria-hidden="true">
        <span className="tree-decor-night tree-night-veil" />
        <span className="tree-decor-day doodle-sun" />
        <span className="tree-decor-day doodle-cloud cloud-one" />
        <span className="tree-decor-day doodle-cloud cloud-two" />
        <span className="tree-decor-day doodle-leaf leaf-one" />
        <span className="tree-decor-day doodle-leaf leaf-two" />
        <span className="tree-decor-day doodle-flower flower-one" />
        <span className="tree-decor-day doodle-flower flower-two" />
        <span className="tree-decor-day doodle-dust dust-one" />
        <span className="tree-decor-day doodle-dust dust-two" />
      </div>

      <header className="page-head">
        <p className="eyebrow">THE HOLLOW · 漂流</p>
        <h2>让说不出口的话，先漂一会儿。</h2>
        <p className="page-desc">这里可以浏览匿名悄悄话，也可以送出一个抱抱或一颗星星。</p>
        <p className="demo-note">当前内容与回声均为本地演示，不会真的发送到其他人的设备。</p>
      </header>

      <div className="tree-section-switch" role="group" aria-label="树洞内容区域">
        <button
          type="button"
          className={section === 'drift' ? 'active' : ''}
          onClick={() => goTo('drift')}
          aria-pressed={section === 'drift'}
        >
          漂流中
        </button>
        <button
          type="button"
          className={section === 'echo' ? 'active' : ''}
          onClick={() => goTo('echo')}
          aria-pressed={section === 'echo'}
        >
          <Inbox size={14} strokeWidth={1.7} aria-hidden="true" />
          收到的回声
        </button>
      </div>

      {section === 'drift' && (
        <>
          <section className="tree-toolbar" aria-label="树洞操作">
            <div className="tree-mode-switch" role="group" aria-label="浏览方式">
              <button type="button" className={sortMode === 'latest' ? 'active' : ''} onClick={() => setSortMode('latest')}>
                最新排序
              </button>
              <button type="button" className={sortMode === 'random' ? 'active' : ''} onClick={refresh} disabled={isRefreshing}>
                <Shuffle size={13} strokeWidth={1.8} aria-hidden="true" />
                随机遇见
              </button>
            </div>
            <button type="button" className="tool-btn" onClick={() => setPublishOpen((value) => !value)}>
              <Globe size={15} strokeWidth={1.8} aria-hidden="true" />
              管理我的公开记录
            </button>
          </section>

          {publishOpen && (
            <section className="publish-panel" aria-label="我的公开记录管理">
              <div className="publish-panel-head">
                <h3>我的公开记录</h3>
                <button type="button" className="icon-btn" onClick={() => setPublishOpen(false)} aria-label="关闭公开记录管理">
                  <X size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
              <p className="publish-warning">公开状态在记录页选择一次即可。匿名公开的记录会自动出现在树洞，不需要再次确认；这里可以查看状态或撤回公开。当前仍是本地演示，不会上传到网络。</p>

              {entries.length === 0 ? (
                <p className="gentle-empty">你还没有自己的记录。先点中间的加号写一条吧。</p>
              ) : (
                <div className="publish-list">
                  {sortByDateDesc(entries).map((entry) => {
                    const treeItem = treeByEntryId.get(String(entry.id))
                    const isPublic = entry.visibility === 'anonymous' && Boolean(treeItem)
                    const legacyPublic = entry.visibility === 'anonymous' && !treeItem
                    return (
                      <div key={entry.id} className={`publish-option ${isPublic ? '' : 'disabled'}`}>
                        <span className="publish-color" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                        <span className="publish-text">
                          <em>{getDateKey(entry.createdAt) ? formatFriendlyDate(getDateKey(entry.createdAt)) : '未标注日期'}</em>
                          <strong>{entry.note}</strong>
                          <small>{isPublic ? '当前状态：匿名公开 · 已在树洞靠岸' : legacyPublic ? '旧记录 · 尚未同步到树洞' : '当前状态：仅自己可见'}</small>
                        </span>
                        {isPublic ? (
                          <button type="button" className="text-btn publish-retract" onClick={() => setRetractTarget(treeItem)}>撤回公开</button>
                        ) : (
                          <span className="published-tag">{legacyPublic ? '未同步' : '仅自己可见'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {visibleItems.length === 0 ? (
            <p className="gentle-empty">这里暂时没有新的悄悄话。换个日子看看吧。</p>
          ) : (
            <FloatingField
              items={visibleItems}
              expandedId={expandedId}
              renderItem={(item, index) => {
                const expanded = expandedId === item.id
                const state = reactionState(reactions, item.id)
                const shape = index % 4
                const hasFeedback = feedback?.id === item.id
                const itemNotes = comments.filter((comment) => String(comment.targetId) === String(item.id))
                const shownNotes = showHiddenNotes
                  ? itemNotes
                  : itemNotes.filter((note) => !hiddenNoteIds.has(String(note.id)))
                const itemDemoReplies = []
                const shownDemoReplies = showHiddenNotes
                  ? itemDemoReplies
                  : itemDemoReplies.filter((reply) => !hiddenNoteIds.has(String(reply.id)))
                const hiddenNoteCount = itemNotes.length - shownNotes.length + itemDemoReplies.length - shownDemoReplies.length
                const detailNotes = [...shownNotes, ...shownDemoReplies]
                return (
                  <article
                    className={`whisper-card shape-${shape} ${expanded ? 'expanded' : ''} ${isRefreshing ? 'is-refreshing' : ''}`}
                    style={{ '--whisper-color': item.color || '#A6C9DD' }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    onClick={() => openCard(item.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openCard(item.id)
                      }
                    }}
                  >
                    <div className="whisper-body">
                      <div className="whisper-meta">
                        {expanded && (
                          <span className="whisper-date">
                            {getDateKey(item.publishedAt) ? formatFriendlyDate(getDateKey(item.publishedAt)) : '未标注日期'}
                          </span>
                        )}
                        <span className="whisper-source">
                          <span className="source-short">{item.isDemo ? '演示' : '我的'}</span>
                          <span className="source-full">{item.isDemo ? '演示内容' : '我匿名分享的'}</span>
                        </span>
                      </div>
                      <p className="whisper-text">{item.note || item.text}</p>
                      <div className="whisper-stats">
                        <span className={state.hugCount ? 'has-reaction' : ''} aria-label={`${state.hugCount} 个抱抱`}>
                          <Heart size={13} strokeWidth={1.8} aria-hidden="true" />
                          <strong>{state.hugCount}</strong>
                          {expanded && <span className="stat-label">个抱抱</span>}
                        </span>
                        <span className={state.starCount ? 'has-reaction' : ''} aria-label={`${state.starCount} 颗星星`}>
                          <Star size={13} strokeWidth={1.8} aria-hidden="true" />
                          <strong>{state.starCount}</strong>
                          {expanded && <span className="stat-label">颗星星</span>}
                        </span>
                      </div>
                      {expanded && (
                        <div className="whisper-extra" onClick={(event) => event.stopPropagation()}>
                          <p className="reaction-lead">如果想回应，可以轻轻递过去。</p>
                          <div className="reaction-bar" role="group" aria-label="给这条悄悄话一点回应">
                            <button
                              type="button"
                              className={`reaction-btn hug ${state.hugged ? 'active' : ''} ${hasFeedback?.type === 'hug' ? 'is-feedback' : ''}`}
                              onClick={(event) => { event.stopPropagation(); sendReaction(item, 'hug') }}
                              aria-pressed={state.hugged}
                            >
                              <Heart size={15} strokeWidth={1.7} aria-hidden="true" />
                              <span>{state.hugged ? '已送出抱抱' : '抱抱'}</span>
                              {hasFeedback?.type === 'hug' && <span className="heart-burst" aria-hidden="true">♥ ♥ ♥</span>}
                            </button>
                            <button
                              type="button"
                              className={`reaction-btn star ${state.starred ? 'active' : ''} ${hasFeedback?.type === 'star' ? 'is-feedback' : ''}`}
                              onClick={(event) => { event.stopPropagation(); sendReaction(item, 'star') }}
                              aria-pressed={state.starred}
                            >
                              <Star size={15} strokeWidth={1.7} aria-hidden="true" />
                              <span>{state.starred ? '已送星星' : '送星星'}</span>
                              {hasFeedback?.type === 'star' && <span className="star-fly" aria-hidden="true">✦ ✦ ✦</span>}
                            </button>
                          </div>
                          <div className="anonymous-notes">
                            <div className="notes-heading">
                              <MessageCircle size={13} strokeWidth={1.8} aria-hidden="true" />
                              <span>匿名留话（{detailNotes.length}）</span>
                              <button
                                type="button"
                                className="text-btn"
                                onClick={() => {
                                  setNoteError('')
                                  setNoteOpen((value) => !value)
                                }}
                              >
                                {noteOpen ? '收起输入' : '匿名留话'}
                              </button>
                            </div>
                            <p className="local-demo-note">
                              本地模拟：留言只保存在这台设备上，不是真实陌生人发来的消息。
                              {itemDemoReplies.length > 0 && '标注「演示回复」的内容是预设示例。'}
                            </p>
                            {noteOpen && (
                              <div className="comment-compose anonymous-compose">
                                <textarea
                                  value={noteText}
                                  onChange={(event) => {
                                    setNoteText(event.target.value)
                                    if (noteError) setNoteError('')
                                  }}
                                  placeholder="把想说的话轻轻留在这里……"
                                  aria-label="匿名留言内容"
                                />
                                {noteError && <p className="note-error" role="alert">{noteError}</p>}
                                <div className="anonymous-actions">
                                  <button
                                    type="button"
                                    className="save-btn compact-save"
                                    onClick={() => submitNote(item)}
                                    disabled={noteCooldown > 0}
                                  >
                                    <Send size={14} strokeWidth={1.8} aria-hidden="true" />
                                    <span>{noteCooldown > 0 ? `请等待 ${Math.ceil(noteCooldown / 1000)} 秒` : '匿名送出'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="tool-btn"
                                    onClick={() => {
                                      setNoteOpen(false)
                                      setNoteText('')
                                      setNoteError('')
                                    }}
                                  >
                                    取消
                                  </button>
                                </div>
                                <p className="note-rule-hint">不限制字数和次数；两次发送至少间隔 30 秒；本地模拟不弹验证码，也不展示你的身份。</p>
                              </div>
                            )}
                            {detailNotes.length ? (
                              <div className="anonymous-note-list">
                                {detailNotes.map((note) => {
                                  const isDemoReply = note.source === 'demo'
                                  return (
                                    <article className={`anonymous-note ${isDemoReply ? 'demo-reply' : ''}`} key={note.id}>
                                      <p>{note.text}</p>
                                      <div className="note-foot">
                                        <span>{isDemoReply ? '演示回复' : `${formatDateTime(note.createdAt) || '刚刚'} · 匿名`}</span>
                                        <span className="note-actions">
                                          <button
                                            type="button"
                                            className="note-action"
                                            title="隐藏这条回复"
                                            aria-label="隐藏这条回复"
                                            onClick={() => hideNote(note.id)}
                                          >
                                            <EyeOff size={12} strokeWidth={1.8} aria-hidden="true" />
                                          </button>
                                          <button
                                            type="button"
                                            className="note-action"
                                            title={reportedNoteIds.has(String(note.id)) ? '已举报这条回复' : '举报这条回复'}
                                            aria-label={reportedNoteIds.has(String(note.id)) ? '已举报这条回复' : '举报这条回复'}
                                            disabled={reportedNoteIds.has(String(note.id))}
                                            onClick={() => openReport(note)}
                                          >
                                            <Flag size={12} strokeWidth={1.8} aria-hidden="true" />
                                          </button>
                                          {note.isMine && !isDemoReply && (
                                            <button
                                              type="button"
                                              className="note-action text-action"
                                              title="删除这条回复"
                                              aria-label="删除这条回复"
                                              onClick={() => onDeleteComment?.(note.id)}
                                            >
                                              删除
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    </article>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="gentle-empty small">还没有匿名留话。想说的话，可以轻轻放在这里。</p>
                            )}
                            {hiddenNoteCount > 0 && (
                              <button type="button" className="text-btn" onClick={() => setShowHiddenNotes((value) => !value)}>
                                {showHiddenNotes ? '重新隐藏这些留言' : `查看 ${hiddenNoteCount} 条已隐藏留言`}
                              </button>
                            )}
                          </div>
                          {myPublishedIds.has(item.id) && (
                            <button
                              type="button"
                              className="retract-btn"
                              onClick={(event) => { event.stopPropagation(); setRetractTarget(item) }}
                            >
                              <Undo2 size={14} strokeWidth={1.8} aria-hidden="true" />
                              撤回公开
                            </button>
                          )}
                          {item.isDemo && <p className="retract-note">演示内容不可撤回</p>}
                          <button type="button" className="whisper-close" onClick={(event) => { event.stopPropagation(); setExpandedId(null) }}>
                            <X size={14} strokeWidth={1.8} aria-hidden="true" />
                            收好，让它继续漂
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              }}
            />
          )}

          <section className="tree-calendar-wrap" aria-label="按日期查看悄悄话">
            <div className="section-title-row">
              <h3>按日期寻找一只瓶子</h3>
              {selectedDate && <button type="button" className="text-btn" onClick={() => setSelectedDate(null)}>清除筛选</button>}
            </div>
            <Calendar value={selectedDate} onChange={setSelectedDate} dayColors={dayColors} label="树洞日期筛选" />
          </section>

          {!isRefreshing && bottleVisible && bottleItem && (
            <button
              type="button"
              className="drift-bottle"
              onClick={() => setBottleOpen(true)}
              aria-label="打开偶尔漂来的漂流瓶"
              title="一只偶尔漂来的瓶子"
            >
              <span className="drift-bottle-glow" aria-hidden="true" />
              <Sparkles size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        </>
      )}

      {section === 'echo' && (
        <section className="echo-area" aria-label="收到的回声">
          <div className="echo-intro">
            <h3>轻轻落在你分享上的回应</h3>
            <p>这里的回声来自本机演示和你自己留下的匿名留言，不会同步给其他人，也不是真实陌生人发来的消息。点开一条，就能看到它回应的是哪一片心情。</p>
          </div>
          <div className="comment-filter">
            <div className="section-title-row">
              <h4>按日期查看</h4>
              {echoDate && <button type="button" className="text-btn" onClick={() => setEchoDate(null)}>查看全部</button>}
            </div>
            <Calendar value={echoDate} onChange={setEchoDate} dayColors={echoDayColors} label="回声日期筛选" />
          </div>
          {visibleEchoes.length ? (
            <div className="echo-list">
              {visibleEchoes.map((echo) => (
                <article className="echo-item" key={echo.id}>
                  <div className="echo-head">
                    <span className={`echo-icon ${echo.type}`} aria-hidden="true">
                      {echo.type === 'hug'
                        ? <Heart size={14} strokeWidth={1.7} />
                        : echo.type === 'star'
                          ? <Star size={14} strokeWidth={1.7} />
                          : <MessageCircle size={14} strokeWidth={1.7} />}
                    </span>
                    <span>{echo.author} · {echoLabel(echo)}</span>
                    <span className="echo-local-tag">{echo.source === 'demo' ? '本地演示' : '本地模拟'}</span>
                    <time>{formatDateTime(echo.createdAt) || '未标注时间'}</time>
                  </div>
                  <p className="echo-note">{echo.note}</p>
                  <div className="echo-source">
                    <span>回应的是：{excerpt(echo.targetId)}</span>
                    <button type="button" className="text-btn" onClick={() => openEcho(echo)}>查看原来的内容</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="gentle-empty">这里暂时没有符合条件的回声。先匿名分享一条心情吧。</p>
          )}
        </section>
      )}

      {bottleOpen && bottleItem && (
        <div className="bottle-modal-backdrop" onClick={() => setBottleOpen(false)}>
          <div
            className="bottle-modal"
            role="dialog"
            aria-modal="true"
            aria-label="漂流瓶中的匿名内容"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bottle-modal-head">
              <p className="panel-kicker">A BOTTLE · 漂流瓶</p>
              <button type="button" className="icon-btn" onClick={() => setBottleOpen(false)} aria-label="关闭漂流瓶">
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <p className="bottle-modal-text">{bottleItem.note || bottleItem.text}</p>
            <p className="bottle-modal-meta">
              {getDateKey(bottleItem.publishedAt) ? formatFriendlyDate(getDateKey(bottleItem.publishedAt)) : '未标注日期'} · 本地演示内容
            </p>
            <button type="button" className="text-btn" onClick={() => {
              setBottleOpen(false)
              setSelectedDate(null)
              setSortMode('latest')
              setSection('drift')
              setExpandedId(bottleItem.id)
            }}>
              看看它漂到哪里
            </button>
          </div>
        </div>
      )}

      {retractTarget && (
        <ConfirmDialog
          tone="danger"
          title="撤回这条公开记录？"
          description="撤回后，这条内容会从树洞消失，原始记录仍保留在你的记录册。已有的匿名留言、星星和抱抱会继续保存在本机。"
          details={[retractTarget.note]}
          confirmText="撤回公开"
          onCancel={() => setRetractTarget(null)}
          onConfirm={() => {
            onRetract?.(retractTarget.id)
            setRetractTarget(null)
            setExpandedId(null)
          }}
        />
      )}

      {reportTarget && (
        <div className="modal-overlay confirm-overlay" onMouseDown={() => setReportTarget(null)} role="presentation">
          <div
            className="modal-card confirm-card report-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="icon-btn confirm-close"
              onClick={() => setReportTarget(null)}
              aria-label="关闭举报窗口"
            >
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="confirm-icon" aria-hidden="true"><Flag size={20} strokeWidth={1.7} /></span>
            <h2 id="report-title">举报这条回复</h2>
            <p className="confirm-description">请选择一个原因。当前为本地原型，举报只会记录在这台设备上，不会发送到服务器。</p>
            {reportTarget.isDemo && <p className="report-demo-note">这是一条演示回复。</p>}
            <div className="report-reasons" role="radiogroup" aria-label="举报原因">
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className={`report-reason ${reportReason === reason ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setReportTarget(null)}>取消</button>
              <button type="button" className="save-btn compact-save" disabled={!reportReason} onClick={confirmReport}>记录举报</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
