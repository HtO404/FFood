<script setup>
import { ref, computed, reactive } from 'vue'
import { useFoodStore, validateFoodName, validateQuantity as checkQuantity, validateDays as checkDays, recommendDays } from '../store/foodStore.js'
import { recommendShelfLife } from '../utils/deepseek.js'
import { extractFood } from '../nlp/extractor.js'
import { useSwipeBatch } from '../composables/useSwipeBatch.js'

// ===== 视图级状态 =====
const foodStore = useFoodStore()
const searchText = ref('')
const activeCategory = ref('all')
const activeStorage = ref('all')
const sortBy = ref(localStorage.getItem('ffood_sort') || 'expiry')
const showStatsPanel = ref(false)
const showBarcodeModal = ref(false)

// ===== 选项 =====
const filterCategories = [
  { key: 'all', label: '全部', emoji: '📋' }, { key: '蔬菜', label: '蔬菜', emoji: '🥬' },
  { key: '水果', label: '水果', emoji: '🍎' }, { key: '肉类', label: '肉类', emoji: '🥩' },
  { key: '乳制品', label: '乳制品', emoji: '🥛' }, { key: '调料', label: '调料', emoji: '🧂' }, { key: '其他', label: '其他', emoji: '📦' },
]
const foodCategories = filterCategories.filter(c => c.key !== 'all')
const storages = ['冷藏', '冷冻', '常温']
const units = ['个', 'kg', '份']
const storageFilterOptions = [
  { key: 'all', label: '全部位置' }, { key: '冷藏', label: '❄️ 冷藏' }, { key: '冷冻', label: '🧊 冷冻' }, { key: '常温', label: '🏠 常温' },
]
const sortOptions = [
  { key: 'expiry', label: '临期优先' }, { key: 'created', label: '添加时间' }, { key: 'name', label: '名称' },
]

// ===== 列表 =====
const filteredFoods = computed(() => {
  let list = foodStore.foods
  if (activeCategory.value !== 'all') list = list.filter(f => f.category === activeCategory.value)
  if (activeStorage.value !== 'all') list = list.filter(f => f.storage === activeStorage.value)
  if (searchText.value.trim()) { const kw = searchText.value.trim().toLowerCase(); list = list.filter(f => f.name.toLowerCase().includes(kw)) }
  const sorted = [...list]
  if (sortBy.value === 'expiry') sorted.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity))
  else if (sortBy.value === 'created') sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  else if (sortBy.value === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  return sorted
})
const groupedFoods = computed(() => {
  const groups = {}
  for (const f of filteredFoods.value) { const cat = f.category || '其他'; if (!groups[cat]) groups[cat] = { category: cat, items: [] }; groups[cat].items.push(f) }
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category, 'zh'))
})
const stats = computed(() => foodStore.stats)
const wasteLevelClass = computed(() => { const r = stats.value.wasteRate; return r >= 30 ? 'waste-bad' : r >= 10 ? 'waste-warn' : 'waste-good' })

function setSortBy(key) { sortBy.value = key; localStorage.setItem('ffood_sort', key) }

// ===== 滑动 + 批量 =====
const foodBatch = useSwipeBatch({
  getItems: () => filteredFoods.value,
  onDelete: (id) => { const food = foodStore.foods.find(f => f.id === id); if (food) confirmDelete(food) },
  onBatchDelete: (ids) => foodStore.removeFoods(ids),
  onItemClick: (food) => editFood(food),
})

// ===== 批量删除确认 =====
const batchDeleteTarget = ref('')
function onFoodBatchDelete() {
  if (foodBatch.selectedIds.value.size === 0) return
  batchDeleteTarget.value = `删除 ${foodBatch.selectedIds.value.size} 件食材`
}
function doBatchDeleteConfirm() {
  const ids = foodBatch.selectedIds.value
  foodStore.removeFoods([...ids])
  foodBatch.exitBatchMode()
  batchDeleteTarget.value = ''
}

// ===== 表单 =====
const showAddModal = ref(false)
const editingFood = ref(null)
const deleteTarget = ref(null)
const todayStr = new Date().toISOString().slice(0, 10)
const form = ref(getDefaultForm())
const errors = reactive({ name: '', quantity: '', days: '' })
const showPasteFood = ref(false)
const pasteFoodText = ref('')
const pasteFoodResult = ref(null)
const aiRecommendLoading = ref(false)
const aiRecommendResult = ref(null)

const recommendedDays = computed(() => recommendDays(form.value.category, form.value.storage))
const computedExpiry = computed(() => {
  const d = new Date(form.value.purchaseDate); d.setDate(d.getDate() + Math.ceil(parseFloat(form.value.days) || 0))
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
})
const isFormValid = computed(() => form.value.name.trim() !== '' && errors.name === '' && errors.quantity === '' && errors.days === '')

