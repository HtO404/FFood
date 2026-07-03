/**
 * 同义词归一化 + 单位换算
 */

import { SYNONYM_MAP } from './dictionary.js'

/**
 * 将食材名归一化到主名
 * 例：西红柿 → 番茄
 */
export function normalizeFoodName(name) {
  if (!name) return ''
  const trimmed = name.trim()
  return SYNONYM_MAP[trimmed] || trimmed
}

/**
 * 单位换算到目标单位（kg / 个 / 份）
 * 支持的源单位：斤 / 公斤 / 克 / g / kg / 磅 / 两 / 半斤 / 毫升 / L
 * @returns { {value:number, unit:string} }
 */
export function normalizeQuantity(value, unit) {
  const v = parseFloat(value)
  if (isNaN(v)) return { value: 0, unit: unit || '个' }

  const u = (unit || '').trim()
  switch (u) {
    case 'kg':
    case '公斤':
      return { value: round1(v), unit: 'kg' }
    case '斤':
      return { value: round1(v * 0.5), unit: 'kg' }
    case '半斤':
      return { value: round1(0.25), unit: 'kg' }
    case '两':
      return { value: round1(v * 0.05), unit: 'kg' }
    case '克':
    case 'g':
      return { value: round1(v / 1000), unit: 'kg' }
    case '磅':
      return { value: round1(v * 0.4536), unit: 'kg' }
    case '毫升':
    case 'ml':
      // 毫升按 1g/ml 估算，转 kg
      return { value: round1(v / 1000), unit: 'kg' }
    case '升':
    case 'L':
      return { value: round1(v), unit: 'kg' }
    case '个':
    case '份':
    default:
      return { value: round1(v), unit: u || '个' }
  }
}

/**
 * 时间表达换算到天（用于"已放X天" → 购买日期）
 * @returns {number} 天数（0 表示今天）
 */
export function daysAgoToPurchaseDate(daysAgo) {
  if (!daysAgo || daysAgo < 0) daysAgo = 0
  const d = new Date()
  d.setDate(d.getDate() - Math.ceil(daysAgo))
  return d.toISOString().slice(0, 10)
}

/**
 * 时间表达换算到分钟（食谱用）
 * "15分钟" → 15
 * "1小时" → 60
 * "1小时30分钟" → 90
 */
export function timeToMinutes(value, unit) {
  const v = parseFloat(value)
  if (isNaN(v)) return 0
  if (unit === '小时' || unit === 'h') return Math.round(v * 60)
  if (unit === '天') return Math.round(v * 1440)
  return Math.round(v)  // 默认分钟
}

function round1(v) {
  return Math.round(v * 10) / 10
}
