/**
 * 实体抽取规则引擎
 * 基于分词 + 正则 + 词典匹配，从中文文本提取食材/食谱字段
 */

import {
  FOOD_WORDS, STORAGE_WORDS, DIFFICULTY_WORDS, UNIT_WORDS,
  CATEGORY_WORDS, TIME_WORDS, STEP_MARKERS,
} from './dictionary.js'
import { normalizeFoodName, normalizeQuantity, daysAgoToPurchaseDate, timeToMinutes } from './normalizer.js'

// 懒加载 segmentit 实例（首次调用时动态 import，避免首屏加载500KB + CJS interop 问题）
let segmentitInstance = null

async function getSegmentit() {
  if (!segmentitInstance) {
    const pkg = await import('segmentit')
    const Segment = pkg.default?.Segment || pkg.Segment
    const useDefault = pkg.default?.useDefault || pkg.useDefault
    segmentitInstance = useDefault(new Segment())
  }
  return segmentitInstance
}

/**
 * 分词（懒加载，异步）
 */
export async function tokenize(text) {
  if (!text) return []
  const seg = await getSegmentit()
  return seg.doSegment(text)
}

// ==================== 食材抽取 ====================

/**
 * 从文本抽取食材信息
 * @param {string} text 用户粘贴文本
 * @returns {Object} { name, quantity, unit, days, storage, category, purchaseDate, confidence, matched }
 */
export async function extractFood(text) {
  if (!text || !text.trim()) return emptyFoodResult()

  const original = text.trim()
  const tokens = await tokenize(original)
  const tokenTexts = tokens.map(t => t.w)

  const result = {
    name: '',
    quantity: 0,
    unit: '个',
    days: 0,
    storage: '',
    category: '',
    purchaseDate: '',
    confidence: 0,
    matched: [],
  }

  // 1. 食材名（最长匹配优先）
  const foodName = matchFoodName(original, tokenTexts)
  if (foodName) {
    result.name = normalizeFoodName(foodName)
    result.matched.push('name')
    result.confidence += 30
  }

  // 2. 数量 + 单位
  const qtyResult = matchQuantity(original)
  if (qtyResult) {
    const norm = normalizeQuantity(qtyResult.value, qtyResult.unit)
    result.quantity = norm.value || 1
    result.unit = norm.unit
    result.matched.push('quantity')
    result.confidence += 20
  } else if (result.name) {
    result.quantity = 1
  }

  // 3. 储藏方式
  const storage = matchStorage(original, tokenTexts)
  if (storage) {
    result.storage = storage
    result.matched.push('storage')
    result.confidence += 15
  }

  // 4. 时间表达（区分"已放X天"和"保质期X天"）
  const timeResult = matchTimeForFood(original)
  if (timeResult) {
    if (timeResult.type === 'elapsed') {
      // "放了3天" → purchaseDate
      result.purchaseDate = daysAgoToPurchaseDate(timeResult.value)
      result.matched.push('purchaseDate')
      result.confidence += 20
    } else if (timeResult.type === 'shelf') {
      // "能放10天" / "保质期7天" → days
      result.days = timeResult.value
      result.matched.push('days')
      result.confidence += 20
    }
  }

  // 5. 食品分类（基于食材名推断）
  if (result.name) {
    result.category = inferCategory(result.name)
    if (result.category) result.confidence += 5
  }

  return result
}

// ==================== 食谱抽取 ====================

/**
 * 从文本抽取食谱信息
 * @param {string} text
 * @returns {Object} { name, difficulty, time, category, ingredients[], steps[], confidence, matched }
 */
export async function extractRecipe(text) {
  if (!text || !text.trim()) return emptyRecipeResult()

  const original = text.trim()
  const tokens = await tokenize(original)
  const tokenTexts = tokens.map(t => t.w)

  const result = {
    name: '',
    emoji: '🍳',
    difficulty: '简单',
    time: 15,
    category: '其他',
    ingredients: [],
    steps: [],
    confidence: 0,
    matched: [],
  }

  // 1. 食谱名（第一个出现的菜品词，通常是开头）
  const recipeName = matchRecipeName(original)
  if (recipeName) {
    result.name = recipeName
    result.matched.push('name')
    result.confidence += 30
  }

  // 2. 难度
  const difficulty = matchDifficulty(original, tokenTexts)
  if (difficulty) {
    result.difficulty = difficulty
    result.matched.push('difficulty')
    result.confidence += 15
  }

  // 3. 时间（食谱：分钟/小时）
  const timeResult = matchTimeForRecipe(original)
  if (timeResult) {
    result.time = timeToMinutes(timeResult.value, timeResult.unit)
    result.matched.push('time')
    result.confidence += 15
  }

  // 4. 食材列表（从文本中扫描所有食材词典词 + 逗号分隔段）
  const ingredients = matchIngredients(original, tokenTexts)
  if (ingredients.length > 0) {
    result.ingredients = ingredients.map(normalizeFoodName)
    result.matched.push('ingredients')
    result.confidence += 20
  }

  // 5. 步骤
  const steps = matchSteps(original)
  if (steps.length > 0) {
    result.steps = steps
    result.matched.push('steps')
    result.confidence += 15
  }

  // 6. 分类（基于食材推断）
  if (result.ingredients.length > 0) {
    result.category = inferCategory(result.ingredients[0]) || '其他'
  }

  return result
}

