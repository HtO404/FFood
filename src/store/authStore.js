// 用户鉴权状态管理（双模式：REST API / 云函数+Mock）
import { reactive } from 'vue'
import { call, callAuth, tokenStore, IS_MOCK } from '../utils/cloud.js'
import { authApi, IS_ONLINE } from '../utils/api.js'

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

  // 在线模式：走 REST API
  if (IS_ONLINE) {
    try {
      const res = await authApi.verify()
      if (res.code === 0 && res.data?.user) {
        state.isLoggedIn = true
        state.user = res.data.user
      } else {
        // token 无效，尝试刷新
        try {
          const refreshRes = await authApi.refresh()
          if (refreshRes.code === 0 && refreshRes.data?.token) {
            tokenStore.set(refreshRes.data.token)
            state.isLoggedIn = true
            state.user = refreshRes.data.user
            return
          }
        } catch (e) {
          // 刷新也失败
        }
        tokenStore.clear()
        state.token = null
      }
    } catch (e) {
      // 网络错误不清理 token，保留登录态（下次重试）
      console.warn('[authStore] API verifyToken 失败:', e)
    }
    return
  }

  // 离线模式：走云函数/mock
  try {
    const res = await call('verifyToken', { token })
    if (res.code === 0 && res.data?.user) {
      state.isLoggedIn = true
      state.user = res.data.user
    } else {
      tokenStore.clear()
      state.token = null
    }
  } catch (e) {
    console.warn('[authStore] verifyToken 失败:', e)
  }
}

async function login(username, password, captchaId, captchaCode) {
  state.loading = true
  state.error = ''
  try {
    let res
    if (IS_ONLINE) {
      res = await authApi.login(username, password, captchaId, captchaCode)
    } else {
      res = await call('login', { username, password, captchaId, captchaCode })
    }

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

async function register(username, password, captchaId, captchaCode) {
  state.loading = true
  state.error = ''
  try {
    let res
    if (IS_ONLINE) {
      res = await authApi.register(username, password, captchaId, captchaCode)
    } else {
      res = await call('register', { username, password, captchaId, captchaCode })
    }

    if (res.code === 0) {
      // 注册成功后自动登录
      return await login(username, password, captchaId, captchaCode)
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
    // 在线模式暂不支持微信登录，提示用户
    if (IS_ONLINE) {
      state.error = '在线模式暂不支持微信登录'
      return { success: false, message: '在线模式暂不支持微信登录，请使用账号登录' }
    }

    let code = ''
    if (typeof wx !== 'undefined' && wx.login) {
      code = await new Promise((resolve, reject) => {
        wx.login({ success: r => resolve(r.code), fail: reject })
      })
    }
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
  IS_MOCK,
  IS_ONLINE
}

export default authStore
