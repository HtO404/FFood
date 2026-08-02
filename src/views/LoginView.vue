<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthPage from '../components/AuthPage.vue'
import { guestModeRef } from '../router/index.js'

const router = useRouter()
const guestMode = ref(false)

function onGuest() {
  guestMode.value = true
  guestModeRef.value = true
  router.push({ name: 'food' })
}

function onAuthed() {
  guestMode.value = false
  guestModeRef.value = false
  router.push({ name: 'food' })
}
</script>

<template>
  <AuthPage v-if="!guestMode" @guest="onGuest" @authed="onAuthed" />
  <div v-else class="login-guest-placeholder">
    <div class="empty-state">
      <div class="empty-icon">👻</div>
      <div class="empty-text">游客模式</div>
      <div class="empty-hint">未登录浏览，数据仅保存在本机</div>
      <button class="empty-cta" @click="guestMode = false">去登录</button>
    </div>
  </div>
</template>