// ==================== 匹配函数 ====================

function matchFoodName(text, tokens) {
  // 最长匹配：在原文中按 FOOD_WORDS 长度倒序查找
  const sorted = [...FOOD_WORDS].sort((a, b) => b.length - a.length)
  for (const w of sorted) {
    if (text.includes(w)) return w
  }
  // 兜底：取第一个名词 token
  for (const t of tokens) {
    if (t.p && t.p === 768) return t.w  // 768 = 名词
  }
  return ''
}

function matchQuantity(text) {
  // 半斤、一斤、二两 等中文数字
  const cnMatch = text.match(/(半斤|一斤|两斤|一斤半|半公斤)/)
  if (cnMatch) {
    const w = cnMatch[1]
    if (w === '半斤') return { value: 0.5, unit: '斤' }
    if (w === '一斤') return { value: 1, unit: '斤' }
    if (w === '两斤') return { value: 2, unit: '斤' }
    if (w === '一斤半') return { value: 1.5, unit: '斤' }
    if (w === '半公斤') return { value: 0.5, unit: 'kg' }
  }

  // 数字 + 单位：2个 / 0.5kg / 500g / 3斤
  const m = text.match(/(\d+\.?\d*)\s*(个|斤|公斤|克|g|kg|份|磅|两|毫升|ml|升|L)/i)
  if (m) return { value: parseFloat(m[1]), unit: m[2] }

  // 纯数字 + 默认个
  const numOnly = text.match(/(?:^|[^\d])(\d+\.?\d*)(?![\d分钟小时天])/)
  if (numOnly) {
    const v = parseFloat(numOnly[1])
    if (v > 0 && v <= 99) return { value: v, unit: '个' }
  }
  return null
}

function matchStorage(text, tokens) {
  for (const w of STORAGE_WORDS) {
    if (text.includes(w)) {
      if (w === '冰箱' || w === '冷藏室') return '冷藏'
      if (w === '冷冻室') return '冷冻'
      return w
    }
  }
  return ''
}

function matchTimeForFood(text) {
  // 先检测 shelf（"能放/保质期/保存/可放/保鲜 X天"），优先级高于 elapsed
  let m = text.match(/(?:能放|保质期|保存|可放|保鲜)\s*(\d+)\s*天/) || text.match(/(\d+)\s*天(?:保质|保鲜|保存)/)
  if (m) return { type: 'shelf', value: parseInt(m[1]) }

  // elapsed: "放了3天" / "已放3天" / "买了3天" / "3天前买的" → 明确标志
  m = text.match(/(?:放了|已放|买了|买回)\s*(\d+)\s*天/) || text.match(/(\d+)\s*天前/)
  if (m) return { type: 'elapsed', value: parseInt(m[1]) }

  // 兜底：纯"X天"，默认按 elapsed
  m = text.match(/(?:^|[^\d])(\d+)\s*天(?![钟分钟小时保质期])/)
  if (m) return { type: 'elapsed', value: parseInt(m[1]) }

  return null
}

function matchTimeForRecipe(text) {
  // "15分钟" / "1小时" / "1.5小时" / "30min"
  let m = text.match(/(\d+\.?\d*)\s*(分钟|min|分钟钟)/i)
  if (m) return { value: parseFloat(m[1]), unit: '分钟' }

  m = text.match(/(\d+\.?\d*)\s*(小时|h)/i)
  if (m) return { value: parseFloat(m[1]), unit: '小时' }

  // 纯数字后接"分"（口语）
  m = text.match(/(\d+\.?\d*)\s*分(?![钟克秒])/)
  if (m) return { value: parseFloat(m[1]), unit: '分钟' }

  return null
}

function matchDifficulty(text, tokens) {
  for (const w of DIFFICULTY_WORDS) {
    if (text.includes(w)) {
      if (w === '复杂' || w === '困难') return '困难'
      if (w === '容易') return '简单'
      return w
    }
  }
  return ''
}

function matchRecipeName(text) {
  // 食谱名 = 第一个空格/逗号/句号前的部分，再清洗尾部难度/时间/食材标志词
  const firstSegment = text.split(/[\s,，。.；;\n]/)[0].trim()
  if (!firstSegment) return ''

  // 清洗尾部：去掉难度词、时间数字、单位等
  let name = firstSegment
    .replace(/(?:超简单|简单|中等|困难|复杂|容易)$/, '')
    .replace(/\d+\s*(?:分钟|小时|min|h|分|天)$/, '')
    .replace(/(?:食材|需要|用料|材料|原料)[:：]?$/, '')
    .replace(/^[，,。.；;、\s]+|[，,。.；;、\s]+$/g, '')
    .trim()

  if (name.length >= 2 && name.length <= 12) return name
  // 兜底：取前8字
  if (firstSegment.length >= 2) return firstSegment.slice(0, 8)
  return ''
}

