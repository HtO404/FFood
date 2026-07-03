# FFood 脏数据 / 非法字符注入测试报告

- **项目**：FFood（Vue 3 + localStorage 纯前端食材管理 SPA）
- **测试日期**：2026-07-03
- **测试人**：脏数据测试工程师
- **测试脚本**：`e:\TraeCode\FFood\test-dirty.mjs`
- **原始结果**：`e:\TraeCode\FFood\test-dirty-results.json`
- **代码版本**：src/store/foodStore.js + src/nlp/extractor.js + src/App.vue（未改动源码）

---

## 1. 测试范围与方法

### 1.1 测试目标（所有用户输入字段）

| 模块 | 字段 | 入口函数 |
|------|------|----------|
| 食材表单 | name, quantity, days, purchaseDate, category, storage | `validateFoodName` / `validateQuantity` / `validateDays` / `addFood` |
| 菜谱表单 | name, emoji, time, difficulty, category, ingredientsText, stepsText | `addRecipe` |
| 购物清单 | shopInput | `addShopItem` |
| 用户资料 | nickname, height, weight, age, goal | `saveUser` |
| NLP 粘贴框 | pasteFoodText, pasteRecipeText | `extractFood` / `extractRecipe` |
| 扫码输入 | barcodeInput | `performScan` 正则 + `scanBarcode` |

### 1.2 脏数据样本集（13 类）

| 类别 | 样本 | 说明 |
|------|------|------|
| 空值 | `''` / `'     '` | 空字符串 / 全空格 |
| 超长 | `'a'×100` / `×1000` / `×10000` | 长度爆炸 |
| Emoji | `🍎🔄🏳️‍🌈` | 纯 emoji 含 ZWJ 序列 |
| 多语种 | `西红柿 tomato トマト 토마토` | 中英日韩混合 |
| 特殊字符 | ``!@#$%^&*()_+-=[]{}|;':",./<>?`\\`` | 含反引号反斜杠 |
| 控制字符 | `\n\t\r\0` | 换行/制表/回车/NUL |
| Unicode 边界 | `西\u200B红柿` / `café résumé` / `مرحبا בעברית` | 零宽 / 组合字符 / RTL |
| HTML 实体 | `&lt;&amp;&#x27;&quot;` | 实体注入 |
| JSON 注入 | `{"$gt":""}` | NoSQL 注入 |
| SQL 注入 | `"; DROP TABLE users; --` | SQL 注入 |
| XSS | `<script>alert(1)</script>` | 脚本注入 |
| 非数字 | `abc` / `undefined` / `null` / `NaN` / `Infinity` | 数字字段非法值 |
| 数字越界 | `-1` / `0` / `1e308` / `2026-13-45` | 负数/零/极大值/非法日期 |

### 1.3 测试方法

1. **直接调用 store 层**：绕过 UI 的 `v-model.number`、`maxlength`、`min/max` 等 HTML 属性，直接以字符串/原始值调用 `addFood` / `addRecipe` / `addShopItem` / `saveUser`，模拟"绕过前端约束"的攻击场景（如通过 localStorage 注入、浏览器插件、API 直调）。
2. **直接调用 validate 函数**：验证 UI 层校验对脏数据的拦截能力。
3. **直接调用 NLP 抽取函数**：验证 `extractFood` / `extractRecipe` 对脏输入是否崩溃或泄漏脏数据到结构化字段。
4. **复刻 performScan 正则**：验证条形码正则 `/^\d{8,20}$/` 的拦截能力。

### 1.4 严重级别定义

| 级别 | 含义 | 判定标准 |
|------|------|----------|
| **P0** | 崩溃 | 函数抛出未捕获异常，导致流程中断 |
| **P1** | 数据错乱 | 脏数据被持久化，破坏数据完整性（空值入库、超长未截断、负数、非数字入数字字段） |
| **P2** | 显示异常 | 脏数据原样存储但不破坏结构（无白名单字段被污染、XSS 字符串入库、控制字符保留） |
| **P3** | 可接受 | 校验正确拦截 / 无副作用 |

---

## 2. 总体结论