function getDefaultForm() { return { name: '', quantity: 1.0, unit: '个', days: 7.0, category: '蔬菜', storage: '冷藏', purchaseDate: todayStr } }
function validateName() { const r = validateFoodName(form.value.name); errors.name = r.message; return r.valid }
function validateQty() { const r = checkQuantity(form.value.quantity); errors.quantity = r.message; return r.valid }
function validateDayField() { const r = checkDays(form.value.days); errors.days = r.message; return r.valid }
function validateAll() { return validateName() & validateQty() & validateDayField() }
function openAddModal() {
  editingFood.value = null
  const defaults = getDefaultForm()
  defaults.days = recommendDays(defaults.category, defaults.storage)
  form.value = defaults
  errors.name = ''; errors.quantity = ''; errors.days = ''
  showAddModal.value = true
}
function closeModal() { showAddModal.value = false; editingFood.value = null }
function editFood(food) {
  editingFood.value = food; form.value = { name: food.name, quantity: food.quantity, unit: food.unit || '个', days: food.days, category: food.category, storage: food.storage, purchaseDate: food.purchaseDate || todayStr }
  errors.name = ''; errors.quantity = ''; errors.days = ''; showAddModal.value = true
}
function saveFood() {
  if (!validateAll()) return; const data = { ...form.value }
  const d = new Date(data.purchaseDate); d.setDate(d.getDate() + Math.ceil(parseFloat(data.days) || 0)); data.expiryDate = d.toISOString().slice(0, 10)
  if (editingFood.value) foodStore.updateFood(editingFood.value.id, data); else foodStore.addFood(data)
  closeModal()
}
function confirmDelete(food) { deleteTarget.value = food }
function doDelete() { if (deleteTarget.value) { foodStore.removeFood(deleteTarget.value.id); deleteTarget.value = null; foodBatch.swipedId.value = null } }
function fillTemplate(tpl) { form.value.name = tpl.name; form.value.quantity = tpl.quantity; form.value.unit = tpl.unit; form.value.category = tpl.category; form.value.storage = tpl.storage; errors.name = ''; errors.quantity = ''; errors.days = '' }
function recalcExpiry() {}

// ===== AI 推荐 =====
async function getAiRecommend() {
  if (!form.value.name.trim()) { errors.name = '请先输入食材名称'; return }
  aiRecommendLoading.value = true; aiRecommendResult.value = null
  try {
    const result = await recommendShelfLife(form.value.name.trim(), form.value.category, form.value.storage)
    aiRecommendResult.value = result
    if (result.days) { form.value.days = result.days; validateDayField() }
  } catch (e) { console.warn('AI 推荐失败:', e) } finally { aiRecommendLoading.value = false }
}

// ===== 粘贴智能填充 =====
function doPasteFood() {
  if (!pasteFoodText.value.trim()) return
  pasteFoodResult.value = { loading: true }
  extractFood(pasteFoodText.value).then(r => { pasteFoodResult.value = r })
}
function applyPasteFood() {
  const r = pasteFoodResult.value
  if (!r) return
  if (r.name) form.value.name = r.name
  if (r.quantity) form.value.quantity = r.quantity
  if (r.unit) form.value.unit = r.unit
  if (r.storage) form.value.storage = r.storage
  if (r.category) form.value.category = r.category
  if (r.days) form.value.days = r.days
  if (r.purchaseDate) form.value.purchaseDate = r.purchaseDate
  validateName(); validateQty(); validateDayField()
  showPasteFood.value = false; pasteFoodText.value = ''; pasteFoodResult.value = null
}

// ===== 扫码 =====
const barcodeInput = ref(''); const barcodeError = ref(''); const scannedProduct = ref(null)
const testBarcodes = {
  '6901234567890': { name: '伊利纯牛奶' }, '6909876543210': { name: '双汇火腿肠' },
  '6901111222333': { name: '西红柿' }, '6902222333444': { name: '鸡胸肉' },
  '6903333444555': { name: '蒙牛酸奶' }, '6904444555666': { name: '鸡蛋' },
  '6905555666777': { name: '苹果' }, '6906666777888': { name: '西兰花' },
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
  form.value = { name: p.name, quantity: 1.0, unit: p.defaultDays > 7 ? '份' : '个', days: p.defaultDays, category: p.category, storage: p.defaultStorage, purchaseDate: todayStr }
  errors.name = ''; errors.quantity = ''; errors.days = ''
  showBarcodeModal.value = false; barcodeInput.value = ''; scannedProduct.value = null
  showAddModal.value = true
}

