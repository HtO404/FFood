/**
 * FFood 性能压力测试脚本
 * 运行: node test-perf.mjs
 *
 * 测试范围:
 *  1. NLP 分词性能(segmentit 首次加载 / extractFood / extractRecipe / 连续调用延迟)
 *  2. localStorage 性能(save / load / 接近 5MB 写入 / JSON.parse/stringify)
 *  3. 渲染计算性能(filteredFoods + groupedFoods computed 在不同数据量下的耗时 / 排序切换)
 *  4. 批量操作耗时(勾选 / 批量删除 filter)
 *
 * 说明: Node 无原生 localStorage, 使用 Map polyfill 模拟同步存储开销,
 *       该结果反映 JSON 序列化 + 内存写入的综合成本, 与浏览器 localStorage
 *       (同步 + UTF-16 配额)量级接近, 作为相对基准参考。
 */

import { performance } from 'node:perf_hooks'
import { extractFood, extractRecipe } from './src/nlp/extractor.js'

// ═════════ 工具 ═════════

function fmt(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1000).toFixed(3)}s`
}

function avg(arr) {
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function p95(arr) {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length * 0.95)] ?? s[s.length - 1]
}

// 简单 localStorage polyfill: Map + 字符串存储, 模拟同步 setItem/getItem
class LocalStoragePolyfill {
  constructor() { this._m = new Map() }
  setItem(k, v) { this._m.set(k, String(v)) }
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null }
  removeItem(k) { this._m.delete(k) }
  clear() { this._m.clear() }
  get length() { return this._m.size }
  key(i) { return [...this._m.keys()][i] ?? null }
}
const localStorage = new LocalStoragePolyfill()
globalThis.localStorage = localStorage

// ═════════ 模拟数据 ═════════

const CATEGORIES = ['蔬菜', '水果', '肉类', '乳制品', '调料', '其他']
const STORAGES = ['冷藏', '冷冻', '常温']
const NAMES = ['西红柿', '鸡蛋', '鸡胸肉', '牛奶', '苹果', '西兰花', '猪肉', '牛肉', '酸奶', '白菜',
  '黄瓜', '土豆', '排骨', '香蕉', '橙子', '生菜', '青椒', '虾', '三文鱼', '豆腐',
  '生菜', '芹菜', '洋葱', '胡萝卜', '蘑菇', '菠菜', '可乐', '鸡翅', '火腿肠', '奶酪']

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function calcExpiryDate(purchaseDate, days) {
  const d = new Date(purchaseDate)
  d.setDate(d.getDate() + Math.ceil(days))
  return d.toISOString().slice(0, 10)
}

function calcDaysLeft(expiryDate) {
  if (!expiryDate) return Infinity
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0)
  return Math.floor((expiry - now) / 86400000)
}

/** 生成 n 条与 foodStore.addFood 结构一致的食材 */
function genFoods(n) {
  const out = []
  const today = todayStr()
  for (let i = 0; i < n; i++) {
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? `#${i}` : '')
    const days = parseFloat((1 + (i % 30)).toFixed(1))
    const purchaseDate = today
    const expiryDate = calcExpiryDate(purchaseDate, days)
    out.push({
      id: genId(),
      name,
      quantity: parseFloat((0.5 + (i % 10) * 0.5).toFixed(1)),
      unit: ['个', 'kg', '份'][i % 3],
      days,
      category: CATEGORIES[i % CATEGORIES.length],
      purchaseDate,
      expiryDate,
      storage: STORAGES[i % STORAGES.length],
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      daysLeft: calcDaysLeft(expiryDate),
    })
  }
  return out
}

// ═════════ 复现 App.vue 的 computed 链 ═════════

/** 复现 filteredFoods: 筛选 + 排序 */
function computeFilteredFoods(foods, { category = 'all', storage = 'all', search = '', sortBy = 'expiry' } = {}) {
  let list = foods
  if (category !== 'all') list = list.filter(f => f.category === category)
  if (storage !== 'all') list = list.filter(f => f.storage === storage)
  if (search.trim()) {
    const kw = search.trim().toLowerCase()
    list = list.filter(f => f.name.toLowerCase().includes(kw))
  }
  const sorted = [...list]
  if (sortBy === 'expiry') {
    sorted.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity))
  } else if (sortBy === 'created') {
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  } else if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  }
  return sorted
}

