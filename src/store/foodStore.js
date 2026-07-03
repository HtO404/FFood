import { reactive } from 'vue'

const STORAGE_KEY = 'ffood_data'
const TEMPLATES_KEY = 'ffood_templates'
const SHOPLIST_KEY = 'ffood_shoplist'
const MAX_TEMPLATES = 20

class FoodStore {
  constructor() {
    this.state = reactive({
      foods: [],
      templates: [],
      shopList: [],
    })
  }

  get foods() { return this.state.foods }
  get totalCount() { return this.state.foods.length }
  get templates() { return this.state.templates }

  /** 消耗统计 */
  get stats() {
    let total = this.state.foods.length
    let expired = 0
    let expiringSoon = 0  // ≤1天
    let fresh = 0
    const byCategory = {}
    const byStorage = {}
    for (const f of this.state.foods) {
      const dl = calcDaysLeft(f.expiryDate)
      if (dl < 0) expired++
      else if (dl <= 1) expiringSoon++
      else fresh++
      byCategory[f.category] = (byCategory[f.category] || 0) + 1
      byStorage[f.storage] = (byStorage[f.storage] || 0) + 1
    }
    const wasteRate = total > 0 ? Math.round((expired / total) * 100) : 0
    return { total, expired, expiringSoon, fresh, wasteRate, byCategory, byStorage }
  }

  // ==================== 食材 CRUD ====================

  addFood(item) {
    const qty = clampFloat(item.quantity, 0.1, 99.9)
    const days = clampFloat(item.days, 0.1, 99.9)
    const purchaseDate = item.purchaseDate || todayStr()
    const expiryDate = calcExpiryDate(purchaseDate, days)

    const food = {
      id: genId(),
      name: item.name.trim(),
      quantity: qty,
      unit: item.unit || '个',
      days,
      category: item.category || '其他',
      purchaseDate,
      expiryDate,
      storage: item.storage || '冷藏',
      createdAt: new Date().toISOString(),
      daysLeft: calcDaysLeft(expiryDate),
    }
    this.state.foods.push(food)
    this.save()
    this.saveTemplate(item)  // 记忆表单
  }

  updateFood(id, data) {
    const idx = this.state.foods.findIndex(f => f.id === id)
    if (idx === -1) return
    const qty = clampFloat(data.quantity, 0.1, 99.9)
    const days = clampFloat(data.days, 0.1, 99.9)
    const purchaseDate = data.purchaseDate || this.state.foods[idx].purchaseDate || todayStr()
    const expiryDate = calcExpiryDate(purchaseDate, days)

    const updated = {
      ...this.state.foods[idx],
      ...data,
      id,
      quantity: qty,
      days,
      purchaseDate,
      expiryDate,
      daysLeft: calcDaysLeft(expiryDate),
    }
    this.state.foods[idx] = updated
    this.save()
  }

  removeFood(id) {
    this.state.foods = this.state.foods.filter(f => f.id !== id)
    this.save()
  }

  /** 批量删除 */
  removeFoods(ids) {
    const idSet = new Set(ids)
    this.state.foods = this.state.foods.filter(f => !idSet.has(f.id))
    this.save()
  }

  /** 标记已消耗（同删除，语义化别名） */
  markConsumed(ids) {
    this.removeFoods(ids)
  }

  // ==================== 持久化 ====================

  save() {
    try {
      const data = this.state.foods.map(f => ({ ...f }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[FFood] 保存失败:', e)
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        this.state.foods = data.map(f => ({
          ...f,
          daysLeft: calcDaysLeft(f.expiryDate),
        }))
      }
    } catch (e) {
      console.error('[FFood] 加载失败:', e)
      this.state.foods = []
    }
  }

  // ==================== 表单记忆模板 ====================

  /**
   * 保存模板：将表单数据（不含日期）存入模板列表
   * 去重：相同 name + category + unit → 更新 lastUsed
   */
  saveTemplate(item) {
    try {
      const key = `${item.name}|${item.category}|${item.unit}`
      const existing = this.state.templates.findIndex(
        t => `${t.name}|${t.category}|${t.unit}` === key
      )
      const tpl = {
        name: item.name.trim(),
        quantity: clampFloat(item.quantity, 0.1, 99.9),
        unit: item.unit || '个',
        category: item.category || '其他',
        storage: item.storage || '冷藏',
        lastUsed: Date.now(),
      }
      if (existing !== -1) {
        this.state.templates.splice(existing, 1)
      }
      this.state.templates.unshift(tpl)
      if (this.state.templates.length > MAX_TEMPLATES) {
        this.state.templates = this.state.templates.slice(0, MAX_TEMPLATES)
      }
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(this.state.templates))
    } catch (e) {
      console.error('[FFood] 模板保存失败:', e)
    }
  }

