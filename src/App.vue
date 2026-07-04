<template>
  <!-- 未登录：显示登录/注册页 -->
  <AuthPage v-if="!authStore.state.isLoggedIn && !guestMode" @guest="guestMode = true" @authed="guestMode = false" />

  <!-- 已登录或游客模式：显示主应用 -->
  <div class="app" v-else>
    <!-- ==================== 导航栏 ==================== -->
    <header class="nav-bar">
      <div class="nav-title">
        <template v-if="activeTab === 'food'">🥬 食材管理</template>
        <template v-else-if="activeTab === 'shop'">🛒 购物清单</template>
        <template v-else-if="activeTab === 'recipes'">🍳 菜谱推荐</template>
        <template v-else>👤 我的</template>
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

    <!-- 存储筛选 + 排序 + 批量 -->
    <div class="storage-filter-row" v-if="activeTab === 'food' && activeCategory === 'all'">
      <div class="storage-filter-scroll">
        <button v-for="s in storageFilterOptions" :key="s.key"
          :class="['storage-filter-chip', { active: activeStorage === s.key }]" @click="activeStorage = s.key">{{ s.label }}</button>
      </div>
      <button v-if="foodStore.totalCount > 0" :class="['batch-toggle-btn', { active: foodBatch.batchMode.value }]" @click="foodBatch.toggleBatchMode()">
        {{ foodBatch.batchMode.value ? '完成' : '多选' }}
      </button>
    </div>

    <!-- 食材排序栏 -->
    <div class="sort-bar" v-if="activeTab === 'food' && foodStore.totalCount > 0">
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

    <Transition name="toolbar-slide">
      <div v-if="shopBatch.batchMode.value" class="batch-toolbar-fixed">
        <div class="batch-toolbar-inner">
          <button class="batch-btn" @click="shopBatch.toggleSelectAll()">{{ shopBatch.allSelected.value ? '取消全选' : '全选' }}</button>
          <span class="batch-info">已选 {{ shopBatch.selectedIds.value.size }}</span>
          <button class="batch-btn batch-delete" :disabled="shopBatch.selectedIds.value.size === 0" @click="onShopBatchDelete">删除</button>
          <button class="batch-btn batch-done" @click="shopBatch.exitBatchMode()">完成</button>
        </div>
      </div>
    </Transition>

    <Transition name="toolbar-slide">
      <div v-if="recipeBatch.batchMode.value" class="batch-toolbar-fixed">
        <div class="batch-toolbar-inner">
          <button class="batch-btn" @click="recipeBatch.toggleSelectAll()">{{ recipeBatch.allSelected.value ? '取消全选' : '全选' }}</button>
          <span class="batch-info">已选 {{ recipeBatch.selectedIds.value.size }}</span>
          <button class="batch-btn batch-delete" :disabled="recipeBatch.selectedIds.value.size === 0" @click="onRecipeBatchDelete">删除</button>
          <button class="batch-btn batch-done" @click="recipeBatch.exitBatchMode()">完成</button>
        </div>
      </div>
    </Transition>

    <!-- ==================== 食材列表 Tab ==================== -->
    <div :class="['food-list', { 'batch-active': foodBatch.batchMode.value }]" v-if="activeTab === 'food' && groupedFoods.length">
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

    <div class="empty-state" v-if="activeTab === 'food' && !groupedFoods.length">
      <div class="empty-icon">🛒</div>
      <div class="empty-text">冰箱空空如也~</div>
      <div class="empty-hint">点下方 + 添加第一种食材吧</div>
      <button class="empty-cta" @click="openAddModal">+ 添加食材</button>
    </div>

    <!-- ==================== 购物清单 Tab (P2-1) ==================== -->
    <div class="shop-list" v-if="activeTab === 'shop'">
      <div class="shop-input-row">
        <input v-model="shopInput" class="shop-input" placeholder="添加要买的东西…" maxlength="30" @keyup.enter="addShopItem" />
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
            @click="onShopItemClick(item)" :style="shopBatch.cardStyle(item.id)">
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
            @click="onShopItemClick(item)" :style="shopBatch.cardStyle(item.id)">
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

    <!-- ==================== 菜谱推荐 Tab (P2-2) ==================== -->
    <div class="recipe-list" v-if="activeTab === 'recipes'">
      <div class="recipe-header-bar">
        <div class="recipe-hint" v-if="recipeBatch.batchMode.value">
          🔒 内置菜谱不可删除，仅可勾选自定义菜谱
        </div>
        <div class="recipe-hint" v-else-if="foodStore.totalCount > 0">
          🧑‍🍳 基于冰箱里的 <strong>{{ foodStore.totalCount }}</strong> 件食材自动同步，猜你喜欢：
        </div>
        <div class="recipe-hint" v-else>🧑‍🍳 冰箱还是空的，先添加食材才能匹配菜谱哦～</div>
        <button v-if="recommendedRecipes.length > 0" :class="['batch-toggle-btn', { active: recipeBatch.batchMode.value }]" @click="recipeBatch.toggleBatchMode()">
          {{ recipeBatch.batchMode.value ? '完成' : '多选' }}
        </button>
      </div>

      <!-- 菜谱分类筛选 -->
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
              <div class="recipe-goal-tags" v-if="r.goalTags.length">
                <span v-for="tag in r.goalTags" :key="tag" class="goal-tag">{{ tag }}</span>
              </div>
            </div>
            <div :class="['recipe-match-badge', r.ratio >= 1 ? 'match-full' : r.ratio > 0 ? 'match-high' : 'match-none']">
              {{ r.ratio >= 1 ? '✅ 全部齐备' : r.ratio > 0 ? `缺${r.unmatched.length}种` : '未匹配' }}
            </div>
          </div>
          <div class="recipe-ingredients-preview">
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
    </div>

    <!-- ==================== 我的 Tab ==================== -->
    <div class="profile-list" v-if="activeTab === 'profile'">
      <div class="profile-card profile-header-card">
        <div class="profile-avatar">{{ userForm.nickname ? userForm.nickname.slice(0,1) : '👤' }}</div>
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
        <button class="btn-save profile-save" @click="saveUserProfile">保存资料</button>
      </div>

      <div class="profile-card">
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
        <div class="profile-card-title">今天吃什么</div>
        <div class="what-to-eat" @click="pickRandomRecipe">
          <div class="wte-icon">🎲</div>
          <div class="wte-result" v-if="randomRecipe">{{ randomRecipe.emoji }} {{ randomRecipe.name }}</div>
          <div class="wte-hint" v-else>点我随机选一道菜谱</div>
        </div>
        <div class="wte-actions" v-if="randomRecipe">
          <button class="btn-save wte-btn" @click="pickRandomRecipe">再摇一次</button>
          <button class="btn-save wte-cook-btn" @click="goToCook(randomRecipe)">🍳 去制作</button>
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
          <button class="btn-login-go" @click="guestMode = false">去登录</button>
        </div>
      </div>
    </div>

    <!-- TabBar：5格布局，中间居中放大添加按钮 -->
    <nav class="tab-bar">
      <button :class="['tab-item', { active: activeTab === 'food' }]" @click="switchTab('food')">
        <span class="tab-icon">🥬</span><span class="tab-label">食材</span>
      </button>
      <button :class="['tab-item', { active: activeTab === 'recipes' }]" @click="switchTab('recipes')">
        <span class="tab-icon">🍳</span><span class="tab-label">菜谱</span>
      </button>
      <button class="tab-item tab-center" @click="onCenterAdd">
        <span class="tab-center-btn">+</span>
      </button>
      <button :class="['tab-item', { active: activeTab === 'shop' }]" @click="switchTab('shop')">
        <span class="tab-icon">🛒</span><span class="tab-label">购物</span>
        <span class="tab-badge" v-if="shopUncheckedCount">{{ shopUncheckedCount }}</span>
      </button>
      <button :class="['tab-item', { active: activeTab === 'profile' }]" @click="switchTab('profile')">
        <span class="tab-icon">👤</span><span class="tab-label">我的</span>
      </button>
    </nav>

    <!-- ==================== 扫码录入弹窗 (P2-3) ==================== -->
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

    <!-- 添加/编辑弹窗 -->
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-sheet">
          <div class="modal-handle" /><h3 class="modal-title">{{ editingFood ? '编辑食材' : '添加食材' }}</h3>
          <div class="modal-body">
            <div class="paste-section" v-if="!editingFood">
              <button class="paste-toggle-btn" @click="showPasteFood = !showPasteFood">
                📋 粘贴智能填充
              </button>
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
                <button class="days-recommend-chip" @click="form.days = recommendedDays; validateDayField()">
                  {{ recommendedDays }} 天
                </button>
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

    <!-- 自定义菜谱弹窗 -->
    <Transition name="modal">
      <div v-if="showRecipeModal" class="modal-overlay" @click.self="closeRecipeModal">
        <div class="modal-sheet">
          <div class="modal-handle" /><h3 class="modal-title">🍳 自定义菜谱</h3>
          <div class="modal-body">
            <div class="paste-section">
              <button class="paste-toggle-btn" @click="showPasteRecipe = !showPasteRecipe">
                📋 粘贴智能填充
              </button>
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

    <!-- 删除确认（单条） -->
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

    <!-- 批量删除确认（统一） -->
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
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import { useFoodStore, validateFoodName, validateQuantity as checkQuantity, validateDays as checkDays, recommendDays, GOAL_OPTIONS } from './store/foodStore.js'
import { useSwipeBatch } from './composables/useSwipeBatch.js'
import { extractFood, extractRecipe } from './nlp/extractor.js'
import AuthPage from './components/AuthPage.vue'
import { authStore } from './store/authStore.js'

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
const difficultyOptions = ['超简单', '简单', '中等', '困难']
const sortOptions = [
  { key: 'expiry', label: '临期优先' },
  { key: 'created', label: '添加时间' },
  { key: 'name', label: '名称' },
]
const recipeCategoryOptions = [
  { key: 'all', label: '全部' },
  { key: '蔬菜', label: '🥬 蔬菜' },
  { key: '肉类', label: '🥩 肉类' },
  { key: '水果', label: '🍎 水果' },
  { key: '乳制品', label: '🥛 乳制品' },
  { key: '其他', label: '📦 其他' },
]
const recipeCategoryCreateOptions = ['蔬菜', '肉类', '水果', '乳制品', '其他']
const todayStr = new Date().toISOString().slice(0, 10)

