import { reactive } from 'vue'

const STORAGE_KEY = 'ffood_data'
const TEMPLATES_KEY = 'ffood_templates'
const SHOPLIST_KEY = 'ffood_shoplist'
const RECIPES_KEY = 'ffood_recipes'
const USER_KEY = 'ffood_user'
const MAX_TEMPLATES = 20

// ═════════ P2-2 菜谱 ═════════
const RECIPES = [
  { id:'r1', name:'番茄炒蛋', category:'蔬菜', emoji:'🍳', difficulty:'简单', time:15, ingredients:['鸡蛋','番茄','葱'], steps:['鸡蛋打散加盐炒熟盛出','番茄切块炒出汁','倒入鸡蛋翻炒，加盐调味'] },
  { id:'r2', name:'青椒肉丝', category:'肉类', emoji:'🫑', difficulty:'简单', time:20, ingredients:['猪肉','青椒','蒜'], steps:['肉切丝加生抽淀粉腌制','青椒切丝','热油爆蒜炒肉丝至变色','加入青椒翻炒调味出锅'] },
  { id:'r3', name:'凉拌黄瓜', category:'蔬菜', emoji:'🥒', difficulty:'超简单', time:5, ingredients:['黄瓜','蒜','醋'], steps:['黄瓜拍碎切段','加蒜末、醋、生抽、辣椒油','拌匀即可'] },
  { id:'r4', name:'红烧排骨', category:'肉类', emoji:'🍖', difficulty:'中等', time:60, ingredients:['排骨','姜','酱油'], steps:['排骨焯水去血沫','炒糖色下排骨翻炒','加酱油姜片八角水炖40分钟','大火收汁'] },
  { id:'r5', name:'蒜蓉西兰花', category:'蔬菜', emoji:'🥦', difficulty:'超简单', time:10, ingredients:['西兰花','蒜'], steps:['西兰花焯水1分钟捞出','热油爆香蒜末','倒入西兰花翻炒加盐调味'] },
  { id:'r6', name:'土豆炖牛肉', category:'肉类', emoji:'🥔', difficulty:'中等', time:90, ingredients:['牛肉','土豆','胡萝卜'], steps:['牛肉切块焯水','热油炒香葱姜下牛肉翻炒','加水酱油炖1小时','加入土豆胡萝卜再炖20分钟'] },
  { id:'r7', name:'鸡蛋羹', category:'乳制品', emoji:'🥚', difficulty:'简单', time:15, ingredients:['鸡蛋','牛奶'], steps:['鸡蛋打散加温水搅匀','过筛去泡沫','盖保鲜膜蒸10分钟','淋生抽香油'] },
  { id:'r8', name:'水果沙拉', category:'水果', emoji:'🥗', difficulty:'超简单', time:5, ingredients:['苹果','香蕉','酸奶'], steps:['水果切块','倒入酸奶拌匀'] },
  { id:'r9', name:'醋溜白菜', category:'蔬菜', emoji:'🥬', difficulty:'简单', time:10, ingredients:['白菜','醋','干辣椒'], steps:['白菜切片','热油爆香干辣椒','大火翻炒白菜至断生','淋醋加盐出锅'] },
  { id:'r10', name:'可乐鸡翅', category:'肉类', emoji:'🍗', difficulty:'简单', time:30, ingredients:['鸡翅','可乐','姜'], steps:['鸡翅划两刀焯水','煎至两面金黄','加姜片可乐没过鸡翅','中火收汁'] },
  { id:'r11', name:'蒜苗回锅肉', category:'肉类', emoji:'🥓', difficulty:'简单', time:25, ingredients:['五花肉','蒜苗','豆瓣酱'], steps:['五花肉煮8分熟切片','热油煸炒肉片出油','加豆瓣酱炒出红油','加蒜苗翻炒出锅'] },
  { id:'r12', name:'清炒时蔬', category:'蔬菜', emoji:'🥬', difficulty:'超简单', time:8, ingredients:['蔬菜','蒜'], steps:['任意蔬菜洗净切段','热油爆蒜','大火快炒加盐即可'] },
]

