# FFood 性能压力测试报告

> 测试时间：2026-07-03
> 测试环境：Node v22.14.0（Windows），FFood v1.0.0
> 测试脚本：`test-perf.mjs`（`node --expose-gc test-perf.mjs`）
> 构建工具：Vite v6.4.3

## 0. 测试方法与局限说明

| 维度 | 测试方式 | 可信度 |
|---|---|---|
| NLP 延迟 | `performance.now()` 实测 `extractFood` / `extractRecipe`（Node 直跑源码） | 高 |
| JSON / localStorage | `performance.now()` 实测序列化与读写 | 高（注：Node 无原生 localStorage，用 Map polyfill 模拟同步存储，**5MB 写入耗时偏低**，见 §3.3 说明） |
| 渲染计算（computed 链） | 复现 `filteredFoods` + `groupedFoods` + `stats` 纯 JS 逻辑实测 | 高（计算层），**不含 DOM 渲染** |
| 批量操作 | 实测 `Set` / `filter` 操作 | 高 |
| 构建产物 | `npm run build` 实际产物体积 | 高 |
| 首屏加载 / 滚动 FPS / 内存泄漏 | 基于产物体积 + 源码静态分析（无浏览器 DevTools） | 中（需浏览器实测复核） |

> **达标线**：首屏 < 1s；列表滚动 60 fps（单帧 < 16.67ms）；操作响应 < 100ms。

---

## 1. NLP 分词性能

`src/nlp/extractor.js` 中 `segmentit` 采用动态 `import()` 懒加载，首次调用才加载分词库。

| 场景 | 输入规模 | avg | median | p95 | 是否达标 (<100ms) |
|---|---|---|---|---|---|
| segmentit 首次加载（含 1 次 extractFood） | 10 字符 | 250.0 ms | — | — | ⚠️ 一次性开销，不阻塞首屏，但首次 NLP 交互有 250ms 延迟 |
| extractFood | 10 字符 | 0.17 ms | 0.13 ms | 0.59 ms | ✅ |
| extractFood | 100 字符 | 0.47 ms | 0.44 ms | 0.75 ms | ✅ |
| extractFood | 500 字符 | 3.17 ms | 2.18 ms | 10.99 ms | ✅ |
| extractRecipe | 复杂食谱（~90 字符） | 1.17 ms | 0.83 ms | 3.33 ms | ✅ |
| 连续 10 次 extractFood 平均延迟 | 10 字符 | 0.078 ms | — | max 0.14 ms | ✅ |

**结论**：稳态 NLP 调用全部 < 4ms，远低于 100ms 响应线。唯一注意点是首次调用 250ms 的分词库加载（已通过懒加载规避首屏）。

---

## 2. 滑动交互性能

`src/composables/useSwipeBatch.js` 的滑动 / 多选逻辑为纯 JS（`Set` + `transform`），无重计算。

| 场景 | 数据量 | 耗时 | 是否达标 | 备注 |
|---|---|---|---|---|
| 左滑卡片单次手势处理 | 1000 条 | < 0.1 ms（`touchMove` 内仅 `querySelector(currentTarget)` + transform 赋值） | ✅ | 计算层无卡顿；**DOM 层 1000 节点滚动 FPS 需浏览器实测**（见 §7 风险） |
| 多选勾选 500 条（`Set` 构建） | 500 | 0.045 ms | ✅ | `toggleSelectAll` 一次构建 |
| 批量删除 500 条（`filter` + `Set`） | 500 | 0.082 ms | ✅ | `removeFoods` + 1 次 `save()` |
| 连续单条删除 100 次（每次 `filter` 全表） | 1000→900 | 2.16 ms | ✅ | 单条删除循环触发全量 filter |
| 模拟 1000 次点击切换选中（`Set` copy） | 1000 | 6.05 ms | ✅ | `handleCardClick` 每次 `new Set` |

**结论**：批量/滑动交互计算耗时全部 < 7ms，达标。

---

## 3. localStorage 性能

### 3.1 JSON.stringify / parse 不同数据量

