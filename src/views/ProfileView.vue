<script setup>
import { ref, reactive, computed } from 'vue'
import { useFoodStore, GOAL_OPTIONS } from '../store/foodStore.js'
import { useFeatureStore } from '../store/featureStore.js'
import { authStore } from '../store/authStore.js'
import { getRecommendedCategories, reminderService } from '../utils/reminderService.js'

const foodStore = useFoodStore()
const featureStore = useFeatureStore()

const goalOptions = GOAL_OPTIONS
const userForm = reactive({ ...foodStore.user })
const randomRecipe = ref(null)

const nutritionSummary = computed(() => foodStore.getNutritionSummary())
const macroRingStyle = computed(() => {
  const r = nutritionSummary.value.macroRatio
  if (!r || r.carbs + r.protein + r.fat === 0) return {}
  const c1 = r.carbs, c2 = c1 + r.protein
  return { background: `conic-gradient(var(--orange) 0 ${c1}%, var(--blue) ${c1}% ${c2}%, var(--red) ${c2}% 100%)` }
})

function saveUserProfile() { foodStore.saveUser({ ...userForm }) }

// 推荐品类追踪
const recommendedCategoriesWithStatus = ref(reminderService.getAllCategoryStatus())
function refreshCategoryStatus() { recommendedCategoriesWithStatus.value = reminderService.getAllCategoryStatus() }
function startTrackingCategory(name) {
  reminderService.initCategoryItem(name, new Date().toISOString().slice(0, 10))
  refreshCategoryStatus()
}
function resetCategoryTracking(name) {
  reminderService.setCategoryStartDate(name, new Date().toISOString().slice(0, 10))
  refreshCategoryStatus()
}

function onLogout() { authStore.logout(); window.dispatchEvent(new CustomEvent('ffood-view-event', { detail: { action: 'logout' } })) }

// “今天吃什么”：由 RecipesView 处理（事件总线）
function pickRandomRecipe() {
  window.dispatchEvent(new CustomEvent('ffood-view-event', { detail: { action: 'pick-random-recipe' } }))
}
function goCook(recipe) {
  window.dispatchEvent(new CustomEvent('ffood-view-event', { detail: { action: 'cook-recipe', recipe } }))
}

defineExpose({ pickRandomRecipe: () => {}, randomRecipe })
</script>

