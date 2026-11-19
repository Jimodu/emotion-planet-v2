import { useMemo } from 'react'
import { moods } from '../data/moods'

function random(seed) {
  const value = Math.sin(seed * 127.1) * 43758.5453
  return value - Math.floor(value)
}

const planets = [
  { id: 'planet-1', left: '9%', top: '22%', size: '46px', tone: '#9DB4E8', duration: '38s', delay: '-6s' },
  { id: 'planet-2', left: '79%', top: '64%', size: '28px', tone: '#E3BCD7', duration: '46s', delay: '-19s' },
]

export default function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => {
        const a = random(index + 1)
        const b = random(index + 61)
        const c = random(index + 121)
        const d = random(index + 181)
        const e = random(index + 241)
        const color = moods[Math.floor(e * moods.length)].color
        const duration = 18 + d * 24

        return {
          id: index,
          left: `${a * 100}%`,
          top: `${b * 100}%`,
          '--star-size': `${1 + c * 2}px`,
          '--star-tone': color,
          '--star-glow': color,
          '--star-glow-size': `${5 + c * 7}px`,
          '--dx': `${(b - 0.5) * 28}px`,
          '--dy': `${-14 - d * 34}px`,
          '--duration': `${duration}s`,
          '--delay': `${-c * 26}s`,
          '--min': 0.12 + a * 0.16,
          '--max': 0.38 + c * 0.38,
        }
      }),
    [],
  )

  return (
    <div className="starfield" aria-hidden="true">
      {stars.map((star) => (
        <span key={star.id} className="star" style={star} />
      ))}
      {planets.map((planet) => (
        <span
          key={planet.id}
          className="planet"
          style={{
            left: planet.left,
            top: planet.top,
            width: planet.size,
            height: planet.size,
            '--planet-tone': planet.tone,
            '--planet-duration': planet.duration,
            '--planet-delay': planet.delay,
          }}
        />
      ))}
      <span className="meteor" />
    </div>
  )
}