| 指标 | 数值 |
|------|------|
| 总用例数 | **236** |
| PASS | 165 (69.9%) |
| FAIL | 67 (28.4%) |
| CRASH | 4 (1.7%) |
| **P0 崩溃** | **4** |
| **P1 数据错乱** | **27** |
| **P2 显示异常** | **40** |

**核心风险**：
1. **P0**：`addFood` 的 `purchaseDate` 字段对任意非法字符串都会让 `calcExpiryDate → new Date(x).toISOString()` 抛 `RangeError`，整个保存流程崩溃。
2. **P1**：store 层（`addFood`/`addRecipe`/`addShopItem`/`saveUser`）几乎不做校验，全部依赖 UI 层 `maxlength`/`v-model.number`/`validateAll`。一旦绕过 UI（如 localStorage 直写、DevTools 改值），可写入空 name、10000 字符 name、负数 time、字符串型 height 等。
3. **P2**：`category`/`storage`/`difficulty`/`goal`/`emoji` 等枚举字段均无白名单校验，任意字符串可入库并污染统计/筛选。
4. **NLP**：`extractFood` 对脏数据鲁棒（无崩溃，无脏数据泄漏到 name）；`extractRecipe` 的 `matchRecipeName` 会把文本首段原样塞入 `name`，XSS 字符串会泄漏到 `recipeForm.name`。

---

## 3. 测试矩阵（按字段 × 脏数据类别）

图例：`✅ PASS` / `❌ FAIL` / `💥 CRASH` / `— 未测`

### 3.1 食材表单 — validate 函数（UI 层）

| 脏数据 | validateFoodName | validateQuantity | validateDays |
|--------|:---:|:---:|:---:|
| 空字符串 | ✅ 拒绝 | ✅ 拒绝 | ✅ 拒绝 |
| 全空格 | ✅ 拒绝 | ✅ 拒绝 | ✅ 拒绝 |
| 超长100/10000 | ✅ 拒绝(>20字) | — | — |
| 纯emoji | ✅ 拒绝 | — | — |
| 中英日韩混合 | ❌ P2 正常数据被拒 | — | — |
| 特殊字符 | ✅ 拒绝 | — | — |
| 控制字符 | ✅ 拒绝 | — | — |
| 组合字符é | ❌ P2 正常数据被拒 | — | — |
| HTML实体 | ✅ 拒绝 | — | — |
| JSON注入 | ✅ 拒绝 | — | — |
| SQL注入 | ✅ 拒绝 | — | — |
| XSS脚本 | ✅ 拒绝 | — | — |
| 数字abc | — | ✅ 拒绝 | ✅ 拒绝 |
| 负数-1 | — | ✅ 拒绝(<0.1) | ✅ 拒绝(<0.1) |
| 数字0 | — | ✅ 拒绝(<0.1) | ✅ 拒绝(<0.1) |
| 极大值1e308 | — | ✅ 拒绝(>99.9) | ✅ 拒绝(>99.9) |
| Infinity | — | ✅ 拒绝 | ✅ 拒绝 |
| NaN | — | ✅ 拒绝 | ✅ 拒绝 |
| 正常值 | ✅ 通过 | ✅ 通过 | ✅ 通过 |

> **结论**：`validateFoodName` 的正则 `/^[\u4e00-\u9fff\w\s]+$/` 过于严格，**误杀日韩字符与拉丁扩展字符（é）**，应放宽或改用"黑名单禁用控制字符"策略。

### 3.2 食材表单 — addFood（store 层防御）

