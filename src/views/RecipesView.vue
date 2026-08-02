<script setup>
import { ref, computed, nextTick } from 'vue'
import { useFoodStore } from '../store/foodStore.js'
import { useFeatureStore } from '../store/featureStore.js'
import { useSwipeBatch } from '../composables/useSwipeBatch.js'
import { extractRecipe } from '../nlp/extractor.js'

const foodStore = useFoodStore()
const featureStore = useFeatureStore()

const expandedRecipe = ref(null)
const activeRecipeCategory = ref('all')
const showRecipeModal = ref(false)
const showPasteRecipe = ref(false)
const pasteRecipeText = ref('')
const pasteRecipeResult = ref(null)
const randomRecipe = ref(null)

const recipeCategoryOptions = [
  { key: 'all', label: '全部' },
  { key: '蔬菜', label: '🥬 蔬菜' },
  { key: '肉类', label: '🥩 肉类' },
  { key: '水果', label: '🍎 水果' },
  { key: '乳制品', label: '🥛 乳制品' },
  { key: '其他', label: '📦 其他' },
]
const recipeCategoryCreateOptions = ['蔬菜', '肉类', '水果', '乳制品', '其他']
const difficultyOptions = ['超简单', '简单', '中等', '困难']

const recipeForm = ref({ name: '', emoji: '🍳', difficulty: '简单', time: 15, category: '蔬菜', ingredientsText: '', stepsText: '' })
const isRecipeFormValid = computed(() => recipeForm.value.name.trim() && recipeForm.value.ingredientsText.trim())

const recommendedRecipes = computed(() => {
  if (!featureStore.state.flags.pairing) {
    return foodStore.recipes.map(r => ({ ...r, matched: [], unmatched: r.ingredients, ratio: 0, calories: 0, goalTags: [] }))
  }
  return foodStore.getRecommendedRecipes()
})
const filteredRecipes = computed(() => {
  if (activeRecipeCategory.value === 'all') return recommendedRecipes.value
  return recommendedRecipes.value.filter(r => r.category === activeRecipeCategory.value)
})

const recipeBatch = useSwipeBatch({
  getItems: () => filteredRecipes.value,
  onDelete: (id) => { if (!id.startsWith('r')) foodStore.removeRecipe(id) },
  onBatchDelete: (ids) => { const custom = ids.filter(id => !id.startsWith('r')); if (custom.length) foodStore.removeRecipes(custom) },
  canSelect: (r) => !r.id.startsWith('r'),
  onItemClick: (r) => toggleRecipeDetail(r.id),
})

function toggleRecipeDetail(id) { expandedRecipe.value = expandedRecipe.value === id ? null : id }

function openRecipeModal() { recipeForm.value = { name: '', emoji: '🍳', difficulty: '简单', time: 15, category: '蔬菜', ingredientsText: '', stepsText: '' }; showRecipeModal.value = true }
function closeRecipeModal() { showRecipeModal.value = false }
function saveRecipe() {
  if (!isRecipeFormValid.value) return
  foodStore.addRecipe({
    name: recipeForm.value.name,
    emoji: recipeForm.value.emoji,
    difficulty: recipeForm.value.difficulty,
    time: recipeForm.value.time,
    category: recipeForm.value.category,
    ingredients: recipeForm.value.ingredientsText.split(/[,，]/).map(s => s.trim()).filter(Boolean),
    steps: recipeForm.value.stepsText.split(/\n/).map(s => s.trim()).filter(Boolean),
  })
  closeRecipeModal()
}

