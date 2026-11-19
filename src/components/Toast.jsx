import { Sparkles } from 'lucide-react'

export default function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? 'show' : ''}`} role="status" aria-live="polite">
      <Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