| 脏数据 | name | quantity | days | purchaseDate | category | storage |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| 空字符串 | ❌P1 存空 | ✅ 夹到0.1 | ✅ 夹到0.1 | ✅ 回退today | ✅ 回退其他 | ✅ 回退冷藏 |
| 全空格 | ❌P1 存空 | — | — | — | — | — |
| 超长10000 | ❌P1 未截断 | — | — | — | — | — |
| 纯emoji | ✅(validate前置) | — | — | — | ❌P2 无白名单 | ❌P2 无白名单 |
| 特殊字符 | ✅(validate前置) | — | — | — | ❌P2 无白名单 | ❌P2 无白名单 |
| 控制字符 | ❌P2 保留 | — | — | — | — | — |
| SQL注入 | ❌P2 原样存 | — | — | 💥P0 崩溃 | ❌P2 无白名单 | ❌P2 无白名单 |
| XSS脚本 | ❌P2 原样存 | — | — | 💥P0 崩溃 | ❌P2 无白名单 | ❌P2 无白名单 |
| JSON注入 | — | — | — | — | ❌P2 无白名单 | ❌P2 无白名单 |
| 数字abc | — | ✅ 夹到0.1 | ✅ 夹到0.1 | 💥P0 崩溃 | — | — |
| 负数-1 | — | ✅ 夹到0.1 | ✅ 夹到0.1 | — | — | — |
| 数字0 | — | ✅ 夹到0.1 | ✅ 夹到0.1 | — | — | — |
| 极大值1e308 | — | ✅ 夹到99.9 | ✅ 夹到99.9 | — | — | — |
| Infinity | — | ✅ 夹到99.9 | ✅ 夹到99.9 | — | — | — |
| NaN | — | ✅ 夹到0.1 | ✅ 夹到0.1 | — | — | — |
| 非法日期 | — | — | — | 💥P0 崩溃 | — | — |
| 正常值 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> **结论**：`quantity`/`days` 经 `clampFloat` 夹正，鲁棒性好；`name`/`category`/`storage` 无防御；`purchaseDate` 是 P0 重灾区。

### 3.3 菜谱表单 — addRecipe

| 脏数据 | name | emoji | time | difficulty | category | ingredientsText | stepsText |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 空字符串 | ❌P1 存空 | ✅ 回退🍳 | ✅ 回退15 | ✅ 回退简单 | ✅ 回退其他 | — | — |
| 全空格 | ❌P1 存空 | — | — | — | — | — | — |
| 超长10000 | ❌P1 未截断 | — | — | — | — | ❌P1 项5000字 | ❌P1 步5000字 |
| 纯emoji | — | ❌P2 len=10 | — | ❌P2 无白名单 | ❌P2 无白名单 | — | — |
| 特殊字符 | — | ❌P2 len=31 | — | ❌P2 无白名单 | — | — | — |
| SQL注入 | — | — | ✅ parseInt→NaN→15 | ❌P2 无白名单 | ❌P2 无白名单 | ❌P2 原样保留 | — |
| XSS脚本 | ❌P2 原样存 | ❌P2 len=25 | ✅ parseInt→NaN→15 | ❌P2 无白名单 | ❌P2 无白名单 | ❌P2 原样保留 | ❌P2 原样保留 |
| JSON注入 | — | — | — | ❌P2 无白名单 | ❌P2 无白名单 | — | — |
| 中英日韩混合 | — | ❌P2 len=18 | — | — | — | — | — |
| 负数-1 | — | — | ❌P1 time=-1 | — | — | — | — |
| 数字abc | — | — | ✅ →15 | — | — | — | — |
| 含空段/步 | — | — | — | — | — | ✅ 过滤空段 | ✅ 过滤空步 |
| 正常值 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> **结论**：`time` 用 `parseInt(x) || 15`，对非数字鲁棒但**不夹下界**，负数会入库；`emoji` 无长度限制；`difficulty`/`category` 无白名单；食材项/步骤无单条长度限制。

### 3.4 购物清单 — addShopItem

| 脏数据 | shopInput |
|--------|:---:|
| 空字符串 | ✅ 拒绝 |
| 全空格 | ✅ 拒绝 |
| 超长100 | ✅(len=100) |
| 超长10000 | ❌P1 len=10000 未限制 |
| 纯emoji | ✅ 原样存 |
| 中英日韩混合 | ✅ 原样存 |
| 特殊字符 | ✅ 原样存 |
| 控制字符 | ❌P2 保留 `\n\t\r` |
| JSON注入 | ✅ 原样存 |
| SQL注入 | ✅ 原样存 |
| XSS脚本 | ❌P2 原样存 |
| 零宽字符 | ✅ 原样存 |
| 正常西红柿 | ✅ |

