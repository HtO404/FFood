import { createRouter, createWebHashHistory } from 'vue-router'
import { authStore } from '../store/authStore.js'

// 使用 hash 模式：兼容小程序封装和静态部署（无需服务端配置）
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/food',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/food',
      name: 'food',
      component: () => import('../views/FoodView.vue'),
      meta: { title: '🥬 食材管理' },
    },
    {
      path: '/shop',
      name: 'shop',
      component: () => import('../views/ShopView.vue'),
      meta: { title: '🛒 购物清单' },
    },
    {
      path: '/recipes',
      name: 'recipes',
      component: () => import('../views/RecipesView.vue'),
      meta: { title: '🍳 菜谱推荐' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { title: '👤 我的' },
    },
    // 兜底：未知路由回食材页
    {
      path: '/:pathMatch(.*)*',
      redirect: '/food',
    },
  ],
})

// 导航守卫：未登录且非游客时重定向到登录页
export const guestModeRef = { value: false }

router.beforeEach((to) => {
  // 登录页不需要守卫
  if (to.name === 'login') return true
  // 未登录且非游客 → 去登录
  if (!authStore.state.isLoggedIn && !guestModeRef.value) {
    return { name: 'login' }
  }
  return true
})

export default router
