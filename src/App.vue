<template>
  <div class="app">
    <!-- ==================== 导航栏 ==================== -->
    <header class="nav-bar">
      <div class="nav-title">
        <template v-if="activeTab === 'food'">🥬 食材管理</template>
        <template v-else-if="activeTab === 'shop'">🛒 购物清单</template>
        <template v-else>🍳 菜谱推荐</template>
      </div>
      <div class="nav-actions">
        <button class="nav-btn" v-if="activeTab === 'food'" @click="showStatsPanel = true" title="统计">📊</button>
        <button class="nav-btn" v-if="activeTab === 'food'" @click="showBarcodeModal = true" title="扫码录入">📷</button>
        <div class="nav-count" v-if="activeTab === 'food' && foodStore.totalCount">{{ foodStore.totalCount }} 件</div>
        <div class="nav-count" v-if="activeTab === 'shop' && shopUncheckedCount">{{ shopUncheckedCount }} 待买</div>
      </div>
    </header>

    <!-- 搜索栏 (食材tab) -->
    <div class="search-bar" v-if="activeTab === 'food'">
      <span class="search-icon">🔍</span>
      <input v-model="searchText" type="text" placeholder="搜索食材…" class="search-input" />
      <span v-if="searchText" class="search-clear" @click="searchText = ''">✕</span>
    </div>

    <!-- 分类筛选 -->
    <div class="category-scroll" v-if="activeTab === 'food'">
      <button v-for="cat in filterCategories" :key="cat.key"
        :class="['category-chip', { active: activeCategory === cat.key }]"
        @click="activeCategory = cat.key">{{ cat.emoji }} {{ cat.label }}</button>
    </div>

    <!-- 存储筛选 + 批量 -->
    <div class="storage-filter-row" v-if="activeTab === 'food' && activeCategory === 'all'">
      <div class="storage-filter-scroll">
        <button v-for="s in storageFilterOptions" :key="s.key"
          :class="['storage-filter-chip', { active: activeStorage === s.key }]" @click="activeStorage = s.key">{{ s.label }}</button>
      </div>
      <button v-if="foodStore.totalCount > 0" :class="['batch-toggle-btn', { active: batchMode }]" @click="toggleBatchMode">
        {{ batchMode ? '完成' : '多选' }}</button>
    </div>

    <Transition name="toolbar-slide">
      <div v-if="batchMode" class="batch-toolbar">
        <span class="batch-info">已选 {{ selectedIds.size }} / {{ filteredFoods.length }}</span>
        <button class="batch-btn batch-select-all" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</button>
        <button class="batch-btn batch-mark" :disabled="selectedIds.size === 0" @click="batchMarkConsumed">标记已消耗</button>
        <button class="batch-btn batch-delete" :disabled="selectedIds.size === 0" @click="batchDelete">🗑️ 删除</button>
      </div>
    </Transition>

    <!-- ==================== 食材列表 Tab ==================== -->
    <div class="food-list" v-if="activeTab === 'food' && groupedFoods.length">
      <div v-for="group in groupedFoods" :key="group.category" class="food-group">
        <div class="group-header">
          <span class="group-emoji">{{ getCategoryEmoji(group.category) }}</span>
          <span class="group-label">{{ group.category }}</span>
          <span class="group-count">{{ group.items.length }}</span>
        </div>
        <TransitionGroup name="food-card" tag="div" class="group-items">
          <div class="food-card-wrapper" v-for="food in group.items" :key="food.id"
            @touchstart="touchStart($event, food.id)" @touchmove="touchMove($event, food.id)" @touchend="touchEnd($event, food.id)">
            <div class="food-card-actions">
              <button class="food-action-btn food-action-delete" @click.stop="confirmDelete(food)" title="删除">🗑️</button>
            </div>
            <div :class="['food-card', { expired: food.daysLeft < 0, warning: food.daysLeft >= 0 && food.daysLeft <= 1, selected: batchMode && selectedIds.has(food.id), 'swipe-open': swipedId === food.id }]"
              @click="handleCardClick(food)" :style="cardStyle(food.id)">
              <div v-if="batchMode" class="food-checkbox" @click.stop>
                <div :class="['checkbox-icon', { checked: selectedIds.has(food.id) }]"><span v-if="selectedIds.has(food.id)">✓</span></div>
              </div>
              <div class="food-info">
                <div class="food-name">{{ food.name }}</div>
                <div class="food-meta"><span class="food-qty">{{ food.quantity }} {{ food.unit }}</span><span v-if="food.storage" class="food-storage">· {{ food.storage }}</span></div>
              </div>
              <div class="food-actions" @click.stop>
                <div :class="['expiry-badge', expiryClass(food.daysLeft)]">{{ expiryLabel(food.daysLeft) }}</div>
                <div class="expiry-date">{{ formatDate(food.expiryDate) }}</div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <div class="empty-state" v-if="activeTab === 'food' && !groupedFoods.length">
      <div class="empty-icon">🛒</div><div class="empty-text">冰箱空空如也~</div><div class="empty-hint">点下方 + 添加第一种食材吧</div>
    </div>

    <!-- ==================== 购物清单 Tab (P2-1) ==================== -->
    <div class="shop-list" v-if="activeTab === 'shop'">
      <div class="shop-input-row">
        <input v-model="shopInput" class="shop-input" placeholder="添加要买的东西…" maxlength="30" @keyup.enter="addShopItem" />
        <button class="shop-add-btn" @click="addShopItem" :disabled="!shopInput.trim()">添加</button>
      </div>
      <div class="shop-section" v-if="uncheckedShopItems.length">
        <div class="shop-section-title">待购买 ({{ uncheckedShopItems.length }})</div>
        <div v-for="item in uncheckedShopItems" :key="item.id" class="shop-item" @click="foodStore.toggleShopItem(item.id)">
          <div :class="['shop-check', { checked: item.checked }]"><span v-if="item.checked">✓</span></div>
          <span class="shop-item-text">{{ item.text }}</span>
          <button class="shop-item-del" @click.stop="foodStore.removeShopItem(item.id)">✕</button>
        </div>
      </div>
      <div class="shop-section" v-if="checkedShopItems.length">
        <div class="shop-section-title dim">已购买 ({{ checkedShopItems.length }})</div>
        <div v-for="item in checkedShopItems" :key="item.id" class="shop-item checked" @click="foodStore.toggleShopItem(item.id)">
          <div :class="['shop-check', { checked: item.checked }]"><span v-if="item.checked">✓</span></div>
          <span class="shop-item-text">{{ item.text }}</span>
          <button class="shop-item-del" @click.stop="foodStore.removeShopItem(item.id)">✕</button>
        </div>
        <button class="shop-clear-btn" @click="foodStore.clearCheckedShopItems()">清除已完成</button>
      </div>
      <div class="empty-state" v-if="sortedShopList.length === 0">
        <div class="empty-icon">📝</div><div class="empty-text">购物清单是空的~</div><div class="empty-hint">在上面输入要买的东西吧</div>
      </div>
    </div>

    <!-- ==================== 菜谱推荐 Tab (P2-2) ==================== -->
    <div class="recipe-list" v-if="activeTab === 'recipes'">
      <div class="recipe-hint" v-if="foodStore.totalCount > 0">
        🧑‍🍳 基于冰箱里的 <strong>{{ foodStore.totalCount }}</strong> 件食材，为你推荐：
      </div>
      <div class="recipe-hint" v-else>🧑‍🍳 冰箱还是空的，先添加食材才能匹配菜谱哦～</div>

      <div class="recipe-card" v-for="r in recommendedRecipes" :key="r.id" @click="toggleRecipeDetail(r.id)">
        <div class="recipe-header">
          <span class="recipe-emoji">{{ r.emoji }}</span>
          <div class="recipe-info">
            <div class="recipe-name">{{ r.name }}</div>
            <div class="recipe-meta">{{ r.difficulty }} · ⏱ {{ r.time }}分钟</div>
          </div>
          <div :class="['recipe-match-badge', r.ratio >= 1 ? 'match-full' : r.ratio >= 0.5 ? 'match-high' : 'match-low']">
            {{ r.ratio >= 1 ? '✅ 全部齐备' : `缺${r.unmatched.length}种` }}
          </div>
        </div>
        <Transition name="expand">
          <div v-if="expandedRecipe === r.id" class="recipe-body">
            <div class="recipe-section">
              <div class="recipe-section-title">所需食材</div>
              <div class="recipe-ingredients">
                <span v-for="ing in r.ingredients" :key="ing"
                  :class="['ingredient-tag', r.matched.includes(ing) ? 'ingredient-have' : 'ingredient-miss']">
                  {{ r.matched.includes(ing) ? '✅' : '❌' }} {{ ing }}
                </span>
              </div>
            </div>
            <div class="recipe-section">
              <div class="recipe-section-title">做法步骤</div>
              <div class="recipe-step" v-for="(step, i) in r.steps" :key="i">
                <span class="step-num">{{ i + 1 }}</span>
                <span class="step-text">{{ step }}</span>
              </div>
            </div>
            <div class="recipe-actions">
              <button class="btn-recipe-shop" @click.stop="addMissingToShopList(r)">
                📝 缺的食材加入购物清单
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" v-if="activeTab === 'food'" @click="openAddModal">+</button>

    <!-- TabBar -->
    <nav class="tab-bar">
      <button :class="['tab-item', { active: activeTab === 'food' }]" @click="switchTab('food')">
        <span class="tab-icon">🥬</span><span class="tab-label">食材</span>
      </button>
      <button :class="['tab-item', { active: activeTab === 'recipes' }]" @click="switchTab('recipes')">
        <span class="tab-icon">🍳</span><span class="tab-label">菜谱</span>
      </button>
      <button :class="['tab-item', { active: activeTab === 'shop' }]" @click="switchTab('shop')">
        <span class="tab-icon">🛒</span><span class="tab-label">购物清单</span>
        <span class="tab-badge" v-if="shopUncheckedCount">{{ shopUncheckedCount }}</span>
      </button>
    </nav>

    <!-- ==================== 扫码录入弹窗 (P2-3) ==================== -->
    <Transition name="modal">
      <div v-if="showBarcodeModal" class="modal-overlay" @click.self="showBarcodeModal = false">
        <div class="modal-sheet">
          <div class="modal-handle" />
          <h3 class="modal-title">📷 扫码录入</h3>
          <div class="form-group">
            <label class="form-label">输入条形码编号</label>
            <div class="barcode-input-row">
              <input v-model="barcodeInput" class="form-input barcode-input" placeholder="例: 6901234567890"
                maxlength="20" @keyup.enter="performScan" />
              <button class="barcode-scan-btn" @click="performScan" :disabled="!barcodeInput.trim()">查询</button>
            </div>
          </div>
          <div v-if="barcodeError" class="form-error barcode-error">{{ barcodeError }}</div>

          <div v-if="scannedProduct" class="scanned-product">
            <div class="scanned-icon">📦</div>
            <div class="scanned-name">{{ scannedProduct.name }}</div>
            <div class="scanned-meta">{{ getCategoryEmoji(scannedProduct.category) }} {{ scannedProduct.category }} · 保质期约 {{ scannedProduct.defaultDays }} 天</div>
            <button class="btn-save barcode-add-btn" @click="addFromBarcode">添加到冰箱</button>
          </div>

          <div class="barcode-test-hint">
            <div class="breakdown-title">测试条码（可复制）</div>
            <div class="test-barcodes">
              <span v-for="(info, code) in testBarcodes" :key="code" class="test-barcode-chip" @click="quickScan(code)">
                {{ code.slice(-4) }}
              </span>
            </div>
          </div>

          <div class="modal-actions"><button class="btn-cancel" @click="showBarcodeModal = false">关闭</button></div>
        </div>
      </div>
    </Transition>

    <!-- 统计面板 -->
    <Transition name="modal">
      <div v-if="showStatsPanel" class="modal-overlay" @click.self="showStatsPanel = false">
        <div class="modal-sheet stats-sheet">
          <div class="modal-handle" /><h3 class="modal-title">📊 食材统计</h3>
          <div class="stats-grid">
            <div class="stat-card stat-total"><div class="stat-value">{{ stats.total }}</div><div class="stat-label">总食材</div></div>
            <div class="stat-card stat-fresh"><div class="stat-value">{{ stats.fresh }}</div><div class="stat-label">新鲜</div></div>
            <div class="stat-card stat-warning"><div class="stat-value">{{ stats.expiringSoon }}</div><div class="stat-label">临期</div></div>
            <div class="stat-card stat-expired"><div class="stat-value">{{ stats.expired }}</div><div class="stat-label">已过期</div></div>
          </div>
          <div class="waste-bar-section" v-if="stats.total > 0">
            <div class="waste-label"><span>浪费率</span><span :class="['waste-percent', wasteLevelClass]">{{ stats.wasteRate }}%</span></div>
            <div class="waste-track"><div class="waste-fill" :style="{ width: stats.wasteRate + '%' }" :class="wasteLevelClass" /></div>
          </div>
          <div class="stats-breakdown" v-if="Object.keys(stats.byCategory).length">
            <div class="breakdown-title">按分类</div>
            <div class="breakdown-row" v-for="(count, cat) in stats.byCategory" :key="cat">
              <span>{{ getCategoryEmoji(cat) }} {{ cat }}</span><span class="breakdown-count">{{ count }}</span>
              <div class="breakdown-bar"><div class="breakdown-fill" :style="{ width: (count / stats.total * 100) + '%' }" /></div>
            </div>
          </div>
          <div class="stats-breakdown" v-if="Object.keys(stats.byStorage).length">
            <div class="breakdown-title">按存放位置</div>
            <div class="breakdown-row" v-for="(count, loc) in stats.byStorage" :key="loc">
              <span>{{ storageIcon(loc) }} {{ loc }}</span><span class="breakdown-count">{{ count }}</span>
              <div class="breakdown-bar"><div class="breakdown-fill" :style="{ width: (count / stats.total * 100) + '%' }" /></div>
            </div>
          </div>
          <div class="modal-actions"><button class="btn-cancel" @click="showStatsPanel = false">关闭</button></div>
        </div>
      </div>
    </Transition>

    <!-- 添加/编辑弹窗 -->
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-sheet">
          <div class="modal-handle" /><h3 class="modal-title">{{ editingFood ? '编辑食材' : '添加食材' }}</h3>
          <div v-if="!editingFood && foodStore.templates.length" class="templates-section">
            <div class="form-label">从历史快速添加</div>
            <div class="templates-scroll">
              <div v-for="(tpl, i) in foodStore.templates.slice(0, 6)" :key="i" class="template-chip" @click="fillTemplate(tpl)">
                <span>{{ tpl.name }}</span><span class="template-chip-del" @click.stop="foodStore.removeTemplate(i)">✕</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">名称 *</label>
            <input v-model="form.name" :class="['form-input', { 'form-input-error': errors.name }]"
              placeholder="例：西红柿、鸡胸肉…" maxlength="20" @input="validateName()" @blur="validateName()" />
            <div v-if="errors.name" class="form-error">{{ errors.name }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">数量 *</label>
            <div class="qty-row">
              <input v-model="form.quantity" :class="['form-input', 'qty-input', { 'form-input-error': errors.quantity }]"
                type="number" step="0.1" min="0.1" max="99.9" placeholder="0.1~99.9" @input="validateQty()" @blur="validateQty()" />
              <div class="unit-picker">
                <button v-for="u in units" :key="u" :class="['unit-chip', { active: form.unit === u }]" @click="form.unit = u">{{ u }}</button>
              </div>
            </div>
            <div v-if="errors.quantity" class="form-error">{{ errors.quantity }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">购买日期 · 保质期 *</label>
            <div class="date-dual-row">
              <div class="date-col"><input v-model="form.purchaseDate" type="date" class="form-input date-input" :max="todayStr" @change="recalcExpiry()" /></div>
              <span class="date-arrow">→</span>
              <div class="date-col days-col">
                <input v-model="form.days" :class="['form-input', { 'form-input-error': errors.days }]" type="number"
                  step="0.1" min="0.1" max="99.9" placeholder="天数" @input="validateDayField(); recalcExpiry()" @blur="validateDayField(); recalcExpiry()" />
                <span class="days-suffix">天</span>
              </div>
            </div>
            <div v-if="errors.days" class="form-error">{{ errors.days }}</div>
            <div class="expiry-preview" v-if="computedExpiry">📅 到期日：<strong>{{ computedExpiry }}</strong></div>
          </div>
          <div class="form-group">
            <label class="form-label">分类</label>
            <div class="category-picker">
              <button v-for="cat in foodCategories" :key="cat.key" :class="['category-option', { active: form.category === cat.key }]" @click="form.category = cat.key">{{ cat.emoji }} {{ cat.label }}</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">存放位置</label>
            <div class="storage-picker">
              <button v-for="s in storages" :key="s" :class="['storage-option', { active: form.storage === s }]" @click="form.storage = s">{{ storageIcon(s) }} {{ s }}</button>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="closeModal">取消</button>
            <button class="btn-save" @click="saveFood" :disabled="!isFormValid">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认 -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="alert-sheet">
          <div class="alert-icon">⚠️</div><div class="alert-title">删除食材</div>
          <div class="alert-desc">确定删除「{{ deleteTarget.name }}」吗？</div>
          <div class="alert-actions">
            <button class="btn-cancel" @click="deleteTarget = null">取消</button><button class="btn-danger" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 批量删除确认 -->
    <Transition name="modal">
      <div v-if="batchDeleteTarget" class="modal-overlay" @click.self="batchDeleteTarget = ''">
        <div class="alert-sheet">
          <div class="alert-icon">⚠️</div><div class="alert-title">{{ batchDeleteTarget }}</div>
          <div class="alert-desc">此操作不可撤销</div>
          <div class="alert-actions">
            <button class="btn-cancel" @click="batchDeleteTarget = ''">取消</button><button class="btn-danger" @click="doBatchDelete">删除</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useFoodStore, validateFoodName, validateQuantity as checkQuantity, validateDays as checkDays } from './store/foodStore.js'

const foodStore = useFoodStore()

const filterCategories = [
  { key:'all', label:'全部', emoji:'📋' }, { key:'蔬菜', label:'蔬菜', emoji:'🥬' },
  { key:'水果', label:'水果', emoji:'🍎' }, { key:'肉类', label:'肉类', emoji:'🥩' },
  { key:'乳制品', label:'乳制品', emoji:'🥛' }, { key:'调料', label:'调料', emoji:'🧂' }, { key:'其他', label:'其他', emoji:'📦' },
]
const foodCategories = filterCategories.filter(c => c.key !== 'all')
const storages = ['冷藏', '冷冻', '常温']
const units = ['个', 'kg', '份']
const storageFilterOptions = [
  { key:'all', label:'全部位置' }, { key:'冷藏', label:'❄️ 冷藏' }, { key:'冷冻', label:'🧊 冷冻' }, { key:'常温', label:'🏠 常温' },
]
const todayStr = new Date().toISOString().slice(0, 10)

// ========== Tab ==========
const activeTab = ref('food')
function switchTab(tab) { activeTab.value = tab; if (tab === 'food') { batchMode.value = false; selectedIds.value = new Set() } }

// ========== 搜索 & 筛选 ==========
const searchText = ref(''); const activeCategory = ref('all'); const activeStorage = ref('all')

// ========== 批量 ==========
const batchMode = ref(false); const selectedIds = ref(new Set()); const batchDeleteTarget = ref('')
function toggleBatchMode() { batchMode.value = !batchMode.value; if (!batchMode.value) selectedIds.value = new Set() }
function toggleSelectAll() { selectedIds.value = allSelected.value ? new Set() : new Set(filteredFoods.value.map(f => f.id)) }
const allSelected = computed(() => filteredFoods.value.length > 0 && selectedIds.value.size === filteredFoods.value.length)
function handleCardClick(food) {
  if (swipedId.value && swipedId.value !== food.id) { swipedId.value = null; return }
  if (batchMode.value) { const s = new Set(selectedIds.value); if (s.has(food.id)) s.delete(food.id); else s.add(food.id); selectedIds.value = s }
  else editFood(food)
}

// ========== 列表滑动删除 ==========
const swipedId = ref(null)
const touchMap = new Map()
const SWIPE_THRESHOLD = -64

function cardStyle(id) {
  const x = swipedId.value === id ? SWIPE_THRESHOLD : 0
  return { transform: `translateX(${x}px)`, transition: 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)' }
}
function touchStart(e, id) {
  if (batchMode.value) return
  const t = e.touches[0]
  touchMap.set(id, { startX: t.clientX, startY: t.clientY, time: Date.now() })
}
function touchMove(e, id) {
  if (batchMode.value || !touchMap.has(id)) return
  const t = e.touches[0]
  const state = touchMap.get(id)
  const dx = t.clientX - state.startX
  const dy = t.clientY - state.startY
  if (Math.abs(dy) > Math.abs(dx)) return
  e.preventDefault()
  const card = e.currentTarget.querySelector('.food-card')
  if (dx < 0) card.style.transform = `translateX(${Math.max(dx, -90)}px)`
  else card.style.transform = `translateX(${Math.min(dx, 0)}px)`
}
function touchEnd(e, id) {
  if (batchMode.value || !touchMap.has(id)) return
  const t = e.changedTouches[0]
  const state = touchMap.get(id)
  const dx = t.clientX - state.startX
  const card = e.currentTarget.querySelector('.food-card')
  card.style.transform = ''
  if (dx < SWIPE_THRESHOLD) { swipedId.value = id } else { swipedId.value = null }
  touchMap.delete(id)
}

function batchDelete() { if (selectedIds.value.size > 0) batchDeleteTarget.value = `删除 ${selectedIds.value.size} 件食材` }
function doBatchDelete() { foodStore.removeFoods([...selectedIds.value]); selectedIds.value = new Set(); batchDeleteTarget.value = ''; batchMode.value = false }
function batchMarkConsumed() { if (selectedIds.value.size) { foodStore.markConsumed([...selectedIds.value]); selectedIds.value = new Set() } }

// ========== 统计 ==========
const showStatsPanel = ref(false)
const stats = computed(() => foodStore.stats)
const wasteLevelClass = computed(() => { const r = stats.value.wasteRate; return r >= 30 ? 'waste-bad' : r >= 10 ? 'waste-warn' : 'waste-good' })

// ========== 表单 ==========
const showAddModal = ref(false); const editingFood = ref(null); const deleteTarget = ref(null)
const form = ref(getDefaultForm())
const errors = reactive({ name:'', quantity:'', days:'' })

function getDefaultForm() { return { name:'', quantity:1.0, unit:'个', days:7.0, category:'蔬菜', storage:'冷藏', purchaseDate:todayStr } }
const computedExpiry = computed(() => {
  const d = new Date(form.value.purchaseDate); d.setDate(d.getDate() + Math.ceil(parseFloat(form.value.days) || 0))
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
})
function recalcExpiry() {}
function validateName() { const r = validateFoodName(form.value.name); errors.name = r.message; return r.valid }
function validateQty() { const r = checkQuantity(form.value.quantity); errors.quantity = r.message; return r.valid }
function validateDayField() { const r = checkDays(form.value.days); errors.days = r.message; return r.valid }
function validateAll() { return validateName() & validateQty() & validateDayField() }
const isFormValid = computed(() => form.value.name.trim() !== '' && errors.name === '' && errors.quantity === '' && errors.days === '')
function fillTemplate(tpl) { form.value.name = tpl.name; form.value.quantity = tpl.quantity; form.value.unit = tpl.unit; form.value.category = tpl.category; form.value.storage = tpl.storage; errors.name = ''; errors.quantity = ''; errors.days = '' }

function openAddModal() { editingFood.value = null; form.value = getDefaultForm(); errors.name = ''; errors.quantity = ''; errors.days = ''; showAddModal.value = true }
function closeModal() { showAddModal.value = false; editingFood.value = null }
function editFood(food) {
  editingFood.value = food; form.value = { name:food.name, quantity:food.quantity, unit:food.unit||'个', days:food.days, category:food.category, storage:food.storage, purchaseDate:food.purchaseDate||todayStr }
  errors.name = ''; errors.quantity = ''; errors.days = ''; showAddModal.value = true
}
function saveFood() {
  if (!validateAll()) return; const data = { ...form.value }
  const d = new Date(data.purchaseDate); d.setDate(d.getDate() + Math.ceil(parseFloat(data.days) || 0)); data.expiryDate = d.toISOString().slice(0, 10)
  if (editingFood.value) foodStore.updateFood(editingFood.value.id, data); else foodStore.addFood(data)
  closeModal()
}
function confirmDelete(food) { deleteTarget.value = food }
function doDelete() { if (deleteTarget.value) { foodStore.removeFood(deleteTarget.value.id); deleteTarget.value = null } }

// ========== 列表 ==========
const filteredFoods = computed(() => {
  let list = foodStore.foods
  if (activeCategory.value !== 'all') list = list.filter(f => f.category === activeCategory.value)
  if (activeStorage.value !== 'all') list = list.filter(f => f.storage === activeStorage.value)
  if (searchText.value.trim()) { const kw = searchText.value.trim().toLowerCase(); list = list.filter(f => f.name.toLowerCase().includes(kw)) }
  return list
})
const groupedFoods = computed(() => {
  const groups = {}
  for (const f of filteredFoods.value) { const cat = f.category || '其他'; if (!groups[cat]) groups[cat] = { category:cat, items:[] }; groups[cat].items.push(f) }
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category, 'zh'))
})