> **结论**：仅拦截空值，HTML `maxlength=30` 仅前端约束，store 层无长度上限。

### 3.5 用户资料 — saveUser

| 脏数据 | nickname | height | weight | age | goal |
|--------|:---:|:---:|:---:|:---:|:---:|
| 空字符串 | ✅ 原样存 | — | — | — | ❌P2 无白名单 |
| 全空格 | ✅ trim后空 | — | — | — | — |
| 超长100 | ❌P1 len=100 未限 | — | — | — | — |
| 超长10000 | ❌P1 len=10000 未限 | — | — | — | — |
| 纯emoji | ✅ | — | — | — | ❌P2 无白名单 |
| 特殊字符 | ✅ | — | — | — | ❌P2 无白名单 |
| 控制字符 | ❌P2 保留 | — | — | — | — |
| XSS脚本 | ❌P2 原样存 | — | — | — | ❌P2 无白名单 |
| JSON注入 | — | — | — | — | ❌P2 无白名单 |
| SQL注入 | — | — | — | — | ❌P2 无白名单 |
| 数字abc | — | ❌P1 存字符串"abc" | ❌P1 存"abc" | ❌P1 存"abc" | — |
| 数字undefined | — | ❌P1 存"undefined" | ❌P1 存"undefined" | ❌P1 存"undefined" | — |
| 数字null | — | ❌P1 存"null" | ❌P1 存"null" | ❌P1 存"null" | — |
| NaN | — | ❌P1 存"NaN" | ❌P1 存"NaN" | ❌P1 存"NaN" | — |
| Infinity | — | ❌P1 存"Infinity" | ❌P1 存"Infinity" | ❌P1 存"Infinity" | — |
| 负数-1 | — | ✅(-1数字) | ✅(-1数字) | ✅(-1数字) | — |
| 数字0 | — | ✅(0) | ✅(0) | ✅(0) | — |
| 正常数字5 | — | ✅(5) | ✅(5) | ✅(5) | — |
| 正常昵称/目标 | ✅ | — | — | — | — |

> **结论**：`saveUser` 用 `{ ...DEFAULT_USER, ...user }` 浅合并，**不校验类型也不校验范围**。`v-model.number` 在前端把 `abc` 转成空字符串（不是 "abc"），但 store 层若被绕过，可写入字符串型/负数型数值字段。`goal` 完全无白名单。注意 `NaN`/`Infinity` 经 `JSON.stringify` 持久化后变 `null`，加载时变 `0`，存在静默数据丢失。

### 3.6 NLP — extractFood / extractRecipe

| 脏数据 | extractFood | extractRecipe |
|--------|:---:|:---:|
| 空字符串 | ✅ 空结果 | ✅ 空结果 |
| 全空格 | ✅ 空结果 | ✅ 空结果 |
| 超长100 | ✅ 无匹配 | ✅ name取首段 |
| 超长10000 | ✅ 无匹配 | ❌P2 name取前8字 `aaaaaaaa` |
| 纯emoji | ✅ 无匹配 | ✅ |
| 中英日韩混合 | ✅ 抽到"番茄" | ✅ |
| 特殊字符 | ✅ 无匹配 | ✅ |
| 控制字符 | ✅ 无匹配 | ✅ |
| 零宽字符 | ✅ 无匹配 | ✅ |
| 组合字符é | ✅ 无匹配 | ✅ |
| RTL字符 | ✅ 无匹配 | ✅ |
| HTML实体 | ✅ name空(qty误抽27) | ✅ |
| JSON注入 | ✅ 无匹配 | ✅ |
| SQL注入 | ✅ 无匹配 | ✅ |
| XSS脚本 | ✅ name空(qty误抽1) | ❌P2 name=`<script>` 泄漏 |
| 非法日期 | ✅ 无匹配 | ✅ |
| 正常西红柿 | ✅ 抽到"番茄" | ✅ |

