<template>
  <div class="app">
    <!-- ==================== 导航栏 ==================== -->
    <header class="nav-bar">
      <div class="nav-title">🥬 食材管理</div>
      <div class="nav-actions">
        <button class="nav-btn" @click="showStatsPanel = true" title="统计">📊</button>
        <div class="nav-count" v-if="foodStore.totalCount">{{ foodStore.totalCount }} 件</div>
      </div>
    </header>

    <!-- ==================== 搜索栏 ==================== -->
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchText"
        type="text"
        placeholder="搜索食材…"
        class="search-input"
      />
      <span v-if="searchText" class="search-clear" @click="searchText = ''">✕</span>
    </div>

    <!-- ==================== 分类筛选 ==================== -->
    <div class="category-scroll">
      <button
        v-for="cat in filterCategories"
        :key="cat.key"
        :class="['category-chip', { active: activeCategory === cat.key }]"
        @click="activeCategory = cat.key"
      >
        {{ cat.emoji }} {{ cat.label }}
      </button>
    </div>

    <!-- ==================== 存储位置筛选 (P1-1) ==================== -->
    <div class="storage-filter-row" v-if="activeCategory === 'all'">
      <div class="storage-filter-scroll">
        <button
          v-for="s in storageFilterOptions"
          :key="s.key"
          :class="['storage-filter-chip', { active: activeStorage === s.key }]"
          @click="activeStorage = s.key"
        >
          {{ s.label }}
        </button>
      </div>
      <!-- 批量操作按钮 (P1-2) -->
      <button
        v-if="foodStore.totalCount > 0"
        :class="['batch-toggle-btn', { active: batchMode }]"
        @click="toggleBatchMode"
        title="批量管理"
      >
        {{ batchMode ? '完成' : '多选' }}
      </button>
    </div>

    <!-- ==================== 批量操作工具栏 (P1-2) ==================== -->
    <Transition name="toolbar-slide">
      <div v-if="batchMode" class="batch-toolbar">
        <span class="batch-info">已选 {{ selectedIds.size }} / {{ filteredFoods.length }}</span>
        <button
          class="batch-btn batch-select-all"
          @click="toggleSelectAll"
        >
          {{ allSelected ? '取消全选' : '全选' }}
        </button>
        <button
          class="batch-btn batch-mark"
          :disabled="selectedIds.size === 0"
          @click="batchMarkConsumed"
        >
          标记已消耗
        </button>
        <button
          class="batch-btn batch-delete"
          :disabled="selectedIds.size === 0"
          @click="batchDelete"
        >
          🗑️ 删除
        </button>
      </div>
    </Transition>

    <!-- ==================== 食材列表 ==================== -->
    <div class="food-list" v-if="groupedFoods.length">
      <div v-for="group in groupedFoods" :key="group.category" class="food-group">
        <div class="group-header">
          <span class="group-emoji">{{ getCategoryEmoji(group.category) }}</span>
          <span class="group-label">{{ group.category }}</span>
          <span class="group-count">{{ group.items.length }}</span>
        </div>
        <TransitionGroup name="food-card" tag="div" class="group-items">
          <div
            v-for="food in group.items"
            :key="food.id"
            :class="['food-card', {
              expired: food.daysLeft < 0,
              warning: food.daysLeft >= 0 && food.daysLeft <= 1,
              selected: batchMode && selectedIds.has(food.id)
            }]"
            @click="handleCardClick(food)"
          >
            <!-- 批量模式勾选框 -->
            <div v-if="batchMode" class="food-checkbox">
              <div :class="['checkbox-icon', { checked: selectedIds.has(food.id) }]">
                <span v-if="selectedIds.has(food.id)">✓</span>
              </div>
            </div>
            <div class="food-info">
              <div class="food-name">{{ food.name }}</div>
              <div class="food-meta">
                <span class="food-qty">{{ food.quantity }} {{ food.unit }}</span>
                <span v-if="food.storage" class="food-storage">· {{ food.storage }}</span>
              </div>
            </div>
            <div class="food-expiry">
              <div :class="['expiry-badge', expiryClass(food.daysLeft)]">
                {{ expiryLabel(food.daysLeft) }}
              </div>
              <div class="expiry-date">{{ formatDate(food.expiryDate) }}</div>
            </div>
            <button
              v-if="!batchMode"
              class="food-delete"
              @click.stop="confirmDelete(food)"
              title="删除"
            >🗑️</button>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">🛒</div>
      <div class="empty-text">冰箱空空如也~</div>
      <div class="empty-hint">点下方 + 添加第一种食材吧</div>
    </div>

    <!-- FAB -->
    <button class="fab" @click="openAddModal">+</button>

    <!-- ==================== 统计面板 (P1-4) ==================== -->
    <Transition name="modal">
      <div v-if="showStatsPanel" class="modal-overlay" @click.self="showStatsPanel = false">
        <div class="modal-sheet stats-sheet">
          <div class="modal-handle" />
          <h3 class="modal-title">📊 食材统计</h3>

          <!-- 概览卡片 -->
          <div class="stats-grid">
            <div class="stat-card stat-total">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总食材</div>
            </div>
            <div class="stat-card stat-fresh">
              <div class="stat-value">{{ stats.fresh }}</div>
              <div class="stat-label">新鲜</div>
            </div>
            <div class="stat-card stat-warning">
              <div class="stat-value">{{ stats.expiringSoon }}</div>
              <div class="stat-label">临期</div>
            </div>
            <div class="stat-card stat-expired">
              <div class="stat-value">{{ stats.expired }}</div>
              <div class="stat-label">已过期</div>
            </div>
          </div>

          <!-- 浪费率 -->
          <div class="waste-bar-section" v-if="stats.total > 0">
            <div class="waste-label">
              <span>浪费率</span>
              <span :class="['waste-percent', wasteLevelClass]">{{ stats.wasteRate }}%</span>
            </div>
            <div class="waste-track">
              <div class="waste-fill" :style="{ width: stats.wasteRate + '%' }" :class="wasteLevelClass" />
            </div>
          </div>

          <!-- 按分类 -->
          <div class="stats-breakdown" v-if="Object.keys(stats.byCategory).length">
            <div class="breakdown-title">按分类</div>
            <div class="breakdown-row" v-for="(count, cat) in stats.byCategory" :key="cat">
              <span>{{ getCategoryEmoji(cat) }} {{ cat }}</span>
              <span class="breakdown-count">{{ count }}</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill" :style="{ width: (count / stats.total * 100) + '%' }" />
              </div>
            </div>
          </div>

          <!-- 按存放位置 -->
          <div class="stats-breakdown" v-if="Object.keys(stats.byStorage).length">
            <div class="breakdown-title">按存放位置</div>
            <div class="breakdown-row" v-for="(count, loc) in stats.byStorage" :key="loc">
              <span>{{ storageIcon(loc) }} {{ loc }}</span>
              <span class="breakdown-count">{{ count }}</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill" :style="{ width: (count / stats.total * 100) + '%' }" />
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="showStatsPanel = false">关闭</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ==================== 添加/编辑弹窗 ==================== -->
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-sheet">
          <div class="modal-handle" />
          <h3 class="modal-title">{{ editingFood ? '编辑食材' : '添加食材' }}</h3>

          <!-- 历史模板快捷填充 -->
          <div v-if="!editingFood && foodStore.templates.length" class="templates-section">
            <div class="form-label">从历史快速添加</div>
            <div class="templates-scroll">
              <div
                v-for="(tpl, i) in foodStore.templates.slice(0, 6)"
                :key="i"
                class="template-chip"
                @click="fillTemplate(tpl)"
              >
                <span>{{ tpl.name }}</span>
                <span class="template-chip-del" @click.stop="foodStore.removeTemplate(i)">✕</span>
              </div>
            </div>
          </div>

          <!-- 名称 -->
          <div class="form-group">
            <label class="form-label">名称 *</label>
            <input
              v-model="form.name"
              :class="['form-input', { 'form-input-error': errors.name }]"
              placeholder="例：西红柿、鸡胸肉…"
              maxlength="20"
              @input="validateName()"
              @blur="validateName()"
            />
            <div v-if="errors.name" class="form-error">{{ errors.name }}</div>
          </div>

          <!-- 数量 + 单位 -->
          <div class="form-group">
            <label class="form-label">数量 *</label>
            <div class="qty-row">
              <input
                v-model="form.quantity"
                :class="['form-input', 'qty-input', { 'form-input-error': errors.quantity }]"
                type="number"
                step="0.1"
                min="0.1"
                max="99.9"
                placeholder="0.1~99.9"
                @input="validateQty()"
                @blur="validateQty()"
              />
              <div class="unit-picker">
                <button
                  v-for="u in units"
                  :key="u"
                  :class="['unit-chip', { active: form.unit === u }]"
                  @click="form.unit = u"
                >{{ u }}</button>
              </div>
            </div>
            <div v-if="errors.quantity" class="form-error">{{ errors.quantity }}</div>
          </div>

          <!-- 日期双栏 -->
          <div class="form-group">
            <label class="form-label">购买日期 · 保质期 *</label>
            <div class="date-dual-row">
              <div class="date-col">
                <input
                  v-model="form.purchaseDate"
                  type="date"
                  class="form-input date-input"
                  :max="todayStr"
                  @change="recalcExpiry()"
                />
              </div>
              <span class="date-arrow">→</span>
              <div class="date-col days-col">
                <input
                  v-model="form.days"
                  :class="['form-input', { 'form-input-error': errors.days }]"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="99.9"
                  placeholder="天数"
                  @input="validateDayField(); recalcExpiry()"
                  @blur="validateDayField(); recalcExpiry()"
                />
                <span class="days-suffix">天</span>
              </div>
            </div>
            <div v-if="errors.days" class="form-error">{{ errors.days }}</div>
            <div class="expiry-preview" v-if="computedExpiry">
              📅 到期日：<strong>{{ computedExpiry }}</strong>
            </div>
          </div>

          <!-- 分类 -->
          <div class="form-group">
            <label class="form-label">分类</label>
            <div class="category-picker">
              <button
                v-for="cat in foodCategories"
                :key="cat.key"
                :class="['category-option', { active: form.category === cat.key }]"
                @click="form.category = cat.key"
              >
                {{ cat.emoji }} {{ cat.label }}
              </button>
            </div>
          </div>

          <!-- 存放位置 -->
          <div class="form-group">
            <label class="form-label">存放位置</label>
            <div class="storage-picker">
              <button
                v-for="s in storages"
                :key="s"
                :class="['storage-option', { active: form.storage === s }]"
                @click="form.storage = s"
              >
                {{ storageIcon(s) }} {{ s }}
              </button>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="closeModal">取消</button>
            <button class="btn-save" @click="saveFood" :disabled="!isFormValid">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ==================== 删除确认 ==================== -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="alert-sheet">
          <div class="alert-icon">⚠️</div>
          <div class="alert-title">删除食材</div>
          <div class="alert-desc">确定删除「{{ deleteTarget.name }}」吗？</div>
          <div class="alert-actions">
            <button class="btn-cancel" @click="deleteTarget = null">取消</button>
            <button class="btn-danger" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ==================== 批量删除确认 ==================== -->
    <Transition name="modal">
      <div v-if="batchDeleteTarget" class="modal-overlay" @click.self="batchDeleteTarget = false">
        <div class="alert-sheet">
          <div class="alert-icon">⚠️</div>
          <div class="alert-title">{{ batchDeleteTarget }}</div>
          <div class="alert-desc">此操作不可撤销，确定继续？</div>
          <div class="alert-actions">
            <button class="btn-cancel" @click="batchDeleteTarget = ''">取消</button>
            <button class="btn-danger" @click="doBatchDelete">删除</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useFoodStore, validateFoodName, validateQuantity as checkQuantity, validateDays as checkDays } from './store/foodStore.js'

