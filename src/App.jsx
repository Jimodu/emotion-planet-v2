import { useEffect, useState } from 'react'
import { normalizeHex } from './data/moods'
import { getDateKey } from './data/entries'
import { DEFAULT_PROFILE, STORAGE_KEYS, buildExportData, buildExportText, clearAllLocalData, downloadText } from './data/storage'
import { clearAllAudio, deleteAudio } from './data/audioStore'
import Album from './components/Album'
import BottomNav from './components/BottomNav'
import EmotionPage from './components/EmotionPage'
import Greeting from './components/Greeting'
import MoodRecorder from './components/MoodRecorder'
import ProfileCenter from './components/ProfileCenter'
import Starfield from './components/Starfield'
import TimeMachine from './components/TimeMachine'
import Toast from './components/Toast'
import TopBar from './components/TopBar'
import TreeHole from './components/TreeHole'

function readJSON(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function readEntries() {
  const value = readJSON(STORAGE_KEYS.entries, [])
  return Array.isArray(value) ? value : []
}

function readColors(key, limit) {
  const raw = readJSON(key, [])
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const colors = []
  raw.forEach((item) => {
    const color = normalizeHex(item)
    if (color && !seen.has(color) && colors.length < limit) {
      seen.add(color)
      colors.push(color)
    }
  })
  return colors
}

function readTreeItems() {
  const raw = readJSON(STORAGE_KEYS.tree, [])
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && item.id && typeof item.note === 'string')
    .map((item) => ({ ...item, color: normalizeHex(item.color) || '#A6C9DD' }))
}

function readComments() {
  const raw = readJSON(STORAGE_KEYS.comments, [])
  if (!Array.isArray(raw)) return []
  return raw.filter((item) => item && item.id && item.targetId && typeof item.text === 'string')
}

function readReactions() {
  const raw = readJSON(STORAGE_KEYS.reactions, [])
  if (!Array.isArray(raw)) return []
  return raw.filter((item) => (
    item && item.id && item.targetId && (item.type === 'hug' || item.type === 'star')
  ))
}

function readProfile() {
  const saved = readJSON(STORAGE_KEYS.profile, {})
  return { ...DEFAULT_PROFILE, ...(saved && typeof saved === 'object' ? saved : {}) }
}

function buildTreeItem(entry) {
  return {
    id: `publish-${entry.id}`,
    sourceEntryId: entry.id,
    note: entry.note,
    color: normalizeHex(entry.color) || '#A6C9DD',
    publishedAt: new Date().toISOString(),
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 本地存储不可用时，仅保留当前会话数据 */
  }
}

