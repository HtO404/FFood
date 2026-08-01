/**
 * 后端 API 客户端
 * 自动检测：如果配置了 API_BASE 则走真后端，否则 fallback 到 localStorage（现有 mock 模式）
 * 这样前端可以渐进式迁移，不破坏现有功能
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''  // 例如 http://localhost:3000/api

export const IS_ONLINE = !!API_BASE

/**
 * 获取存储的 JWT token
 */
function getToken() {
  return localStorage.getItem('ffood_token') || ''
}

/**
 * 统一请求函数
 */
async function request(path, options = {}) {
  if (!IS_ONLINE) {
    throw new Error('API_BASE 未配置，请使用 localStorage 模式')
  }

  const url = API_BASE + path
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`)
  }

  return data
}

// ============ 鉴权 API ============

export const authApi = {
  register: (username, password, captchaId, captchaCode) =>
    request('/auth/register', { method: 'POST', body: { username, password, captchaId, captchaCode } }),

  login: (username, password, captchaId, captchaCode) =>
    request('/auth/login', { method: 'POST', body: { username, password, captchaId, captchaCode } }),

  verify: () =>
    request('/auth/verify', { method: 'GET' }),

  refresh: () =>
    request('/auth/refresh', { method: 'POST' }),
}

// ============ 食材 API ============

export const foodApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/foods${qs ? '?' + qs : ''}`, { method: 'GET' })
  },

  create: (data) =>
    request('/foods', { method: 'POST', body: {
      ...data,
      // 同时发送 snake_case 版本，确保后端兼容
      purchase_date: data.purchaseDate || data.purchase_date,
      expiry_date: data.expiryDate || data.expiry_date,
    } }),

  update: (id, data) =>
    request(`/foods/${id}`, { method: 'PUT', body: data }),

  remove: (id) =>
    request(`/foods/${id}`, { method: 'DELETE' }),

  batchDelete: (ids) =>
    request('/foods/batch-delete', { method: 'POST', body: { ids } }),
}

// ============ 分类 API ============

export const categoryApi = {
  list: () =>
    request('/categories', { method: 'GET' }),
}

// ============ 智能推荐 API ============

export const smartApi = {
  /**
   * 智能推荐保存天数
   * @param {string} name - 食材名称
   * @param {string} category - 分类
   * @param {string} storage - 储存方式
   * @returns {Promise<{days: number, reason: string, source: 'static' | 'ai'}>}
   */
  shelfLife: (name, category, storage) =>
    request('/smart/shelf-life', { method: 'POST', body: { name, category, storage } }),

  /**
   * 推荐品类（如牙刷头一个月一换）
   * @returns {Promise<Array<{name: string, cycle: number, emoji: string, desc: string}>>}
   */
  recommend: () =>
    request('/smart/recommend', { method: 'GET' }),
}

export default { authApi, foodApi, categoryApi, smartApi, IS_ONLINE }
