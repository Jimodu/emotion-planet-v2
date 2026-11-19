export const STORAGE_KEYS = {
  theme: 'emotion-planet-theme',
  entries: 'emotion-planet-entries',
  tree: 'emotion-planet-tree-publishes',
  comments: 'emotion-planet-comments',
  reactions: 'emotion-planet-reactions',
  commentCooldown: 'emotion-planet-comment-cooldown',
  hiddenComments: 'emotion-planet-hidden-comments',
  reportedComments: 'emotion-planet-reported-comments',
  letters: 'emotion-planet-letters',
  letterDraft: 'emotion-planet-letter-draft',
  favorites: 'emotion-planet-favorites',
  recent: 'emotion-planet-recent-colors',
  draft: 'emotion-planet-draft',
  profile: 'emotion-planet-profile',
}

export const DEFAULT_PROFILE = {
  nickname: '靠岸的人',
  signature: '把心情放在这里，慢慢靠岸。',
  avatar: '我',
  avatarImage: '',
  profileVisibility: 'private',
  allowReplies: true,
  hideSignature: false,
}

export function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 本地存储不可用时忽略 */
  }
}

export function clearDraft() {
  remove(STORAGE_KEYS.draft)
}

export function clearAllLocalData() {
  Object.values(STORAGE_KEYS).forEach(remove)
}

export function buildExportData({ entries = [], treeItems = [], comments = [], reactions = [], profile }) {
  return {
    app: '情绪靠岸',
    exportedAt: new Date().toISOString(),
    note: '本地演示数据导出，不包含任何服务端账号信息。',
    profile: profile || DEFAULT_PROFILE,
    entries,
    whispers: treeItems,
    comments,
    reactions,
  }
}

function readableEntry(entry, index) {
  const created = entry.createdAt ? new Date(entry.createdAt).toLocaleString('zh-CN') : '未标注创建时间'
  const updated = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('zh-CN') : '未记录修改时间'
  return [
    `${index + 1}. ${created}`,
    `   颜色：${entry.color || '未记录'}`,
    `   可见范围：${entry.visibility === 'anonymous' ? '匿名公开' : '仅自己可见'}`,
    `   创建：${created}`,
    `   最后修改：${updated}`,
    `   心情：${entry.note || ''}`,
    ...(entry.voice?.audioId ? [
      `   录音：已保存在本机（${entry.voice.duration || 0} 秒）`,
      `   转写：${entry.voice.transcript || '无转写文字'}`,
    ] : []),
    '',
  ].join('\n')
}

export function buildExportText(data) {
  const lines = [
    '情绪靠岸 · 个人记录导出',
    `导出时间：${new Date(data.exportedAt).toLocaleString('zh-CN')}`,
    `昵称：${data.profile?.nickname || DEFAULT_PROFILE.nickname}`,
    `个性签名：${data.profile?.signature || DEFAULT_PROFILE.signature}`,
    '',
    `情绪记录（${data.entries.length} 条）`,
    '----------------------------------------',
    ...(data.entries.length ? data.entries.map(readableEntry) : ['暂无记录', '']),
    `树洞发布（${data.whispers.length} 条）`,
    '----------------------------------------',
    ...data.whispers.map((item, index) => `${index + 1}. ${item.publishedAt ? new Date(item.publishedAt).toLocaleString('zh-CN') : '未标注日期'}\n   ${item.note || ''}\n`),
    `留言（${data.comments.length} 条）`,
    '----------------------------------------',
    ...data.comments.map((item, index) => `${index + 1}. ${item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '未标注日期'}\n   ${item.text || ''}\n`),
    `抱抱与星星（${(data.reactions || []).length} 条）`,
    '----------------------------------------',
    ...(data.reactions || []).map((item, index) => `${index + 1}. ${item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '未标注日期'}\n   ${item.type === 'star' ? '星星' : '抱抱'} · 目标：${item.targetId}\n`),
  ]
  return lines.join('\n')
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