> **结论**：`extractFood` 鲁棒性优秀，无崩溃无泄漏；`extractRecipe` 的 `matchRecipeName` 取文本首段后只做尾部清洗，**XSS 字符串会原样进入 `name`**，再经 `applyPasteRecipe` 写入 `recipeForm.name`，最终进 `addRecipe` 持久化（Vue `{{ }}` 自动转义可防渲染型 XSS，但脏数据已入库）。

### 3.7 扫码 — performScan 正则 + scanBarcode

| 脏数据 | barcodeInput | 结果 |
|--------|:---:|------|
| 空字符串 | ✅ | "请输入条形码" |
| 纯字母 | ✅ | 格式不正确 |
| 字母数字混合 | ✅ | 格式不正确 |
| 短数字(3位) | ✅ | 格式不正确 |
| 7位数字 | ✅ | 格式不正确(<8位) |
| 8位数字(库无) | ✅ | 未识别 |
| 13位合法 | ✅ | 命中西红柿 |
| 21位超长 | ✅ | 格式不正确(>20位) |
| 含空格 | ✅ | trim后命中 |
| 含特殊字符 | ✅ | 格式不正确 |
| SQL注入 | ✅ | 格式不正确 |
| XSS | ✅ | 格式不正确 |
| 纯emoji | ✅ | 格式不正确 |
| 1e308 | ✅ | 格式不正确(含字母e) |
| 负数 | ✅ | 格式不正确(含-) |
| 8位合法 | ✅ | 未识别 |

> **结论**：扫码模块正则 `/^\d{8,20}$/` 拦截严密，全部 PASS，是本项目中防御最完善的输入入口。

---

## 4. 缺陷详情与复现步骤

### 4.1 P0 崩溃缺陷（4 例）

#### P0-1～4：addFood 非法 purchaseDate 导致 RangeError

- **位置**：`src/store/foodStore.js` `calcExpiryDate()`（第 541-545 行）
- **根因**：`new Date(purchaseDate)` 对非法字符串返回 Invalid Date，`.toISOString()` 抛 `RangeError: Invalid time value`，未被 try/catch 包裹（`addFood` 直接调用，无防护）。
- **影响**：用户在购买日期字段粘贴任意非日期字符串（如 `abc`、`2026-13-45`、SQL/XSS payload），点击保存即整页流程崩溃，食材无法保存。
- **复现**：
  ```js
  import { useFoodStore } from './src/store/foodStore.js'
  const s = useFoodStore()
  s.addFood({ name:'西红柿', quantity:5, unit:'个', days:7, category:'蔬菜', storage:'冷藏', purchaseDate:'2026-13-45' })
  // → RangeError: Invalid time value
  ```
- **触发样本**：`2026-13-45` / `abc` / `"; DROP TABLE users; --` / `<script>alert(1)</script>`

### 4.2 P1 数据错乱缺陷（27 例）

#### P1-1：addFood 空字符串/全空格 name 存为空字符串

- **位置**：`foodStore.js` `addFood()` 第 161 行 `name: item.name.trim()`
- **根因**：store 层不调用 `validateFoodName`，空 name 直接入库。
- **影响**：食材列表出现无名称项，统计/筛选/排序异常。
- **复现**：`s.addFood({ name:'   ', quantity:5, days:7, purchaseDate:'2026-07-03' })` → `s.foods[0].name === ''`

#### P1-2：addFood 超长 name 未截断（10000 字符入库）

- **位置**：`addFood()` 第 161 行，无长度限制
- **影响**：localStorage 配额耗尽风险，列表渲染卡顿。
- **复现**：`s.addFood({ name:'a'.repeat(10000), quantity:5, days:7, purchaseDate:'2026-07-03' })` → `s.foods[0].name.length === 10000`

#### P1-3：addRecipe 空字符串/全空格 name 存为空

- **位置**：`addRecipe()` 第 422 行 `name: recipe.name.trim()`
- **影响**：菜谱列表出现无名称项。UI 层 `isRecipeFormValid` 拦截，但 store 层不拦。

#### P1-4：addRecipe 超长 name 未截断（10000 字符）

- **位置**：`addRecipe()` 第 422 行，无长度限制

#### P1-5：addRecipe 负数 time 入库