/** 复现 groupedFoods: 按分类分组 + 组内排序 */
function computeGroupedFoods(filtered) {
  const groups = {}
  for (const f of filtered) {
    const cat = f.category || '其他'
    if (!groups[cat]) groups[cat] = { category: cat, items: [] }
    groups[cat].items.push(f)
  }
  return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category, 'zh'))
}

/** 复现 foodStore.stats getter */
function computeStats(foods) {
  let total = foods.length, expired = 0, expiringSoon = 0, fresh = 0
  const byCategory = {}, byStorage = {}
  for (const f of foods) {
    const dl = calcDaysLeft(f.expiryDate)
    if (dl < 0) expired++
    else if (dl <= 1) expiringSoon++
    else fresh++
    byCategory[f.category] = (byCategory[f.category] || 0) + 1
    byStorage[f.storage] = (byStorage[f.storage] || 0) + 1
  }
  return { total, expired, expiringSoon, fresh, wasteRate: total > 0 ? Math.round((expired / total) * 100) : 0, byCategory, byStorage }
}

/** 复现 removeFoods 批量删除(filter + Set) */
function batchRemove(foods, ids) {
  const idSet = new Set(ids)
  return foods.filter(f => !idSet.has(f.id))
}

/** 复现多选勾选 500 条(Set 操作) */
function batchSelect(items, count) {
  const set = new Set()
  for (let i = 0; i < count && i < items.length; i++) set.add(items[i].id)
  return set
}

// ═════════ 测试用例 ═════════

const results = {}

// ---- 1. NLP 性能 ----
async function testNLP() {
  console.log('\n========== 1. NLP 分词性能 ==========')
  const nlp = {}

  // 1.1 segmentit 首次加载时间(通过 extractFood 首次调用间接测量)
  const t0 = performance.now()
  await extractFood('2个西红柿冷藏')
  const t1 = performance.now()
  nlp.segmentit首次加载 = t1 - t0
  console.log(`segmentit 首次加载(含一次 extractFood): ${fmt(nlp.segmentit首次加载)}`)

  // 1.2 extractFood 不同输入长度
  const inputs = {
    '10字符': '2个西红柿冷藏',
    '100字符': '今天买了3个西红柿和半斤猪肉放在冷藏室，鸡蛋10个能放30天，还有一把菠菜和两根黄瓜，牛奶一升保质期7天',
    '500字符': '今天去超市采购了一大堆食材：3个西红柿、半斤猪肉、鸡蛋10个、牛奶一升、菠菜一把、黄瓜两根、土豆5个、胡萝卜3根、洋葱2个、大蒜两头、生姜一块、西兰花一颗、白菜半棵、芹菜一把、青椒4个、红椒2个、金针菇一包、香菇半斤、虾仁200克、三文鱼300克、牛肉一斤、鸡翅6个、排骨一斤、酸奶4杯、奶酪一盒、苹果5个、香蕉6根、橙子4个、猕猴桃8个、葡萄一串、草莓一盒、蓝莓两盒、芒果3个、菠萝一个、西瓜半个、哈密瓜半个、柠檬4个、柚子2个、桃子6个、李子一袋'.padEnd(500, '，'),
  }
  nlp.extractFood = {}
  for (const [label, text] of Object.entries(inputs)) {
    // warm up 已完成(首次加载), 这里测量稳态
    const ts = []
    for (let i = 0; i < 10; i++) {
      const s = performance.now()
      await extractFood(text)
      ts.push(performance.now() - s)
    }
    nlp.extractFood[label] = { avg: avg(ts), median: median(ts), p95: p95(ts) }
    console.log(`extractFood[${label}] avg=${fmt(nlp.extractFood[label].avg)} median=${fmt(nlp.extractFood[label].median)} p95=${fmt(nlp.extractFood[label].p95)}`)
  }

  // 1.3 extractRecipe 复杂食谱文本
  const recipeText = '番茄炒蛋 简单 15分钟 食材：番茄、鸡蛋、葱、盐、糖。步骤：1. 鸡蛋打散加少许盐 2. 番茄切块 3. 热油炒鸡蛋盛出 4. 重新热油炒番茄出汁 5. 倒入鸡蛋翻炒加糖盐调味 6. 撒葱花出锅'
  const ts = []
  for (let i = 0; i < 10; i++) {
    const s = performance.now()
    await extractRecipe(recipeText)
    ts.push(performance.now() - s)
  }
  nlp.extractRecipe = { avg: avg(ts), median: median(ts), p95: p95(ts) }
  console.log(`extractRecipe[复杂食谱] avg=${fmt(nlp.extractRecipe.avg)} median=${fmt(nlp.extractRecipe.median)} p95=${fmt(nlp.extractRecipe.p95)}`)

  // 1.4 连续 10 次调用 extractFood 的平均延迟(稳态)
  const lat = []
  for (let i = 0; i < 10; i++) {
    const s = performance.now()
    await extractFood('半斤猪肉冷冻能放10天')
    lat.push(performance.now() - s)
  }
  nlp.连续10次平均延迟 = avg(lat)
  nlp.连续10次延迟列表 = lat.map(fmt)
  console.log(`连续 10 次 extractFood 平均延迟: ${fmt(nlp.连续10次平均延迟)} (max=${fmt(Math.max(...lat))} min=${fmt(Math.min(...lat))})`)

  results.nlp = nlp
}

