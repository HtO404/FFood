// 云函数调用封装（H5 端用 HTTP 触发器，小程序端用 wx.cloud.callFunction）
// 未配置 HTTP_BASE 时自动走 mock 模式（localStorage 模拟登录，方便前端开发）

const CONFIG = {
  // 云开发环境 ID（小程序端 wx.cloud.init 用）
  ENV_ID: '',

  // HTTP 触发器基础 URL（H5 端调用用）
  // 部署云函数后填入，形如：https://<env-id>.service.tcloudbasegateway.com
  // 留空则走 mock 模式（本地模拟登录，不调真后端）
  HTTP_BASE: '',

  // 各云函数的 HTTP 路径
  FUNCTION_PATHS: {
    register: '/register',
    login: '/login',
    wxLogin: '/wxLogin',
    verifyToken: '/verifyToken',
    sendSms: '/sendSms'
  }
}

// 是否启用 mock 模式（未配置 HTTP_BASE 时自动启用）
export const IS_MOCK = !CONFIG.HTTP_BASE

/**
 * 通过 HTTP 触发器调用云函数（H5 端用）
 */
async function callHttp(fnName, data = {}, opts = {}) {
  const path = CONFIG.FUNCTION_PATHS[fnName] || '/' + fnName
  const url = CONFIG.HTTP_BASE + path
  const method = opts.method || (data && Object.keys(data).length ? 'POST' : 'GET')
  const headers = { 'Content-Type': 'application/json' }
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token

  const init = { method, headers }
  if (method === 'POST') init.body = JSON.stringify(data)
  let finalUrl = url
  if (method === 'GET' && data && Object.keys(data).length) {
    const qs = new URLSearchParams(data).toString()
    finalUrl = url + (url.includes('?') ? '&' : '?') + qs
  }

  const res = await fetch(finalUrl, init)
  const json = await res.json()
  // 兼容 HTTP 触发器 { statusCode, body } 和直接 JSON 两种返回
  if (json && typeof json.body === 'string') {
    try { return JSON.parse(json.body) } catch (e) { return json }
  }
  return json
}

/**
 * 通过 wx.cloud.callFunction 调用（小程序端用）
 */
function callWx(fnName, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: fnName,
      data,
      success: (res) => resolve(res.result),
      fail: (err) => reject(err)
    })
  })
}

// ============ Mock 模式（本地模拟登录，方便前端开发测试） ============
// 用 localStorage 存模拟用户数据，密码用简单 hash（仅 mock 用，非真安全）
function mockHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return String(h)
}

function mockDelay(ms = 300) {
  return new Promise(r => setTimeout(r, ms))
}

function getMockUsers() {
  try {
    return JSON.parse(localStorage.getItem('ffood_mock_users') || '[]')
  } catch { return [] }
}

function setMockUsers(users) {
  localStorage.setItem('ffood_mock_users', JSON.stringify(users))
}

async function callMock(fnName, data = {}) {
  await mockDelay()
  const users = getMockUsers()

  switch (fnName) {
    case 'register': {
      const { username, password } = data
      if (!username || !password) return { code: 10002, message: '用户名或密码不能为空', data: null }
      if (users.find(u => u.username === username)) return { code: 10003, message: '用户名已存在', data: null }
      const user = {
        id: 'mock_' + Date.now().toString(36),
        username,
        passwordHash: mockHash(password),
        nickname: username,
        avatar: '',
        createdAt: new Date().toISOString(),
        lastLoginAt: null
      }
      users.push(user)
      setMockUsers(users)
      return { code: 0, message: '注册成功', data: { userId: user.id, username: user.username } }
    }
    case 'login': {
      const { username, password } = data
      const user = users.find(u => u.username === username)
      if (!user || user.passwordHash !== mockHash(password)) {
        return { code: 10004, message: '用户名或密码错误', data: null }
      }
      const token = 'mock_token_' + user.id + '_' + Date.now().toString(36)
      return { code: 0, message: '登录成功', data: { token, user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar } } }
    }
    case 'verifyToken': {
      const { token } = data
      if (!token || !token.startsWith('mock_token_')) return { code: 10005, message: 'token 无效', data: null }
      const userId = token.split('_')[2]
      const user = users.find(u => u.id === userId)
      if (!user) return { code: 10005, message: '用户不存在', data: null }
      return { code: 0, message: 'ok', data: { user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar } } }
    }
    case 'wxLogin': {
      // mock 微信登录：直接创建/返回一个 mock 微信用户
      const wxUser = users.find(u => u.openid === 'mock_openid')
      if (wxUser) {
        const token = 'mock_token_' + wxUser.id + '_' + Date.now().toString(36)
        return { code: 0, message: '登录成功', data: { token, user: { id: wxUser.id, username: wxUser.username, nickname: wxUser.nickname, avatar: wxUser.avatar } } }
      }
      const newUser = {
        id: 'mock_wx_' + Date.now().toString(36),
        username: '微信用户' + Math.floor(Math.random() * 10000),
        passwordHash: '',
        openid: 'mock_openid',
        nickname: '微信用户',
        avatar: '',
        createdAt: new Date().toISOString(),
        lastLoginAt: null
      }
      users.push(newUser)
      setMockUsers(users)
      const token = 'mock_token_' + newUser.id + '_' + Date.now().toString(36)
      return { code: 0, message: '登录成功', data: { token, user: { id: newUser.id, username: newUser.username, nickname: newUser.nickname, avatar: newUser.avatar } } }
    }
    default:
      return { code: 10099, message: 'mock 模式不支持该接口', data: null }
  }
}

/**
 * 端能力探测：自动选择调用方式
 * - 小程序端：wx.cloud.callFunction
 * - H5 已配置 HTTP_BASE：callHttp
 * - H5 未配置 HTTP_BASE：callMock（本地模拟）
 */
export function call(fnName, data = {}, opts = {}) {
  if (typeof wx !== 'undefined' && wx.cloud) {
    return callWx(fnName, data)
  }
  if (IS_MOCK) {
    return callMock(fnName, data)
  }
  return callHttp(fnName, data, opts)
}

// ============ token 本地存储 ============
export const tokenStore = {
  get() {
    if (typeof localStorage !== 'undefined') return localStorage.getItem('ffood_token')
    if (typeof wx !== 'undefined' && wx.getStorageSync) return wx.getStorageSync('ffood_token')
    return null
  },
  set(token) {
    if (typeof localStorage !== 'undefined') localStorage.setItem('ffood_token', token)
    else if (typeof wx !== 'undefined' && wx.setStorageSync) wx.setStorageSync('ffood_token', token)
  },
  clear() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ffood_token')
    else if (typeof wx !== 'undefined' && wx.removeStorageSync) wx.removeStorageSync('ffood_token')
  }
}

/**
 * 调用受保护接口（自动带上 token）
 */
export async function callAuth(fnName, data = {}) {
  const token = tokenStore.get()
  return call(fnName, { ...data, token }, { token })
}

export default CONFIG