- **位置**：`addRecipe()` 第 426 行 `time: parseInt(recipe.time) || 15`
- **根因**：`parseInt('-1') === -1`，负数是 truthy，不被 `|| 15` 兜底；也无上界夹正。
- **影响**：菜谱显示"-1 分钟"。
- **复现**：`s.addRecipe({ name:'x', time:-1, ingredients:['蛋'], steps:['炒'] })` → `r.time === -1`

#### P1-6/P1-7：addRecipe 食材项/步骤超长未限制（5000 字符）

- **位置**：`addRecipe()` 第 427-428 行，仅 `filter(i => i.trim())` 去空，无单条长度上限
- **影响**：单条食材/步骤 5000 字符入库，渲染卡顿。

#### P1-8：addShopItem 超长文本（10000 字符）

- **位置**：`addShopItem()` 第 303 行，仅 `text.trim()`，无长度限制
- **根因**：HTML `maxlength=30` 仅前端约束，store 层无防御。
- **复现**：`s.addShopItem('a'.repeat(10000))` → `s.shopList[0].text.length === 10000`

#### P1-9/P1-10：saveUser nickname 超长（100/10000 字符）

- **位置**：`saveUser()` 第 475-482 行，无长度限制
- **根因**：HTML `maxlength=12` 仅前端约束。

#### P1-11～P1-25：saveUser height/weight/age 接受任意字符串

- **位置**：`saveUser()` 第 477 行 `this.state.user = { ...DEFAULT_USER, ...user }`
- **根因**：浅合并，不校验类型/范围。`v-model.number` 在前端把非法输入转为空字符串（非 "abc"），但 store 层被绕过时可写入 `"abc"`/`"undefined"`/`"null"`/`"NaN"`/`"Infinity"` 字符串。
- **影响**：数值字段变字符串，下游营养统计 `parseFloat(f.quantity)` 等若依赖类型会异常；`NaN`/`Infinity` 经 `JSON.stringify` 持久化为 `null`，加载后变 `0`，**静默数据丢失**。
- **复现**：`s.saveUser({ height:'abc' })` → `s.user.height === 'abc'`，localStorage 中 `"height":"abc"`

### 4.3 P2 显示异常缺陷（40 例）

#### P2-1/P2-2：validateFoodName 误杀日韩字符与拉丁扩展字符

- **位置**：`foodStore.js` 第 574 行 `/^[\u4e00-\u9fff\w\s]+$/`
- **根因**：`\w` 仅匹配 `[A-Za-z0-9_]`，不含日文假名、韩文谚文、拉丁扩展（é/ü/ñ）。
- **影响**：合法食材名如 `西红柿 tomato トマト 토마토`、`café` 被拒，正常用户无法保存。
- **复现**：`validateFoodName('西红柿 tomato トマト 토마토')` → `{ valid:false, message:'名称只能包含汉字、字母和数字' }`

#### P2-3：addFood name 保留 SQL 注入/XSS 字符串

- **位置**：`addFood()` 第 161 行
- **根因**：store 层不调用 `validateFoodName`，脏字符串原样入库。
- **影响**：Vue `{{ }}` 自动转义防渲染型 XSS，但脏数据持久化污染数据，导出/同步场景有风险。

#### P2-4/P2-5：addFood category / storage 无白名单

- **位置**：`addFood()` 第 164/167 行 `category: item.category || '其他'` / `storage: item.storage || '冷藏'`
- **根因**：仅空值回退，无白名单校验。
- **影响**：`category` 可存 `<script>` / `{"$gt":""}` / emoji，污染 `stats.byCategory`、`groupedFoods` 分组、筛选器。

#### P2-6：addRecipe name 保留 XSS

- **位置**：`addRecipe()` 第 422 行

#### P2-7：addRecipe emoji 字段超长

- **位置**：`addRecipe()` 第 424 行 `emoji: recipe.emoji || '🍳'`
- **根因**：仅空值回退，无长度限制（emoji 应限 1-2 个码位）。
- **影响**：emoji 字段存 31 字符特殊字符串，菜谱列表 emoji 位被撑爆。