// ---- 2. localStorage & JSON 性能 ----
function testStorage() {
  console.log('\n========== 2. localStorage & JSON 性能 ==========')
  const st = {}

  // 2.1 JSON.stringify / parse 在不同数据量下
  st.json = {}
  for (const n of [100, 500, 1000, 2000, 5000]) {
    const foods = genFoods(n)
    // stringify
    const sTimes = []
    for (let i = 0; i < 5; i++) {
      const s = performance.now()
      JSON.stringify(foods)
      sTimes.push(performance.now() - s)
    }
    const json = JSON.stringify(foods)
    // parse
    const pTimes = []
    for (let i = 0; i < 5; i++) {
      const s = performance.now()
      JSON.parse(json)
      pTimes.push(performance.now() - s)
    }
    st.json[n] = {
      条数: n,
      字符串体积KB: (json.length / 1024).toFixed(1),
      stringifyAvg: avg(sTimes),
      parseAvg: avg(pTimes),
    }
    console.log(`JSON[${n}条] 体积=${st.json[n].字符串体积KB}KB stringify=${fmt(st.json[n].stringifyAvg)} parse=${fmt(st.json[n].parseAvg)}`)
  }

  // 2.2 localStorage save/load 1000 条(模拟 foodStore.save + load)
  const foods1000 = genFoods(1000)
  const saveTimes = []
  for (let i = 0; i < 5; i++) {
    const s = performance.now()
    const data = foods1000.map(f => ({ ...f }))
    localStorage.setItem('ffood_data', JSON.stringify(data))
    saveTimes.push(performance.now() - s)
  }
  const raw = localStorage.getItem('ffood_data')
  const loadTimes = []
  for (let i = 0; i < 5; i++) {
    const s = performance.now()
    const data = JSON.parse(raw)
    data.map(f => ({ ...f, daysLeft: calcDaysLeft(f.expiryDate) }))
    loadTimes.push(performance.now() - s)
  }
  st.localStorage1000 = { saveAvg: avg(saveTimes), loadAvg: avg(loadTimes) }
  console.log(`localStorage[1000条] save=${fmt(st.localStorage1000.saveAvg)} load=${fmt(st.localStorage1000.loadAvg)}`)

  // 2.3 localStorage 接近 5MB 时的写入性能
  // localStorage 配额按 UTF-16 code unit 计, 5MB ≈ 2.5M 中文字符 或 5M ASCII
  // 构造 ~4.8MB 字符串(预留余量), 测量写入耗时
  const bigPayload = JSON.stringify(genFoods(2000)) // 基础数据
  // 用大字符串填充至接近 4.8MB
  const padding = 'x'.repeat(4.8 * 1024 * 1024 - bigPayload.length)
  const nearFull = bigPayload + padding
  st.near5MB = { 字符串体积MB: (nearFull.length / 1024 / 1024).toFixed(2) }
  const bigTimes = []
  for (let i = 0; i < 5; i++) {
    const s = performance.now()
    localStorage.setItem('ffood_big', nearFull)
    bigTimes.push(performance.now() - s)
  }
  st.near5MB.写入耗时 = avg(bigTimes)
  console.log(`localStorage[接近5MB, ${(nearFull.length / 1024 / 1024).toFixed(2)}MB] 写入=${fmt(st.near5MB.写入耗时)}`)

  // 单条写入(对照组, 小字符串)
  const smallTimes = []
  for (let i = 0; i < 5; i++) {
    const s = performance.now()
    localStorage.setItem('ffood_small', '{"a":1}')
    smallTimes.push(performance.now() - s)
  }
  st.near5MB.小字符串写入对照 = avg(smallTimes)
  console.log(`localStorage[小字符串对照] 写入=${fmt(st.near5MB.小字符串写入对照)}`)

  results.storage = st
}

