<script setup>
import { ref, computed } from 'vue'
import { useFoodStore } from '../store/foodStore.js'
import { useSwipeBatch } from '../composables/useSwipeBatch.js'

const foodStore = useFoodStore()
const shopInput = ref('')
const shopInputRef = ref(null)

const sortedShopList = computed(() => foodStore.getShopListSorted())
const uncheckedShopItems = computed(() => sortedShopList.value.filter(i => !i.checked))
const checkedShopItems = computed(() => sortedShopList.value.filter(i => i.checked))
const shopUncheckedCount = computed(() => uncheckedShopItems.value.length)

const shopBatch = useSwipeBatch({
  getItems: () => sortedShopList.value,
  onDelete: (id) => foodStore.removeShopItem(id),
  onBatchDelete: (ids) => foodStore.removeShopItems(ids),
  onItemClick: (item) => { foodStore.toggleShopItem(item.id) },
})

function addShopItem() {
  if (!shopInput.value.trim()) return
  foodStore.addShopItem(shopInput.value)
  shopInput.value = ''
}

function focusShopInput() {
  const el = document.querySelector('.shop-input')
  if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
}

// 批量删除确认
const batchDeleteTarget = ref('')
function onShopBatchDelete() {
  if (shopBatch.selectedIds.value.size === 0) return
  batchDeleteTarget.value = `删除 ${shopBatch.selectedIds.value.size} 项购物清单`
}
function doBatchDeleteConfirm() {
  const ids = shopBatch.selectedIds.value
  foodStore.removeShopItems([...ids])
  shopBatch.exitBatchMode()
  batchDeleteTarget.value = ''
}

const VIEW_EVENT = 'ffood-view-event'
function handleViewEvent(e) {
  const action = e.detail?.action
  if (action === 'focus-shop-input') focusShopInput()
  if (action === 'open-add-shop') addShopItem()
}
if (typeof window !== 'undefined') window.addEventListener(VIEW_EVENT, handleViewEvent)

defineExpose({ focusShopInput, addShopItem })
</script>

<template>
  <div class="shop-list">
    <div class="shop-input-row">
      <input ref="shopInputRef" v-model="shopInput" class="shop-input" placeholder="添加要买的东西…" maxlength="30" @keyup.enter="addShopItem" />
      <button class="shop-add-btn" @click="addShopItem" :disabled="!shopInput.trim()">添加</button>
    </div>

    <div class="storage-filter-row" v-if="sortedShopList.length > 0">
      <div class="storage-filter-scroll"></div>
      <button :class="['batch-toggle-btn', { active: shopBatch.batchMode.value }]" @click="shopBatch.toggleBatchMode()">
        {{ shopBatch.batchMode.value ? '完成' : '多选' }}
      </button>
    </div>

    <div class="shop-section" v-if="uncheckedShopItems.length">
      <div class="shop-section-title">待购买 ({{ uncheckedShopItems.length }})</div>
      <div class="shop-item-wrapper" v-for="item in uncheckedShopItems" :key="item.id"
        @touchstart="shopBatch.touchStart($event, item)" @touchmove="shopBatch.touchMove($event, item, '.shop-item-card')" @touchend="shopBatch.touchEnd($event, item, '.shop-item-card')"
        @mousedown="shopBatch.mouseStart($event, item)" @mouseup="shopBatch.mouseEnd($event, item)" @mouseleave="shopBatch.mouseLeave(item)"
        @contextmenu.prevent>
        <div class="swipe-actions">
          <button class="swipe-action-btn" @click.stop="shopBatch.deleteSingle(item.id)">
            <span class="action-emoji">🗑️</span><span class="action-label">删除</span>
          </button>
        </div>
        <div :class="['shop-item-card', { checked: item.checked, selected: shopBatch.selectedIds.value.has(item.id) }]"
          @click="shopBatch.handleCardClick(item)" :style="shopBatch.cardStyle(item.id)">
          <div v-if="shopBatch.batchMode.value" class="select-checkbox" :class="{ checked: shopBatch.selectedIds.value.has(item.id) }">
            <span v-if="shopBatch.selectedIds.value.has(item.id)">✓</span>
          </div>
          <div v-else :class="['shop-check', { checked: item.checked }]" @click.stop="foodStore.toggleShopItem(item.id)"><span v-if="item.checked">✓</span></div>
          <span class="shop-item-text">{{ item.text }}<span v-if="item.source" class="shop-source-tag">🏷️ {{ item.source }}</span></span>
        </div>
      </div>
    </div>

    <div class="shop-section" v-if="checkedShopItems.length">
      <div class="shop-section-title dim">已购买 ({{ checkedShopItems.length }})</div>
      <div class="shop-item-wrapper" v-for="item in checkedShopItems" :key="item.id"
        @touchstart="shopBatch.touchStart($event, item)" @touchmove="shopBatch.touchMove($event, item, '.shop-item-card')" @touchend="shopBatch.touchEnd($event, item, '.shop-item-card')"
        @mousedown="shopBatch.mouseStart($event, item)" @mouseup="shopBatch.mouseEnd($event, item)" @mouseleave="shopBatch.mouseLeave(item)"
        @contextmenu.prevent>
        <div class="swipe-actions">
          <button class="swipe-action-btn" @click.stop="shopBatch.deleteSingle(item.id)">
            <span class="action-emoji">🗑️</span><span class="action-label">删除</span>
          </button>
        </div>
        <div :class="['shop-item-card', { checked: item.checked, selected: shopBatch.selectedIds.value.has(item.id) }]"
          @click="shopBatch.handleCardClick(item)" :style="shopBatch.cardStyle(item.id)">
          <div v-if="shopBatch.batchMode.value" class="select-checkbox" :class="{ checked: shopBatch.selectedIds.value.has(item.id) }">
            <span v-if="shopBatch.selectedIds.value.has(item.id)">✓</span>
          </div>
          <div v-else :class="['shop-check', { checked: item.checked }]" @click.stop="foodStore.toggleShopItem(item.id)"><span v-if="item.checked">✓</span></div>
          <span class="shop-item-text">{{ item.text }}<span v-if="item.source" class="shop-source-tag">🏷️ {{ item.source }}</span></span>
        </div>
      </div>
      <button class="shop-clear-btn" @click="foodStore.clearCheckedShopItems()">清除已完成</button>
    </div>

    <div class="empty-state" v-if="sortedShopList.length === 0">
      <div class="empty-icon">📝</div>
      <div class="empty-text">购物清单是空的~</div>
      <div class="empty-hint">在上面输入要买的东西，或从菜谱"加入购物清单"</div>
    </div>
  </div>

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
