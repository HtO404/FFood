<template>
  <div class="captcha-box">
    <canvas
      ref="canvasEl"
      class="captcha-canvas"
      width="120"
      height="44"
      @click="refresh"
      title="点击刷新验证码"
    ></canvas>
    <button type="button" class="captcha-refresh" @click="refresh" :disabled="loading">↻</button>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { call, IS_MOCK } from '../utils/cloud.js'

const props = defineProps({
  // 验证码类型：image 图形验证码（登录/注册用），sms 短信验证码前置校验
  type: { type: String, default: 'image' }
})

const emit = defineEmits(['update', 'error'])

const canvasEl = ref(null)
const loading = ref(false)
const captchaId = ref('')
const code = ref('')

// 生成 mock 验证码（本地随机，不调后端）
function genMockCode(len = 4) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// canvas 渲染验证码图片
function drawCanvas(text) {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  // 背景
  ctx.fillStyle = '#f2f2f7'
  ctx.fillRect(0, 0, w, h)

  // 干扰线
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(${rand(100, 200)},${rand(100, 200)},${rand(100, 200)},0.4)`
    ctx.beginPath()
    ctx.moveTo(rand(0, w), rand(0, h))
    ctx.lineTo(rand(0, w), rand(0, h))
    ctx.stroke()
  }

  // 干扰点
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${rand(100, 200)},${rand(100, 200)},${rand(100, 200)},0.5)`
    ctx.fillRect(rand(0, w), rand(0, h), 1, 1)
  }

  // 字符
  const colors = ['#007aff', '#ff3b30', '#34c759', '#ff9500', '#af52de']
  const chars = text.split('')
  const charW = w / (chars.length + 1)
  chars.forEach((ch, i) => {
    ctx.save()
    ctx.font = `bold ${rand(22, 28)}px -apple-system, sans-serif`
    ctx.fillStyle = colors[rand(0, colors.length - 1)]
    ctx.translate(charW * (i + 1), h / 2)
    ctx.rotate((rand(-15, 15) * Math.PI) / 180)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function refresh() {
  loading.value = true
  try {
    if (IS_MOCK) {
      // mock 模式：本地生成
      const mockCode = genMockCode(4)
      const mockId = 'mock_cap_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      captchaId.value = mockId
      code.value = mockCode
      drawCanvas(mockCode)
      emit('update', { captchaId: mockId, code: mockCode })
    } else {
      // 真后端：调 createCaptcha 云函数
      const res = await call('createCaptcha', { type: props.type })
      if (res.code === 0 && res.data) {
        captchaId.value = res.data.captchaId
        code.value = res.data.code
        drawCanvas(res.data.code)
        emit('update', { captchaId: res.data.captchaId, code: res.data.code })
      } else {
        emit('error', res.message || '获取验证码失败')
      }
    }
  } catch (e) {
    emit('error', '网络错误，点击刷新重试')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
})

// 暴露刷新方法给父组件
defineExpose({ refresh })
</script>