// ═════════ P2-3 条形码模拟数据 ═════════
const BARCODE_DB = {
  '6901234567890':{name:'伊利纯牛奶 250ml',category:'乳制品',defaultDays:30,defaultStorage:'常温'},
  '6909876543210':{name:'双汇火腿肠 400g',category:'肉类',defaultDays:90,defaultStorage:'冷藏'},
  '6901111222333':{name:'西红柿 约200g',category:'蔬菜',defaultDays:7,defaultStorage:'冷藏'},
  '6902222333444':{name:'鸡胸肉 500g',category:'肉类',defaultDays:3,defaultStorage:'冷冻'},
  '6903333444555':{name:'蒙牛酸奶 100g×8',category:'乳制品',defaultDays:21,defaultStorage:'冷藏'},
  '6904444555666':{name:'鸡蛋 10枚装',category:'乳制品',defaultDays:30,defaultStorage:'冷藏'},
  '6905555666777':{name:'苹果 约300g',category:'水果',defaultDays:14,defaultStorage:'冷藏'},
  '6906666777888':{name:'西兰花 约300g',category:'蔬菜',defaultDays:5,defaultStorage:'冷藏'},
}

// 按食材类型 + 储藏方式推荐保质期（天）
export const SHELF_LIFE_RECOMMENDATIONS = {
  '蔬菜': { '冷藏': 7, '冷冻': 90, '常温': 3 },
  '水果': { '冷藏': 14, '冷冻': 60, '常温': 7 },
  '肉类': { '冷藏': 3, '冷冻': 180, '常温': 1 },
  '乳制品': { '冷藏': 21, '冷冻': 90, '常温': 30 },
  '调料': { '冷藏': 180, '冷冻': 365, '常温': 365 },
  '其他': { '冷藏': 14, '冷冻': 90, '常温': 7 },
}

export function recommendDays(category, storage) {
  const catMap = SHELF_LIFE_RECOMMENDATIONS[category] || SHELF_LIFE_RECOMMENDATIONS['其他']
  return catMap[storage] || catMap['冷藏'] || 7
}

// 默认用户资料与健康目标
export const GOAL_OPTIONS = ['均衡饮食', '减脂', '增肌', '养生']
export const DEFAULT_USER = { nickname: '', height: 0, weight: 0, age: 0, goal: '均衡饮食' }

