import { Globe, Lock } from 'lucide-react'

export default function VisibilityToggle({ value, onChange }) {
  return (
    <div className="field">
      <p className="field-label">04 &nbsp; 这份心情，给谁看？</p>
      <div className="segmented" role="group" aria-label="可见范围">
        <button
          type="button"
          data-value="private"
          className={`segment ${value === 'private' ? 'active' : ''}`}
          onClick={() => onChange('private')}
          aria-pressed={value === 'private'}
        >
          <Lock size={16} strokeWidth={1.8} aria-hidden="true" />
          仅自己可见
        </button>
        <button
          type="button"
          data-value="anonymous"
          className={`segment ${value === 'anonymous' ? 'active' : ''}`}
          onClick={() => onChange('anonymous')}
          aria-pressed={value === 'anonymous'}
        >
          <Globe size={16} strokeWidth={1.8} aria-hidden="true" />
          匿名公开
        </button>
      </div>
      <p className="field-hint">
        {value === 'anonymous'
          ? '这份心情将以匿名形式出现在树洞。'
          : '只留给自己，不会出现在树洞。'}
      </p>
    </div>
  )
}
