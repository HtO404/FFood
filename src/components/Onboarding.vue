<template>
  <Transition name="onboard">
    <div v-if="visible" class="onboard-overlay">
      <div class="onboard-card">
        <div class="onboard-emoji">{{ steps[current].emoji }}</div>
        <h2 class="onboard-title">{{ steps[current].title }}</h2>
        <p class="onboard-desc">{{ steps[current].desc }}</p>
        <div class="onboard-dots">
          <span
            v-for="(_, i) in steps"
            :key="i"
            :class="['onboard-dot', { active: i === current }]"
          ></span>
        </div>
        <div class="onboard-actions">
          <button class="onboard-skip" @click="finish">跳过</button>
          <button class="onboard-next" @click="next">
            {{ current === steps.length - 1 ? '开始使用' : '下一步' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'ffood_onboarded'
const visible = ref(false)
const current = ref(0)

const steps = [
  {
    emoji: '🥬',
    title: '添加食材，一目了然',
    desc: '手动输入或粘贴文本（如"2个西红柿冷藏"），AI 自动识别填入名称、数量、分类和保存方式。',
  },
  {
    emoji: '📋',
    title: '粘贴智能填充',
    desc: '复制一段菜谱或食材清单，粘贴后自动分词提取——名称、数量、单位、保质期一键填好。',
  },
  {
    emoji: '⏰',
    title: '到期提醒，减少浪费',
    desc: '食材快过期时浏览器自动推送通知，推荐品类（牙刷头、抹布等）也会提醒你定期更换。',
  },
]

onMounted(() => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    visible.value = true
  }
})

function next() {
  if (current.value < steps.length - 1) {
    current.value++
  } else {
    finish()
  }
}

function finish() {
  localStorage.setItem(STORAGE_KEY, '1')
  visible.value = false
}
</script>

<style scoped>
.onboard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.onboard-card {
  background: #fff;
  border-radius: 20px;
  max-width: 360px;
  width: 100%;
  padding: 36px 28px 24px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.onboard-emoji {
  font-size: 56px;
  margin-bottom: 16px;
}
.onboard-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #1d1d1f;
}
.onboard-desc {
  font-size: 15px;
  line-height: 1.6;
  color: #6e6e73;
  margin: 0 0 28px;
}
.onboard-dots {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 24px;
}
.onboard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d1d6;
  transition: all .2s;
}
.onboard-dot.active {
  background: #34c759;
  width: 24px;
  border-radius: 4px;
}
.onboard-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.onboard-skip {
  background: none;
  border: none;
  color: #8e8e93;
  font-size: 15px;
  padding: 8px 12px;
  cursor: pointer;
}
.onboard-next {
  background: #34c759;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 10px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.onboard-next:active {
  opacity: 0.85;
}
.onboard-enter-active, .onboard-leave-active {
  transition: opacity .3s;
}
.onboard-enter-from, .onboard-leave-to {
  opacity: 0;
}
</style>