// 常见食材每 100g 约计热量（kcal），用于估算
export const CALORIE_TABLE = {
  '鸡蛋': 155, '番茄': 18, '西红柿': 18, '葱': 33, '猪肉': 242, '青椒': 22, '蒜': 149,
  '黄瓜': 16, '醋': 31, '排骨': 292, '姜': 80, '酱油': 63, '西兰花': 34, '牛肉': 250,
  '土豆': 77, '胡萝卜': 41, '牛奶': 54, '苹果': 52, '香蕉': 89, '酸奶': 72, '白菜': 13,
  '干辣椒': 324, '鸡翅': 290, '可乐': 42, '五花肉': 518, '蒜苗': 37, '豆瓣酱': 178,
  '蔬菜': 25, '豆腐': 76, '鱼': 206, '虾': 99, '米饭': 130, '面条': 137, '面包': 265,
  '馒头': 223, '玉米': 86, '红薯': 86, '洋葱': 40, '蘑菇': 22, '菠菜': 23, '芹菜': 14,
  '韭菜': 30, '茄子': 25, '豆角': 31, '冬瓜': 12, '南瓜': 26, '丝瓜': 20, '苦瓜': 19,
  '莴笋': 15, '芦笋': 20, '木耳': 27, '海带': 13, '紫菜': 250, '花生': 567, '核桃': 654,
  '芝麻': 573, '红豆': 329, '绿豆': 316, '黄豆': 359, '黑豆': 381, '小米': 361, '燕麦': 389,
  '紫薯': 82, '芋头': 56, '山药': 57, '莲藕': 47, '木耳菜': 20, '油麦菜': 15, '生菜': 15,
  '油菜': 14, '芥蓝': 19, '菜心': 18, '茼蒿': 21, '香菜': 23, '茴香': 31, '大葱': 33,
  '小葱': 31, '蒜苗': 37, '蒜苔': 61, '生姜': 80, '蒜黄': 32, '韭黄': 34, '韭菜花': 32,
  '秋葵': 33, '荷兰豆': 27, '四季豆': 31, '豌豆': 81, '毛豆': 131, '蚕豆': 335, '扁豆': 116,
  '金针菇': 32, '香菇': 26, '平菇': 24, '杏鲍菇': 35, '鸡腿菇': 30, '草菇': 27, '口蘑': 29,
  '银耳': 200, '竹荪': 155, '腐竹': 461, '豆腐皮': 260, '千张': 262, '豆干': 197, '素鸡': 192,
  '鸭血': 108, '猪血': 55, '鸡血': 49, '牛肚': 72, '猪肚': 110, '猪肝': 129, '鸡肝': 121,
  '鸭肝': 129, '牛肝': 135, '羊肝': 134, '猪心': 119, '牛心': 106, '鸡心': 172, '鸭心': 120,
  '猪蹄': 260, '猪耳': 176, '猪大肠': 191, '猪小肠': 65, '猪皮': 363, '牛蹄筋': 151,
  '鸡爪': 254, '鸭爪': 150, '鸡翅中': 202, '鸡翅根': 202, '鸡腿': 146, '鸭腿': 190,
  '鸡胸': 165, '鸭胸': 146, '鹅肉': 371, '鸽肉': 213, '鹌鹑': 110, '火鸡': 135,
  '羊肉': 203, '羊排': 360, '牛肉卷': 250, '肥牛': 250, '肥羊': 250, '牛排': 271,
  '猪里脊': 109, '猪后腿': 160, '猪前腿': 195, '猪五花': 518, '梅花肉': 248, '腱子肉': 160,
  '牛腩': 332, '牛腱': 160, '牛尾': 282, '羊腿': 203, '羊蝎子': 159,
  '草鱼': 93, '鲤鱼': 109, '鲫鱼': 108, '鲈鱼': 105, '鳜鱼': 117, '黄鱼': 97, '带鱼': 127,
  '三文鱼': 139, '鳕鱼': 82, '金枪鱼': 132, '鲅鱼': 121, '比目鱼': 91, '鱿鱼': 92, '墨鱼': 79,
  '章鱼': 81, '虾仁': 48, '基围虾': 101, '对虾': 93, '河虾': 84, '皮皮虾': 90, '龙虾': 90,
  '螃蟹': 97, '大闸蟹': 102, '海蟹': 95, '蛤蜊': 62, '花蛤': 62, '蛏子': 40, '扇贝': 70,
  '生蚝': 68, '鲍鱼': 85, '海螺': 95, '田螺': 60, '海蜇': 33, '海参': 78, '海胆': 120,
  '紫菜': 250, '海带': 13, '裙带菜': 45, '海苔': 270, '虾皮': 153, '蟹棒': 123, '鱼丸': 107,
  '虾滑': 80, '午餐肉': 229, '火腿': 196, '香肠': 346, '腊肠': 584, '腊肉': 692, '培根': 476,
  '牛肉干': 550, '猪肉脯': 378, '肉松': 396, '鸭脖': 264, '鸭舌': 267, '鸭翅': 217,
  '苹果': 52, '香蕉': 89, '橙子': 47, '橘子': 44, '柚子': 42, '柠檬': 37, '梨': 57,
  '桃': 39, '李子': 38, '樱桃': 63, '葡萄': 69, '提子': 69, '草莓': 32, '蓝莓': 57,
  '猕猴桃': 61, '芒果': 60, '菠萝': 50, '木瓜': 39, '火龙果': 51, '西瓜': 30, '哈密瓜': 34,
  '香瓜': 26, '榴莲': 147, '荔枝': 66, '龙眼': 71, '杨梅': 30, '枇杷': 41, '椰子': 354,
  '甘蔗': 64, '柿子': 71, '石榴': 63, '红枣': 276, '枸杞': 258, '山楂': 102, '葡萄干': 299,
  '牛奶': 54, '酸奶': 72, '奶粉': 484, '奶酪': 328, '奶油': 879, '黄油': 717, '芝士': 328,
  '冰淇淋': 207, '雪糕': 150, '巧克力': 546, '白糖': 400, '红糖': 389, '蜂蜜': 304,
  '花生油': 899, '橄榄油': 884, '菜籽油': 884, '豆油': 884, '玉米油': 884, '葵花籽油': 884,
  '芝麻油': 884, '猪油': 902, '盐': 0, '生抽': 20, '老抽': 30, '蚝油': 111, '料酒': 69,
  '醋': 31, '番茄酱': 97, '沙拉酱': 449, '豆瓣酱': 178, '甜面酱': 136, '辣椒酱': 108,
  '咖喱': 325, '花椒': 316, '八角': 331, '桂皮': 247, '香叶': 311, '孜然': 375,
}

