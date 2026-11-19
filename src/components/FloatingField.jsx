import { useEffect, useRef } from 'react'

const CRUISE_MIN = 0.09
const CRUISE_MAX = 0.26
const MAX_SPEED = 0.5
const SEPARATION_RATE = 0.16
const MAX_SEPARATION_STEP = 1.15
const IMPULSE = 0.16
const MAX_IMPULSE_CHANGE = 0.11
const SETTLE = 0.014
const BOUNCE_DAMP = 0.86
const EDGE_ZONE = 30
const EDGE_TURN = 0.006
const IMPULSE_COOLDOWN = 260
const GAP = 4

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function createBody(id, index) {
  const angle = Math.random() * Math.PI * 2
  const cruise = randomBetween(CRUISE_MIN, CRUISE_MAX)
  return {
    id,
    index,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    node: null,
    vx: Math.cos(angle) * cruise,
    vy: Math.sin(angle) * cruise,
    cruiseX: Math.cos(angle) * cruise,
    cruiseY: Math.sin(angle) * cruise,
    swing: Math.random() * Math.PI * 2,
    rotation: randomBetween(-2.5, 2.5),
    rotationBase: randomBetween(-2.5, 2.5),
    placed: false,
    impulseCooldown: 0,
  }
}

function contact(a, b, gap) {
  const ax = a.x + a.w / 2
  const ay = a.y + a.h / 2
  const bx = b.x + b.w / 2
  const by = b.y + b.h / 2
  let dx = bx - ax
  let dy = by - ay
  let distance = Math.hypot(dx, dy)
  if (distance < 0.0001) {
    dx = 1
    dy = 0
    distance = 1
  }
  const radius = (Math.min(a.w, a.h) + Math.min(b.w, b.h)) / 2 + gap
  if (distance >= radius) return null
  return { nx: dx / distance, ny: dy / distance, depth: radius - distance }
}