// ========== Tab ==========
const activeTab = ref('food')
const guestMode = ref(false)  // 游客模式：未登录也可浏览
function switchTab(tab) {
  activeTab.value = tab
  // 切换 tab 时退出所有批量模式，避免状态串台
  foodBatch.exitBatchMode()
  shopBatch.exitBatchMode()
  recipeBatch.exitBatchMode()
}

// ========== 我的 / NutritionMaster 参考 ==========
const goalOptions = GOAL_OPTIONS
const userForm = reactive({ ...foodStore.user })
const randomRecipe = ref(null)
const nutritionSummary = computed(() => foodStore.getNutritionSummary())
const macroRingStyle = computed(() => {
  const r = nutritionSummary.value.macroRatio
  if (!r || r.carbs + r.protein + r.fat === 0) return {}
  // conic-gradient 环形图：碳水(橙) 蛋白(蓝) 脂肪(红)
  const c1 = r.carbs, c2 = c1 + r.protein
  return { background: `conic-gradient(var(--orange) 0 ${c1}%, var(--blue) ${c1}% ${c2}%, var(--red) ${c2}% 100%)` }
})
function saveUserProfile() {
  foodStore.saveUser({ ...userForm })
}

// ========== 搜索 & 筛选 ==========
const searchText = ref(''); const activeCategory = ref('all'); const activeStorage = ref('all')

