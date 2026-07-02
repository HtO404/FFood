<template>
  <div class="app">
    <header class="nav-bar">
      <div class="nav-title">🥬 食材管理</div>
      <div class="nav-count" v-if="foodStore.totalCount">{{ foodStore.totalCount }} 件</div>
    </header>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchText"
        type="text"
        placeholder="搜索食材…"
        class="search-input"
        @input="onSearch"
      />
      <span v-if="searchText" class="search-clear" @click="clearSearch">✕</span>
    </div>

    <!-- 分类筛选 -->
    <div class="category-scroll">
      <button
        v-for="cat in filterCategories"
        :key="cat.key"
        :class="['category-chip', { active: activeCategory === cat.key }]"
        @click="filterCategory(cat.key)"
      >
        {{ cat.emoji }} {{ cat.label }}
      </button>
    </div>

    <!-- 食材列表（按分类分组） -->
    <div class="food-list" v-if="groupedFoods.length">
      <div
        v-for="group in groupedFoods"
        :key="group.category"
        class="food-group"
      >
        <div class="group-header">
          <span class="group-emoji">{{ getCategoryEmoji(group.category) }}</span>
          <span class="group-label">{{ group.category }}</span>
          <span class="group-count">{{ group.items.length }}</span>
        </div>
        <TransitionGroup name="food-card" tag="div" class="group-items">
          <div
            v-for="food in group.items"
            :key="food.id"
            :class="['food-card', { expired: food.daysLeft < 0, warning: food.daysLeft >= 0 && food.daysLeft <= 1 }]"
            @click="editFood(food)"
          >
            <div class="food-info">
              <div class="food-name">{{ food.name }}</div>
              <div class="food-meta">
                <span class="food-qty">{{ food.quantity }}{{ food.unit }}</span>
                <span v-if="food.storage" class="food-storage">· {{ food.storage }}</span>
              </div>
            </div>
            <div class="food-expiry">
              <div :class="['expiry-badge', expiryClass(food.daysLeft)]">
                {{ expiryLabel(food.daysLeft) }}
              </div>
              <div class="expiry-date">{{ formatDate(food.expiryDate) }}</div>
            </div>
            <button class="food-delete" @click.stop="confirmDelete(food)" title="删除">🗑️</button>
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

    <!-- FAB 添加按钮 -->
    <button class="fab" @click="showAddModal = true">+</button>

    <!-- 添加/编辑弹窗 -->
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-sheet">
          <div class="modal-handle" />
          <h3 class="modal-title">{{ editingFood ? '编辑食材' : '添加食材' }}</h3>

          <div class="form-group">
            <label class="form-label">名称 *</label>
            <input v-model="form.name" class="form-input" placeholder="例：西红柿、鸡胸肉…" />
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">数量</label>
              <input v-model.number="form.quantity" type="number" class="form-input" min="1" />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">单位</label>
              <select v-model="form.unit" class="form-input">
                <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

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

          <div class="form-group">
            <label class="form-label">保质到期日 *</label>
            <input v-model="form.expiryDate" type="date" class="form-input" />
          </div>

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
            <button class="btn-save" @click="saveFood" :disabled="!form.name || !form.expiryDate">
              保存
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认 -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="alert-sheet">
          <div class="alert-icon">⚠️</div>
          <div class="alert-title">删除食材</div>
          <div class="alert-desc">确定删除「{{ deleteTarget.name }}」吗？此操作不可撤销。</div>
          <div class="alert-actions">
            <button class="btn-cancel" @click="deleteTarget = null">取消</button>
            <button class="btn-danger" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFoodStore } from './store/foodStore.js'

const foodStore = useFoodStore()

// 分类（筛选用，含"全部"）
const filterCategories = [
  { key: 'all',      label: '全部',  emoji: '📋' },
  { key: '蔬菜',     label: '蔬菜',  emoji: '🥬' },
  { key: '水果',     label: '水果',  emoji: '🍎' },
  { key: '肉类',     label: '肉类',  emoji: '🥩' },
  { key: '乳制品',   label: '乳制品', emoji: '🥛' },
  { key: '调料',     label: '调料',  emoji: '🧂' },
  { key: '其他',     label: '其他',  emoji: '📦' },
]
// 分类（表单用，不含"全部"）
const foodCategories = [
  { key: '蔬菜',     label: '蔬菜',  emoji: '🥬' },
  { key: '水果',     label: '水果',  emoji: '🍎' },
  { key: '肉类',     label: '肉类',  emoji: '🥩' },
  { key: '乳制品',   label: '乳制品', emoji: '🥛' },
  { key: '调料',     label: '调料',  emoji: '🧂' },
  { key: '其他',     label: '其他',  emoji: '📦' },
]

const units = ['个', '斤', 'kg', 'g', '瓶', '盒', '袋', '把', '根', '颗', '块', '包', 'L', 'ml']
const storages = ['冷藏', '冷冻', '常温']

// 状态
const searchText = ref('')
const activeCategory = ref('all')

// 表单
const showAddModal = ref(false)
const editingFood = ref(null)
const form = ref(getDefaultForm())
const deleteTarget = ref(null)

function getDefaultForm() {
  return {
    name: '',
    quantity: 1,
    unit: '个',
    category: '蔬菜',
    expiryDate: '',
    storage: '冷藏',
  }
}

// 计算属性
const filteredFoods = computed(() => {
  let list = foodStore.foods
  if (activeCategory.value !== 'all') {
    list = list.filter(f => f.category === activeCategory.value)
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

// 筛选
function filterCategory(key) {
  activeCategory.value = key
}
function onSearch() { /* computed 自动响应 */ }
function clearSearch() {
  searchText.value = ''
}

// 弹窗
function closeModal() {
  showAddModal.value = false
  editingFood.value = null
  form.value = getDefaultForm()
}

function editFood(food) {
  editingFood.value = food
  form.value = { ...food }
  showAddModal.value = true
}

function saveFood() {
  if (!form.value.name.trim() || !form.value.expiryDate) return
  if (editingFood.value) {
    foodStore.updateFood(editingFood.value.id, { ...form.value })
  } else {
    foodStore.addFood({ ...form.value })
  }
  closeModal()
}

function confirmDelete(food) {
  deleteTarget.value = food
}

function doDelete() {
  if (deleteTarget.value) {
    foodStore.removeFood(deleteTarget.value.id)
    deleteTarget.value = null
  }
}

// 工具函数
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
  const found = filterCategories.find(c => c.key === cat)
  return found ? found.emoji : '📦'
}

function storageIcon(s) {
  return s === '冷藏' ? '❄️' : s === '冷冻' ? '🧊' : '🏠'
}

onMounted(() => {
  foodStore.load()
})
</script>