// ===== 工具 =====
function formatDate(d) { if (!d) return ''; const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getDate()}` }
function expiryClass(d) { if (d < 0) return 'badge-expired'; if (d === 0) return 'badge-today'; if (d <= 3) return 'badge-warning'; return 'badge-fresh' }
function expiryLabel(d) { if (d < 0) return `已过期${Math.abs(d)}天`; if (d === 0) return '今天到期'; if (d === 1) return '明天到期'; return `${d}天后` }
function getCategoryEmoji(c) { return filterCategories.find(x => x.key === c)?.emoji || '📦' }
function storageIcon(s) { return s === '冷藏' ? '❄️' : s === '冷冻' ? '🧊' : '🏠' }

// 暴露给 App 的跨 tab 操作
const VIEW_EVENT = 'ffood-view-event'
function handleViewEvent(e) {
  const action = e.detail?.action
  if (action === 'open-add-food') openAddModal()
}
// 监听 App 中央按钮事件
if (typeof window !== 'undefined') window.addEventListener(VIEW_EVENT, handleViewEvent)

defineExpose({ openAddModal })
</script>

<template>
  <!-- 搜索栏 -->
  <div class="search-bar">
    <span class="search-icon">🔍</span>
    <input v-model="searchText" type="text" placeholder="搜索食材…" class="search-input" />
    <span v-if="searchText" class="search-clear" @click="searchText = ''">✕</span>
  </div>

  <!-- 分类筛选 -->
  <div class="category-scroll">
    <button v-for="cat in filterCategories" :key="cat.key"
      :class="['category-chip', { active: activeCategory === cat.key }]"
      @click="activeCategory = cat.key">{{ cat.emoji }} {{ cat.label }}</button>
  </div>

  <!-- 存储筛选 + 排序 + 批量 -->
  <div class="storage-filter-row" v-if="activeCategory === 'all'">
    <div class="storage-filter-scroll">
      <button v-for="s in storageFilterOptions" :key="s.key"
        :class="['storage-filter-chip', { active: activeStorage === s.key }]" @click="activeStorage = s.key">{{ s.label }}</button>
    </div>
    <button v-if="foodStore.totalCount > 0" :class="['batch-toggle-btn', { active: foodBatch.batchMode.value }]" @click="foodBatch.toggleBatchMode()">
      {{ foodBatch.batchMode.value ? '完成' : '多选' }}
    </button>
  </div>

  <!-- 排序栏 -->
  <div class="sort-bar" v-if="foodStore.totalCount > 0">
    <span class="sort-label">排序</span>
    <button v-for="s in sortOptions" :key="s.key"
      :class="['sort-chip', { active: sortBy === s.key }]"
      @click="setSortBy(s.key)">{{ s.label }}</button>
  </div>

  <Transition name="toolbar-slide">
    <div v-if="foodBatch.batchMode.value" class="batch-toolbar-fixed">
      <div class="batch-toolbar-inner">
        <button class="batch-btn" @click="foodBatch.toggleSelectAll()">{{ foodBatch.allSelected.value ? '取消全选' : '全选' }}</button>
        <span class="batch-info">已选 {{ foodBatch.selectedIds.value.size }}</span>
        <button class="batch-btn batch-delete" :disabled="foodBatch.selectedIds.value.size === 0" @click="onFoodBatchDelete">删除</button>
        <button class="batch-btn batch-done" @click="foodBatch.exitBatchMode()">完成</button>
      </div>
    </div>
  </Transition>

  <!-- 食材列表 -->
  <div :class="['food-list', { 'batch-active': foodBatch.batchMode.value }]" v-if="groupedFoods.length">
    <div v-for="group in groupedFoods" :key="group.category" class="food-group">
      <div class="group-header">
        <span class="group-emoji">{{ getCategoryEmoji(group.category) }}</span>
        <span class="group-label">{{ group.category }}</span>
        <span class="group-count">{{ group.items.length }}</span>
      </div>
      <TransitionGroup name="food-card" tag="div" class="group-items">
        <div class="swipe-wrapper food-card-wrapper" v-for="food in group.items" :key="food.id"
          @touchstart="foodBatch.touchStart($event, food)" @touchmove="foodBatch.touchMove($event, food, '.swipe-card')" @touchend="foodBatch.touchEnd($event, food, '.swipe-card')"
          @mousedown="foodBatch.mouseStart($event, food)" @mouseup="foodBatch.mouseEnd($event, food)" @mouseleave="foodBatch.mouseLeave(food)"
          @contextmenu.prevent>
          <div class="swipe-actions food-card-actions">
            <button class="swipe-action-btn food-action-delete" @click.stop="confirmDelete(food)" title="删除">
              <span class="action-emoji">🗑️</span><span class="action-label">删除</span>
            </button>
          </div>
          <div :class="['swipe-card food-card', { selected: foodBatch.selectedIds.value.has(food.id) }]"
            @click="foodBatch.handleCardClick(food)" :style="foodBatch.cardStyle(food.id)">
            <div v-if="foodBatch.batchMode.value" class="food-checkbox" @click.stop>
              <div :class="['select-checkbox', 'checkbox-icon', { checked: foodBatch.selectedIds.value.has(food.id) }]">
                <span v-if="foodBatch.selectedIds.value.has(food.id)">✓</span>
              </div>
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

  <div class="empty-state" v-if="!groupedFoods.length">
    <div class="empty-icon">🛒</div>
    <div class="empty-text">冰箱空空如也~</div>
    <div class="empty-hint">点下方 + 添加第一种食材吧</div>
    <button class="empty-cta" @click="openAddModal">+ 添加食材</button>
  </div>

  <!-- 统计面板 -->
  <Transition name="modal">
    <div v-if="showStatsPanel" class="modal-overlay modal-overlay-stats" @click.self="showStatsPanel = false">
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

  <!-- 扫码弹窗 -->
  <Transition name="modal">
    <div v-if="showBarcodeModal" class="modal-overlay modal-overlay-scan" @click.self="showBarcodeModal = false">
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

  <!-- 添加/编辑弹窗 -->
  <Transition name="modal">
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-sheet">
        <div class="modal-handle" /><h3 class="modal-title">{{ editingFood ? '编辑食材' : '添加食材' }}</h3>
        <div class="modal-body">
          <div class="paste-section" v-if="!editingFood">
            <button class="paste-toggle-btn" @click="showPasteFood = !showPasteFood">📋 粘贴智能填充</button>
            <Transition name="expand">
              <div v-if="showPasteFood" class="paste-area">
                <textarea v-model="pasteFoodText" class="paste-textarea" rows="2"
                  placeholder="例：2个西红柿放了3天冷藏，或 半斤猪肉冷冻"></textarea>
                <button class="paste-parse-btn" @click="doPasteFood" :disabled="!pasteFoodText.trim()">智能识别</button>
                <div v-if="pasteFoodResult && !pasteFoodResult.loading" class="paste-preview">
                  <div class="paste-preview-title">识别结果（点击应用到表单）</div>
                  <div class="paste-preview-body" @click="applyPasteFood">
                    {{ pasteFoodResult.name || '未识别' }}
                    <span v-if="pasteFoodResult.quantity">× {{ pasteFoodResult.quantity }} {{ pasteFoodResult.unit }}</span>
                    <span v-if="pasteFoodResult.storage">· {{ pasteFoodResult.storage }}</span>
                    <span v-if="pasteFoodResult.days">· 保质期 {{ pasteFoodResult.days }} 天</span>
                    <span v-if="pasteFoodResult.purchaseDate">· {{ pasteFoodResult.purchaseDate }} 购买</span>
                    <span v-if="pasteFoodResult.category">· {{ pasteFoodResult.category }}</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
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
            <div class="days-recommend" v-if="recommendedDays">
              <span class="days-recommend-label">推荐保质期</span>
              <button class="days-recommend-chip" @click="form.days = recommendedDays; validateDayField()">{{ recommendedDays }} 天</button>
              <button class="days-recommend-chip ai-recommend-btn" @click="getAiRecommend" :disabled="aiRecommendLoading">
                {{ aiRecommendLoading ? '🤔 查询中…' : '🤖 AI推荐' }}
              </button>
            </div>
            <div class="ai-recommend-result" v-if="aiRecommendResult && !aiRecommendLoading">
              <div class="ai-recommend-days">{{ aiRecommendResult.days }} 天</div>
              <div class="ai-recommend-reason" v-if="aiRecommendResult.reason">{{ aiRecommendResult.reason }}</div>
              <div class="ai-recommend-tips" v-if="aiRecommendResult.tips">💡 {{ aiRecommendResult.tips }}</div>
              <div class="ai-recommend-source" v-if="aiRecommendResult.source === 'ai'">✨ 由 DeepSeek AI 生成</div>
            </div>
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
    <div v-if="deleteTarget" class="modal-overlay alert-overlay" @click.self="deleteTarget = null">
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
    <div v-if="batchDeleteTarget" class="modal-overlay alert-overlay" @click.self="batchDeleteTarget = ''">
      <div class="alert-sheet">
        <div class="alert-icon">⚠️</div><div class="alert-title">{{ batchDeleteTarget }}</div>
        <div class="alert-desc">此操作不可撤销</div>
        <div class="alert-actions">
          <button class="btn-cancel" @click="batchDeleteTarget = ''">取消</button><button class="btn-danger" @click="doBatchDeleteConfirm">删除</button>
        </div>
      </div>
    </div>
  </Transition>
</template>


