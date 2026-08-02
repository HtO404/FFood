/**
 * normalizer 单元测试
 */
import { describe, it, expect } from 'vitest'
import { normalizeFoodName, normalizeQuantity, timeToMinutes, daysAgoToPurchaseDate } from '../src/nlp/normalizer.js'

describe('normalizeFoodName', () => {
  it('同义词归一化：西红柿 → 番茄', () => {
    expect(normalizeFoodName('西红柿')).toBe('番茄')
  })

  it('无同义词时返回原名', () => {
    expect(normalizeFoodName('白菜')).toBe('白菜')
  })

  it('空输入返回空字符串', () => {
    expect(normalizeFoodName('')).toBe('')
    expect(normalizeFoodName(null)).toBe('')
  })

  it('trim 空白', () => {
    expect(normalizeFoodName('  土豆  ')).toBe('土豆')
  })
})

describe('normalizeQuantity', () => {
  it('斤 → kg（×0.5）', () => {
    expect(normalizeQuantity(2, '斤')).toEqual({ value: 1, unit: 'kg' })
  })

  it('克 → kg（÷1000）', () => {
    expect(normalizeQuantity(500, 'g')).toEqual({ value: 0.5, unit: 'kg' })
  })

  it('半斤 → 0.3 kg（round1(0.25)=0.3）', () => {
    expect(normalizeQuantity(1, '半斤')).toEqual({ value: 0.3, unit: 'kg' })
  })

  it('磅 → kg（×0.4536）', () => {
    const r = normalizeQuantity(1, '磅')
    expect(r.value).toBeCloseTo(0.5, 1)
    expect(r.unit).toBe('kg')
  })

  it('个 保持不变', () => {
    expect(normalizeQuantity(3, '个')).toEqual({ value: 3, unit: '个' })
  })

  it('份 保持不变', () => {
    expect(normalizeQuantity(2, '份')).toEqual({ value: 2, unit: '份' })
  })

  it('无效输入返回 0', () => {
    expect(normalizeQuantity('abc', '个')).toEqual({ value: 0, unit: '个' })
  })
})

describe('timeToMinutes', () => {
  it('分钟直传', () => {
    expect(timeToMinutes(15, '分钟')).toBe(15)
  })

  it('小时 → 分钟（×60）', () => {
    expect(timeToMinutes(1, '小时')).toBe(60)
  })

  it('1.5 小时 = 90 分钟', () => {
    expect(timeToMinutes(1.5, '小时')).toBe(90)
  })

  it('天 → 分钟（×1440）', () => {
    expect(timeToMinutes(1, '天')).toBe(1440)
  })

  it('无效输入返回 0', () => {
    expect(timeToMinutes('abc', '分钟')).toBe(0)
  })
})

describe('daysAgoToPurchaseDate', () => {
  it('0 天前 = 今天', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(daysAgoToPurchaseDate(0)).toBe(today)
  })

  it('3 天前 = 3 天前的日期', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    expect(daysAgoToPurchaseDate(3)).toBe(d.toISOString().slice(0, 10))
  })

  it('负数容错为 0', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(daysAgoToPurchaseDate(-5)).toBe(today)
  })
})