const foodStore = useFoodStore()

// ==================== 常量 ====================

const filterCategories = [
  { key: 'all',  label: '全部',   emoji: '📋' },
  { key: '蔬菜', label: '蔬菜',   emoji: '🥬' },
  { key: '水果', label: '水果',   emoji: '🍎' },
  { key: '肉类', label: '肉类',   emoji: '🥩' },
  { key: '乳制品', label: '乳制品', emoji: '🥛' },
  { key: '调料', label: '调料',   emoji: '🧂' },
  { key: '其他', label: '其他',   emoji: '📦' },
]

const foodCategories = filterCategories.filter(c => c.key !== 'all')
const storages = ['冷藏', '冷冻', '常温']
const units = ['个', 'kg', '份']

const storageFilterOptions = [
  { key: 'all',   label: '全部位置' },
  { key: '冷藏',  label: '❄️ 冷藏' },
  { key: '冷冻',  label: '🧊 冷冻' },
  { key: '常温',  label: '🏠 常温' },
]

const todayStr = new Date().toISOString().slice(0, 10)

// ==================== 搜索 & 筛选 ====================

const searchText = ref('')
const activeCategory = ref('all')
const activeStorage = ref('all')

// ==================== 批量模式 ====================

const batchMode = ref(false)
const selectedIds = ref(new Set())
const batchDeleteTarget = ref('')

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selectedIds.value = new Set()
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredFoods.value.map(f => f.id))
  }
}