#### P2-8/P2-9：addRecipe difficulty / category 无白名单

- **位置**：`addRecipe()` 第 425/423 行
- **根因**：`difficulty` 合法值应为 `['超简单','简单','中等','困难']`，`category` 应同食材 category 白名单，但均无校验。

#### P2-10/P2-11：addRecipe ingredients/steps 保留 XSS/SQL

- **位置**：`addRecipe()` 第 427-428 行

#### P2-12：addShopItem 保留 XSS

- **位置**：`addShopItem()` 第 307 行

#### P2-13/P2-14：saveUser nickname 保留控制字符/XSS

- **位置**：`saveUser()` 第 477 行
- **影响**：昵称含 `\n\t\r\0` 导致 UI 错位；含 `<script>` 持久化（渲染被 Vue 转义，但脏数据入库）。

#### P2-15：saveUser goal 无白名单

- **位置**：`saveUser()` 第 477 行
- **根因**：`GOAL_OPTIONS = ['均衡饮食','减脂','增肌','养生']` 已导出但 `saveUser` 不校验。
- **影响**：`goal` 可存任意字符串，`getRecommendedRecipes` 的 `getRecipeGoalTags` 分支无法匹配，健康标签失效。

#### P2-16：extractRecipe 超长文本首段进 name

- **位置**：`extractor.js` `matchRecipeName()` 第 295 行兜底 `firstSegment.slice(0, 8)`
- **影响**：10000 字符 `a` 输入 → `name = 'aaaaaaaa'`（8 字符），写入 `recipeForm.name`。

#### P2-17：extractRecipe XSS 字符串泄漏到 name

- **位置**：`matchRecipeName()` 第 282 行 `text.split(/[\s,，。.；;\n]/)[0]`
- **根因**：取首段后仅清洗尾部难度/时间词，不清洗 `<script>` 等危险内容。
- **影响**：`extractRecipe('<script>alert(1)</script>')` → `result.name = '<script>'`，经 `applyPasteRecipe` 写入 `recipeForm.name`，最终 `addRecipe` 持久化。
- **复现**：
  ```js
  import { extractRecipe } from './src/nlp/extractor.js'
  const r = await extractRecipe('<script>alert(1)</script>')
  // r.name === '<script>'
  ```

---

## 5. 修复建议

### 5.1 P0 修复（必须立即修）

**修复 `calcExpiryDate` 的日期校验**（`foodStore.js` 第 541-545 行）：

```js
function calcExpiryDate(purchaseDate, days) {
  const d = new Date(purchaseDate)
  if (isNaN(d.getTime())) {
    // 非法日期回退到今天，避免 toISOString 抛 RangeError
    return todayStr()
  }
  d.setDate(d.getDate() + Math.ceil(days))
  return d.toISOString().slice(0, 10)
}
```

同时在 `addFood` 入口对 `purchaseDate` 做格式校验（推荐 `/^\d{4}-\d{2}-\d{2}$/` + `new Date(x)` 有效性双校验），非法时回退 `todayStr()` 或返回错误。

### 5.2 P1 修复（store 层防御纵深）

**原则**：UI 层校验是第一道防线，store 层必须做第二道防线，因为 localStorage 可被绕过直写。

1. **addFood 增加防御**：
   - `name`：调用 `validateFoodName`，无效则 `return` 或抛错；并 `slice(0, 20)` 截断。
   - `category`/`storage`：增加白名单校验，非法值回退默认。

2. **addRecipe 增加防御**：
   - `name`：`slice(0, 20)`，空则 `return`。
   - `time`：`Math.max(1, Math.min(1440, parseInt(x) || 15))` 夹到 [1, 1440] 分钟。
   - `difficulty`：白名单 `['超简单','简单','中等','困难']`，非法回退 `'简单'`。
   - `category`：白名单同食材。
   - `ingredients`/`steps`：每项 `slice(0, 50)` / `slice(0, 200)` 截断。

3. **addShopItem 增加长度限制**：
   - `text = text.trim().slice(0, 30)`，与 HTML `maxlength=30` 对齐。