// ---- 3. 渲染计算性能(filteredFoods + groupedFoods) ----
function testRenderCompute() {
  console.log('\n========== 3. 渲染计算性能 (filteredFoods + groupedFoods) ==========')
  const rc = {}
  const sizes = [100, 500, 1000, 2000]

  // 3.1 groupedFoods computed 全量(无筛选)耗时
  rc.groupedFoods = {}
  for (const n of sizes) {
    const foods = genFoods(n)
    const ts = []
    for (let i = 0; i < 10; i++) {
      const s = performance.now()
      const filtered = computeFilteredFoods(foods, { sortBy: 'expiry' })
      computeGroupedFoods(filtered)
      ts.push(performance.now() - s)
    }
    rc.groupedFoods[n] = { avg: avg(ts), median: median(ts), p95: p95(ts) }
    console.log(`groupedFoods[${n}条] avg=${fmt(rc.groupedFoods[n].avg)} median=${fmt(rc.groupedFoods[n].median)} p95=${fmt(rc.groupedFoods[n].p95)}`)
  }

  // 3.2 排序切换响应时间(1000条, 三种排序)
  rc.排序切换 = {}
  const foods1000 = genFoods(1000)
  for (const sb of ['expiry', 'created', 'name']) {
    const ts = []
    for (let i = 0; i < 10; i++) {
      const s = performance.now()
      computeFilteredFoods(foods1000, { sortBy: sb })
      ts.push(performance.now() - s)
    }
    rc.排序切换[sb] = { avg: avg(ts), median: median(ts) }
    console.log(`排序切换[1000条, ${sb}] avg=${fmt(rc.排序切换[sb].avg)} median=${fmt(rc.排序切换[sb].median)}`)
  }

  // 3.3 带搜索 + 分类筛选的 groupedFoods 耗时(1000条)
  rc.筛选搜索 = {}
  const scenarios = [
    { label: '仅分类筛选', opts: { category: '蔬菜', sortBy: 'expiry' } },
    { label: '仅搜索', opts: { search: '鸡', sortBy: 'expiry' } },
    { label: '分类+搜索', opts: { category: '肉类', search: '鸡', sortBy: 'expiry' } },
    { label: '全筛选(分类+存储+搜索)', opts: { category: '肉类', storage: '冷藏', search: '鸡', sortBy: 'expiry' } },
  ]
  for (const sc of scenarios) {
    const ts = []
    for (let i = 0; i < 10; i++) {
      const s = performance.now()
      const filtered = computeFilteredFoods(foods1000, sc.opts)
      computeGroupedFoods(filtered)
      ts.push(performance.now() - s)
    }
    rc.筛选搜索[sc.label] = { avg: avg(ts), median: median(ts) }
    console.log(`筛选搜索[1000条, ${sc.label}] avg=${fmt(rc.筛选搜索[sc.label].avg)} median=${fmt(rc.筛选搜索[sc.label].median)}`)
  }

  // 3.4 stats getter 耗时(1000/2000条)
  rc.stats = {}
  for (const n of [1000, 2000]) {
    const foods = genFoods(n)
    const ts = []
    for (let i = 0; i < 10; i++) {
      const s = performance.now()
      computeStats(foods)
      ts.push(performance.now() - s)
    }
    rc.stats[n] = { avg: avg(ts) }
    console.log(`stats getter[${n}条] avg=${fmt(rc.stats[n].avg)}`)
  }

  results.render = rc
}