const allSelected = computed(() =>
  filteredFoods.value.length > 0 && selectedIds.value.size === filteredFoods.value.length
)

function handleCardClick(food) {
  if (batchMode.value) {
    toggleSelect(food.id)
  } else {
    editFood(food)
  }
}

function toggleSelect(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function batchDelete() {
  if (selectedIds.value.size === 0) return
  batchDeleteTarget.value = `删除 ${selectedIds.value.size} 件食材`
}

function doBatchDelete() {
  foodStore.removeFoods([...selectedIds.value])
  selectedIds.value = new Set()
  batchDeleteTarget.value = ''
  batchMode.value = false
}

function batchMarkConsumed() {
  if (selectedIds.value.size === 0) return
  foodStore.markConsumed([...selectedIds.value])
  selectedIds.value = new Set()
}

// ==================== 统计面板 ====================

const showStatsPanel = ref(false)

const stats = computed(() => foodStore.stats)

const wasteLevelClass = computed(() => {
  const r = stats.value.wasteRate
  if (r >= 30) return 'waste-bad'
  if (r >= 10) return 'waste-warn'
  return 'waste-good'
})

// ==================== 表单状态 ====================

const showAddModal = ref(false)
const editingFood = ref(null)
const deleteTarget = ref(null)
const form = ref(getDefaultForm())
const errors = reactive({ name: '', quantity: '', days: '' })

function getDefaultForm() {
  return {
    name: '', quantity: 1.0, unit: '个', days: 7.0,
    category: '蔬菜', storage: '冷藏', purchaseDate: todayStr,
  }
}

const computedExpiry = computed(() => {
  const d = new Date(form.value.purchaseDate)
  d.setDate(d.getDate() + Math.ceil(parseFloat(form.value.days) || 0))
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
})

function recalcExpiry() {}

// ==================== 表单校验 ====================

function validateName() { const r = validateFoodName(form.value.name); errors.name = r.message; return r.valid }
function validateQty() { const r = checkQuantity(form.value.quantity); errors.quantity = r.message; return r.valid }
function validateDayField() { const r = checkDays(form.value.days); errors.days = r.message; return r.valid }
function validateAll() { return validateName() & validateQty() & validateDayField() }

const isFormValid = computed(() =>
  form.value.name.trim() !== '' &&
  errors.name === '' && errors.quantity === '' && errors.days === ''
)

// ==================== 模板填充 ====================

function fillTemplate(tpl) {
  form.value.name = tpl.name
  form.value.quantity = tpl.quantity
  form.value.unit = tpl.unit
  form.value.category = tpl.category
  form.value.storage = tpl.storage
  errors.name = ''; errors.quantity = ''; errors.days = ''
}

// ==================== 列表计算 ====================

const filteredFoods = computed(() => {
  let list = foodStore.foods
  if (activeCategory.value !== 'all') {
    list = list.filter(f => f.category === activeCategory.value)
  }
  if (activeStorage.value !== 'all') {
    list = list.filter(f => f.storage === activeStorage.value)
  }
  if (searchText.value.trim()) {
    const kw = searchText.value.trim().toLowerCase()
    list = list.filter(f => f.name.toLowerCase().includes(kw))
  }
  return list
})

const groupedFoods = computed(() => {
  const groups = {}
  for (const f of filteredFoods.value) {
    const cat = f.category || '其他'
    if (!groups[cat]) groups[cat] = { category: cat, items: [] }
    groups[cat].items.push(f)
  }
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category, 'zh'))
})