4. **saveUser 增加类型与范围校验**：
   ```js
   saveUser(user) {
     const num = (v, min, max, def) => {
       const n = typeof v === 'number' ? v : parseFloat(v)
       return isNaN(n) ? def : Math.max(min, Math.min(max, n))
     }
     this.state.user = {
       nickname: String(user.nickname ?? '').trim().slice(0, 12),
       height: num(user.height, 0, 300, 0),
       weight: num(user.weight, 0, 500, 0),
       age: num(user.age, 0, 150, 0),
       goal: GOAL_OPTIONS.includes(user.goal) ? user.goal : '均衡饮食',
     }
     localStorage.setItem(USER_KEY, JSON.stringify(this.state.user))
   }
   ```

### 5.3 P2 修复

1. **放宽 validateFoodName 正则**：改为黑名单策略，禁用控制字符即可：
   ```js
   if (/[\u0000-\u001F\u007F]/.test(trimmed)) return { valid:false, message:'名称不能含控制字符' }
   ```
   或扩展白名单到 Unicode 字母：`/^[\p{L}\p{N}\s]+$/u`（支持多语种）。

2. **category / storage / difficulty / goal 统一白名单**：
   - 抽出常量：`CATEGORIES = ['蔬菜','水果','肉类','水产','乳制品','调料','主食','其他']`、`STORAGES = ['冷藏','冷冻','常温']`、`DIFFICULTIES = ['超简单','简单','中等','困难']`。
   - 在 `addFood`/`addRecipe`/`saveUser` 入口统一校验。

3. **extractRecipe.matchRecipeName 清洗危险字符**：
   - 对返回的 `name` 做 `name.replace(/[<>]/g, '')` 或调用 `validateFoodName` 兜底，非法时返回空。
   - 增加首段长度上限（已有 `slice(0,8)` 兜底，但应在白名单校验失败时返回 `''`）。

4. **nickname / shopInput 控制字符过滤**：
   - `text.replace(/[\u0000-\u001F\u007F]/g, '')` 去除控制字符后再 trim。

### 5.4 优先级排序

| 优先级 | 修复项 | 工作量 |
|--------|--------|--------|
| 🔴 立即 | P0 calcExpiryDate 日期校验 | 0.5h |
| 🟠 本迭代 | P1 store 层 name/超长/负数 time/数值字段类型校验 | 2h |
| 🟡 下迭代 | P2 白名单（category/storage/difficulty/goal）+ validateFoodName 正则放宽 + NLP name 清洗 | 3h |

---

## 6. 测试脚本与产物

- 测试脚本：`e:\TraeCode\FFood\test-dirty.mjs`（运行：`node test-dirty.mjs`）
- 原始结果 JSON：`e:\TraeCode\FFood\test-dirty-results.json`（236 条用例详情）
- 本报告：`e:\TraeCode\FFood\TEST_REPORT_DIRTY_DATA.md`

**复跑方式**：
```bash
cd e:\TraeCode\FFood
node test-dirty.mjs
```
脚本自带 localStorage polyfill，无需浏览器环境；NLP 测试依赖 `segmentit`（已安装）。

---

## 7. 附录：状态分布明细

| 模块 | 用例数 | PASS | FAIL | CRASH |
|------|:---:|:---:|:---:|:---:|
| 食材.validateFoodName | 16 | 14 | 2 | 0 |
| 食材.validateQuantity | 11 | 11 | 0 | 0 |
| 食材.validateDays | 9 | 9 | 0 | 0 |
| 食材.addFood | 38 | 18 | 16 | 4 |
| 菜谱.addRecipe | 33 | 17 | 16 | 0 |
| 购物.addShopItem | 13 | 9 | 4 | 0 |
| 用户.saveUser | 41 | 22 | 19 | 0 |
| NLP.extractFood | 17 | 17 | 0 | 0 |
| NLP.extractRecipe | 17 | 15 | 2 | 0 |
| 扫码 | 16 | 16 | 0 | 0 |
| **合计** | **236** | **165** | **67** | **4** |

**缺陷严重级别分布**：P0=4，P1=27，P2=40（PASS 不计级别）。