| 数据量 | 字符串体积 | stringify avg | parse avg | 是否达标 |
|---|---|---|---|---|
| 100 条 | 20.5 KB | 0.060 ms | 0.067 ms | ✅ |
| 500 条 | 103.4 KB | 0.491 ms | 0.387 ms | ✅ |
| 1000 条 | 206.9 KB | 0.945 ms | 0.725 ms | ✅ |
| 2000 条 | 415.0 KB | 2.013 ms | 2.321 ms | ✅ |
| 5000 条 | 1039.2 KB | 5.728 ms | 3.587 ms | ✅ |

### 3.2 localStorage save / load（1000 条，复现 `foodStore.save` + `load`）

| 操作 | 耗时 | 是否达标 (<100ms) |
|---|---|---|
| save（`map` 浅拷贝 + `stringify` + `setItem`） | 1.35 ms | ✅ |
| load（`getItem` + `parse` + `map` 补 `daysLeft`） | 2.09 ms | ✅ |

### 3.3 localStorage 接近 5MB 写入

| 场景 | 体积 | 写入耗时 | 说明 |
|---|---|---|---|
| 接近 5MB 字符串写入 | 4.80 MB | 4.4 μs | ⚠️ **Map polyfill 结果，不可信** |
| 小字符串对照 | 28 B | 1.0 μs | — |

> **重要说明**：本测试用 `Map` 模拟 localStorage，未体现真实浏览器 localStorage 的同步阻塞成本。真实浏览器中 localStorage 写入是**同步**操作，且涉及配额检查与 UTF-16 持久化，写入接近 5MB 的字符串会**阻塞主线程数百毫秒**。FFood 单用户数据 1000 条仅 207KB，距 5MB 配额很远，实际无风险；但若数据膨胀至 MB 级，`save()` 的同步 `setItem` 将成为明显卡顿源。

**结论**：1000 条数据下 localStorage 全链路 < 2.1ms，达标。

---

## 4. 构建产物分析

`npm run build` 产物（`dist/`）：

| 产物 | 原始体积 | gzip 体积 | 加载时机 | 说明 |
|---|---|---|---|---|
| `index.html` | 0.74 KB | 0.46 KB | 首屏 | 仅引用主 JS + CSS |
| `assets/index-*.css` | 38.98 KB | 7.19 KB | 首屏 | iOS16 样式 |
| `assets/index-*.js`（主 chunk） | 147.99 KB | 52.55 KB | 首屏 | Vue + App + store + composables |
| `assets/segmentit-*.js` | **3,636.03 KB** | **1,309.22 KB** | 懒加载 | 仅首次 NLP 调用时加载 |

### 验证项

| 验证点 | 结果 | 证据 |
|---|---|---|
| segmentit 是否独立 chunk | ✅ 是 | 构建输出独立 `segmentit-DJBG6d4X.js` 文件 |
| segmentit 是否懒加载 | ✅ 是 | `index.html` 仅引用主 JS+CSS，未引用 segmentit；主 chunk 中仅 1 处动态 `import()` 引用；源码 `extractor.js` 用 `await import('segmentit')` |
| gzip 后首屏总体积（不含 segmentit） | ✅ ~60.2 KB | 0.46 + 7.19 + 52.55 |
| gzip 后全量体积（含 segmentit） | 1,369.4 KB | 首屏 + 1,309.22 |

**结论**：首屏 gzip 仅 ~60KB，segmentit 正确懒加载，**首屏 < 1s 达标**。但 segmentit 单 chunk 高达 3.6MB（gzip 1.3MB），首次使用「粘贴智能填充」时弱网下下载开销大（见 §7 瓶颈 1）。

---

## 5. 渲染计算性能（computed 链）

复现 `App.vue` 的 `filteredFoods` → `groupedFoods` 计算链（纯 JS，不含 DOM patch）。

### 5.1 groupedFoods 全量分组（无筛选，默认 expiry 排序）