// ========== 购物清单 ==========
const shopInput = ref('')
const sortedShopList = computed(() => foodStore.getShopListSorted())
const uncheckedShopItems = computed(() => sortedShopList.value.filter(i => !i.checked))
const checkedShopItems = computed(() => sortedShopList.value.filter(i => i.checked))
const shopUncheckedCount = computed(() => uncheckedShopItems.value.length)
function addShopItem() { foodStore.addShopItem(shopInput.value); shopInput.value = '' }

// ========== 菜谱 (P2-2) ==========
const expandedRecipe = ref(null)
const recommendedRecipes = computed(() => foodStore.getRecommendedRecipes())
function toggleRecipeDetail(id) { expandedRecipe.value = expandedRecipe.value === id ? null : id }
function addMissingToShopList(recipe) {
  for (const ing of recipe.unmatched) { foodStore.addShopItem(ing) }
}

// ========== 扫码 (P2-3) ==========
const showBarcodeModal = ref(false); const barcodeInput = ref(''); const barcodeError = ref(''); const scannedProduct = ref(null)

const testBarcodes = {
  '6901234567890': { name:'伊利纯牛奶' }, '6909876543210': { name:'双汇火腿肠' },
  '6901111222333': { name:'西红柿' }, '6902222333444': { name:'鸡胸肉' },
  '6903333444555': { name:'蒙牛酸奶' }, '6904444555666': { name:'鸡蛋' },
  '6905555666777': { name:'苹果' }, '6906666777888': { name:'西兰花' },
}