// ---- 4. 批量操作性能 ----
function testBatchOps() {
  console.log('\n========== 4. 批量操作性能 ==========')
  const bo = {}

  // 4.1 多选勾选 500 条(Set 构建)
  const foods1000 = genFoods(1000)
  const selTimes = []
  for (let i = 0; i < 10; i++) {
    const s = performance.now()
    batchSelect(foods1000, 500)
    selTimes.push(performance.now() - s)
  }
  bo.勾选500条 = { avg: avg(selTimes) }
  console.log(`勾选500条(Set构建) avg=${fmt(bo.勾选500条.avg)}`)

  // 4.2 批量删除 500 条(filter + Set)
  const ids500 = foods1000.slice(0, 500).map(f => f.id)
  const delTimes = []
  for (let i = 0; i < 10; i++) {
    const s = performance.now()
    batchRemove(foods1000, ids500)
    delTimes.push(performance.now() - s)
  }
  bo.批量删除500条 = { avg: avg(delTimes) }
  console.log(`批量删除500条(filter+Set) avg=${fmt(bo.批量删除500条.avg)}`)

  // 4.3 单条删除 1000 次(模拟连续 removeFood, 每次 filter 整个数组)
  const foods1 = genFoods(1000)
  const removeIds = [...foods1].slice(0, 100).map(f => f.id)
  const s = performance.now()
  let cur = foods1
  for (const id of removeIds) {
    cur = cur.filter(f => f.id !== id)
  }
  bo.连续单条删除100次 = performance.now() - s
  console.log(`连续单条删除100次(每次filter) 总耗=${fmt(bo.连续单条删除100次)}`)

  // 4.4 handleCardClick 模拟(Set copy + add/delete, 1000 次点击)
  let selSet = new Set()
  const s2 = performance.now()
  for (let i = 0; i < 1000; i++) {
    const id = foods1000[i % foods1000.length].id
    const ns = new Set(selSet)
    if (ns.has(id)) ns.delete(id)
    else ns.add(id)
    selSet = ns
  }
  bo.模拟1000次点击切换选中 = performance.now() - s2
  console.log(`模拟1000次点击切换选中(Set copy) 总耗=${fmt(bo.模拟1000次点击切换选中)}`)

  results.batch = bo
}

// ---- 5. 内存占用估算 ----
function testMemoryEstimate() {
  console.log('\n========== 5. 内存占用估算 ==========')
  const mem = {}

  // 用 process.memoryUsage().heapUsed 估算 1000 条食材的 JS 堆开销
  // 强制 GC 前后差值(若 --expose-gc 可用)
  const canGC = typeof global.gc === 'function'
  if (canGC) global.gc()
  const before = process.memoryUsage().heapUsed
  const foods1000 = genFoods(1000)
  const json1000 = JSON.stringify(foods1000)
  const after = process.memoryUsage().heapUsed
  mem.数据结构 = {
    '1000条食材对象数': foods1000.length,
    单条字段数: Object.keys(foods1000[0]).length,
    JSON字符串体积KB: (json1000.length / 1024).toFixed(1),
    堆增量估算MB: canGC ? ((after - before) / 1024 / 1024).toFixed(2) : 'N/A(未启用 --expose-gc)',
  }
  console.log(`1000条食材 JSON体积=${mem.数据结构.JSON字符串体积KB}KB 堆增量=${mem.数据结构.堆增量估算MB}MB`)

  // 2000 条
  if (canGC) global.gc()
  const b2 = process.memoryUsage().heapUsed
  const foods2000 = genFoods(2000)
  const j2 = JSON.stringify(foods2000)
  const a2 = process.memoryUsage().heapUsed
  mem.数据结构.两千条JSON体积KB = (j2.length / 1024).toFixed(1)
  mem.数据结构.两千条堆增量MB = canGC ? ((a2 - b2) / 1024 / 1024).toFixed(2) : 'N/A'
  console.log(`2000条食材 JSON体积=${mem.数据结构.两千条JSON体积KB}KB 堆增量=${mem.数据结构.两千条堆增量MB}MB`)

  // tab 切换内存泄漏分析: 代码层面检查(无实际浏览器, 给出静态结论)
  mem.tab切换泄漏分析 = '见报告静态分析(switchTab 仅切换 activeTab ref + exitBatchMode, 无定时器/监听器累积, Transition 内联不持有引用)'

  results.memory = mem
}

// ---- 主流程 ----
async function main() {
  console.log('FFood 性能测试开始 (Node ' + process.version + ')')
  console.log('时间: ' + new Date().toISOString())
  console.log('='.repeat(60))

  await testNLP()
  testStorage()
  testRenderCompute()
  testBatchOps()
  testMemoryEstimate()

  // 输出 JSON 全量结果到文件(便于报告引用)
  console.log('\n========== 测试完成, 全量 JSON 结果 ==========')
  console.log(JSON.stringify(results, null, 2))
}

main().catch(e => {
  console.error('测试失败:', e)
  process.exit(1)
})
