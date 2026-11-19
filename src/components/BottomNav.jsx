import { Activity, BookOpen, Clock, MessageCircle, Plus } from 'lucide-react'

const items = [
  { id: 'tree', label: '树洞', icon: MessageCircle },
  { id: 'emotion', label: '情绪', icon: Activity },
  { id: 'quick', label: '快速记录', icon: Plus, center: true },
  { id: 'album', label: '记录册', icon: BookOpen },
  { id: 'time', label: '时光机', icon: Clock },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id
        const className = `nav-item ${isActive ? 'active' : ''} ${item.center ? 'nav-add' : ''}`
        return (
          <button
            key={item.id}
            type="button"
            className={className.trim()}
            onClick={() => onChange(item.id)}
            aria-label={item.center ? '快速记录' : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.center ? (
              <span className="nav-add-icon">
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
            ) : (
              <>
                <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
                <span>{item.label}</span>
                <i className="nav-dot" aria-hidden="true" />
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}