function performScan() {
  const code = barcodeInput.value.trim()
  if (!code) { barcodeError.value = '请输入条形码'; scannedProduct.value = null; return }
  if (!/^\d{8,20}$/.test(code)) { barcodeError.value = '条形码格式不正确（8-20位数字）'; scannedProduct.value = null; return }
  const product = foodStore.scanBarcode(code)
  if (!product) { barcodeError.value = '未识别此条形码，请手动输入'; scannedProduct.value = null; return }
  barcodeError.value = ''; scannedProduct.value = { ...product, barcode: code }
}

function quickScan(code) { barcodeInput.value = code; performScan() }

function addFromBarcode() {
  if (!scannedProduct.value) return
  const p = scannedProduct.value
  form.value = {
    name: p.name, quantity: 1.0, unit: p.defaultDays > 7 ? '份' : '个',
    days: p.defaultDays, category: p.category, storage: p.defaultStorage, purchaseDate: todayStr,
  }
  errors.name = ''; errors.quantity = ''; errors.days = ''
  showBarcodeModal.value = false; barcodeInput.value = ''; scannedProduct.value = null
  showAddModal.value = true
}

// ========== 工具 ==========
function formatDate(d) { if (!d) return ''; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}` }
function expiryClass(d) { if (d<0) return 'badge-expired'; if (d===0) return 'badge-today'; if (d<=1) return 'badge-warning'; return 'badge-fresh' }
function expiryLabel(d) { if (d<0) return `已过期${Math.abs(d)}天`; if (d===0) return '今天到期'; if (d===1) return '明天到期'; return `${d}天后` }
function getCategoryEmoji(c) { return filterCategories.find(x => x.key === c)?.emoji || '📦' }
function storageIcon(s) { return s==='冷藏'?'❄️':s==='冷冻'?'🧊':'🏠' }

// ========== 推送 ==========
let nt = null
function checkExpiryNotification() {
  const ex = foodStore.foods.filter(f => f.daysLeft < 0).length; const so = foodStore.foods.filter(f => f.daysLeft >= 0 && f.daysLeft <= 1).length
  if (ex+so===0) return
  if (Notification.permission === 'granted') { const p=[]; if(ex>0)p.push(`${ex}件已过期`); if(so>0)p.push(`${so}件即将到期`); new Notification('🥬 食材提醒',{body:p.join('，'),icon:'/vite.svg',tag:'ffood-expiry'}) }
}
function requestNotification() { if ('Notification' in window && Notification.permission==='default') Notification.requestPermission().then(p=>{if(p==='granted') checkExpiryNotification()}) }
function startNotificationTimer() { if (nt) clearInterval(nt); nt = setInterval(checkExpiryNotification, 1000*60*60*4) }

onMounted(() => { foodStore.load(); foodStore.loadTemplates(); foodStore.loadShopList(); requestNotification(); checkExpiryNotification(); startNotificationTimer() })
</script>