// ========== 食材排序（localStorage 持久化） ==========
const SORT_KEY = 'ffood_sort'
const sortBy = ref(localStorage.getItem(SORT_KEY) || 'expiry')
function setSortBy(key) {
  sortBy.value = key
  localStorage.setItem(SORT_KEY, key)
}

// ========== 批量删除统一确认弹窗 ==========
const batchDeleteTarget = ref('')
const pendingBatchAction = ref(null)  // 'food' | 'shop' | 'recipe'

function onFoodBatchDelete() {
  if (foodBatch.selectedIds.value.size === 0) return
  pendingBatchAction.value = 'food'
  batchDeleteTarget.value = `删除 ${foodBatch.selectedIds.value.size} 件食材`
}
function onShopBatchDelete() {
  if (shopBatch.selectedIds.value.size === 0) return
  pendingBatchAction.value = 'shop'
  batchDeleteTarget.value = `删除 ${shopBatch.selectedIds.value.size} 项购物清单`
}
function onRecipeBatchDelete() {
  // 过滤掉内置菜谱（不应被选中，但二次保护）
  const customSelected = [...recipeBatch.selectedIds.value].filter(id => !id.startsWith('r'))
  if (customSelected.length === 0) {
    batchDeleteTarget.value = ''
    return
  }
  pendingBatchAction.value = 'recipe'
  batchDeleteTarget.value = `删除 ${customSelected.length} 个自定义菜谱`
}
function doBatchDeleteConfirm() {
  const ids = pendingBatchAction.value === 'food'
    ? foodBatch.selectedIds.value
    : pendingBatchAction.value === 'shop'
      ? shopBatch.selectedIds.value
      : [...recipeBatch.selectedIds.value].filter(id => !id.startsWith('r'))
  if (pendingBatchAction.value === 'food') {
    foodStore.removeFoods([...ids])
    foodBatch.exitBatchMode()
  } else if (pendingBatchAction.value === 'shop') {
    foodStore.removeShopItems([...ids])
    shopBatch.exitBatchMode()
  } else if (pendingBatchAction.value === 'recipe') {
    foodStore.removeRecipes([...ids])
    recipeBatch.exitBatchMode()
  }
  batchDeleteTarget.value = ''
  pendingBatchAction.value = null
}