function estimateIngredientCalories(name) {
  for (const key in CALORIE_TABLE) {
    if (name.includes(key) || key.includes(name)) return CALORIE_TABLE[key]
  }
  return 0
}

export function estimateRecipeCalories(recipe) {
  if (!recipe || !recipe.ingredients) return 0
  return recipe.ingredients.reduce((sum, ing) => sum + estimateIngredientCalories(ing), 0)
}

class FoodStore {
  constructor() {
    this.state = reactive({
      foods: [],
      templates: [],
      shopList: [],
      recipes: RECIPES,
      user: { ...DEFAULT_USER },
    })
  }

  get foods() { return this.state.foods }
  get totalCount() { return this.state.foods.length }
  get templates() { return this.state.templates }

  /** 消耗统计 */
  get stats() {
    let total = this.state.foods.length
    let expired = 0
    let expiringSoon = 0  // ≤1天
    let fresh = 0
    const byCategory = {}
    const byStorage = {}
    for (const f of this.state.foods) {
      const dl = calcDaysLeft(f.expiryDate)
      if (dl < 0) expired++
      else if (dl <= 1) expiringSoon++
      else fresh++
      byCategory[f.category] = (byCategory[f.category] || 0) + 1
      byStorage[f.storage] = (byStorage[f.storage] || 0) + 1
    }
    const wasteRate = total > 0 ? Math.round((expired / total) * 100) : 0
    return { total, expired, expiringSoon, fresh, wasteRate, byCategory, byStorage }
  }

  // ==================== 食材 CRUD ====================

  addFood(item) {
    const qty = clampFloat(item.quantity, 0.1, 99.9)
    const days = clampFloat(item.days, 0.1, 99.9)
    const purchaseDate = item.purchaseDate || todayStr()
    const expiryDate = calcExpiryDate(purchaseDate, days)

    const food = {
      id: genId(),
      name: item.name.trim(),
      quantity: qty,
      unit: item.unit || '个',
      days,
      category: item.category || '其他',
      purchaseDate,
      expiryDate,
      storage: item.storage || '冷藏',
      createdAt: new Date().toISOString(),
      daysLeft: calcDaysLeft(expiryDate),
    }
    this.state.foods.push(food)
    this.save()
    this.saveTemplate(item)  // 记忆表单
  }

  updateFood(id, data) {
    const idx = this.state.foods.findIndex(f => f.id === id)
    if (idx === -1) return
    const qty = clampFloat(data.quantity, 0.1, 99.9)
    const days = clampFloat(data.days, 0.1, 99.9)
    const purchaseDate = data.purchaseDate || this.state.foods[idx].purchaseDate || todayStr()
    const expiryDate = calcExpiryDate(purchaseDate, days)

    const updated = {
      ...this.state.foods[idx],
      ...data,
      id,
      quantity: qty,
      days,
      purchaseDate,
      expiryDate,
      daysLeft: calcDaysLeft(expiryDate),
    }
    this.state.foods[idx] = updated
    this.save()
  }