| 数据量 | avg | median | p95 | 是否达标 (<16ms/帧) |
|---|---|---|---|---|
| 100 条 | 1.08 ms | 0.045 ms | 10.16 ms | ✅ |
| 500 条 | 0.074 ms | 0.067 ms | 0.127 ms | ✅ |
| 1000 条 | 0.242 ms | 0.166 ms | 0.789 ms | ✅ |
| 2000 条 | 0.298 ms | 0.341 ms | 0.376 ms | ✅ |

### 5.2 排序切换响应时间（1000 条）

| 排序方式 | avg | median | 是否达标 (<100ms) | 备注 |
|---|---|---|---|---|
| expiry（临期优先，数值比较） | 0.084 ms | 0.074 ms | ✅ | 最快 |
| created（添加时间，`new Date` 比较） | 0.964 ms | 0.778 ms | ✅ | 每次创建 `Date` 对象 |
| name（名称，`localeCompare('zh')`） | 2.14 ms | 2.05 ms | ✅ | 最慢，比数值排序慢 ~25 倍 |

### 5.3 带搜索 + 筛选的 groupedFoods（1000 条）

| 场景 | avg | median |
|---|---|---|
| 仅分类筛选 | 0.063 ms | 0.046 ms |
| 仅搜索 | 0.127 ms | 0.116 ms |
| 分类 + 搜索 | 0.021 ms | 0.019 ms |
| 全筛选（分类 + 存储 + 搜索） | 0.017 ms | 0.011 ms |

### 5.4 stats getter

| 数据量 | avg | 是否达标 |
|---|---|---|
| 1000 条 | 0.812 ms | ✅ |
| 2000 条 | 1.311 ms | ✅ |

**结论**：所有 computed 计算层耗时 < 11ms，达标。`name` 排序是最慢项但仍在 100ms 内。

---

## 6. 内存占用估算

| 场景 | JSON 体积 | 堆增量估算 | 说明 |
|---|---|---|---|
| 1000 条食材 | 206.9 KB | 1.50 MB | 11 字段/条，`--expose-gc` 后差值 |
| 2000 条食材 | 415.0 KB | 3.01 MB | 线性增长，无异常膨胀 |

### tab 切换内存泄漏（静态分析，重复 50 次）

分析 `App.vue` 的 `switchTab(tab)`：

```js
function switchTab(tab) {
  activeTab.value = tab
  foodBatch.exitBatchMode()
  shopBatch.exitBatchMode()
  recipeBatch.exitBatchMode()
}
```

| 检查项 | 结论 |
|---|---|
| 是否注册未清理的 `setInterval` / `setTimeout` | 仅 `startNotificationTimer` 注册 1 个 4 小时 `setInterval`（`nt`），`onMounted` 仅触发一次，tab 切换不重复注册 ✅ |
| 是否绑定未解绑的事件监听 | tab 切换通过 `v-if` 销毁/重建 DOM，Vue 自动清理模板内联监听器 ✅ |
| 是否累积闭包引用 | `exitBatchMode` 清空 `selectedIds` Set 与 `swipedId`，无累积 ✅ |
| `Transition` / `TransitionGroup` | 内联使用，不持有跨 tab 引用 ✅ |

**结论**：tab 切换无内存泄漏风险（静态分析）。1000 条数据堆占用约 1.5MB，浏览器总内存占用（含 Vue 响应式代理 + DOM 节点）估算在 5–10MB 量级，远低于移动端内存压力线。

---

## 7. 发现的瓶颈