// ========== 三处统一滑动 + 多选 ==========
// 食材
const foodBatch = useSwipeBatch({
  getItems: () => filteredFoods.value,
  onDelete: (id) => {
    const food = foodStore.foods.find(f => f.id === id)
    if (food) confirmDelete(food)
  },
  onBatchDelete: (ids) => foodStore.removeFoods(ids),
  onItemClick: (food) => editFood(food),
})

// 购物清单
const shopBatch = useSwipeBatch({
  getItems: () => sortedShopList.value,
  onDelete: (id) => foodStore.removeShopItem(id),
  onBatchDelete: (ids) => foodStore.removeShopItems(ids),
  onItemClick: (item) => {
    // 非多选模式：点击切换勾选
    foodStore.toggleShopItem(item.id)
  },
})

// 菜谱（内置 r1-r12 不可选/不可删）
const recipeBatch = useSwipeBatch({
  getItems: () => filteredRecipes.value,
  onDelete: (id) => {
    if (id.startsWith('r')) return
    foodStore.removeRecipe(id)
  },
  onBatchDelete: (ids) => {
    const custom = ids.filter(id => !id.startsWith('r'))
    if (custom.length) foodStore.removeRecipes(custom)
  },
  canSelect: (r) => !r.id.startsWith('r'),
  onItemClick: (r) => toggleRecipeDetail(r.id),
})

// 非多选模式下，购物清单点击交由 onItemClick 处理
function onShopItemClick(item) {
  shopBatch.handleCardClick(item)
}

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
const recommendedDays = computed(() => recommendDays(form.value.category, form.value.storage))
watch([() => form.value.category, () => form.value.storage], () => {
  if (!editingFood.value && showAddModal.value) {
    form.value.days = recommendDays(form.value.category, form.value.storage)
    validateDayField()
  }
})
function recalcExpiry() {}
function validateName() { const r = validateFoodName(form.value.name); errors.name = r.message; return r.valid }
function validateQty() { const r = checkQuantity(form.value.quantity); errors.quantity = r.message; return r.valid }
function validateDayField() { const r = checkDays(form.value.days); errors.days = r.message; return r.valid }
function validateAll() { return validateName() & validateQty() & validateDayField() }
const isFormValid = computed(() => form.value.name.trim() !== '' && errors.name === '' && errors.quantity === '' && errors.days === '')
function fillTemplate(tpl) { form.value.name = tpl.name; form.value.quantity = tpl.quantity; form.value.unit = tpl.unit; form.value.category = tpl.category; form.value.storage = tpl.storage; errors.name = ''; errors.quantity = ''; errors.days = '' }

// ========== 粘贴智能填充（NLP） ==========
const showPasteFood = ref(false)
const pasteFoodText = ref('')
const pasteFoodResult = ref(null)
const showPasteRecipe = ref(false)
const pasteRecipeText = ref('')
const pasteRecipeResult = ref(null)

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
  showPasteFood.value = false
  pasteFoodText.value = ''
  pasteFoodResult.value = null
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
function doDelete() { if (deleteTarget.value) { foodStore.removeFood(deleteTarget.value.id); deleteTarget.value = null; foodBatch.swipedId.value = null } }

// ========== 自定义菜谱 ==========
const showRecipeModal = ref(false)
const recipeForm = ref({ name:'', emoji:'🍳', difficulty:'简单', time:15, category:'蔬菜', ingredientsText:'', stepsText:'' })
const isRecipeFormValid = computed(() => recipeForm.value.name.trim() && recipeForm.value.ingredientsText.trim())
function openRecipeModal() { recipeForm.value = { name:'', emoji:'🍳', difficulty:'简单', time:15, category:'蔬菜', ingredientsText:'', stepsText:'' }; showRecipeModal.value = true }
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

