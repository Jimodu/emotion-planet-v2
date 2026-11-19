export default function MoodOrb({ color, intensity }) {
  const ratio = Math.min(100, Math.max(0, Number(intensity) || 0)) / 100
  const glow = 0.16 + ratio * 0.3
  const opacity = 0.72 + ratio * 0.28

  return (
    <div className="orb-wrap" aria-hidden="true" style={{ '--orb': color }}>
      <span className="orb-halo" style={{ opacity: glow }} />
      <span className="mood-orb" style={{ opacity }} />
    </div>
  )
}