| # | 瓶颈 | 严重度 | 证据 |
|---|---|---|---|
| 1 | **segmentit chunk 过大**（3.6MB / gzip 1.3MB） | 🔴 高 | §4 构建产物；首次「粘贴智能填充」需下载 1.3MB，弱网/4G 下延迟显著 |
| 2 | **食材列表无虚拟化** | 🔴 高 | `App.vue` 用 `v-for` + `TransitionGroup` 渲染 `groupedFoods` 全部节点；1000+ 条时全量 DOM 节点（每卡片含 6+ 子元素与多个事件监听）会导致滚动 FPS 下降。**计算层 < 1ms 达标，但 DOM 层是 60fps 的主要风险**，需浏览器 Performance 面板实测 |
| 3 | name 排序 `localeCompare('zh')` 较慢 | 🟡 中 | §5.2：1000 条 2.05ms，比数值排序慢 25 倍；虽达标但大数据量 + 频繁切换会累积 |
| 4 | `getRecommendedRecipes` 嵌套循环 | 🟡 中 | `foodStore.js:382-394`：对每个菜谱做 `[...foodNames].some(...)` 双重展开，复杂度 O(recipes × foods × ingredients)；内置 12 菜谱下无感，自定义菜谱增多时退化 |
| 5 | `save()` 每次增删全量 stringify | 🟢 低 | `foodStore.js:217-224`：每次 `addFood`/`updateFood`/`removeFood` 都 `JSON.stringify` 全表；1000 条 0.95ms 可接受，但批量单条循环删除会累积（§2 连续删 100 次 2.16ms 含多次 save） |
| 6 | 真实浏览器 localStorage 5MB 同步写阻塞 | 🟢 低 | 本测试 Map polyfill 未体现；FFood 实际数据量远低于配额，无现实风险，但架构上未做防抖 |

---

## 8. 优化建议

### 优先级 P0（影响大数据量体验）

1. **列表虚拟化**：当食材数 > 200 时引入窗口化渲染（如 `vue-virtual-scroller` 或自实现），仅渲染可视区 ± 缓冲节点。可彻底解决 1000+ 条滚动掉帧风险。分组结构可在虚拟列表外层保留分组标题吸顶。
2. **segmentit 瘦身**：
   - 方案 A：换用更轻量的分词方案（自建前缀匹配词典 + 最大正向匹配，`FOOD_WORDS` 仅 ~200 词，完全可替代 segmentit 对短文本的切分，体积可降至 < 50KB）。
   - 方案 B：保留 segmentit 但用构建工具裁剪其内置词典（segmentit 自带大词典是体积主因）。
   - 当前懒加载策略正确，建议保留；核心是减小 chunk 本身。

### 优先级 P1（细节体验）

3. **name 排序优化**：预计算排序索引（如 `Intl.Collator('zh').compare` 缓存实例，或对名称建一次性排序缓存键），避免每次切换重排都调用 `localeCompare`。
4. **`getRecommendedRecipes` 缓存**：`foodNames` 的 `Set` 在菜谱匹配内层循环中每次 `[...foodNames].some(...)` 重复展开；改为预先构建 `Set` 并用 `set.has()`，复杂度降为 O(recipes × ingredients)。
5. **`save()` 防抖**：对高频写操作（批量删除、连续编辑）`debounce` 200ms 后统一持久化，避免每次操作都全量 stringify。

### 优先级 P2（锦上添花）

6. **`created` 排序避免重复 `new Date`**：存 `createdAt` 时间戳数值，排序时直接数值比较，省去每次 `new Date()` 解析。
7. **大数据量禁用 `TransitionGroup` 过渡**：> 500 条时动态关闭 `food-card` 过渡动画，减少 reflow。

---

## 9. 达标总结

| 达标线 | 目标 | 结论 | 依据 |
|---|---|---|---|
| 首屏加载 | < 1s | ✅ 达标 | 首屏 gzip ~60KB（主 JS 52.55KB + CSS 7.19KB），segmentit 懒加载不阻塞 |
| 列表滚动 FPS | 60 fps | ⚠️ 风险 | computed 计算层 < 1ms 达标；**但无虚拟化，1000+ DOM 节点滚动可能掉帧，需浏览器实测复核** |
| 操作响应 | < 100ms | ✅ 达标 | 所有交互（排序/筛选/批量勾选/批量删除/NLP）稳态耗时 < 7ms |

> **核心结论**：FFood 在 1000 条数据量下，**计算层与持久化层全面达标**；唯一显著风险在 **DOM 渲染层（无虚拟化）** 与 **segmentit 首次加载体积**。建议优先落地列表虚拟化（P0）与 segmentit 瘦身（P0）。
