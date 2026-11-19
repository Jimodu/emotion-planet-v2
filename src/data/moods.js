export const moods = [
  { id: 'rose', label: '玫瑰粉', color: '#E8B9BC', hint: '像傍晚落在窗边的光' },
  { id: 'apricot', label: '浅杏', color: '#EEC9A6', hint: '像刚晒到太阳的墙' },
  { id: 'cream', label: '奶油黄', color: '#F0E1AE', hint: '像一封没寄出的信' },
  { id: 'sprout', label: '嫩芽绿', color: '#D7DFA6', hint: '像春天刚长出的叶' },
  { id: 'mint', label: '薄荷绿', color: '#B9D9B6', hint: '像清晨的薄荷风' },
  { id: 'seafoam', label: '海盐青', color: '#A9D8CB', hint: '像退潮后的浅浅海水' },
  { id: 'mist', label: '雾蓝', color: '#A6C9DD', hint: '像雨后安静的天空' },
  { id: 'sky', label: '晴空蓝', color: '#B8C4E6', hint: '像很远的蓝色星球' },
  { id: 'lilac', label: '丁香紫', color: '#D0BFE6', hint: '像夜色里的一朵花' },
  { id: 'orchid', label: '木槿紫', color: '#E0BEDD', hint: '像温柔的旧梦' },
  { id: 'blossom', label: '樱花粉', color: '#EDBECC', hint: '像落在肩上的花瓣' },
  { id: 'coral', label: '珊瑚橘', color: '#E8B8B0', hint: '像傍晚最后一抹暖意' },
]

export const legacyMoods = [
  { id: 'calm', label: '平静', color: '#A8BFCB', hint: '像清晨的雾' },
  { id: 'joy', label: '喜悦', color: '#E6CC96', hint: '奶油色的光' },
  { id: 'tired', label: '疲惫', color: '#A9B4A0', hint: '灰豆绿的风' },
  { id: 'down', label: '低落', color: '#CFAFAE', hint: '淡灰粉的云' },
  { id: 'restless', label: '烦躁', color: '#DDAE91', hint: '浅杏色的火' },
]

export const getMood = (id) => moods.find((mood) => mood.id === id) || legacyMoods.find((mood) => mood.id === id) || moods[0]

export function normalizeHex(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split('').map((char) => char + char).join('').toUpperCase()}`
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`
  return null
}

export function hexToHsl(value) {
  const hex = normalizeHex(value)
  if (!hex) return { h: 0, s: 0, l: 80 }
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToHex(h, s, l) {
  const hue = ((Number(h) || 0) % 360 + 360) % 360
  const sat = Math.min(100, Math.max(0, Number(s) || 0)) / 100
  const light = Math.min(100, Math.max(0, Number(l) || 0)) / 100
  const a = sat * Math.min(light, 1 - light)
  const channel = (n) => {
    const k = (n + hue / 30) % 12
    const value = light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}

export function applyIntensity(hex, intensity) {
  const { h, s } = hexToHsl(hex)
  const ratio = Math.min(100, Math.max(0, Number(intensity) || 0)) / 100
  const lightness = Math.round((0.92 - ratio * 0.56) * 100)
  return hslToHex(h, Math.min(100, s + Math.round(ratio * 10)), lightness)
}

export function getContrastColor(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return '#FFFFFF'
  const channels = normalized.slice(1).match(/../g).map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return luminance > 0.45 ? '#4B4642' : '#FFFFFF'
}