  removeTemplate(idx) {
    this.state.templates.splice(idx, 1)
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(this.state.templates))
  }

  loadTemplates() {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY)
      if (raw) {
        this.state.templates = JSON.parse(raw)
      }
    } catch (e) {
      console.error('[FFood] 模板加载失败:', e)
      this.state.templates = []
    }
  }

  // ==================== 购物清单 ====================

  get shopList() { return this.state.shopList }

  getShopListSorted() {
    return [...this.state.shopList].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1
      return b.createdAt - a.createdAt
    })
  }

  addShopItem(text) {
    if (!text || !text.trim()) return
    const item = {
      id: genId(),
      text: text.trim(),
      checked: false,
      createdAt: Date.now(),
    }
    this.state.shopList.push(item)
    this.saveShopList()
  }

  toggleShopItem(id) {
    const item = this.state.shopList.find(i => i.id === id)
    if (item) {
      item.checked = !item.checked
      this.saveShopList()
    }
  }

  removeShopItem(id) {
    this.state.shopList = this.state.shopList.filter(i => i.id !== id)
    this.saveShopList()
  }

  clearCheckedShopItems() {
    this.state.shopList = this.state.shopList.filter(i => !i.checked)
    this.saveShopList()
  }

  saveShopList() {
    try {
      localStorage.setItem(SHOPLIST_KEY, JSON.stringify(this.state.shopList))
    } catch (e) {
      console.error('[FFood] 购物清单保存失败:', e)
    }
  }

  loadShopList() {
    try {
      const raw = localStorage.getItem(SHOPLIST_KEY)
      if (raw) {
        this.state.shopList = JSON.parse(raw)
      }
    } catch (e) {
      console.error('[FFood] 购物清单加载失败:', e)
      this.state.shopList = []
    }
  }
}

// ==================== 工具函数 ====================

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function clampFloat(val, min, max) {
  const v = parseFloat(val)
  if (isNaN(v)) return min
  return Math.min(max, Math.max(min, Math.round(v * 10) / 10))
}

/**
 * 根据购买日期 + 保质期天数计算到期日
 */
function calcExpiryDate(purchaseDate, days) {
  const d = new Date(purchaseDate)
  d.setDate(d.getDate() + Math.ceil(days))
  return d.toISOString().slice(0, 10)
}

function calcDaysLeft(expiryDate) {
  if (!expiryDate) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
}

let instance = null

export function useFoodStore() {
  if (!instance) instance = new FoodStore()
  return instance
}

// ==================== 校验函数 ====================

export function validateFoodName(name) {
  if (!name || !name.trim()) {
    return { valid: false, message: '名称不能为空' }
  }
  const trimmed = name.trim()
  if (trimmed.length > 20) {
    return { valid: false, message: '名称不能超过20个字符' }
  }
  // 仅允许：汉字(\u4e00-\u9fff)、字母(a-zA-Z)、数字(0-9)、空格
  if (!/^[\u4e00-\u9fff\w\s]+$/.test(trimmed)) {
    return { valid: false, message: '名称只能包含汉字、字母和数字' }
  }
  return { valid: true, message: '' }
}

export function validateQuantity(val) {
  const v = parseFloat(val)
  if (isNaN(v) || v < 0.1) return { valid: false, message: '不能小于 0.1' }
  if (v > 99.9) return { valid: false, message: '不能超过 99.9' }
  return { valid: true, message: '' }
}

export function validateDays(val) {
  const v = parseFloat(val)
  if (isNaN(v) || v < 0.1) return { valid: false, message: '天数不能小于 0.1 天' }
  if (v > 99.9) return { valid: false, message: '天数不能超过 99.9 天' }
  return { valid: true, message: '' }
}
