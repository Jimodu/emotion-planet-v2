import { Moon, Sun } from 'lucide-react'
import logo from '../assets/logo.png'

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export default function TopBar({ theme, onToggleTheme, profile, onOpenProfile }) {
  const now = new Date()
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日`
  const weekday = weekdays[now.getDay()]

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark">
            <img className="brand-logo" src={logo} alt="" aria-hidden="true" />
          </span>
          <span className="brand-name">情绪靠岸</span>
        </div>

        <div className="topbar-date" aria-label="今天日期">
          <span>{dateText}</span>
          <span className="date-dot">·</span>
          <span className="weekday">{weekday}</span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'day' ? '切换到夜晚模式' : '切换到白天模式'}
            title={theme === 'day' ? '切换到夜晚' : '切换到白天'}
          >
            {theme === 'day' ? <Moon size={17} strokeWidth={1.6} /> : <Sun size={17} strokeWidth={1.6} />}
          </button>
          <button
            type="button"
            className="avatar avatar-button"
            onClick={onOpenProfile}
            aria-label="打开个人中心"
            title="打开个人中心"
          >
            {profile?.avatarImage ? (
              <img className="avatar-image" src={profile.avatarImage} alt="" />
            ) : (
              profile?.avatar || '我'
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