// ========== 列表（带排序） ==========
const filteredFoods = computed(() => {
  let list = foodStore.foods
  if (activeCategory.value !== 'all') list = list.filter(f => f.category === activeCategory.value)
  if (activeStorage.value !== 'all') list = list.filter(f => f.storage === activeStorage.value)
  if (searchText.value.trim()) { const kw = searchText.value.trim().toLowerCase(); list = list.filter(f => f.name.toLowerCase().includes(kw)) }
  // 排序
  const sorted = [...list]
  if (sortBy.value === 'expiry') {
    sorted.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity))
  } else if (sortBy.value === 'created') {
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  } else if (sortBy.value === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  }
  return sorted
})
const groupedFoods = computed(() => {
  const groups = {}
  for (const f of filteredFoods.value) { const cat = f.category || '其他'; if (!groups[cat]) groups[cat] = { category:cat, items:[] }; groups[cat].items.push(f) }
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category, 'zh'))
})

// ========== 购物清单 ==========
const shopInput = ref('')
const shopInputRef = ref(null)
const sortedShopList = computed(() => foodStore.getShopListSorted())
const uncheckedShopItems = computed(() => sortedShopList.value.filter(i => !i.checked))
const checkedShopItems = computed(() => sortedShopList.value.filter(i => i.checked))
const shopUncheckedCount = computed(() => uncheckedShopItems.value.length)
function addShopItem() {
  if (!shopInput.value.trim()) return
  foodStore.addShopItem(shopInput.value)
  shopInput.value = ''
}
function focusShopInput() {
  // 购物清单 tab：聚焦输入框（输入框在最顶部，无需弹窗）
  const el = document.querySelector('.shop-input')
  if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
}

// 导航栏中间添加按钮：根据当前 tab 触发对应添加操作
function onCenterAdd() {
  // 多选模式下不触发添加（避免误触）
  if (foodBatch.batchMode.value || recipeBatch.batchMode.value || shopBatch.batchMode.value) return
  switch (activeTab.value) {
    case 'food': openAddModal(); break
    case 'recipes': openRecipeModal(); break
    case 'shop': focusShopInput(); break
    case 'profile': switchTab('food'); nextTick(() => openAddModal()); break
    default: openAddModal()
  }
}

// 退出登录
function onLogout() {
  authStore.logout()
  guestMode.value = false
}

// ========== 菜谱 (P2-2) ==========
const expandedRecipe = ref(null)
const activeRecipeCategory = ref('all')
const recommendedRecipes = computed(() => foodStore.getRecommendedRecipes())
const filteredRecipes = computed(() => {
  if (activeRecipeCategory.value === 'all') return recommendedRecipes.value
  return recommendedRecipes.value.filter(r => r.category === activeRecipeCategory.value)
})
function toggleRecipeDetail(id) { expandedRecipe.value = expandedRecipe.value === id ? null : id }
function pickRandomRecipe() {
  const recipes = recommendedRecipes.value.length ? recommendedRecipes.value : foodStore.recipes
  if (recipes.length === 0) return
  randomRecipe.value = recipes[Math.floor(Math.random() * recipes.length)]
}
function goToCook(recipe) {
  if (!recipe) return
  switchTab('recipes')
  // 展开目标菜谱详情（滚动到视图）
  expandedRecipe.value = recipe.id
  // 等待 DOM 更新后滚动到该菜谱
  nextTick(() => {
    const el = document.querySelector(`[data-recipe-id="${recipe.id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
watch(recommendedRecipes, () => {
  if (randomRecipe.value && !recommendedRecipes.value.some(r => r.id === randomRecipe.value.id)) {
    randomRecipe.value = null
  }
})
function addMissingToShopList(recipe) {
  // 带来源标记：从菜谱加入的购物项标注菜谱名
  for (const ing of recipe.unmatched) {
    foodStore.addShopItemWithSource(ing, recipe.name)
  }
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
function expiryClass(d) { if (d<0) return 'badge-expired'; if (d===0) return 'badge-today'; if (d<=3) return 'badge-warning'; return 'badge-fresh' }
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

onMounted(() => {
  authStore.initAuth()
  foodStore.load(); foodStore.loadTemplates(); foodStore.loadShopList(); foodStore.loadRecipes(); foodStore.loadUser(); Object.assign(userForm, foodStore.user); requestNotification(); checkExpiryNotification(); startNotificationTimer()
})
</script>
