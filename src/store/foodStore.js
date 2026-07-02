import { reactive, computed } from 'vue'

const STORAGE_KEY = 'ffood_data'

class FoodStore {
  constructor() {
    this.state = reactive({
      foods: []
    })
  }

  get foods() {
    return this.state.foods
  }

  get totalCount() {
    return this.state.foods.length
  }

  addFood(item) {
    const food = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: item.name.trim(),
      quantity: item.quantity || 1,
      unit: item.unit || '个',
      category: item.category || '其他',
      expiryDate: item.expiryDate,
      storage: item.storage || '冷藏',
      createdAt: new Date().toISOString(),
    }
    // 计算剩余天数
    food.daysLeft = calcDaysLeft(food.expiryDate)
    this.state.foods.push(food)
    this.save()
  }

  updateFood(id, data) {
    const idx = this.state.foods.findIndex(f => f.id === id)
    if (idx === -1) return
    const updated = { ...this.state.foods[idx], ...data, id }
    updated.daysLeft = calcDaysLeft(updated.expiryDate)
    this.state.foods[idx] = updated
    this.save()
  }

  removeFood(id) {
    this.state.foods = this.state.foods.filter(f => f.id !== id)
    this.save()
  }

  save() {
    try {
      const data = this.state.foods.map(f => ({ ...f }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('保存失败:', e)
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
      console.error('加载失败:', e)
      this.state.foods = []
    }
  }
}

function calcDaysLeft(dateStr) {
  if (!dateStr) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
}

let instance = null

export function useFoodStore() {
  if (!instance) instance = new FoodStore()
  return instance
}
