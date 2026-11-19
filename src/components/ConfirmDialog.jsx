import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ title, description, details = [], confirmText = '确认', cancelText = '取消', tone = 'default', onConfirm, onCancel }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="modal-overlay confirm-overlay" onMouseDown={onCancel} role="presentation">
      <div
        className={`modal-card confirm-card ${tone === 'danger' ? 'danger-tone' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-btn confirm-close" onClick={onCancel} aria-label="关闭确认框">
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span className="confirm-icon" aria-hidden="true"><AlertTriangle size={20} strokeWidth={1.7} /></span>
        <h2 id="confirm-title">{title}</h2>
        {description && <p className="confirm-description">{description}</p>}
        {details.length > 0 && (
          <ul className="confirm-details">
            {details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>{cancelText}</button>
          <button type="button" className="save-btn compact-save" autoFocus onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
