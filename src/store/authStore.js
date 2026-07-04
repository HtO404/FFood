// 用户鉴权状态管理
import { reactive } from 'vue'
import { call, callAuth, tokenStore, IS_MOCK } from '../utils/cloud.js'

const state = reactive({
  isLoggedIn: false,
  user: null,        // { id, username, nickname, avatar }
  token: null,
  loading: false,
  error: ''
})

// 启动时自动校验 token（恢复登录态）
async function initAuth() {
  const token = tokenStore.get()
  if (!token) return
  state.token = token
  try {
    const res = await call('verifyToken', { token })
    if (res.code === 0 && res.data?.user) {
      state.isLoggedIn = true
      state.user = res.data.user
    } else {
      // token 无效，清理
      tokenStore.clear()
      state.token = null
    }
  } catch (e) {
    // 网络错误不清理 token，保留登录态（下次重试）
    console.warn('[authStore] verifyToken 失败:', e)
  }
}

async function login(username, password) {
  state.loading = true
  state.error = ''
  try {
    const res = await call('login', { username, password })
    if (res.code === 0 && res.data?.token) {
      state.isLoggedIn = true
      state.user = res.data.user
      state.token = res.data.token
      tokenStore.set(res.data.token)
      return { success: true }
    }
    state.error = res.message || '登录失败'
    return { success: false, message: res.message }
  } catch (e) {
    state.error = '网络错误，请稍后重试'
    return { success: false, message: '网络错误' }
  } finally {
    state.loading = false
  }
}

async function register(username, password) {
  state.loading = true
  state.error = ''
  try {
    const res = await call('register', { username, password })
    if (res.code === 0) {
      // 注册成功后自动登录
      return await login(username, password)
    }
    state.error = res.message || '注册失败'
    return { success: false, message: res.message }
  } catch (e) {
    state.error = '网络错误，请稍后重试'
    return { success: false, message: '网络错误' }
  } finally {
    state.loading = false
  }
}

async function wxLogin() {
  state.loading = true
  state.error = ''
  try {
    // 小程序端：先 wx.login 拿 code
    let code = ''
    if (typeof wx !== 'undefined' && wx.login) {
      code = await new Promise((resolve, reject) => {
        wx.login({ success: r => resolve(r.code), fail: reject })
      })
    }
    // H5 mock 模式：code 为空，云函数走 mock 分支
    const res = await call('wxLogin', { code })
    if (res.code === 0 && res.data?.token) {
      state.isLoggedIn = true
      state.user = res.data.user
      state.token = res.data.token
      tokenStore.set(res.data.token)
      return { success: true }
    }
    state.error = res.message || '微信登录失败'
    return { success: false, message: res.message }
  } catch (e) {
    state.error = '微信登录失败'
    return { success: false, message: '微信登录失败' }
  } finally {
    state.loading = false
  }
}

function logout() {
  state.isLoggedIn = false
  state.user = null
  state.token = null
  state.error = ''
  tokenStore.clear()
}

export const authStore = {
  state,
  initAuth,
  login,
  register,
  wxLogin,
  logout,
  IS_MOCK
}

export default authStore