// ==================== 弹窗操作 ====================

function openAddModal() {
  editingFood.value = null
  form.value = getDefaultForm()
  errors.name = ''; errors.quantity = ''; errors.days = ''
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingFood.value = null
}

function editFood(food) {
  editingFood.value = food
  form.value = {
    name: food.name, quantity: food.quantity, unit: food.unit || '个',
    days: food.days, category: food.category, storage: food.storage,
    purchaseDate: food.purchaseDate || todayStr,
  }
  errors.name = ''; errors.quantity = ''; errors.days = ''
  showAddModal.value = true
}

function saveFood() {
  if (!validateAll()) return
  const data = { ...form.value }
  const d = new Date(data.purchaseDate)
  d.setDate(d.getDate() + Math.ceil(parseFloat(data.days) || 0))
  data.expiryDate = d.toISOString().slice(0, 10)

  if (editingFood.value) {
    foodStore.updateFood(editingFood.value.id, data)
  } else {
    foodStore.addFood(data)
  }
  closeModal()
}

function confirmDelete(food) { deleteTarget.value = food }

function doDelete() {
  if (deleteTarget.value) {
    foodStore.removeFood(deleteTarget.value.id)
    deleteTarget.value = null
  }
}

// ==================== 工具函数 ====================

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function expiryClass(days) {
  if (days < 0) return 'badge-expired'
  if (days === 0) return 'badge-today'
  if (days <= 1) return 'badge-warning'
  return 'badge-fresh'
}

