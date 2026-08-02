<template>
  <div class="app" :class="{ 'app-login': route.name === 'login' }">
    <!-- ==================== 导航栏（登录页不显示） ==================== -->
    <header class="nav-bar" v-if="showNavBar">
      <div class="nav-title">{{ route.meta.title || '🥬 食材管理' }}</div>
      <div class="nav-actions">
        <button class="nav-btn" v-if="route.name === 'food'" @click="showStatsPanel = true" title="统计">📊</button>
        <button class="nav-btn" v-if="route.name === 'food'" @click="showBarcodeModal = true" title="扫码录入">📷</button>
        <div class="nav-count" v-if="route.name === 'food' && foodStore.totalCount">{{ foodStore.totalCount }} 件</div>
        <div class="nav-count" v-if="route.name === 'shop' && shopUncheckedCount">{{ shopUncheckedCount }} 待买</div>
      </div>
    </header>

    <!-- ==================== 路由视图 ==================== -->
    <main class="page-main">
      <router-view />
    </main>

    <!-- TabBar：仅主应用页面显示，登录页不显示 -->
    <nav class="tab-bar" v-if="showTabBar">
      <button :class="['tab-item', { active: route.name === 'food' }]" @click="switchTab('food')">
        <span class="tab-icon">🥬</span><span class="tab-label">食材</span>
      </button>
      <button :class="['tab-item', { active: route.name === 'recipes' }]" @click="switchTab('recipes')">
        <span class="tab-icon">🍳</span><span class="tab-label">菜谱</span>
      </button>
      <button class="tab-item tab-center" @click="onCenterAdd">
        <span class="tab-center-btn">+</span>
      </button>
      <button :class="['tab-item', { active: route.name === 'shop' }]" @click="switchTab('shop')">
        <span class="tab-icon">🛒</span><span class="tab-label">购物</span>
        <span class="tab-badge" v-if="shopUncheckedCount">{{ shopUncheckedCount }}</span>
      </button>
      <button :class="['tab-item', { active: route.name === 'profile' }]" @click="switchTab('profile')">
        <span class="tab-icon">👤</span><span class="tab-label">我的</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFoodStore } from './store/foodStore.js'
import { authStore } from './store/authStore.js'
import { guestModeRef } from './router/index.js'

const route = useRoute()
const router = useRouter()
const foodStore = useFoodStore()

const guestMode = ref(false)
const showStatsPanel = ref(false)
const showBarcodeModal = ref(false)

const shopUncheckedCount = computed(() => foodStore.getShopListSorted().filter(i => !i.checked).length)
const showTabBar = computed(() => ['food', 'shop', 'recipes', 'profile'].includes(route.name))
const showNavBar = computed(() => route.name !== 'login')

// 游客模式：与路由守卫共享状态
function enterGuest() {
  guestMode.value = true
  guestModeRef.value = true
  router.push({ name: 'food' })
}
function onAuthed() {
  router.push({ name: 'food' })
}
// 上述两个函数由 LoginView 内部处理，这里保留以备外部触发
window.__ffoodEnterGuest = enterGuest
window.__ffoodAuthed = onAuthed

function switchTab(tab) {
  router.push({ name: tab })
}

// 导航栏中间添加按钮：根据当前 tab 触发对应添加操作
function onCenterAdd() {
  switch (route.name) {
    case 'recipes': emitToView('open-add-recipe'); break
    case 'shop': emitToView('focus-shop-input'); break
    case 'profile': router.push({ name: 'food' }); emitToView('open-add-food'); break
    default: emitToView('open-add-food')
  }
}

// 简单事件总线：通过 window 自定义事件传给当前视图
const VIEW_EVENT = 'ffood-view-event'
function emitToView(action) {
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { action } }))
}

onMounted(() => {
  authStore.initAuth()
  foodStore.load()
  foodStore.loadTemplates()
  foodStore.loadShopList()
  foodStore.loadRecipes()
  foodStore.loadUser()
  // 推荐品类到期提醒检查
  import('./utils/reminderService.js').then(({ reminderService }) => reminderService.checkAndNotify(foodStore.state.foods))
  // 监听视图事件：退出登录后退出游客模式
  window.addEventListener('ffood-view-event', (e) => {
    if (e.detail?.action === 'logout') {
      guestMode.value = false
      guestModeRef.value = false
      router.push({ name: 'login' })
    }
  })
})
</script>