  removeFood(id) {
    this.state.foods = this.state.foods.filter(f => f.id !== id)
    this.save()
  }

  /** 批量删除 */
  removeFoods(ids) {
    const idSet = new Set(ids)
    this.state.foods = this.state.foods.filter(f => !idSet.has(f.id))
    this.save()
  }

  /** 标记已消耗（同删除，语义化别名） */
  markConsumed(ids) {
    this.removeFoods(ids)
  }

  // ==================== 持久化 ====================

  save() {
    try {
      const data = this.state.foods.map(f => ({ ...f }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[FFood] 保存失败:', e)
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        this.state.foods = data.map(f => ({
          ...f,
          daysLeft: calcDaysLeft(f.expiryDate),
        }))
      }
    } catch (e) {
      console.error('[FFood] 加载失败:', e)
      this.state.foods = []
    }
  }

  // ==================== 表单记忆模板 ====================

  /**
   * 保存模板：将表单数据（不含日期）存入模板列表
   * 去重：相同 name + category + unit → 更新 lastUsed
   */
  saveTemplate(item) {
    try {
      const key = `${item.name}|${item.category}|${item.unit}`
      const existing = this.state.templates.findIndex(
        t => `${t.name}|${t.category}|${t.unit}` === key
      )
      const tpl = {
        name: item.name.trim(),
        quantity: clampFloat(item.quantity, 0.1, 99.9),
        unit: item.unit || '个',
        category: item.category || '其他',
        storage: item.storage || '冷藏',
        lastUsed: Date.now(),
      }
      if (existing !== -1) {
        this.state.templates.splice(existing, 1)
      }
      this.state.templates.unshift(tpl)
      if (this.state.templates.length > MAX_TEMPLATES) {
        this.state.templates = this.state.templates.slice(0, MAX_TEMPLATES)
      }
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(this.state.templates))
    } catch (e) {
      console.error('[FFood] 模板保存失败:', e)
    }
  }

