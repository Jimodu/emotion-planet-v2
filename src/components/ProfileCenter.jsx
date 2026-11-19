import { useEffect, useRef, useState } from 'react'
import { BookOpen, Download, Moon, ShieldCheck, Sun, Trash2, X } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { DEFAULT_PROFILE, STORAGE_KEYS } from '../data/storage'

const avatarOptions = ['我', '岸', '星', '月', '海', '芽', '光', '静']

export default function ProfileCenter({ profile, theme, onToggleTheme, onSaveProfile, onOpenAlbum, onExport, onClearAll, onNotify, onClose, stats = {} }) {
  const [nickname, setNickname] = useState(profile.nickname || DEFAULT_PROFILE.nickname)
  const [signature, setSignature] = useState(profile.signature || DEFAULT_PROFILE.signature)
  const [avatar, setAvatar] = useState(profile.avatar || DEFAULT_PROFILE.avatar)
  const [avatarImage, setAvatarImage] = useState(profile.avatarImage || '')
  const [profileVisibility, setProfileVisibility] = useState(profile.profileVisibility || 'private')
  const [allowReplies, setAllowReplies] = useState(profile.allowReplies ?? true)
  const [hideSignature, setHideSignature] = useState(profile.hideSignature ?? false)
  const [clearOpen, setClearOpen] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !clearOpen) onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearOpen, onClose])

  const handleFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onNotify?.('请选择图片文件。')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      onNotify?.('头像图片请小于 2MB。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarImage(String(reader.result))
      setAvatar('')
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    const nextNickname = nickname.trim()
    if (!nextNickname) {
      onNotify?.('给自己留一个昵称吧。')
      return
    }
    onSaveProfile?.({
      nickname: nextNickname,
      signature: signature.trim(),
      avatar,
      avatarImage,
      profileVisibility,
      allowReplies,
      hideSignature,
    })
  }

  const currentAvatar = avatarImage
    ? <img className="profile-avatar-image" src={avatarImage} alt="" />
    : <span>{avatar || '我'}</span>

  return (
    <div className="modal-overlay profile-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="modal-card profile-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="panel-kicker">PERSONAL SPACE</p>
            <h2 id="profile-title">个人中心</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭个人中心">
            <X size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <section className="profile-hero">
          <div className="profile-avatar">{currentAvatar}</div>
          <div className="profile-hero-text">
            <strong>{nickname || '靠岸的人'}</strong>
            <p>{hideSignature ? '签名已隐藏' : (signature || '还没有写签名')}</p>
            <span>{profileVisibility === 'private' ? '资料仅自己可见' : '资料设为公开展示'}</span>
          </div>
        </section>

        <section className="profile-section">
          <h3>编辑资料</h3>
          <label className="profile-field">
            <span>昵称</span>
            <input type="text" value={nickname} maxLength={20} onChange={(event) => setNickname(event.target.value)} placeholder="给自己一个称呼" />
          </label>
          <label className="profile-field">
            <span>个性签名</span>
            <textarea value={signature} maxLength={80} rows={2} onChange={(event) => setSignature(event.target.value)} placeholder="写一句想对自己说的话" />
          </label>

          <div className="profile-field">
            <span>头像</span>
            <div className="avatar-options">
              {avatarOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`avatar-option ${!avatarImage && avatar === option ? 'active' : ''}`}
                  onClick={() => { setAvatar(option); setAvatarImage('') }}
                  aria-pressed={!avatarImage && avatar === option}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="avatar-upload-row">
              <button type="button" className="ghost-btn small" onClick={() => fileRef.current?.click()}>上传图片</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="visually-hidden" aria-label="上传头像图片" />
              {avatarImage && (
                <button type="button" className="text-btn" onClick={() => { setAvatarImage(''); setAvatar('我') }}>移除图片</button>
              )}
            </div>
          </div>

          <div className="profile-field">
            <span>资料可见范围</span>
            <div className="profile-segmented" role="group" aria-label="资料可见范围">
              <button type="button" className={profileVisibility === 'private' ? 'active' : ''} onClick={() => setProfileVisibility('private')} aria-pressed={profileVisibility === 'private'}>仅自己可见</button>
              <button type="button" className={profileVisibility === 'public' ? 'active' : ''} onClick={() => setProfileVisibility('public')} aria-pressed={profileVisibility === 'public'}>公开展示</button>
            </div>
          </div>

          <button type="button" className="save-btn compact-save profile-save" onClick={handleSave}>保存资料</button>
        </section>

        <section className="profile-section">
          <h3>隐私与偏好</h3>
          <label className="profile-toggle">
            <input type="checkbox" checked={allowReplies} onChange={(event) => setAllowReplies(event.target.checked)} />
            <span>允许别人回应我公开发布的内容<em>本地演示设置，不会影响其他设备</em></span>
          </label>
          <label className="profile-toggle">
            <input type="checkbox" checked={hideSignature} onChange={(event) => setHideSignature(event.target.checked)} />
            <span>在资料卡中隐藏签名<em>只影响本地展示</em></span>
          </label>
          <button type="button" className="tool-btn profile-theme-btn" onClick={onToggleTheme}>
            {theme === 'day' ? <Moon size={15} strokeWidth={1.8} aria-hidden="true" /> : <Sun size={15} strokeWidth={1.8} aria-hidden="true" />}
            当前为{theme === 'day' ? '白天' : '夜晚'}模式，点击切换
          </button>
        </section>

        <section className="profile-section">
          <h3>数据管理</h3>
          <p className="profile-stats">本地记录 {stats.entries || 0} 条 · 树洞发布 {stats.whispers || 0} 条 · 留言 {stats.comments || 0} 条</p>
          <div className="profile-data-actions">
            <button type="button" className="tool-btn" onClick={onOpenAlbum}><BookOpen size={15} strokeWidth={1.8} aria-hidden="true" />打开记录册</button>
            <button type="button" className="tool-btn" onClick={() => onExport?.('json')}><Download size={15} strokeWidth={1.8} aria-hidden="true" />导出 JSON</button>
            <button type="button" className="tool-btn" onClick={() => onExport?.('txt')}><Download size={15} strokeWidth={1.8} aria-hidden="true" />导出 TXT</button>
            <button type="button" className="tool-btn danger" onClick={() => setClearOpen(true)}><Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />清除本地数据</button>
          </div>
          <p className="demo-note profile-demo"><ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" />本地个人资料，不会上传网络，也没有真实多账号系统。</p>
        </section>

        {clearOpen && (
          <ConfirmDialog
            tone="danger"
            title="清除全部本地数据？"
            description="这个操作无法撤销。清除后页面会恢复到初始状态，本地记录和录音可能无法恢复。"
            details={[
              `情绪记录（${stats.entries || 0} 条）`,
              '语音录音文件（保存在本机 IndexedDB）',
              `树洞发布（${stats.whispers || 0} 条）`,
              `本地留言（${stats.comments || 0} 条）`,
              '草稿、收藏颜色、最近使用颜色',
              '个人资料与隐私偏好',
              '主题设置与树洞演示数据缓存',
            ]}
            confirmText="确认清除"
            cancelText="再想想"
            onCancel={() => setClearOpen(false)}
            onConfirm={() => {
              setClearOpen(false)
              onClearAll?.()
            }}
          />
        )}
      </div>
    </div>
  )
}
