/**
 * FFood 脏数据 / 非法字符注入测试
 * 运行：node test-dirty.mjs
 *
 * 范围：
 *   - 食材表单 validate + addFood
 *   - 菜谱表单 addRecipe
 *   - 购物清单 addShopItem
 *   - 用户资料 saveUser
 *   - NLP extractFood / extractRecipe
 *   - 扫码 scanBarcode / performScan 正则
 */
import {
  useFoodStore,
  validateFoodName,
  validateQuantity,
  validateDays,
  GOAL_OPTIONS,
} from './src/store/foodStore.js'
import { extractFood, extractRecipe } from './src/nlp/extractor.js'

// ───────── localStorage polyfill (Node 无 localStorage) ─────────
const memStore = new Map()
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => { memStore.set(k, String(v)) },
  removeItem: (k) => { memStore.delete(k) },
  clear: () => { memStore.clear() },
}

// ───────── 脏数据样本 ─────────
const SAMPLES = {
  '空字符串': '',
  '全空格': '     ',
  '超长100': 'a'.repeat(100),
  '超长1000': 'a'.repeat(1000),
  '超长10000': 'a'.repeat(10000),
  '纯emoji': '🍎🔄🏳️‍🌈',
  '中英日韩混合': '西红柿 tomato トマト 토마토',
  '特殊字符': '!@#$%^&*()_+-=[]{}|;\':",./<>?`\\',
  '控制字符': '\n\t\r\0',
  '零宽字符': '西\u200B红柿',
  '组合字符é': 'café résumé',
  'RTL字符': 'مرحبا בעברית',
  'HTML实体': '&lt;&amp;&#x27;&quot;',
  'JSON注入': '{"$gt":""}',
  'SQL注入': '"; DROP TABLE users; --',
  'XSS脚本': '<script>alert(1)</script>',
  '数字abc': 'abc',
  '数字undefined': 'undefined',
  '数字null': 'null',
  '负数-1': '-1',
  '数字0': '0',
  '极大值1e308': '1e308',
  'Infinity': 'Infinity',
  'NaN': 'NaN',
  '非法日期': '2026-13-45',
  '正常西红柿': '西红柿',
  '正常数字5': '5',
  '正常日期': '2026-07-03',
}

// ───────── 工具 ─────────
function tryRun(label, fn) {
  try {
    const r = fn()
    return { ok: true, label, result: r, error: null }
  } catch (e) {
    return { ok: false, label, result: null, error: `${e.name}: ${e.message}` }
  }
}

function snapshot(value) {
  // 安全 stringify，处理 NaN/Infinity/circular
  try {
    return JSON.stringify(value, (k, v) => {
      if (typeof v === 'number' && !isFinite(v)) return `<${v}>`
      return v
    })
  } catch {
    return String(value)
  }
}

function truncate(s, n = 60) {
  const str = String(s ?? '')
  return str.length > n ? str.slice(0, n) + `…(+${str.length - n})` : str
}

// ───────── 测试结果收集 ─────────
const results = []

function record(group, field, sampleName, input, status, severity, detail) {
  results.push({ group, field, sampleName, input: truncate(input), status, severity, detail: truncate(detail, 120) })
}