function doPasteRecipe() {
  if (!pasteRecipeText.value.trim()) return
  pasteRecipeResult.value = { loading: true }
  extractRecipe(pasteRecipeText.value).then(r => { pasteRecipeResult.value = r })
}
function applyPasteRecipe() {
  const r = pasteRecipeResult.value
  if (!r) return
  if (r.name) recipeForm.value.name = r.name
  if (r.difficulty) recipeForm.value.difficulty = r.difficulty
  if (r.time) recipeForm.value.time = r.time
  if (r.category) recipeForm.value.category = r.category
  if (r.ingredients.length) recipeForm.value.ingredientsText = r.ingredients.join('，')
  if (r.steps.length) recipeForm.value.stepsText = r.steps.join('\n')
  showPasteRecipe.value = false
  pasteRecipeText.value = ''
  pasteRecipeResult.value = null
}

function pickRandomRecipe() {
  const recipes = recommendedRecipes.value.length ? recommendedRecipes.value : foodStore.recipes
  if (recipes.length === 0) return
  randomRecipe.value = recipes[Math.floor(Math.random() * recipes.length)]
}

function addMissingToShopList(recipe) {
  for (const ing of recipe.unmatched) {
    foodStore.addShopItemWithSource(ing, recipe.name)
  }
}

// 批量删除确认
const batchDeleteTarget = ref('')
function onRecipeBatchDelete() {
  const customSelected = [...recipeBatch.selectedIds.value].filter(id => !id.startsWith('r'))
  if (customSelected.length === 0) { batchDeleteTarget.value = ''; return }
  batchDeleteTarget.value = `删除 ${customSelected.length} 个自定义菜谱`
}
function doBatchDeleteConfirm() {
  const ids = [...recipeBatch.selectedIds.value].filter(id => !id.startsWith('r'))
  if (ids.length) foodStore.removeRecipes(ids)
  recipeBatch.exitBatchMode()
  batchDeleteTarget.value = ''
}