export default function FloatingField({ items, expandedId, renderItem }) {
  const fieldRef = useRef(null)
  const bodiesRef = useRef(new Map())
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const sizeRef = useRef({ width: 0, height: 0 })
  const reducedRef = useRef(false)
  const expandedRef = useRef(expandedId)

  useEffect(() => {
    expandedRef.current = expandedId
    const field = fieldRef.current
    if (!field) return
    const { width, height } = sizeRef.current
    bodiesRef.current.forEach((body) => {
      const node = body.node?.isConnected
        ? body.node
        : field.querySelector(`[data-float-id="${CSS.escape(body.id)}"]`)
      if (!node) return
      body.node = node
      body.w = node.offsetWidth
      body.h = node.offsetHeight
      body.x = Math.min(Math.max(0, body.x), Math.max(0, width - body.w))
      body.y = Math.min(Math.max(0, body.y), Math.max(0, height - body.h))
    })

    if (!expandedId) return
    const activeNode = field.querySelector(`[data-float-id="${CSS.escape(String(expandedId))}"]`)
    if (!activeNode) return
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (expandedRef.current === String(expandedId)) {
          activeNode.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
      })
    })
  }, [expandedId])

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return undefined

    const measure = () => {
      const rect = field.getBoundingClientRect()
      sizeRef.current = { width: rect.width, height: rect.height }
    }

    const initialize = () => {
      measure()
      const { width, height } = sizeRef.current
      const next = new Map()
      const ids = items.map((item) => item.id)

      ids.forEach((id, index) => {
        const previous = bodiesRef.current.get(String(id))
        const body = previous || createBody(String(id), index)
        const node = field.querySelector(`[data-float-id="${CSS.escape(String(id))}"]`)
        body.node = node
        body.w = node ? node.offsetWidth : 180
        body.h = node ? node.offsetHeight : 120
        body.x = Math.min(Math.max(0, body.x), Math.max(0, width - body.w))
        body.y = Math.min(Math.max(0, body.y), Math.max(0, height - body.h))
        if (previous) {
          body.vx = previous.vx
          body.vy = previous.vy
          body.cruiseX = previous.cruiseX
          body.cruiseY = previous.cruiseY
          body.placed = previous.placed
          body.impulseCooldown = previous.impulseCooldown
        }
        next.set(String(id), body)
      })

      const ordered = ids.map((id) => next.get(String(id)))

      ordered.forEach((body, index) => {
        if (body.placed) return
        let x = 0
        let y = 0
        let found = false
        for (let attempt = 0; attempt < 48; attempt += 1) {
          x = randomBetween(8, Math.max(8, width - body.w - 8))
          y = randomBetween(8, Math.max(8, height - body.h - 8))
          const candidate = { ...body, x, y }
          const collides = ordered.some((other) => (
            other !== body && other.placed && contact(candidate, other, 18)
          ))
          if (!collides) {
            found = true
            break
          }
        }
        if (!found) {
          const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)))
          const cellWidth = width / columns
          const column = index % columns
          const row = Math.floor(index / columns)
          x = Math.min(column * cellWidth + 12, Math.max(0, width - body.w - 8))
          y = Math.min(row * 160 + 12, Math.max(0, height - body.h - 8))
        }
        body.x = x
        body.y = y
        body.placed = true
      })

      bodiesRef.current = next
    }

    initialize()

    const renderStatic = () => {
      bodiesRef.current.forEach((body) => {
        if (!body.node) return
        body.node.style.transform = `translate3d(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px, 0) rotate(${body.rotationBase.toFixed(2)}deg)`
      })
    }

    reducedRef.current = prefersReducedMotion()
    if (reducedRef.current) {
      renderStatic()
      return undefined
    }

    const tick = (time) => {
      const elapsed = lastTimeRef.current ? time - lastTimeRef.current : 16.67
      lastTimeRef.current = time
      const step = Math.min(2, Math.max(0, elapsed / 16.67))
      const { width, height } = sizeRef.current
      const bodies = bodiesRef.current
      const list = [...bodies.values()]
      const active = expandedRef.current ? String(expandedRef.current) : null

      list.forEach((body) => {
        if (body.impulseCooldown > 0) body.impulseCooldown -= elapsed
        if (body.id === active) return

        const rightGap = width - (body.x + body.w)
        const bottomGap = height - (body.y + body.h)
        if (body.x < EDGE_ZONE) body.cruiseX += EDGE_TURN * step
        if (rightGap < EDGE_ZONE) body.cruiseX -= EDGE_TURN * step
        if (body.y < EDGE_ZONE) body.cruiseY += EDGE_TURN * step
        if (bottomGap < EDGE_ZONE) body.cruiseY -= EDGE_TURN * step

        const cruiseSpeed = Math.hypot(body.cruiseX, body.cruiseY) || 1
        if (cruiseSpeed > CRUISE_MAX) {
          const scale = CRUISE_MAX / cruiseSpeed
          body.cruiseX *= scale
          body.cruiseY *= scale
        } else if (cruiseSpeed < CRUISE_MIN) {
          const scale = CRUISE_MIN / cruiseSpeed
          body.cruiseX *= scale
          body.cruiseY *= scale
        }

        body.vx += (body.cruiseX - body.vx) * SETTLE * step
        body.vy += (body.cruiseY - body.vy) * SETTLE * step

        const speed = Math.hypot(body.vx, body.vy)
        if (speed > MAX_SPEED) {
          const scale = MAX_SPEED / speed
          body.vx *= scale
          body.vy *= scale
        }

        body.x += body.vx * step
        body.y += body.vy * step

        if (body.x < 6) {
          body.x = 6
          body.vx = Math.abs(body.vx) * BOUNCE_DAMP
          body.cruiseX = Math.abs(body.cruiseX)
        } else if (body.x + body.w > width - 6) {
          body.x = Math.max(6, width - body.w - 6)
          body.vx = -Math.abs(body.vx) * BOUNCE_DAMP
          body.cruiseX = -Math.abs(body.cruiseX)
        }
        if (body.y < 6) {
          body.y = 6
          body.vy = Math.abs(body.vy) * BOUNCE_DAMP
          body.cruiseY = Math.abs(body.cruiseY)
        } else if (body.y + body.h > height - 6) {
          body.y = Math.max(6, height - body.h - 6)
          body.vy = -Math.abs(body.vy) * BOUNCE_DAMP
          body.cruiseY = -Math.abs(body.cruiseY)
        }

        body.swing += 0.005 * step
        body.rotation = body.rotationBase + Math.sin(body.swing) * 2.2
      })

      for (let i = 0; i < list.length; i += 1) {
        const a = list[i]
        if (a.id === active) continue
        for (let j = i + 1; j < list.length; j += 1) {
          const b = list[j]
          if (b.id === active) continue
          const hit = contact(a, b, GAP)
          if (!hit) continue

          const correction = Math.min(hit.depth * SEPARATION_RATE, MAX_SEPARATION_STEP) * step
          a.x -= hit.nx * correction
          a.y -= hit.ny * correction
          b.x += hit.nx * correction
          b.y += hit.ny * correction

          const approaching = (b.vx - a.vx) * hit.nx + (b.vy - a.vy) * hit.ny
          if (approaching < 0 && a.impulseCooldown <= 0 && b.impulseCooldown <= 0) {
            const change = Math.min(-approaching * IMPULSE, MAX_IMPULSE_CHANGE)
            a.vx -= hit.nx * change
            a.vy -= hit.ny * change
            b.vx += hit.nx * change
            b.vy += hit.ny * change
            a.impulseCooldown = IMPULSE_COOLDOWN
            b.impulseCooldown = IMPULSE_COOLDOWN
          }
        }
      }

      bodies.forEach((body, id) => {
        if (!body.node) return
        if (id === active) {
          const cx = Math.max(6, Math.min(width - body.w - 6, (width - body.w) / 2))
          body.node.style.transform = `translate3d(${cx.toFixed(1)}px, 10px, 0) rotate(0deg)`
          return
        }
        body.node.style.transform = `translate3d(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px, 0) rotate(${body.rotation.toFixed(2)}deg)`
      })

      rafRef.current = window.requestAnimationFrame(tick)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      } else if (!rafRef.current && !reducedRef.current) {
        lastTimeRef.current = 0
        rafRef.current = window.requestAnimationFrame(tick)
      }
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        measure()
        const { width, height } = sizeRef.current
        bodiesRef.current.forEach((body) => {
          if (body.node?.isConnected) {
            body.w = body.node.offsetWidth
            body.h = body.node.offsetHeight
          }
          body.x = Math.min(Math.max(0, body.x), Math.max(0, width - body.w))
          body.y = Math.min(Math.max(0, body.y), Math.max(0, height - body.h))
        })
        if (reducedRef.current) renderStatic()
      })
      : null
    if (resizeObserver) resizeObserver.observe(field)

    document.addEventListener('visibilitychange', onVisibilityChange)
    rafRef.current = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [items])

  return (
    <div className={`float-field ${expandedId ? 'has-expanded' : ''}`} ref={fieldRef}>
      {items.map((item, index) => (
        <div
          className={`float-anchor ${expandedId === item.id ? 'is-expanded' : ''}`}
          key={item.id}
          data-float-id={String(item.id)}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}