// ───────── 1. 食材表单 validate ─────────
function testValidateFoodName() {
  const group = '食材.validateFoodName'
  const samples = ['空字符串', '全空格', '超长100', '超长10000', '纯emoji', '中英日韩混合', '特殊字符',
    '控制字符', '零宽字符', '组合字符é', 'RTL字符', 'HTML实体', 'JSON注入', 'SQL注入', 'XSS脚本', '正常西红柿']
  for (const k of samples) {
    const v = SAMPLES[k]
    const r = tryRun(k, () => validateFoodName(v))
    if (!r.ok) {
      record(group, 'name', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const { valid, message } = r.result
      // 期望：脏数据应被拒绝
      const expectedValid = k === '正常西红柿' || k === '中英日韩混合' || k === '组合字符é'
      if (valid === expectedValid) {
        record(group, 'name', k, v, 'PASS', 'P3', `valid=${valid} msg="${message}"`)
      } else if (valid && !expectedValid) {
        record(group, 'name', k, v, 'FAIL', 'P1', `脏数据被放行 valid=${valid} msg="${message}"`)
      } else {
        record(group, 'name', k, v, 'FAIL', 'P2', `正常数据被拒 valid=${valid} msg="${message}"`)
      }
    }
  }
}

function testValidateQuantity() {
  const group = '食材.validateQuantity'
  const cases = ['空字符串', '全空格', '数字abc', '数字undefined', '数字null', '负数-1', '数字0',
    '极大值1e308', 'Infinity', 'NaN', '正常数字5']
  for (const k of cases) {
    const v = SAMPLES[k]
    const r = tryRun(k, () => validateQuantity(v))
    if (!r.ok) {
      record(group, 'quantity', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const { valid, message } = r.result
      const expectedValid = k === '正常数字5'
      if (valid === expectedValid) {
        record(group, 'quantity', k, v, 'PASS', 'P3', `valid=${valid} msg="${message}"`)
      } else if (valid && !expectedValid) {
        record(group, 'quantity', k, v, 'FAIL', 'P1', `非法数字被放行 valid=${valid} msg="${message}"`)
      } else {
        record(group, 'quantity', k, v, 'FAIL', 'P2', `正常数字被拒 valid=${valid} msg="${message}"`)
      }
    }
  }
}

function testValidateDays() {
  const group = '食材.validateDays'
  const cases = ['空字符串', '全空格', '数字abc', '负数-1', '数字0', '极大值1e308', 'Infinity', 'NaN', '正常数字5']
  for (const k of cases) {
    const v = SAMPLES[k]
    const r = tryRun(k, () => validateDays(v))
    if (!r.ok) {
      record(group, 'days', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const { valid, message } = r.result
      const expectedValid = k === '正常数字5'
      if (valid === expectedValid) {
        record(group, 'days', k, v, 'PASS', 'P3', `valid=${valid} msg="${message}"`)
      } else if (valid && !expectedValid) {
        record(group, 'days', k, v, 'FAIL', 'P1', `非法天数被放行 valid=${valid} msg="${message}"`)
      } else {
        record(group, 'days', k, v, 'FAIL', 'P2', `正常天数被拒 valid=${valid} msg="${message}"`)
      }
    }
  }
}

// ───────── 2. addFood (store 层防御) ─────────
function makeStore() {
  // 每次测试新建实例：重置单例
  // useFoodStore 是单例；直接清空 state
  const s = useFoodStore()
  s.state.foods.splice(0)
  s.state.templates.splice(0)
  s.state.shopList.splice(0)
  s.state.user = { nickname: '', height: 0, weight: 0, age: 0, goal: '均衡饮食' }
  s.state.recipes.splice(0)
  return s
}

function testAddFood() {
  const group = '食材.addFood'
  const base = { name: '西红柿', quantity: 5, unit: '个', days: 7, category: '蔬菜', storage: '冷藏', purchaseDate: '2026-07-03' }

  // name 测试（绕过 UI validate，直接调 addFood）
  const nameCases = ['空字符串', '全空格', '超长10000', '纯emoji', '中英日韩混合', '特殊字符',
    '控制字符', '零宽字符', 'JSON注入', 'SQL注入', 'XSS脚本', '正常西红柿']
  for (const k of nameCases) {
    const store = makeStore()
    const input = { ...base, name: SAMPLES[k] }
    const r = tryRun(k, () => { store.addFood(input); return store.foods[0] })
    if (!r.ok) {
      record(group, 'name', k, input.name, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const food = r.result
      if (!food) {
        record(group, 'name', k, input.name, 'CRASH', 'P0', 'addFood 未创建食材')
        continue
      }
      const name = food.name
      // 检查：是否保留了脏数据 / 长度是否异常 / 是否为空
      if (name === '' ) record(group, 'name', k, input.name, 'FAIL', 'P1', `name 被存为空字符串 → ${snapshot(name)}`)
      else if (name.length > 50) record(group, 'name', k, input.name, 'FAIL', 'P1', `name 超长未截断 len=${name.length} → ${snapshot(name)}`)
      else if (k === 'XSS脚本' && name.includes('<script>')) record(group, 'name', k, input.name, 'FAIL', 'P2', `XSS 字符串原样存储 → ${snapshot(name)}`)
      else if (k === 'SQL注入' && name.includes('DROP TABLE')) record(group, 'name', k, input.name, 'FAIL', 'P2', `SQL 注入字符串原样存储 → ${snapshot(name)}`)
      else if (k === '控制字符' && /[\n\t\r]/.test(name)) record(group, 'name', k, input.name, 'FAIL', 'P2', `控制字符保留 → ${snapshot(name)}`)
      else record(group, 'name', k, input.name, 'PASS', 'P3', `存储 name=${snapshot(name)} (len=${name.length})`)
    }
  }

  // quantity 测试
  const qtyCases = ['空字符串', '数字abc', '数字undefined', '负数-1', '数字0', '极大值1e308', 'Infinity', 'NaN', '正常数字5']
  for (const k of qtyCases) {
    const store = makeStore()
    const input = { ...base, quantity: SAMPLES[k] }
    const r = tryRun(k, () => { store.addFood(input); return store.foods[0] })
    if (!r.ok) {
      record(group, 'quantity', k, input.quantity, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const q = r.result?.quantity
      // clampFloat 应保证 [0.1, 99.9]
      if (typeof q !== 'number' || q < 0.1 || q > 99.9) {
        record(group, 'quantity', k, input.quantity, 'FAIL', 'P1', `未夹到合法区间 quantity=${q}`)
      } else {
        record(group, 'quantity', k, input.quantity, 'PASS', 'P3', `夹正后 quantity=${q}`)
      }
    }
  }

  // days 测试
  const dayCases = ['空字符串', '数字abc', '负数-1', '数字0', '极大值1e308', 'Infinity', 'NaN', '正常数字5']
  for (const k of dayCases) {
    const store = makeStore()
    const input = { ...base, days: SAMPLES[k] }
    const r = tryRun(k, () => { store.addFood(input); return store.foods[0] })
    if (!r.ok) {
      record(group, 'days', k, input.days, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const d = r.result?.days
      if (typeof d !== 'number' || d < 0.1 || d > 99.9) {
        record(group, 'days', k, input.days, 'FAIL', 'P1', `未夹到合法区间 days=${d}`)
      } else {
        record(group, 'days', k, input.days, 'PASS', 'P3', `夹正后 days=${d}`)
      }
    }
  }

  // purchaseDate 测试
  const dateCases = ['空字符串', '非法日期', '数字abc', 'SQL注入', 'XSS脚本', '正常日期']
  for (const k of dateCases) {
    const store = makeStore()
    const input = { ...base, purchaseDate: SAMPLES[k] }
    const r = tryRun(k, () => { store.addFood(input); return store.foods[0] })
    if (!r.ok) {
      record(group, 'purchaseDate', k, input.purchaseDate, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const f = r.result
      const pd = f?.purchaseDate
      const ed = f?.expiryDate
      // 空字符串应回退到 todayStr；非法日期应被拒绝或回退
      if (k === '空字符串') {
        record(group, 'purchaseDate', k, input.purchaseDate, 'PASS', 'P3', `空日期回退到 today pd=${pd}`)
      } else if (k === '正常日期') {
        record(group, 'purchaseDate', k, input.purchaseDate, 'PASS', 'P3', `正常 pd=${pd} expiry=${ed}`)
      } else if (ed && ed.startsWith('NaN')) {
        record(group, 'purchaseDate', k, input.purchaseDate, 'FAIL', 'P1', `expiryDate 变为 NaN-NaN-NaN pd=${pd} ed=${ed}`)
      } else if (ed === undefined) {
        record(group, 'purchaseDate', k, input.purchaseDate, 'FAIL', 'P1', `expiryDate 缺失 pd=${pd}`)
      } else if (k === '非法日期' && pd === '2026-13-45') {
        record(group, 'purchaseDate', k, input.purchaseDate, 'FAIL', 'P1', `非法日期原样存储 pd=${pd} ed=${ed}`)
      } else {
        record(group, 'purchaseDate', k, input.purchaseDate, 'PASS', 'P3', `处理为 pd=${pd} ed=${ed}`)
      }
    }
  }

  // category / storage 测试（无校验，应原样存储）
  const catCases = ['空字符串', '纯emoji', '特殊字符', 'JSON注入', 'SQL注入', 'XSS脚本']
  for (const k of catCases) {
    const store = makeStore()
    const input = { ...base, category: SAMPLES[k] }
    const r = tryRun(k, () => { store.addFood(input); return store.foods[0] })
    if (!r.ok) {
      record(group, 'category', k, input.category, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const c = r.result?.category
      // 空字符串应回退到 '其他'，其它原样存（无白名单）
      if (k === '空字符串' && c === '其他') {
        record(group, 'category', k, input.category, 'PASS', 'P3', `空 category 回退到 其他`)
      } else if (k === '空字符串') {
        record(group, 'category', k, input.category, 'FAIL', 'P1', `空 category 未回退 → ${snapshot(c)}`)
      } else {
        // 无白名单：脏数据原样存储 → 下游 stats.byCategory 等会被污染
        record(group, 'category', k, input.category, 'FAIL', 'P2', `无白名单校验，原样存储 category=${snapshot(c)}`)
      }
    }
  }
  for (const k of catCases) {
    const store = makeStore()
    const input = { ...base, storage: SAMPLES[k] }
    const r = tryRun(k, () => { store.addFood(input); return store.foods[0] })
    if (!r.ok) {
      record(group, 'storage', k, input.storage, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const c = r.result?.storage
      if (k === '空字符串' && c === '冷藏') {
        record(group, 'storage', k, input.storage, 'PASS', 'P3', `空 storage 回退到 冷藏`)
      } else if (k === '空字符串') {
        record(group, 'storage', k, input.storage, 'FAIL', 'P1', `空 storage 未回退 → ${snapshot(c)}`)
      } else {
        record(group, 'storage', k, input.storage, 'FAIL', 'P2', `无白名单校验，原样存储 storage=${snapshot(c)}`)
      }
    }
  }
}

// ───────── 3. addRecipe ─────────
function testAddRecipe() {
  const group = '菜谱.addRecipe'
  const base = { name: '测试菜', emoji: '🍳', difficulty: '简单', time: 15, category: '蔬菜',
    ingredients: ['鸡蛋'], steps: ['打散'] }

  const nameCases = ['空字符串', '全空格', '超长10000', '纯emoji', '特殊字符', '控制字符',
    'JSON注入', 'SQL注入', 'XSS脚本', '正常西红柿']
  for (const k of nameCases) {
    const store = makeStore()
    const input = { ...base, name: SAMPLES[k] }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'name', k, input.name, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const name = r.result?.name
      if (name === undefined) {
        record(group, 'name', k, input.name, 'FAIL', 'P1', 'addRecipe 未返回菜谱')
      } else if (name === '' && k !== '空字符串' && k !== '全空格') {
        record(group, 'name', k, input.name, 'FAIL', 'P1', `非空输入被存为空 name`)
      } else if (name && name.length > 50) {
        record(group, 'name', k, input.name, 'FAIL', 'P1', `name 超长未截断 len=${name.length}`)
      } else if (k === 'XSS脚本' && name.includes('<script>')) {
        record(group, 'name', k, input.name, 'FAIL', 'P2', `XSS 字符串原样存储 → ${snapshot(name)}`)
      } else if (k === '空字符串' || k === '全空格') {
        // addRecipe 不校验空 name → 直接存空（UI 层 isRecipeFormValid 会拦，但 store 层不拦）
        record(group, 'name', k, input.name, 'FAIL', 'P1', `store 层未拦截空 name，存为空字符串`)
      } else {
        record(group, 'name', k, input.name, 'PASS', 'P3', `存储 name=${snapshot(name)}`)
      }
    }
  }

  const emojiCases = ['空字符串', '纯emoji', '特殊字符', 'XSS脚本', '中英日韩混合']
  for (const k of emojiCases) {
    const store = makeStore()
    const input = { ...base, emoji: SAMPLES[k] }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'emoji', k, input.emoji, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const e = r.result?.emoji
      if (k === '空字符串' && e === '🍳') {
        record(group, 'emoji', k, input.emoji, 'PASS', 'P3', `空 emoji 回退到 🍳`)
      } else if (k === '空字符串') {
        record(group, 'emoji', k, input.emoji, 'FAIL', 'P1', `空 emoji 未回退 → ${snapshot(e)}`)
      } else if (e && e.length > 8) {
        record(group, 'emoji', k, input.emoji, 'FAIL', 'P2', `emoji 字段超长 len=${e.length} → ${snapshot(e)}`)
      } else {
        record(group, 'emoji', k, input.emoji, 'PASS', 'P3', `存储 emoji=${snapshot(e)}`)
      }
    }
  }

  const timeCases = ['空字符串', '数字abc', '负数-1', '数字0', '极大值1e308', 'Infinity', 'NaN', '正常数字5', 'SQL注入']
  for (const k of timeCases) {
    const store = makeStore()
    const input = { ...base, time: SAMPLES[k] }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'time', k, input.time, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const t = r.result?.time
      // parseInt(SAMPLES) 逻辑：parseInt('-1')=-1 负数会存！parseInt('1e308')=1
      if (t === undefined) {
        record(group, 'time', k, input.time, 'FAIL', 'P1', 'time 缺失')
      } else if (typeof t !== 'number') {
        record(group, 'time', k, input.time, 'FAIL', 'P1', `time 不是数字 type=${typeof t} val=${snapshot(t)}`)
      } else if (t < 0) {
        record(group, 'time', k, input.time, 'FAIL', 'P1', `负数 time 被存 time=${t}`)
      } else if (t > 100000) {
        record(group, 'time', k, input.time, 'FAIL', 'P2', `极大 time 未限幅 time=${t}`)
      } else {
        record(group, 'time', k, input.time, 'PASS', 'P3', `存储 time=${t}`)
      }
    }
  }

  const diffCases = ['空字符串', '纯emoji', '特殊字符', 'JSON注入', 'XSS脚本']
  for (const k of diffCases) {
    const store = makeStore()
    const input = { ...base, difficulty: SAMPLES[k] }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'difficulty', k, input.difficulty, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const d = r.result?.difficulty
      if (k === '空字符串' && d === '简单') {
        record(group, 'difficulty', k, input.difficulty, 'PASS', 'P3', `空 difficulty 回退到 简单`)
      } else if (k === '空字符串') {
        record(group, 'difficulty', k, input.difficulty, 'FAIL', 'P1', `空 difficulty 未回退 → ${snapshot(d)}`)
      } else {
        record(group, 'difficulty', k, input.difficulty, 'FAIL', 'P2', `无白名单，原样存储 difficulty=${snapshot(d)}`)
      }
    }
  }

  // category 同 addFood category
  for (const k of ['空字符串', '纯emoji', 'JSON注入', 'XSS脚本']) {
    const store = makeStore()
    const input = { ...base, category: SAMPLES[k] }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'category', k, input.category, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const c = r.result?.category
      if (k === '空字符串' && c === '其他') {
        record(group, 'category', k, input.category, 'PASS', 'P3', `空 category 回退到 其他`)
      } else if (k === '空字符串') {
        record(group, 'category', k, input.category, 'FAIL', 'P1', `空 category 未回退`)
      } else {
        record(group, 'category', k, input.category, 'FAIL', 'P2', `无白名单，原样存储 category=${snapshot(c)}`)
      }
    }
  }

  // ingredientsText / stepsText：在 App.vue saveRecipe 中按 , 与 \n split。
  // 测 store 层 ingredients/steps 数组对脏数据项的处理
  const ingCases = [
    ['含空段', ['鸡蛋', '', '  ', '番茄']],
    ['超长食材', ['a'.repeat(5000)]],
    ['XSS食材', ['<img src=x onerror=alert(1)>']],
    ['SQL食材', ['"; DROP TABLE;']],
    ['纯emoji食材', ['🍎🍎']],
    ['控制字符食材', ['鸡\n蛋\t']],
  ]
  for (const [k, val] of ingCases) {
    const store = makeStore()
    const input = { ...base, ingredients: val }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'ingredientsText', k, snapshot(val), 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const ing = r.result?.ingredients
      if (!Array.isArray(ing)) {
        record(group, 'ingredientsText', k, snapshot(val), 'FAIL', 'P1', `ingredients 非数组`)
      } else if (ing.some(i => i.length > 100)) {
        record(group, 'ingredientsText', k, snapshot(val), 'FAIL', 'P1', `食材项超长未限制 len=${Math.max(...ing.map(i=>i.length))}`)
      } else if (ing.some(i => i.includes('<') || i.includes('DROP TABLE'))) {
        record(group, 'ingredientsText', k, snapshot(val), 'FAIL', 'P2', `脏数据食材项原样保留 → ${snapshot(ing)}`)
      } else {
        record(group, 'ingredientsText', k, snapshot(val), 'PASS', 'P3', `存储 ingredients=${snapshot(ing)}`)
      }
    }
  }

  const stepCases = [
    ['含空步', ['步骤1', '', '  ', '步骤2']],
    ['超长步骤', ['a'.repeat(5000)]],
    ['XSS步骤', ['<script>alert(1)</script>']],
    ['控制字符步', ['步骤\n\t一\r']],
  ]
  for (const [k, val] of stepCases) {
    const store = makeStore()
    const input = { ...base, steps: val }
    const r = tryRun(k, () => store.addRecipe(input))
    if (!r.ok) {
      record(group, 'stepsText', k, snapshot(val), 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const st = r.result?.steps
      if (!Array.isArray(st)) {
        record(group, 'stepsText', k, snapshot(val), 'FAIL', 'P1', `steps 非数组`)
      } else if (st.some(s => s.length > 500)) {
        record(group, 'stepsText', k, snapshot(val), 'FAIL', 'P1', `步骤超长未限制 len=${Math.max(...st.map(s=>s.length))}`)
      } else if (st.some(s => s.includes('<script>'))) {
        record(group, 'stepsText', k, snapshot(val), 'FAIL', 'P2', `XSS 步骤原样保留 → ${snapshot(st)}`)
      } else {
        record(group, 'stepsText', k, snapshot(val), 'PASS', 'P3', `存储 steps=${snapshot(st)}`)
      }
    }
  }
}

// ───────── 4. addShopItem ─────────
function testAddShopItem() {
  const group = '购物.addShopItem'
  const cases = ['空字符串', '全空格', '超长100', '超长10000', '纯emoji', '中英日韩混合', '特殊字符',
    '控制字符', 'JSON注入', 'SQL注入', 'XSS脚本', '零宽字符', '正常西红柿']
  for (const k of cases) {
    const store = makeStore()
    const v = SAMPLES[k]
    const r = tryRun(k, () => { store.addShopItem(v); return store.shopList[0] })
    if (!r.ok) {
      record(group, 'shopInput', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const item = r.result
      if (k === '空字符串' || k === '全空格') {
        if (item) record(group, 'shopInput', k, v, 'FAIL', 'P1', `空/全空格应被拒绝却已添加 → ${snapshot(item.text)}`)
        else record(group, 'shopInput', k, v, 'PASS', 'P3', `空/全空格被拒绝`)
      } else {
        if (!item) {
          record(group, 'shopInput', k, v, 'FAIL', 'P1', `非空输入未被添加`)
        } else {
          const t = item.text
          if (t.length > 200) {
            record(group, 'shopInput', k, v, 'FAIL', 'P1', `shop 项超长未限制 len=${t.length} (HTML maxlength=30 仅前端)`)
          } else if (k === 'XSS脚本' && t.includes('<script>')) {
            record(group, 'shopInput', k, v, 'FAIL', 'P2', `XSS 原样存储 → ${snapshot(t)}`)
          } else if (k === '控制字符' && /[\n\t\r]/.test(t)) {
            record(group, 'shopInput', k, v, 'FAIL', 'P2', `控制字符保留 → ${snapshot(t)}`)
          } else {
            record(group, 'shopInput', k, v, 'PASS', 'P3', `存储 text=${snapshot(t)} (len=${t.length})`)
          }
        }
      }
    }
  }
}

// ───────── 5. saveUser ─────────
function testSaveUser() {
  const group = '用户.saveUser'
  const base = { nickname: '小明', height: 170, weight: 65, age: 30, goal: '均衡饮食' }

  const nickCases = ['空字符串', '全空格', '超长100', '超长10000', '纯emoji', '特殊字符',
    '控制字符', 'JSON注入', 'SQL注入', 'XSS脚本', '中英日韩混合']
  for (const k of nickCases) {
    const store = makeStore()
    const input = { ...base, nickname: SAMPLES[k] }
    const r = tryRun(k, () => { store.saveUser(input); return store.user })
    if (!r.ok) {
      record(group, 'nickname', k, input.nickname, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const n = r.result?.nickname
      if (n === undefined) {
        record(group, 'nickname', k, input.nickname, 'FAIL', 'P1', `nickname 缺失`)
      } else if (n.length > 50) {
        record(group, 'nickname', k, input.nickname, 'FAIL', 'P1', `nickname 超长未限制 len=${n.length} (HTML maxlength=12 仅前端)`)
      } else if (k === 'XSS脚本' && n.includes('<script>')) {
        record(group, 'nickname', k, input.nickname, 'FAIL', 'P2', `XSS 原样存储 → ${snapshot(n)}`)
      } else if (k === '控制字符' && /[\n\t\r]/.test(n)) {
        record(group, 'nickname', k, input.nickname, 'FAIL', 'P2', `控制字符保留 → ${snapshot(n)}`)
      } else {
        record(group, 'nickname', k, input.nickname, 'PASS', 'P3', `存储 nickname=${snapshot(n)} (len=${n.length})`)
      }
    }
  }

  // height/weight/age：v-model.number 在前端转数字，但 store 无校验
  const numCases = ['空字符串', '数字abc', '数字undefined', '数字null', '负数-1', '数字0',
    '极大值1e308', 'Infinity', 'NaN', '正常数字5']
  for (const field of ['height', 'weight', 'age']) {
    for (const k of numCases) {
      const store = makeStore()
      const input = { ...base, [field]: SAMPLES[k] }
      const r = tryRun(k, () => { store.saveUser(input); return store.user })
      if (!r.ok) {
        record(group, field, k, SAMPLES[k], 'CRASH', 'P0', `抛异常: ${r.error}`)
      } else {
        const v = r.result?.[field]
        // saveUser 用 { ...DEFAULT_USER, ...user }，原样存
        // localStorage.setItem 会 JSON.stringify，NaN/Infinity → null
        const raw = localStorage.getItem('ffood_user')
        const persisted = JSON.parse(raw || '{}')
        const pv = persisted[field]
        if (typeof v === 'number' && (v < 0 || v > 1000)) {
          record(group, field, k, SAMPLES[k], 'FAIL', 'P1', `数值越界未校验 ${field}=${v}`)
        } else if (typeof v === 'string' && (k === '数字abc' || k === '数字undefined' || k === '数字null' || k === 'NaN' || k === 'Infinity' || k === 'SQL注入')) {
          record(group, field, k, SAMPLES[k], 'FAIL', 'P1', `非数字字符串原样存入 ${field}=${snapshot(v)} (持久化=${snapshot(pv)})`)
        } else if (pv === null && (k === 'NaN' || k === 'Infinity')) {
          record(group, field, k, SAMPLES[k], 'FAIL', 'P2', `${k} 持久化为 null，加载后变 0`)
        } else {
          record(group, field, k, SAMPLES[k], 'PASS', 'P3', `${field}=${snapshot(v)} (持久化=${snapshot(pv)})`)
        }
      }
    }
  }

  // goal：UI 用 chip 限定，但 store 无白名单
  const goalCases = ['空字符串', '纯emoji', 'JSON注入', 'SQL注入', 'XSS脚本', '特殊字符']
  for (const k of goalCases) {
    const store = makeStore()
    const input = { ...base, goal: SAMPLES[k] }
    const r = tryRun(k, () => { store.saveUser(input); return store.user })
    if (!r.ok) {
      record(group, 'goal', k, input.goal, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const g = r.result?.goal
      if (!GOAL_OPTIONS.includes(g)) {
        record(group, 'goal', k, input.goal, 'FAIL', 'P2', `goal 无白名单校验，原样存储 goal=${snapshot(g)} (合法值=${GOAL_OPTIONS.join('/')})`)
      } else {
        record(group, 'goal', k, input.goal, 'PASS', 'P3', `goal=${snapshot(g)}`)
      }
    }
  }
}

// ───────── 6. NLP extractFood / extractRecipe ─────────
async function testExtractFood() {
  const group = 'NLP.extractFood'
  const cases = ['空字符串', '全空格', '超长100', '超长10000', '纯emoji', '中英日韩混合', '特殊字符',
    '控制字符', '零宽字符', '组合字符é', 'RTL字符', 'HTML实体', 'JSON注入', 'SQL注入', 'XSS脚本',
    '非法日期', '正常西红柿']
  for (const k of cases) {
    const v = SAMPLES[k]
    const r = await tryRunAsync(k, () => extractFood(v))
    if (!r.ok) {
      record(group, 'pasteFoodText', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const res = r.result
      if (!res || typeof res !== 'object') {
        record(group, 'pasteFoodText', k, v, 'FAIL', 'P1', `返回非对象`)
        continue
      }
      // 检查返回字段类型与脏数据是否泄漏到 name
      const name = res.name
      if (typeof name !== 'string') {
        record(group, 'pasteFoodText', k, v, 'FAIL', 'P1', `name 非字符串 type=${typeof name}`)
      } else if (name.includes('<script>') || name.includes('DROP TABLE')) {
        record(group, 'pasteFoodText', k, v, 'FAIL', 'P2', `脏数据泄漏到 name=${snapshot(name)}`)
      } else if (k === '空字符串' || k === '全空格') {
        record(group, 'pasteFoodText', k, v, 'PASS', 'P3', `空输入返回空结果 name="${name}"`)
      } else if (k === '正常西红柿' && name === '西红柿') {
        record(group, 'pasteFoodText', k, v, 'PASS', 'P3', `正确抽取 name=${name} qty=${res.quantity}`)
      } else if (name === '' && res.confidence === 0) {
        record(group, 'pasteFoodText', k, v, 'PASS', 'P3', `无匹配 name="" confidence=0`)
      } else {
        record(group, 'pasteFoodText', k, v, 'PASS', 'P3', `抽取 name=${snapshot(name)} qty=${res.quantity} conf=${res.confidence}`)
      }
    }
  }
}

async function testExtractRecipe() {
  const group = 'NLP.extractRecipe'
  const cases = ['空字符串', '全空格', '超长100', '超长10000', '纯emoji', '中英日韩混合', '特殊字符',
    '控制字符', '零宽字符', '组合字符é', 'RTL字符', 'HTML实体', 'JSON注入', 'SQL注入', 'XSS脚本',
    '非法日期', '正常西红柿']
  for (const k of cases) {
    const v = SAMPLES[k]
    const r = await tryRunAsync(k, () => extractRecipe(v))
    if (!r.ok) {
      record(group, 'pasteRecipeText', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const res = r.result
      if (!res || typeof res !== 'object') {
        record(group, 'pasteRecipeText', k, v, 'FAIL', 'P1', `返回非对象`)
        continue
      }
      const name = res.name
      // matchRecipeName 会取文本首段，脏数据可能原样进入 name
      if (typeof name !== 'string') {
        record(group, 'pasteRecipeText', k, v, 'FAIL', 'P1', `name 非字符串`)
      } else if (name.length > 20) {
        record(group, 'pasteRecipeText', k, v, 'FAIL', 'P1', `name 超长 len=${name.length} → ${snapshot(name)}`)
      } else if (name.includes('<script>') || name.includes('DROP TABLE')) {
        record(group, 'pasteRecipeText', k, v, 'FAIL', 'P2', `脏数据泄漏到 name=${snapshot(name)} (会进 recipeForm.name)`)
      } else if (k === '空字符串' || k === '全空格') {
        record(group, 'pasteRecipeText', k, v, 'PASS', 'P3', `空输入返回空结果`)
      } else if (k === '超长10000' && name.length > 0) {
        record(group, 'pasteRecipeText', k, v, 'FAIL', 'P2', `超长文本首段进 name=${snapshot(name)} (len=${name.length})`)
      } else {
        record(group, 'pasteRecipeText', k, v, 'PASS', 'P3', `抽取 name=${snapshot(name)} conf=${res.confidence}`)
      }
    }
  }
}

async function tryRunAsync(label, fn) {
  try {
    const r = await fn()
    return { ok: true, label, result: r, error: null }
  } catch (e) {
    return { ok: false, label, result: null, error: `${e.name}: ${e.message}` }
  }
}

// ───────── 7. 扫码 scanBarcode + performScan 正则 ─────────
function testBarcode() {
  const group = '扫码'
  const store = makeStore()
  // performScan 正则: /^\d{8,20}$/
  const cases = [
    ['空字符串', ''],
    ['纯字母', 'abcdefgh'],
    ['字母数字混合', 'abc12345'],
    ['短数字', '123'],
    ['7位数字', '1234567'],
    ['8位数字(合法但DB无)', '12345678'],
    ['13位合法', '6901234567890'],
    ['21位超长数字', '1'.repeat(21)],
    ['含空格', '6901234567890 '],
    ['含特殊字符', '69012345!@#'],
    ['SQL注入', '"; DROP TABLE;'],
    ['XSS', '<script>1</script>'],
    ['纯emoji', '🍎🍎🍎'],
    ['超大数字1e308', '1e308'],
    ['负数', '-6901234567890'],
    ['正常8位', '69012345'],
  ]
  for (const [k, v] of cases) {
    // 复刻 App.vue performScan 逻辑
    const r = tryRun(k, () => {
      const code = String(v).trim()
      if (!code) return { error: '请输入条形码' }
      if (!/^\d{8,20}$/.test(code)) return { error: '条形码格式不正确（8-20位数字）' }
      const product = store.scanBarcode(code)
      if (!product) return { error: '未识别此条形码，请手动输入' }
      return { product: { ...product, barcode: code } }
    })
    if (!r.ok) {
      record(group, 'barcodeInput', k, v, 'CRASH', 'P0', `抛异常: ${r.error}`)
    } else {
      const res = r.result
      if (res.error) {
        record(group, 'barcodeInput', k, v, 'PASS', 'P3', `被正则/DB拦截: ${res.error}`)
      } else {
        record(group, 'barcodeInput', k, v, 'PASS', 'P3', `命中: ${snapshot(res.product.name)}`)
      }
    }
  }
}

// ───────── 主流程 ─────────
console.log('FFood 脏数据测试开始...\n')
testValidateFoodName()
testValidateQuantity()
testValidateDays()
testAddFood()
testAddRecipe()
testAddShopItem()
testSaveUser()
await testExtractFood()
await testExtractRecipe()
testBarcode()

// 输出统计
const byStatus = {}
const bySeverity = {}
const fails = []
for (const r of results) {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1
  if (r.status !== 'PASS') bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1
  if (r.status !== 'PASS') fails.push(r)
}
console.log('\n========== 统计 ==========')
console.log('总用例:', results.length)
console.log('状态分布:', byStatus)
console.log('缺陷严重级别分布:', bySeverity)

console.log('\n========== 失败/崩溃用例 ==========')
for (const f of fails) {
  console.log(`[${f.severity}] ${f.group} / ${f.field} / ${f.sampleName} → ${f.status}`)
  console.log(`    输入: ${f.input}`)
  console.log(`    详情: ${f.detail}`)
}

// 写出 JSON 供报告生成
import { writeFileSync } from 'node:fs'
writeFileSync('test-dirty-results.json', JSON.stringify(results, null, 2), 'utf-8')
console.log('\n详细结果已写入 test-dirty-results.json')