function expiryLabel(days) {
  if (days < 0) return `已过期${Math.abs(days)}天`
  if (days === 0) return '今天到期'
  if (days === 1) return '明天到期'
  return `${days}天后`
}

function getCategoryEmoji(cat) {
  return filterCategories.find(c => c.key === cat)?.emoji || '📦'
}

function storageIcon(s) {
  return s === '冷藏' ? '❄️' : s === '冷冻' ? '🧊' : '🏠'
}

// ==================== 到期推送提醒 (P1-3) ====================

let notificationTimer = null

function checkExpiryNotification() {
  const expired = foodStore.foods.filter(f => f.daysLeft < 0).length
  const soon = foodStore.foods.filter(f => f.daysLeft >= 0 && f.daysLeft <= 1).length
  if (expired + soon === 0) return

  if (Notification.permission === 'granted') {
    const parts = []
    if (expired > 0) parts.push(`${expired} 件已过期`)
    if (soon > 0) parts.push(`${soon} 件即将到期`)
    new Notification('🥬 食材提醒', { body: parts.join('，'), icon: '/vite.svg', tag: 'ffood-expiry' })
  }
}

function requestNotification() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') checkExpiryNotification()
    })
  }
}

function startNotificationTimer() {
  if (notificationTimer) clearInterval(notificationTimer)
  notificationTimer = setInterval(checkExpiryNotification, 1000 * 60 * 60 * 4) // 每4小时检查
}

onMounted(() => {
  foodStore.load()
  foodStore.loadTemplates()
  requestNotification()
  checkExpiryNotification()
  startNotificationTimer()
})
</script>
