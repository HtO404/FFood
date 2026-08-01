/**
 * 推荐品类到期提醒服务
 * 
 * 两种提醒：
 * 1. 食材临期提醒 — 检查冰箱中的食材是否即将过期
 * 2. 推荐品类更换提醒 — 检查日用品（牙刷头/毛巾等）是否到了建议更换周期
 * 
 * 数据持久化：localStorage（ffood_reminders）
 * 通知方式：浏览器 Notification API
 */

const REMINDER_KEY = 'ffood_reminders'

// 推荐品类默认数据
const RECOMMEND_CATEGORIES = [
  { name: '牙刷头', emoji: '🪥', cycle: 90, desc: '每3个月更换，刷毛变形需提前' },
  { name: '毛巾', emoji: '🧖', cycle: 90, desc: '每3个月更换，日常保持干燥' },
  { name: '洗碗海绵', emoji: '🧽', cycle: 30, desc: '每月更换，避免细菌滋生' },
  { name: '砧板', emoji: '🪵', cycle: 365, desc: '每年更换，有深痕及时换' },
  { name: '枕头', emoji: '😴', cycle: 730, desc: '1-2年更换，保持颈椎健康' },
  { name: '隐形眼镜盒', emoji: '👁️', cycle: 90, desc: '每3个月更换' },
  { name: '床单被套', emoji: '🛏️', cycle: 14, desc: '每2周清洗更换' },
  { name: '厨房抹布', emoji: '🧹', cycle: 7, desc: '每周更换或高温消毒' },
  { name: '滤水器滤芯', emoji: '💧', cycle: 180, desc: '每6个月更换' },
  { name: '浴花', emoji: '🚿', cycle: 60, desc: '每2个月更换' },
]

/**
 * 加载提醒数据
 */
function loadReminders() {
  try {
    const raw = localStorage.getItem(REMINDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('[reminders] 加载失败:', e)
  }
  return { categoryItems: [] }
}

/**
 * 保存提醒数据
 */
function saveReminders(data) {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('[reminders] 保存失败:', e)
  }
}

/**
 * 初始化推荐品类追踪
 * 用户首次设置更换日期后开始追踪
 */
function initCategoryItem(name, startDate) {
  const data = loadReminders()
  const existing = data.categoryItems.find(i => i.name === name)
  if (existing) return existing

  const item = {
    name,
    startDate: startDate || new Date().toISOString().slice(0, 10),
    notifiedAt: null,  // 上次通知日期
  }
  data.categoryItems.push(item)
  saveReminders(data)
  return item
}

/**
 * 设置推荐品类的开始日期
 */
function setCategoryStartDate(name, startDate) {
  const data = loadReminders()
  const idx = data.categoryItems.findIndex(i => i.name === name)
  if (idx >= 0) {
    data.categoryItems[idx].startDate = startDate
    data.categoryItems[idx].notifiedAt = null
  } else {
    data.categoryItems.push({ name, startDate, notifiedAt: null })
  }
  saveReminders(data)
}

/**
 * 移除推荐品类追踪
 */
function removeCategoryItem(name) {
  const data = loadReminders()
  data.categoryItems = data.categoryItems.filter(i => i.name !== name)
  saveReminders(data)
}

/**
 * 计算推荐品类的到期状态
 */
function getCategoryStatus(name) {
  const cat = RECOMMEND_CATEGORIES.find(c => c.name === name)
  if (!cat) return null

  const data = loadReminders()
  const item = data.categoryItems.find(i => i.name === name)
  if (!item) return { ...cat, tracked: false }

  const start = new Date(item.startDate)
  const now = new Date()
  const daysPassed = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  const daysLeft = cat.cycle - daysPassed

  return {
    ...cat,
    tracked: true,
    startDate: item.startDate,
    daysPassed,
    daysLeft,
    overdue: daysLeft <= 0,
    urgent: daysLeft > 0 && daysLeft <= 7,
  }
}

/**
 * 获取所有推荐品类的状态
 */
function getAllCategoryStatus() {
  return RECOMMEND_CATEGORIES.map(c => getCategoryStatus(c.name))
}

/**
 * 检查并发送到期提醒
 * @param {Array} foods - 当前食材列表（含 daysLeft 字段）
 * @returns {Array} 提醒消息列表
 */
function checkAndNotify(foods = []) {
  const notifications = []

  // 1. 食材临期提醒
  const expiringSoon = foods.filter(f => {
    const left = parseInt(f.daysLeft)
    return left !== NaN && left <= 3
  })

  expiringSoon.forEach(f => {
    const msg = f.daysLeft <= 0
      ? `⚠️ ${f.name} 已过期！请及时处理`
      : `⏰ ${f.name} 还有 ${f.daysLeft} 天过期`
    notifications.push({ type: 'food', name: f.name, message: msg, daysLeft: f.daysLeft })
  })

  // 2. 推荐品类更换提醒
  const data = loadReminders()
  const today = new Date().toISOString().slice(0, 10)

  data.categoryItems.forEach(item => {
    const cat = RECOMMEND_CATEGORIES.find(c => c.name === item.name)
    if (!cat) return

    const status = getCategoryStatus(item.name)
    if (!status) return

    // 今天已通知过则跳过
    if (item.notifiedAt === today) return

    if (status.overdue) {
      const msg = `🔄 ${cat.emoji} ${item.name} 已超过建议更换周期 ${Math.abs(status.daysLeft)} 天，建议更换`
      notifications.push({ type: 'category', name: item.name, message: msg, daysLeft: status.daysLeft })
      item.notifiedAt = today
    } else if (status.urgent) {
      const msg = `📅 ${cat.emoji} ${item.name} 建议在 ${status.daysLeft} 天内更换`
      notifications.push({ type: 'category', name: item.name, message: msg, daysLeft: status.daysLeft })
      item.notifiedAt = today
    }
  })

  saveReminders(data)

  // 发送浏览器通知
  if (notifications.length > 0 && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      notifications.forEach(n => {
        new Notification('FFood 提醒', { body: n.message, icon: '/favicon.ico' })
      })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          notifications.forEach(n => {
            new Notification('FFood 提醒', { body: n.message, icon: '/favicon.ico' })
          })
        }
      })
    }
  }

  return notifications
}

/**
 * 请求通知权限
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export const reminderService = {
  RECOMMEND_CATEGORIES,
  initCategoryItem,
  setCategoryStartDate,
  removeCategoryItem,
  getCategoryStatus,
  getAllCategoryStatus,
  checkAndNotify,
  requestNotificationPermission,
}

export function getRecommendedCategories() {
  return RECOMMEND_CATEGORIES.map(c => ({
    name: c.name,
    emoji: c.emoji,
    desc: c.desc,
    cycle: c.cycle,
  }))
}

export default reminderService