function matchIngredients(text, tokens) {
  const found = new Set()

  // 1. 词典最长匹配
  const sorted = [...FOOD_WORDS].sort((a, b) => b.length - a.length)
  for (const w of sorted) {
    if (text.includes(w)) {
      // 排除食谱名本身（避免"番茄炒蛋"误把"番茄"当食材，虽然这里其实是想要的）
      found.add(w)
    }
  }

  // 2. "食材：" / "需要" 后的逗号分隔段
  const m = text.match(/(?:食材|需要|用料|材料|原料)\s*[:：]?\s*([^步骤做法\n]{2,100})/)
  if (m) {
    const seg = m[1]
    const parts = seg.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) {
      // 校验是否像食材名（2-6字且不在步骤标记词中）
      if (p.length >= 1 && p.length <= 6 && !STEP_MARKERS.includes(p)) {
        found.add(p)
      }
    }
  }

  return Array.from(found)
}

function matchSteps(text) {
  const steps = []

  // 1. "步骤：" / "做法：" 后的内容
  let m = text.match(/(?:步骤|做法)\s*[:：]?\s*([\s\S]+)$/)
  if (m) {
    const body = m[1]
    // 按 "1." "2." 或 "第一步" 分割
    const parts = body.split(/\d+\s*[\.、)]|第[一二三四五六七八九十]步|[\n；;]/)
      .map(s => s.trim())
      .filter(s => s.length > 2)
    if (parts.length > 0) {
      steps.push(...parts)
      return steps
    }
  }

  // 2. 按 "然后/接着/再" 分割
  const parts = text.split(/然后|接着|之后|再|，|,|。/)
    .map(s => s.trim())
    .filter(s => s.length > 4 && containsCookingVerb(s))
  if (parts.length > 0) {
    steps.push(...parts)
  }

  return steps
}

function containsCookingVerb(s) {
  const verbs = ['炒', '炖', '煮', '蒸', '烤', '炸', '煎', '拌', '焖', '煲', '烧', '烩', '熘', '爆', '腌', '切', '加', '倒', '放', '搅', '洗', '剥', '焯']
  return verbs.some(v => s.includes(v))
}

function inferCategory(name) {
  if (!name) return ''
  // 精确匹配优先（FOOD_WORDS 在 dictionary.js 中已按分类组织，但这里用规则推断）
  // 注意顺序：乳制品（蛋/奶）要在肉类（鸡/鸭）之前判断，否则"鸡蛋"会误归肉类
  const rules = [
    ['乳制品', ['奶', '酪', '蛋', '酸奶', '黄油', '芝士', '冰淇淋', '乳']],
    ['肉类', ['肉', '猪', '牛', '羊', '鸡', '鸭', '鹅', '鸽', '排骨', '五花', '里脊', '腱子', '火腿', '腊']],
    ['水产', ['鱼', '虾', '蟹', '蛤', '蛏', '扇贝', '生蚝', '鲍鱼', '海参', '海蜇', '鱿鱼', '墨鱼']],
    ['蔬菜', ['菜', '瓜', '萝卜', '葱', '蒜', '姜', '椒', '茄', '豆', '菇', '笋', '芹', '菠菜', '白菜', '韭菜', '生菜', '西兰花', '番茄', '土豆', '红薯', '山药', '莲藕', '洋葱', '胡萝卜', '木耳', '海带', '紫菜', '秋葵', '茼蒿', '香菜']],
    ['水果', ['苹果', '香蕉', '橙', '橘', '梨', '桃', '莓', '葡萄', '瓜', '果', '梅', '枣', '柠檬', '柚', '樱桃', '芒果', '菠萝', '木瓜', '榴莲', '荔枝', '龙眼', '杨梅', '枇杷', '椰子', '柿子', '石榴', '山楂']],
    ['调料', ['油', '盐', '糖', '醋', '酱', '桂', '香叶', '孜然', '蜜', '花椒', '八角', '生抽', '老抽', '蚝油', '料酒']],
    ['主食', ['米', '面', '麦', '燕麦', '玉米', '花生', '核桃', '面包', '馒头', '面条']],
  ]
  for (const [c, keys] of rules) {
    if (keys.some(k => name.includes(k))) return c
  }
  return '其他'
}

function emptyFoodResult() {
  return {
    name: '', quantity: 0, unit: '个', days: 0,
    storage: '', category: '', purchaseDate: '',
    confidence: 0, matched: [],
  }
}

function emptyRecipeResult() {
  return {
    name: '', emoji: '🍳', difficulty: '简单', time: 15,
    category: '其他', ingredients: [], steps: [],
    confidence: 0, matched: [],
  }
}