export default function App() {
  const [theme, setTheme] = useState(() => (localStorage.getItem(STORAGE_KEYS.theme) === 'night' ? 'night' : 'day'))
  const [activeTab, setActiveTab] = useState('tree')
  const [toast, setToast] = useState('')
  const [entries, setEntries] = useState(readEntries)
  const [treeItems, setTreeItems] = useState(readTreeItems)
  const [comments, setComments] = useState(readComments)
  const [reactions, setReactions] = useState(readReactions)
  const [favoriteColors, setFavoriteColors] = useState(() => readColors(STORAGE_KEYS.favorites, 12))
  const [recentColors, setRecentColors] = useState(() => readColors(STORAGE_KEYS.recent, 8))
  const [profile, setProfile] = useState(readProfile)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = (message) => setToast(message)
  const toggleTheme = () => setTheme((current) => (current === 'day' ? 'night' : 'day'))

  const toggleFavorite = (color) => {
    const normalized = normalizeHex(color)
    if (!normalized) return
    const exists = favoriteColors.some((item) => item.toUpperCase() === normalized)
    const next = exists
      ? favoriteColors.filter((item) => item.toUpperCase() !== normalized)
      : [normalized, ...favoriteColors].slice(0, 12)
    setFavoriteColors(next)
    persist(STORAGE_KEYS.favorites, next)
    showToast(exists ? '已从收藏中移除这个颜色。' : '这个颜色已经收好了。')
  }

  const handleSave = (entry) => {
    const next = [entry, ...entries]
    setEntries(next)
    persist(STORAGE_KEYS.entries, next)
    const usedColor = normalizeHex(entry.color)
    if (usedColor) {
      const nextRecent = [usedColor, ...recentColors.filter((item) => item !== usedColor)].slice(0, 8)
      setRecentColors(nextRecent)
      persist(STORAGE_KEYS.recent, nextRecent)
    }
    if (entry.visibility === 'anonymous') {
      const nextTree = treeItems.some((item) => String(item.sourceEntryId) === String(entry.id))
        ? treeItems.map((item) => (
          String(item.sourceEntryId) === String(entry.id)
            ? { ...item, note: entry.note, color: usedColor || item.color }
            : item
        ))
        : [buildTreeItem(entry), ...treeItems]
      setTreeItems(nextTree)
      persist(STORAGE_KEYS.tree, nextTree)
      showToast('这份心情已经在树洞靠岸了。')
      return
    }
    showToast('今天的心情，已经被温柔收好了。')
  }

  const updateEntry = (id, patch) => {
    const current = entries.find((entry) => entry.id === id)
    const wasPublic = current?.visibility === 'anonymous'
    const willPublic = (patch.visibility ?? current?.visibility) === 'anonymous'
    const next = entries.map((entry) => (
      entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry
    ))
    setEntries(next)
    persist(STORAGE_KEYS.entries, next)

    const linked = treeItems.some((item) => String(item.sourceEntryId) === String(id))
    let nextTree = treeItems
    let message = '记录已经更新，修改时间也记下来了。'
    if (willPublic && linked) {
      const updated = { ...current, ...patch }
      nextTree = treeItems.map((item) => (
        String(item.sourceEntryId) === String(id)
          ? { ...item, note: updated.note ?? item.note, color: normalizeHex(updated.color) || item.color }
          : item
      ))
    } else if (willPublic && !wasPublic && current) {
      nextTree = [buildTreeItem({ ...current, ...patch }), ...treeItems]
      message = '这份心情已经在树洞靠岸了。'
    } else if (!willPublic && linked) {
      nextTree = treeItems.filter((item) => String(item.sourceEntryId) !== String(id))
      message = '这份心情已回到你的记录册。'
    }
    if (nextTree !== treeItems) {
      setTreeItems(nextTree)
      persist(STORAGE_KEYS.tree, nextTree)
    }
    showToast(message)
  }

  const deleteEntry = (id) => {
    const target = entries.find((entry) => entry.id === id)
    const wasPublic = treeItems.some((item) => String(item.sourceEntryId) === String(id))
    const next = entries.filter((entry) => entry.id !== id)
    setEntries(next)
    persist(STORAGE_KEYS.entries, next)
    if (wasPublic) {
      const nextTree = treeItems.filter((item) => String(item.sourceEntryId) !== String(id))
      setTreeItems(nextTree)
      persist(STORAGE_KEYS.tree, nextTree)
    }
    if (target?.voice?.audioId) {
      deleteAudio(target.voice.audioId)
        .then(() => showToast(wasPublic ? '记录与树洞中的对应内容已撤回，录音也已删除。' : '记录与对应录音已经删除。'))
        .catch(() => showToast(wasPublic ? '记录与树洞中的对应内容已撤回，但录音删除失败，请稍后在个人中心重试。' : '记录已删除，但对应录音删除失败，请稍后在个人中心重试。'))
    } else {
      showToast(wasPublic ? '记录已删除，树洞中的对应内容也已撤回。' : '这条记录已经删除。')
    }
  }

  const retractTreeItem = (id) => {
    const target = treeItems.find((item) => item.id === id)
    if (!target || target.isDemo) return
    const nextTree = treeItems.filter((item) => item.id !== id)
    setTreeItems(nextTree)
    persist(STORAGE_KEYS.tree, nextTree)
    if (target.sourceEntryId != null) {
      const next = entries.map((entry) => (
        String(entry.id) === String(target.sourceEntryId)
          ? { ...entry, visibility: 'private', updatedAt: new Date().toISOString() }
          : entry
      ))
      if (next.some((entry, index) => entry !== entries[index])) {
        setEntries(next)
        persist(STORAGE_KEYS.entries, next)
      }
    }
    showToast('这份心情已回到你的记录册。')
  }

  const toggleReaction = (targetId, type) => {
    const nextType = type === 'star' ? 'star' : 'hug'
    const existing = reactions.find((item) => (
      item.targetId === targetId && item.type === nextType && item.isMine
    ))
    const next = existing
      ? reactions.filter((item) => item.id !== existing.id)
      : [{
        id: `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        targetId,
        type: nextType,
        createdAt: new Date().toISOString(),
        authorName: profile.nickname || '我',
        isMine: true,
      }, ...reactions]
    setReactions(next)
    persist(STORAGE_KEYS.reactions, next)
    if (existing) {
      showToast(nextType === 'star' ? '已经收回这颗星星。' : '已经收回这个抱抱。')
    } else {
      showToast(nextType === 'star' ? '一颗星星轻轻送到了。' : '一个抱抱轻轻送到了。')
    }
  }

  const addComment = (targetId, text, targetColor) => {
    const trimmed = String(text || '').trim()
    if (!trimmed) return false
    const comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      targetId,
      text: trimmed,
      color: normalizeHex(targetColor) || '#A6C9DD',
      createdAt: new Date().toISOString(),
      kind: 'anonymous-note',
      localDemo: true,
      isMine: true,
    }
    const next = [comment, ...comments]
    setComments(next)
    persist(STORAGE_KEYS.comments, next)
    return true
  }

  const deleteComment = (id) => {
    const next = comments.filter((comment) => comment.id !== id)
    setComments(next)
    persist(STORAGE_KEYS.comments, next)
    showToast('这条留言已经删除。')
  }

  const saveProfile = (patch) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    persist(STORAGE_KEYS.profile, next)
    showToast('个人资料已经保存。')
  }

  const exportData = (format) => {
    const data = buildExportData({ entries, treeItems, comments, reactions, profile })
    const stamp = getDateKey(new Date()) || 'export'
    if (format === 'json') {
      downloadText(`情绪靠岸-记录-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
    } else {
      downloadText(`情绪靠岸-记录-${stamp}.txt`, buildExportText(data))
    }
    showToast(`已开始导出 ${format.toUpperCase()} 文件。`)
  }

  const clearAll = () => {
    clearAllLocalData()
    const audioCleared = clearAllAudio()
      .then(() => true)
      .catch(() => false)
    setEntries([])
    setTreeItems([])
    setComments([])
    setReactions([])
    setFavoriteColors([])
    setRecentColors([])
    setProfile(DEFAULT_PROFILE)
    setActiveTab('tree')
    setTheme('day')
    setProfileOpen(false)
    audioCleared.then((ok) => {
      showToast(ok
        ? '本地数据与录音已清除，页面回到初始状态。'
        : '本地数据已清除，但部分录音删除失败，可能仍留在浏览器中。')
    })
  }

  return (
    <div className={`app-shell theme-${theme} tab-${activeTab}`}>
      <div className="bg-layer bg-day" aria-hidden="true" />
      <div className="bg-layer bg-night" aria-hidden="true" />
      <Starfield />

      <TopBar theme={theme} profile={profile} onToggleTheme={toggleTheme} onOpenProfile={() => setProfileOpen(true)} />

      <main className="main-content">
        <div className="page-transition" key={activeTab}>
          {activeTab === 'quick' && (
            <>
              <Greeting />
              <MoodRecorder
                onSave={handleSave}
                onNotify={showToast}
                onCancel={() => setActiveTab('tree')}
                favoriteColors={favoriteColors}
                recentColors={recentColors}
                onToggleFavorite={toggleFavorite}
              />
            </>
          )}
          {activeTab === 'emotion' && <EmotionPage entries={entries} />}
          {activeTab === 'tree' && (
            <TreeHole
              entries={entries}
              treeItems={treeItems}
              comments={comments}
              reactions={reactions}
              profile={profile}
              onRetract={retractTreeItem}
              onToggleReaction={toggleReaction}
              onAddComment={addComment}
              onDeleteComment={deleteComment}
              onNotify={showToast}
            />
          )}
          {activeTab === 'album' && (
            <Album
              entries={entries}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
              onNotify={showToast}
              favoriteColors={favoriteColors}
              recentColors={recentColors}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {activeTab === 'time' && (
            <TimeMachine
              onNotify={showToast}
            />
          )}
        </div>
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
      <Toast message={toast} visible={Boolean(toast)} />

      {profileOpen && (
        <ProfileCenter
          profile={profile}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSaveProfile={saveProfile}
          onOpenAlbum={() => { setProfileOpen(false); setActiveTab('album') }}
          onExport={exportData}
          onClearAll={clearAll}
          onNotify={showToast}
          onClose={() => setProfileOpen(false)}
          stats={{ entries: entries.length, whispers: treeItems.length, comments: comments.length }}
        />
      )}
    </div>
  )
}
