<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Logo & 标题 -->
      <div class="auth-header">
        <div class="auth-logo">🥬</div>
        <h1 class="auth-title">FFood</h1>
        <p class="auth-subtitle">家庭食材管理</p>
      </div>

      <!-- 表单卡片 -->
      <div class="auth-card">
        <!-- 切换登录/注册 -->
        <div class="auth-tabs">
          <button :class="['auth-tab', { active: mode === 'login' }]" @click="switchMode('login')">登录</button>
          <button :class="['auth-tab', { active: mode === 'register' }]" @click="switchMode('register')">注册</button>
        </div>

        <!-- 表单 -->
        <form class="auth-form" @submit.prevent="onSubmit">
          <div class="auth-field">
            <label class="auth-label">用户名</label>
            <input
              v-model.trim="username"
              type="text"
              class="auth-input"
              placeholder="3-20 位字母/数字/汉字"
              maxlength="20"
              autocomplete="username"
              @input="validateUsername"
            />
            <div v-if="errors.username" class="auth-error">{{ errors.username }}</div>
          </div>

          <div class="auth-field">
            <label class="auth-label">密码</label>
            <div class="password-row">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="auth-input"
                placeholder="6-32 位，需含字母和数字"
                maxlength="32"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                @input="validatePassword"
              />
              <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div v-if="errors.password" class="auth-error">{{ errors.password }}</div>
          </div>

          <div class="auth-field" v-if="mode === 'register'">
            <label class="auth-label">确认密码</label>
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              class="auth-input"
              placeholder="再次输入密码"
              maxlength="32"
              autocomplete="new-password"
              @input="validateConfirmPassword"
            />
            <div v-if="errors.confirmPassword" class="auth-error">{{ errors.confirmPassword }}</div>
          </div>

          <!-- 图形验证码 -->
          <div class="auth-field">
            <label class="auth-label">图形验证码</label>
            <div class="captcha-row">
              <input
                v-model="captchaCode"
                type="text"
                class="auth-input captcha-input"
                placeholder="输入图中字符"
                maxlength="4"
                autocomplete="off"
                @input="captchaCode = captchaCode.toUpperCase()"
              />
              <CaptchaCanvas ref="captchaRef" @update="onCaptchaUpdate" @error="onCaptchaError" />
            </div>
            <div v-if="captchaError" class="auth-error">{{ captchaError }}</div>
          </div>

          <!-- 全局错误 -->
          <div v-if="authStore.state.error" class="auth-error auth-error-global">
            ⚠️ {{ authStore.state.error }}
          </div>

          <!-- 提交按钮 -->
          <button type="submit" class="auth-submit" :disabled="authStore.state.loading || !canSubmit">
            <span v-if="authStore.state.loading" class="auth-loading"></span>
            {{ mode === 'login' ? '登录' : '注册' }}
          </button>
        </form>

        <!-- 分隔线 -->
        <div class="auth-divider">
          <span class="auth-divider-line"></span>
          <span class="auth-divider-text">或</span>
          <span class="auth-divider-line"></span>
        </div>

        <!-- 微信登录 -->
        <button class="auth-wx-btn" @click="onWxLogin" :disabled="authStore.state.loading">
          <span class="auth-wx-icon">💚</span>
          微信登录
        </button>
      </div>

      <!-- Mock 模式提示 -->
      <div class="auth-mock-hint" v-if="authStore.IS_MOCK">
        🧪 演示模式：登录数据仅存本地浏览器，未接真后端。配好云开发后切真鉴权。
      </div>

      <!-- 试玩入口 -->
      <button class="auth-guest" @click="$emit('guest')">先逛逛看 →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { authStore } from '../store/authStore.js'
import CaptchaCanvas from './CaptchaCanvas.vue'

const emit = defineEmits(['guest', 'authed'])

const mode = ref('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const captchaCode = ref('')
const captchaId = ref('')
const captchaError = ref('')
const captchaRef = ref(null)
const errors = reactive({ username: '', password: '', confirmPassword: '' })

const canSubmit = computed(() => {
  if (!username.value || !password.value) return false
  if (mode.value === 'register' && !confirmPassword.value) return false
  if (!captchaCode.value || captchaCode.value.length !== 4) return false
  return !errors.username && !errors.password && !errors.confirmPassword
})

function onCaptchaUpdate({ captchaId: id, code }) {
  captchaId.value = id
  captchaError.value = ''
}

function onCaptchaError(msg) {
  captchaError.value = msg
}

function switchMode(m) {
  mode.value = m
  // 切换模式时刷新验证码，清空验证码输入
  captchaCode.value = ''
  captchaError.value = ''
  captchaRef.value?.refresh()
}

function validateUsername() {
  const v = username.value
  if (!v) { errors.username = ''; return }
  if (v.length < 3) { errors.username = '至少 3 个字符'; return }
  if (v.length > 20) { errors.username = '最多 20 个字符'; return }
  if (!/^[\u4e00-\u9fffa-zA-Z0-9_]+$/.test(v)) { errors.username = '仅支持字母、数字、汉字、下划线'; return }
  errors.username = ''
}

function validatePassword() {
  const v = password.value
  if (!v) { errors.password = ''; return }
  if (v.length < 6) { errors.password = '至少 6 位'; return }
  if (v.length > 32) { errors.password = '最多 32 位'; return }
  if (mode.value === 'register' && !/(?=.*[a-zA-Z])(?=.*\d)/.test(v)) {
    errors.password = '需同时包含字母和数字'; return
  }
  errors.password = ''
}

function validateConfirmPassword() {
  if (mode.value !== 'register') { errors.confirmPassword = ''; return }
  if (!confirmPassword.value) { errors.confirmPassword = ''; return }
  if (confirmPassword.value !== password.value) {
    errors.confirmPassword = '两次密码不一致'; return
  }
  errors.confirmPassword = ''
}

async function onSubmit() {
  validateUsername()
  validatePassword()
  validateConfirmPassword()
  if (errors.username || errors.password || errors.confirmPassword) return
  if (!captchaCode.value || captchaCode.value.length !== 4) {
    captchaError.value = '请输入 4 位验证码'
    return
  }

  const res = mode.value === 'login'
    ? await authStore.login(username.value, password.value, captchaId.value, captchaCode.value)
    : await authStore.register(username.value, password.value, captchaId.value, captchaCode.value)

  if (res.success) {
    emit('authed')
  } else {
    // 登录/注册失败：刷新验证码，清空用户输入（验证码已用掉）
    captchaCode.value = ''
    captchaRef.value?.refresh()
  }
}

async function onWxLogin() {
  const res = await authStore.wxLogin()
  if (res.success) emit('authed')
}
</script>