<template>
  <div class="profile-list">
    <div class="profile-card profile-header-card">
      <div class="profile-avatar">{{ userForm.nickname ? userForm.nickname.slice(0, 1) : '👤' }}</div>
      <div class="profile-info">
        <div class="profile-name">{{ userForm.nickname || '未设置昵称' }}</div>
        <div class="profile-goal">{{ userForm.goal }}</div>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-card-title">个人资料</div>
      <div class="form-group">
        <label class="form-label">昵称</label>
        <input v-model="userForm.nickname" class="form-input" placeholder="怎么称呼你" maxlength="12" />
      </div>
      <template v-if="featureStore.state.flags.fitness">
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">身高（cm）</label>
            <input v-model.number="userForm.height" type="number" class="form-input" placeholder="0" min="1" max="300" />
          </div>
          <div class="form-group flex-1">
            <label class="form-label">体重（kg）</label>
            <input v-model.number="userForm.weight" type="number" class="form-input" placeholder="0" min="1" max="300" />
          </div>
          <div class="form-group flex-1">
            <label class="form-label">年龄</label>
            <input v-model.number="userForm.age" type="number" class="form-input" placeholder="0" min="1" max="150" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">健康目标</label>
          <div class="goal-picker">
            <button v-for="g in goalOptions" :key="g" :class="['goal-chip', { active: userForm.goal === g }]" @click="userForm.goal = g">{{ g }}</button>
          </div>
        </div>
      </template>
      <div v-else class="feature-mini-locked">💪 健身指标未开启，去下方「功能设置」打开后可填写身高/体重/健康目标</div>
      <button class="btn-save profile-save" @click="saveUserProfile">保存资料</button>
    </div>

    <!-- 功能设置卡片 -->
    <div class="profile-card">
      <div class="profile-card-title">功能设置</div>
      <div class="feature-switch-list">
        <div class="feature-switch-item" v-for="def in featureStore.defs" :key="def.key">
          <div class="feature-switch-info">
            <div class="feature-switch-name">{{ def.icon }} {{ def.name }}</div>
            <div class="feature-switch-desc">{{ def.desc }}</div>
          </div>
          <button :class="['ios-switch', { on: featureStore.state.flags[def.key] }]" @click="featureStore.toggle(def.key)">
            <span class="ios-switch-knob"></span>
          </button>
        </div>
      </div>
      <div class="feature-switch-hint">💡 部分功能默认关闭，按需开启；后续将作为高级功能提供</div>
    </div>

    <div class="profile-card" v-if="featureStore.state.flags.fitness">
      <div class="profile-card-title">冰箱营养概览</div>
      <div class="nutrition-grid">
        <div class="nutrition-item">
          <div class="nutrition-value">{{ nutritionSummary.totalCalories }}</div>
          <div class="nutrition-label">估算热量（kcal）</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">{{ nutritionSummary.vegCount }}</div>
          <div class="nutrition-label">蔬果</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">{{ nutritionSummary.meatCount }}</div>
          <div class="nutrition-label">肉蛋水产</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">{{ nutritionSummary.proteinScore }}</div>
          <div class="nutrition-label">高蛋白食材</div>
        </div>
      </div>
      <div class="macro-section" v-if="nutritionSummary.macroRatio && (nutritionSummary.macroRatio.carbs + nutritionSummary.macroRatio.protein + nutritionSummary.macroRatio.fat) > 0">
        <div class="macro-title">宏量营养素比例（按热量贡献）</div>
        <div class="macro-ring-row">
          <div class="macro-ring" :style="macroRingStyle">
            <div class="macro-ring-center">
              <span class="macro-ring-total">{{ nutritionSummary.totalCalories }}</span>
              <span class="macro-ring-unit">kcal</span>
            </div>
          </div>
          <div class="macro-legend">
            <div class="macro-legend-item">
              <span class="macro-dot macro-dot-carbs"></span>
              <span class="macro-name">碳水</span>
              <span class="macro-grams">{{ nutritionSummary.carbs }}g</span>
              <span class="macro-pct">{{ nutritionSummary.macroRatio.carbs }}%</span>
            </div>
            <div class="macro-legend-item">
              <span class="macro-dot macro-dot-protein"></span>
              <span class="macro-name">蛋白质</span>
              <span class="macro-grams">{{ nutritionSummary.protein }}g</span>
              <span class="macro-pct">{{ nutritionSummary.macroRatio.protein }}%</span>
            </div>
            <div class="macro-legend-item">
              <span class="macro-dot macro-dot-fat"></span>
              <span class="macro-name">脂肪</span>
              <span class="macro-grams">{{ nutritionSummary.fat }}g</span>
              <span class="macro-pct">{{ nutritionSummary.macroRatio.fat }}%</span>
            </div>
          </div>
        </div>
        <div class="macro-bar">
          <div class="macro-bar-carbs" :style="{ width: nutritionSummary.macroRatio.carbs + '%' }"></div>
          <div class="macro-bar-protein" :style="{ width: nutritionSummary.macroRatio.protein + '%' }"></div>
          <div class="macro-bar-fat" :style="{ width: nutritionSummary.macroRatio.fat + '%' }"></div>
        </div>
      </div>
      <div class="macro-empty" v-else>暂无宏量营养素数据，添加常见食材后自动计算</div>
    </div>

    <div class="profile-card">
      <div class="profile-card-title">🔄 推荐品类·定期更换提醒</div>
      <div class="recommend-category-list">
        <div v-for="item in recommendedCategoriesWithStatus" :key="item.name" class="recommend-category-item" :class="{ 'is-overdue': item.tracked && item.overdue, 'is-urgent': item.tracked && item.urgent }">
          <span class="recommend-category-emoji">{{ item.emoji }}</span>
          <div class="recommend-category-info">
            <div class="recommend-category-name">{{ item.name }}</div>
            <div class="recommend-category-desc">{{ item.desc }}</div>
            <div v-if="item.tracked" class="recommend-category-status">
              <span v-if="item.overdue" class="status-overdue">已逾期 {{ Math.abs(item.daysLeft) }} 天</span>
              <span v-else-if="item.urgent" class="status-urgent">还有 {{ item.daysLeft }} 天到期</span>
              <span v-else class="status-ok">追踪中 · 还有 {{ item.daysLeft }} 天</span>
            </div>
          </div>
          <div class="recommend-category-right">
            <div class="recommend-category-cycle">{{ item.cycle }}天</div>
            <button v-if="!item.tracked" class="recommend-track-btn" @click="startTrackingCategory(item.name)">追踪</button>
            <button v-else class="recommend-track-btn tracked" @click="resetCategoryTracking(item.name)">重置</button>
          </div>
        </div>
      </div>
    </div>

    <div class="profile-card" v-if="featureStore.state.flags.recipes">
      <div class="profile-card-title">今天吃什么</div>
      <div class="what-to-eat" @click="pickRandomRecipe">
        <div class="wte-icon">🎲</div>
        <div class="wte-result" v-if="randomRecipe">{{ randomRecipe.emoji }} {{ randomRecipe.name }}</div>
        <div class="wte-hint" v-else>点我随机选一道菜谱</div>
      </div>
      <div class="wte-actions" v-if="randomRecipe">
        <button class="btn-save wte-btn" @click="pickRandomRecipe">再摇一次</button>
        <button class="btn-save wte-cook-btn" @click="goCook(randomRecipe)">🍳 去制作</button>
      </div>
      <button class="btn-save wte-btn wte-btn-full" v-else @click="pickRandomRecipe">摇一摇</button>
    </div>

    <!-- 登录状态 + 退出登录 -->
    <div class="profile-card">
      <div class="auth-status-row" v-if="authStore.state.isLoggedIn">
        <div class="auth-status-info">
          <span class="auth-status-icon">✅</span>
          <span>已登录：{{ authStore.state.user?.nickname || authStore.state.user?.username }}</span>
        </div>
        <button class="btn-logout" @click="onLogout">退出登录</button>
      </div>
      <div class="auth-status-row" v-else>
        <div class="auth-status-info">
          <span class="auth-status-icon">👻</span>
          <span>游客模式</span>
        </div>
        <button class="btn-login-go" @click="$emit('login')">去登录</button>
      </div>
    </div>
  </div>
</template>