function goToCook(recipe) {
  if (!recipe) return
  expandedRecipe.value = recipe.id
  nextTick(() => {
    const el = document.querySelector(`[data-recipe-id="${recipe.id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// 处理 ProfileView “今天吃什么”事件
function handleProfileRecipeEvent(e) {
  const action = e.detail?.action
  if (action === 'pick-random-recipe') pickRandomRecipe()
  if (action === 'cook-recipe') goToCook(e.detail.recipe)
}
window.addEventListener('ffood-view-event', handleProfileRecipeEvent)

const VIEW_EVENT = 'ffood-view-event'
function handleViewEvent(e) {
  const action = e.detail?.action
  if (action === 'open-add-recipe') openRecipeModal()
}
if (typeof window !== 'undefined') window.addEventListener(VIEW_EVENT, handleViewEvent)

defineExpose({ openRecipeModal, pickRandomRecipe, goToCook, randomRecipe })
</script>

<template>
  <div class="recipe-list">
    <div v-if="!featureStore.state.flags.recipes" class="feature-locked">
      <div class="feature-locked-icon">🔒</div>
      <div class="feature-locked-title">菜谱推荐未开启</div>
      <div class="feature-locked-desc">开启后可查看菜谱库、自定义菜谱和「今天吃什么」</div>
      <button class="btn-save feature-locked-btn" @click="featureStore.toggle('recipes')">去开启</button>
    </div>

    <template v-else>
      <div class="recipe-header-bar">
        <div class="recipe-hint" v-if="recipeBatch.batchMode.value">🔒 内置菜谱不可删除，仅可勾选自定义菜谱</div>
        <div class="recipe-hint" v-else-if="featureStore.state.flags.pairing && foodStore.totalCount > 0">
          🧊 基于冰箱里的 <strong>{{ foodStore.totalCount }}</strong> 件食材自动同步，猜你喜欢：
        </div>
        <div class="recipe-hint" v-else-if="featureStore.state.flags.pairing">🧑‍🍳 冰箱还是空的，先添加食材才能匹配菜谱哦～</div>
        <div class="recipe-hint" v-else>📖 菜谱库浏览模式，共 {{ foodStore.recipes.length }} 道菜谱</div>
        <button v-if="recommendedRecipes.length > 0" :class="['batch-toggle-btn', { active: recipeBatch.batchMode.value }]" @click="recipeBatch.toggleBatchMode()">
          {{ recipeBatch.batchMode.value ? '完成' : '多选' }}
        </button>
      </div>

      <div class="recipe-category-bar" v-if="recommendedRecipes.length > 0">
        <button v-for="cat in recipeCategoryOptions" :key="cat.key"
          :class="['recipe-category-chip', { active: activeRecipeCategory === cat.key }]"
          @click="activeRecipeCategory = cat.key">{{ cat.label }}</button>
      </div>

      <div class="recipe-empty" v-if="filteredRecipes.length === 0 && foodStore.totalCount > 0">
        <div class="empty-icon">🍳</div>
        <div class="empty-text">{{ recommendedRecipes.length === 0 ? '现有食材还没法匹配菜谱' : '该分类下暂无菜谱' }}</div>
        <div class="empty-hint">添加更多常用食材，或点击下方 + 自定义菜谱</div>
      </div>

      <div class="recipe-item-wrapper" v-for="r in filteredRecipes" :key="r.id" :data-recipe-id="r.id"
        @touchstart="recipeBatch.touchStart($event, r)" @touchmove="recipeBatch.touchMove($event, r, '.recipe-item-card')" @touchend="recipeBatch.touchEnd($event, r, '.recipe-item-card')"
        @mousedown="recipeBatch.mouseStart($event, r)" @mouseup="recipeBatch.mouseEnd($event, r)" @mouseleave="recipeBatch.mouseLeave(r)"
        @contextmenu.prevent>
        <div class="swipe-actions">
          <button v-if="!r.id.startsWith('r')" class="swipe-action-btn" @click.stop="recipeBatch.deleteSingle(r.id)">
            <span class="action-emoji">🗑️</span><span class="action-label">删除</span>
          </button>
          <button v-else class="swipe-action-btn" disabled style="opacity:0.5;cursor:not-allowed">
            <span class="action-emoji">🔒</span><span class="action-label">内置</span>
          </button>
        </div>
        <div :class="['recipe-item-card', { selected: recipeBatch.selectedIds.value.has(r.id) }]"
          @click="recipeBatch.handleCardClick(r)" :style="recipeBatch.cardStyle(r.id)">
          <div v-if="recipeBatch.batchMode.value" class="select-checkbox" :class="{ checked: recipeBatch.selectedIds.value.has(r.id), disabled: r.id.startsWith('r') }" @click.stop>
            <span v-if="recipeBatch.selectedIds.value.has(r.id)">✓</span>
          </div>
          <div class="recipe-header">
            <span class="recipe-emoji">{{ r.emoji }}</span>
            <div class="recipe-info">
              <div class="recipe-name">{{ r.name }}</div>
              <div class="recipe-meta">{{ r.difficulty }} · ⏱ {{ r.time }}分钟 · 🔥 {{ r.calories }} kcal</div>
              <div class="recipe-goal-tags" v-if="featureStore.state.flags.pairing && r.goalTags.length">
                <span v-for="tag in r.goalTags" :key="tag" class="goal-tag">{{ tag }}</span>
              </div>
            </div>
            <div v-if="featureStore.state.flags.pairing" :class="['recipe-match-badge', r.ratio >= 1 ? 'match-full' : r.ratio > 0 ? 'match-high' : 'match-none']">
              {{ r.ratio >= 1 ? '✅ 全部齐备' : r.ratio > 0 ? `缺${r.unmatched.length}种` : '未匹配' }}
            </div>
          </div>
          <div class="recipe-ingredients-preview" v-if="featureStore.state.flags.pairing">
            <span v-for="ing in r.ingredients" :key="ing"
              :class="['ingredient-tag', r.matched.includes(ing) ? 'ingredient-have' : 'ingredient-miss']">
              {{ r.matched.includes(ing) ? '✅' : '❌' }} {{ ing }}
            </span>
          </div>
          <Transition name="expand">
            <div v-if="expandedRecipe === r.id" class="recipe-body">
              <div class="recipe-section">
                <div class="recipe-section-title">所需食材</div>
                <div class="recipe-ingredients">
                  <span v-for="ing in r.ingredients" :key="ing" :class="['ingredient-tag', featureStore.state.flags.pairing ? (r.matched.includes(ing) ? 'ingredient-have' : 'ingredient-miss') : 'ingredient-have']">
                    {{ featureStore.state.flags.pairing ? (r.matched.includes(ing) ? '✅' : '❌') : '🧺' }} {{ ing }}
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
                <button class="btn-recipe-shop" @click.stop="addMissingToShopList(r)">📝 缺的食材加入购物清单</button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </div>

  <!-- 自定义菜谱弹窗 -->
  <Transition name="modal">
    <div v-if="showRecipeModal" class="modal-overlay" @click.self="closeRecipeModal">
      <div class="modal-sheet">
        <div class="modal-handle" /><h3 class="modal-title">🍳 自定义菜谱</h3>
        <div class="modal-body">
          <div class="paste-section">
            <button class="paste-toggle-btn" @click="showPasteRecipe = !showPasteRecipe">📋 粘贴智能填充</button>
            <Transition name="expand">
              <div v-if="showPasteRecipe" class="paste-area">
                <textarea v-model="pasteRecipeText" class="paste-textarea" rows="3"
                  placeholder="例：番茄炒蛋 简单 15分钟 番茄鸡蛋葱，步骤：打散鸡蛋，番茄切块炒出汁"></textarea>
                <button class="paste-parse-btn" @click="doPasteRecipe" :disabled="!pasteRecipeText.trim()">智能识别</button>
                <div v-if="pasteRecipeResult && !pasteRecipeResult.loading" class="paste-preview">
                  <div class="paste-preview-title">识别结果（点击应用到表单）</div>
                  <div class="paste-preview-body" @click="applyPasteRecipe">
                    {{ pasteRecipeResult.name || '未识别' }}
                    <span v-if="pasteRecipeResult.difficulty">· {{ pasteRecipeResult.difficulty }}</span>
                    <span v-if="pasteRecipeResult.time">· {{ pasteRecipeResult.time }}分钟</span>
                    <span v-if="pasteRecipeResult.ingredients.length">· 食材：{{ pasteRecipeResult.ingredients.join('、') }}</span>
                    <span v-if="pasteRecipeResult.steps.length">· {{ pasteRecipeResult.steps.length }}步</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
          <div class="form-group">
            <label class="form-label">菜谱名称 *</label>
            <input v-model="recipeForm.name" class="form-input" placeholder="例：番茄炒蛋" maxlength="20" />
          </div>
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">emoji</label>
              <input v-model="recipeForm.emoji" class="form-input" placeholder="🍳" maxlength="2" />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">时间（分）</label>
              <input v-model="recipeForm.time" type="number" class="form-input" min="1" max="300" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">难度</label>
            <div class="difficulty-picker">
              <button v-for="d in difficultyOptions" :key="d" :class="['difficulty-chip', { active: recipeForm.difficulty === d }]" @click="recipeForm.difficulty = d">{{ d }}</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">分类</label>
            <div class="difficulty-picker">
              <button v-for="c in recipeCategoryCreateOptions" :key="c" :class="['difficulty-chip', { active: recipeForm.category === c }]" @click="recipeForm.category = c">{{ c }}</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">所需食材（用逗号分隔）</label>
            <input v-model="recipeForm.ingredientsText" class="form-input" placeholder="鸡蛋, 番茄, 葱" />
          </div>
          <div class="form-group">
            <label class="form-label">做法步骤（每行一步）</label>
            <textarea v-model="recipeForm.stepsText" class="form-textarea" rows="3" placeholder="1. 鸡蛋打散..." />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="closeRecipeModal">取消</button>
          <button class="btn-save" @click="saveRecipe" :disabled="!isRecipeFormValid">保存</button>
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
