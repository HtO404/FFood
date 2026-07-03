import { ref, computed } from 'vue'

/**
 * 统一滑动删除 + 长按多选 + 复选框批量删除的可复用逻辑
 * 用于食材 / 菜谱 / 购物清单三处列表，保持交互一致性
 *
 * @param {Object} options
 * @param {Function} options.getItems  返回当前列表数组（用于全选计算）
 * @param {Function} options.onDelete  单条删除回调 (id) => void
 * @param {Function} options.onBatchDelete 批量删除回调 (ids: string[]) => void
 * @param {Function} [options.canSelect] 某项是否可被选中（用于保护内置菜谱）
 * @param {Function} [options.onItemClick] 非多选模式下点击项回调 (item) => void
 */
export function useSwipeBatch(options = {}) {
  const {
    getItems,
    onDelete,
    onBatchDelete,
    canSelect = () => true,
    onItemClick = () => {},
  } = options

  // ========== 滑动删除 ==========
  const swipedId = ref(null)
  const SWIPE_THRESHOLD = -64
  const touchMap = new Map()
  const mouseMap = new Map()

  // ========== 长按进入多选 ==========
  const batchMode = ref(false)
  const selectedIds = ref(new Set())
  const longPressTimer = ref(null)
  const LONG_PRESS_MS = 550

  const allSelected = computed(() => {
    const items = getItems() || []
    const selectable = items.filter(it => canSelect(it))
    return selectable.length > 0 && selectedIds.value.size === selectable.length
  })

  function cardStyle(id) {
    const x = swipedId.value === id ? SWIPE_THRESHOLD : 0
    return {
      transform: `translateX(${x}px)`,
      transition: 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
    }
  }

  function clearLongPress() {
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
  }

  function startLongPress(item) {
    clearLongPress()
    if (!canSelect(item)) return
    longPressTimer.value = setTimeout(() => {
      if (!batchMode.value) {
        batchMode.value = true
        swipedId.value = null  // 防误触：进入多选时清空所有滑动状态
        selectedIds.value = new Set([item.id])
      }
      longPressTimer.value = null
    }, LONG_PRESS_MS)
  }

  function touchStart(e, item) {
    if (batchMode.value) return
    const t = e.touches[0]
    touchMap.set(item.id, { startX: t.clientX, startY: t.clientY, time: Date.now() })
    startLongPress(item)
  }

  function touchMove(e, item, cardSelector = '.swipe-card') {
    if (batchMode.value || !touchMap.has(item.id)) return
    const t = e.touches[0]
    const state = touchMap.get(item.id)
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY
    if (Math.abs(dy) > 10 || Math.abs(dx) > 10) clearLongPress()
    if (Math.abs(dy) > Math.abs(dx)) return
    e.preventDefault()
    const card = e.currentTarget.querySelector(cardSelector)
    if (!card) return
    if (dx < 0) card.style.transform = `translateX(${Math.max(dx, -90)}px)`
    else card.style.transform = `translateX(${Math.min(dx, 0)}px)`
  }

  function touchEnd(e, item, cardSelector = '.swipe-card') {
    clearLongPress()
    if (batchMode.value || !touchMap.has(item.id)) return
    const t = e.changedTouches[0]
    const state = touchMap.get(item.id)
    const dx = t.clientX - state.startX
    const card = e.currentTarget.querySelector(cardSelector)
    if (card) card.style.transform = ''
    if (dx < SWIPE_THRESHOLD) swipedId.value = item.id
    else swipedId.value = null
    touchMap.delete(item.id)
  }

  function mouseStart(e, item) {
    if (batchMode.value || e.button !== 0) return
    startLongPress(item)
    mouseMap.set(item.id, { x: e.clientX, y: e.clientY })
  }

  function mouseEnd(e, item) {
    clearLongPress()
    mouseMap.delete(item.id)
  }

  function mouseLeave(item) {
    clearLongPress()
    mouseMap.delete(item.id)
  }

  // ========== 多选 ==========
  function toggleBatchMode() {
    batchMode.value = !batchMode.value
    if (!batchMode.value) {
      selectedIds.value = new Set()
      swipedId.value = null
    }
  }

  function exitBatchMode() {
    batchMode.value = false
    selectedIds.value = new Set()
    swipedId.value = null
  }

  function toggleSelectAll() {
    const items = getItems() || []
    const selectable = items.filter(it => canSelect(it))
    selectedIds.value = allSelected.value
      ? new Set()
      : new Set(selectable.map(it => it.id))
  }

  function handleCardClick(item) {
    if (swipedId.value && swipedId.value !== item.id) {
      swipedId.value = null
      return
    }
    if (swipedId.value === item.id) {
      swipedId.value = null
      return
    }
    if (batchMode.value) {
      if (!canSelect(item)) return
      const s = new Set(selectedIds.value)
      if (s.has(item.id)) s.delete(item.id)
      else s.add(item.id)
      selectedIds.value = s
    } else {
      onItemClick(item)
    }
  }

  function confirmBatchDelete(label) {
    if (selectedIds.value.size === 0) return null
    return label || `删除 ${selectedIds.value.size} 项`
  }

  function doBatchDelete() {
    const ids = [...selectedIds.value]
    onBatchDelete(ids)
    selectedIds.value = new Set()
    batchMode.value = false
    swipedId.value = null
  }

  function deleteSingle(id) {
    onDelete(id)
    swipedId.value = null
  }

  return {
    // 滑动
    swipedId,
    SWIPE_THRESHOLD,
    cardStyle,
    touchStart,
    touchMove,
    touchEnd,
    mouseStart,
    mouseEnd,
    mouseLeave,
    // 多选
    batchMode,
    selectedIds,
    allSelected,
    toggleBatchMode,
    exitBatchMode,
    toggleSelectAll,
    handleCardClick,
    confirmBatchDelete,
    doBatchDelete,
    deleteSingle,
  }
}