  removeTemplate(idx) {
    this.state.templates.splice(idx, 1)
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(this.state.templates))
  }

  loadTemplates() {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY)
      if (raw) {
        this.state.templates = JSON.parse(raw)
      }
    } catch (e) {
      console.error('[FFood] 模板加载失败:', e)
      this.state.templates = []
    }
  }

  // ==================== 购物清单 ====================

  get shopList() { return this.state.shopList }

  getShopListSorted() {
    return [...this.state.shopList].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1
      return b.createdAt - a.createdAt
    })
  }

  addShopItem(text) {
    if (!text || !text.trim()) return
    const item = {
      id: genId(),
      text: text.trim(),
      checked: false,
      createdAt: Date.now(),
    }
    this.state.shopList.push(item)
    this.saveShopList()
  }

  toggleShopItem(id) {
    const item = this.state.shopList.find(i => i.id === id)
    if (item) {
      item.checked = !item.checked
      this.saveShopList()
    }
  }

  removeShopItem(id) {
    this.state.shopList = this.state.shopList.filter(i => i.id !== id)
    this.saveShopList()
  }

  clearCheckedShopItems() {
    this.state.shopList = this.state.shopList.filter(i => !i.checked)
    this.saveShopList()
  }

  saveShopList() {
    try {
      localStorage.setItem(SHOPLIST_KEY, JSON.stringify(this.state.shopList))
    } catch (e) {
      console.error('[FFood] 购物清单保存失败:', e)
    }
  }

  loadShopList() {
    try {
      const raw = localStorage.getItem(SHOPLIST_KEY)
      if (raw) {
        this.state.shopList = JSON.parse(raw)
      }
    } catch (e) {
      console.error('[FFood] 购物清单加载失败:', e)
      this.state.shopList = []
    }
  }

  // ==================== 菜谱匹配 (P2-2) ====================

  get recipes() { return this.state.recipes }

  getRecommendedRecipes() {
    const foodNames = new Set(this.state.foods.map(f => f.name))
    const userGoal = this.state.user.goal || '均衡饮食'
    const results = []
    for (const r of this.state.recipes) {
      const matched = r.ingredients.filter(ing =>
        [...foodNames].some(fn => fn.includes(ing) || ing.includes(fn))
      )
      const unmatched = r.ingredients.filter(ing =>
        ![...foodNames].some(fn => fn.includes(ing) || ing.includes(fn))
      )
      const ratio = r.ingredients.length > 0 ? matched.length / r.ingredients.length : 0
      const calories = estimateRecipeCalories(r)
      const goalTags = this.getRecipeGoalTags(r, calories, userGoal)
      results.push({ ...r, matchedCount: matched.length, matched, unmatched, ratio, calories, goalTags })
    }
    return results.sort((a, b) => b.ratio - a.ratio || b.matchedCount - a.matchedCount)
  }

  getRecipeGoalTags(recipe, calories, userGoal) {
    const tags = []
    const highProtein = ['鸡胸', '牛肉', '鸡蛋', '虾', '鱼', '豆腐', '牛奶', '鸡腿', '瘦肉', '三文鱼']
    const lowFat = ['蔬菜', '西兰花', '黄瓜', '番茄', '白菜', '菠菜', '芹菜', '冬瓜']
    const hasHighProtein = recipe.ingredients.some(ing => highProtein.some(k => ing.includes(k) || k.includes(ing)))
    const hasLowFat = recipe.ingredients.some(ing => lowFat.some(k => ing.includes(k) || k.includes(ing)))
    const hasMeat = ['肉', '鸡', '牛', '羊', '鱼', '虾', '排骨'].some(k => recipe.ingredients.some(ing => ing.includes(k)))
    const mostlyVeg = recipe.ingredients.length > 0 && !hasMeat

    if (userGoal === '减脂') {
      if (calories < 400) tags.push('低卡')
      if (mostlyVeg || hasLowFat) tags.push('清淡')
    } else if (userGoal === '增肌') {
      if (hasHighProtein) tags.push('高蛋白')
    } else if (userGoal === '养生') {
      if (mostlyVeg || hasLowFat) tags.push('清淡')
      if (calories < 500) tags.push('低负担')
    }
    if (hasHighProtein && userGoal !== '减脂') tags.push('高蛋白')
    return tags
  }

  addRecipe(recipe) {
    const r = {
      id: genId(),
      name: recipe.name.trim(),
      category: recipe.category || '其他',
      emoji: recipe.emoji || '🍳',
      difficulty: recipe.difficulty || '简单',
      time: parseInt(recipe.time) || 15,
      ingredients: recipe.ingredients.filter(i => i.trim()).map(i => i.trim()),
      steps: recipe.steps.filter(s => s.trim()).map(s => s.trim()),
    }
    this.state.recipes.unshift(r)
    this.saveRecipes()
    return r
  }

  removeRecipe(id) {
    this.state.recipes = this.state.recipes.filter(r => r.id !== id)
    this.saveRecipes()
  }

  saveRecipes() {
    try {
      const custom = this.state.recipes.filter(r => !r.id.startsWith('r'))
      localStorage.setItem(RECIPES_KEY, JSON.stringify(custom))
    } catch (e) {
      console.error('[FFood] 菜谱保存失败:', e)
    }
  }

  loadRecipes() {
    try {
      const raw = localStorage.getItem(RECIPES_KEY)
      if (raw) {
        const custom = JSON.parse(raw)
        // 内置菜谱 id 为 r1...r12，自定义 id 为 genId 生成，去重避免重复加载
        const builtinIds = new Set(RECIPES.map(r => r.id))
        const merged = [...custom.filter(r => !builtinIds.has(r.id)), ...RECIPES]
        this.state.recipes = merged
      }
    } catch (e) {
      console.error('[FFood] 菜谱加载失败:', e)
    }
  }

  // ==================== 用户资料（我的） ====================

  get user() { return this.state.user }

  saveUser(user) {
    try {
      this.state.user = { ...DEFAULT_USER, ...user }
      localStorage.setItem(USER_KEY, JSON.stringify(this.state.user))
    } catch (e) {
      console.error('[FFood] 用户资料保存失败:', e)
    }
  }

  loadUser() {
    try {
      const raw = localStorage.getItem(USER_KEY)
      if (raw) {
        this.state.user = { ...DEFAULT_USER, ...JSON.parse(raw) }
      }
    } catch (e) {
      console.error('[FFood] 用户资料加载失败:', e)
      this.state.user = { ...DEFAULT_USER }
    }
  }

  // ==================== 营养统计 ====================

  getNutritionSummary() {
    let totalCalories = 0
    let proteinScore = 0
    let vegCount = 0
    let meatCount = 0
    for (const f of this.state.foods) {
      const cal = estimateIngredientCalories(f.name)
      if (cal > 0) {
        totalCalories += cal * (parseFloat(f.quantity) || 1)
      }
      if (['蔬菜', '水果'].includes(f.category)) vegCount++
      if (f.category === '肉类' || ['鸡', '牛', '羊', '鱼', '虾', '肉', '排骨'].some(k => f.name.includes(k))) meatCount++
      if (['鸡胸', '牛肉', '鸡蛋', '虾', '鱼', '豆腐', '牛奶', '鸡腿', '瘦肉', '三文鱼'].some(k => f.name.includes(k))) proteinScore += 1
    }
    return { totalCalories: Math.round(totalCalories), vegCount, meatCount, proteinScore }
  }

  // ==================== 条形码 (P2-3) ====================

  scanBarcode(code) {
    return BARCODE_DB[code] || null
  }
}

// ==================== 工具函数 ====================

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function clampFloat(val, min, max) {
  const v = parseFloat(val)
  if (isNaN(v)) return min
  return Math.min(max, Math.max(min, Math.round(v * 10) / 10))
}

/**
 * 根据购买日期 + 保质期天数计算到期日
 */
function calcExpiryDate(purchaseDate, days) {
  const d = new Date(purchaseDate)
  d.setDate(d.getDate() + Math.ceil(days))
  return d.toISOString().slice(0, 10)
}

function calcDaysLeft(expiryDate) {
  if (!expiryDate) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
}

let instance = null

export function useFoodStore() {
  if (!instance) instance = new FoodStore()
  return instance
}

// ==================== 校验函数 ====================

export function validateFoodName(name) {
  if (!name || !name.trim()) {
    return { valid: false, message: '名称不能为空' }
  }
  const trimmed = name.trim()
  if (trimmed.length > 20) {
    return { valid: false, message: '名称不能超过20个字符' }
  }
  // 仅允许：汉字(\u4e00-\u9fff)、字母(a-zA-Z)、数字(0-9)、空格
  if (!/^[\u4e00-\u9fff\w\s]+$/.test(trimmed)) {
    return { valid: false, message: '名称只能包含汉字、字母和数字' }
  }
  return { valid: true, message: '' }
}

export function validateQuantity(val) {
  const v = parseFloat(val)
  if (isNaN(v) || v < 0.1) return { valid: false, message: '不能小于 0.1' }
  if (v > 99.9) return { valid: false, message: '不能超过 99.9' }
  return { valid: true, message: '' }
}

export function validateDays(val) {
  const v = parseFloat(val)
  if (isNaN(v) || v < 0.1) return { valid: false, message: '天数不能小于 0.1 天' }
  if (v > 99.9) return { valid: false, message: '天数不能超过 99.9 天' }
  return { valid: true, message: '' }
}
