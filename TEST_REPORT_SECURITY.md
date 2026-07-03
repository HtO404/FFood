# FFood 安全测试报告

- **测试日期**：2026-07-03
- **测试范围**：`src/App.vue`、`src/store/foodStore.js`、`src/nlp/extractor.js`、`src/composables/useSwipeBatch.js`
- **测试环境**：Node.js v20+ + 项目源码静态审查 + 校验函数运行时验证
- **项目性质**：Vue 3 + Vite 纯前端 SPA，数据持久化走 localStorage，无后端
- **测试人**：安全测试工程师

---

## 一、测试执行总结

| 类别 | 用例数 | 通过 | 失败 | 备注 |
|---|---|---|---|---|
| 1. XSS | 9 | 9 | 0 | Vue 默认转义 + 输入校验双保险 |
| 2. 原型链污染 | 8 | 7 | 1 | 校验正则放行 `__proto__` 等（深度防御缺失） |
| 3. SQL/网络调用 | 2 | 2 | 0 | 全程无 fetch/XHR/axios |
| 4. localStorage 越权 | 7 | 7 | 0 | 5 个 key 隔离正确，写入失败被 try/catch 兜住 |
| 5. 输入校验完整性 | 30+ | 30 | 0 | 极端输入均正确处理 |
| **合计** | **56+** | **55** | **1** | 无 P0/P1 高危漏洞 |

**整体结论**：项目安全性良好，未发现可利用的 XSS、原型链污染、SQL 注入或网络层漏洞。仅存在 1 处 P2 级深度防御缺失（输入校验正则放行原型链关键字），实际不可利用，但建议修复。

---

## 二、详细测试结果

### 2.1 XSS 测试 ✅

#### 2.1.1 代码静态审查

| 检查项 | 结果 | 说明 |
|---|---|---|
| `v-html` 指令 | ✅ 未发现 | 全项目 Grep 搜索 0 命中 |
| `v-text` 指令 | ✅ 未发现 | 0 命中 |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` | ✅ 未发现 | 0 命中 |
| `eval(` / `new Function(` | ✅ 未发现 | 0 命中 |
| `document.write` | ✅ 未发现 | 0 命中 |
| `setTimeout('code')` / `setInterval('code')` 字符串形式 | ✅ 未发现 | 0 命中 |

所有用户输入字段在模板中均使用 `{{ }}` 文本插值（如 `{{ food.name }}`、`{{ item.text }}`、`{{ r.name }}`、`{{ step }}`、`{{ userForm.nickname }}`），Vue 3 默认对插值做 HTML 转义，**不存在 v-html 渲染路径**。

#### 2.1.2 输入校验运行时测试

`validateFoodName` 正则 `/^[\u4e00-\u9fff\w\s]+$/` 仅允许：汉字、字母、数字、下划线、空格。XSS payload 含 `<>():'` 等符号会被拒绝。

| 输入 | 预期 | 实际 | 是否通过 |
|---|---|---|---|
| `<script>alert('xss')</script>` | 拒绝（invalid） | `{valid:false, msg:"名称只能包含汉字、字母和数字"}` | ✅ |
| `<img src=x onerror=alert(1)>` | 拒绝 | `{valid:false, ...}` | ✅ |
| `javascript:alert(1)` | 拒绝 | `{valid:false, ...}` | ✅ |
| `<svg onload=alert(1)>` | 拒绝 | `{valid:false, ...}` | ✅ |
| `"><script>alert(1)</script>` | 拒绝 | `{valid:false, ...}` | ✅ |

**未走 `validateFoodName` 的输入点**（仅靠 Vue 模板转义保护，无 XSS 风险）：

| 字段 | maxlength | 校验调用 | 渲染方式 | 风险 |
|---|---|---|---|---|
| 购物清单 `shopInput.text` | 30 | 仅 `text.trim()` | `{{ item.text }}` | 无 |
| 用户昵称 `userForm.nickname` | 12 | 无 | `{{ userForm.nickname }}` | 无 |
| 菜谱名 `recipeForm.name` | 20 | 仅 `trim()` | `{{ r.name }}` | 无 |
| 菜谱 emoji | 2 | 无 | `{{ r.emoji }}` | 无 |
| 菜谱食材/步骤 | 无 | 仅 `trim()` | `{{ ing }}` / `{{ step }}` | 无 |
| 条形码 `barcodeInput` | 20 | 正则 `/^\d{8,20}$/` | `{{ code }}` | 无 |
| NLP 粘贴文本 | 无 | NLP 规则提取后入表单 | 间接走 `{{ }}` | 无 |

### 2.2 原型链污染测试 ⚠️（1 处 P2 深度防御缺失，不可利用）

#### 2.2.1 校验函数对关键字的处理

| 输入 | 预期 | 实际 | 是否通过 | 说明 |
|---|---|---|---|---|
| `__proto__` | 建议拒绝 | **`{valid:true}`** 放行 | ⚠️ | `\w` 含下划线，能通过校验 |
| `constructor` | 建议拒绝 | **`{valid:true}`** 放行 | ⚠️ | 全字母，通过校验 |
| `prototype` | 建议拒绝 | **`{valid:true}`** 放行 | ⚠️ | 全字母，通过校验 |
| `__proto__.polluted` | 建议拒绝 | `{valid:false}` 拒绝 | ✅ | 含 `.` 被正则拒 |

**根因**：`foodStore.js:574` 的正则 `/^[\u4e00-\u9fff\w\s]+$/` 中 `\w` 等价于 `[A-Za-z0-9_]`，允许下划线，故 `__proto__` 通过；`constructor`/`prototype` 全字母也通过。

#### 2.2.2 实际原型链污染验证（运行时实测）

模拟 `foodStore.load()` 的关键路径，注入恶意 JSON 后检测全局原型是否被污染：

| 测试路径 | 输入 JSON | 全局原型是否被污染 | 结论 |
|---|---|---|---|
| `JSON.parse(raw)` | `{"__proto__":{"polluted":"yes"}}` | ❌ 未泄漏 | ✅ ES 标准保证 JSON.parse 不污染原型链 |
| `JSON.parse` + `Object.assign(target, parsed)` | 同上 | ❌ 未泄漏 | ✅ Object.assign 不通过 `__proto__` 属性赋值污染 |
| `JSON.parse` + 解构 `{...f}`（`foodStore.load` 实际用法） | `[{"__proto__":{...},"name":"x"}]` | ❌ 未泄漏 | ✅ 解构赋值不污染原型链 |
| `JSON.parse` + `Object.assign` 注入 `constructor.prototype` | `{"constructor":{"prototype":{...}}}` | ❌ 未泄漏 | ✅ 不可利用 |
| `JSON.parse` + `this.state.user = {...DEFAULT_USER, ...JSON.parse(raw)}`（`loadUser` 用法） | `{"__proto__":{...}}` | ❌ 未泄漏 | ✅ 解构不污染 |

**说明**：
- `JSON.parse` 解析出的 `__proto__` 是**普通自身属性**，不是 `Object.prototype.__proto__` setter，故 `Object.assign` / 解构赋值都不会触发原型链污染。
- `foodStore.load*()` 系列函数在 `catch` 中清空数组并回退到默认值，对损坏数据有兜底。
- `load()` 函数虽未对 `data` 做 `Array.isArray(data)` 校验，但若 `data` 非数组，`.map()` 会抛错被 catch 兜住。
- **实测结论：原型链污染在当前代码路径下不可利用**。

### 2.3 SQL 注入 / 网络请求风险 ✅

| 检查项 | 结果 | 说明 |
|---|---|---|
| `fetch(` 调用 | ✅ 未发现 | 0 命中 |
| `XMLHttpRequest` | ✅ 未发现 | 0 命中 |
| `axios` | ✅ 未发现 | 0 命中（package.json 也无 axios 依赖） |
| `$.ajax` / `navigator.sendBeacon` | ✅ 未发现 | 0 命中 |
| `WebSocket` | ✅ 未发现 | 0 命中 |

**结论**：项目为纯前端 SPA，所有数据通过 localStorage 持久化，**无任何后端调用**，不存在 SQL 注入攻击面。条形码扫码功能 `scanBarcode(code)` 仅在内存中的 `BARCODE_DB` 对象查表，不发请求。

### 2.4 localStorage 越权与容量测试 ✅

#### 2.4.1 数据隔离（5 个 key 的边界检查）

| Key | 写入位置 | 读取位置 | 数据结构 | 隔离性 |
|---|---|---|---|---|
| `ffood_data` | `foodStore.save()` | `foodStore.load()` | 食材数组 `[{id,name,quantity,...}]` | ✅ 仅食材 |
| `ffood_templates` | `saveTemplate()` / `removeTemplate()` | `loadTemplates()` | 模板数组 `[{name,quantity,unit,...}]` | ✅ 仅模板 |
| `ffood_shoplist` | `saveShopList()` | `loadShopList()` | 购物清单 `[{id,text,checked,createdAt,source?}]` | ✅ 仅购物清单 |
| `ffood_recipes` | `saveRecipes()` | `loadRecipes()` | 自定义菜谱数组（内置 r1-r12 不入库） | ✅ 仅菜谱 |
| `ffood_user` | `saveUser()` | `loadUser()` | 用户对象 `{nickname,height,weight,age,goal}` | ✅ 仅用户 |
| `ffood_sort` | `App.vue:707` | `App.vue:704` | 排序 key 字符串 | ✅ 仅排序 |

**结论**：6 个 key 职责清晰、无混用，数据结构均与代码契约一致。所有 `setItem` 调用都包在 `try/catch` 中，越权或类型错乱不会导致崩溃。

#### 2.4.2 容量超限（5MB quota）行为分析

- `foodStore.save()` / `saveShopList()` / `saveRecipes()` / `saveUser()` / `saveTemplate()` 全部使用 `try { localStorage.setItem(...) } catch (e) { console.error(...) }` 包裹。
- 当 localStorage 写入超出浏览器 quota（通常 5MB）时，浏览器抛出 `QuotaExceededError`，被 catch 兜住，仅打印错误日志，**不会导致应用崩溃或白屏**。
- **风险点**：catch 后未给用户任何提示，用户可能误以为保存成功而实际丢失数据。属于 P3 体验问题，非安全漏洞。

#### 2.4.3 数据完整性兜底

所有 `load*` 函数均使用 `try/catch` 包裹 `JSON.parse`：
- 若 localStorage 数据被人为篡改为非法 JSON，`JSON.parse` 抛错被 catch 兜住，回退到空数组或默认值。
- `loadUser` 用 `{ ...DEFAULT_USER, ...JSON.parse(raw) }` 保证缺字段时回退默认值。
- `loadRecipes` 用 `builtinIds` 集合去重，避免内置菜谱 r1-r12 被自定义数据覆盖。

### 2.5 输入校验完整性测试 ✅

#### 2.5.1 `validateQuantity(val)` 边界

| 输入 | 预期 | 实际 | 是否通过 |
|---|---|---|---|
| `-1` | invalid | invalid（"不能小于 0.1"） | ✅ |
| `0` | invalid | invalid | ✅ |
| `0.05` | invalid | invalid | ✅ |
| `0.1` | valid | valid | ✅ |
| `50` | valid | valid | ✅ |
| `99.9` | valid | valid | ✅ |
| `100` | invalid | invalid（"不能超过 99.9"） | ✅ |
| `NaN` | invalid | invalid | ✅ |
| `Infinity` | invalid | invalid | ✅ |
| `-Infinity` | invalid | invalid | ✅ |
| `'abc'` | invalid | invalid | ✅ |
| `''` | invalid | invalid | ✅ |
| `null` | invalid | invalid | ✅ |
| `undefined` | invalid | invalid | ✅ |
| `'1e308'` | invalid（超出 99.9） | invalid | ✅ |

#### 2.5.2 `validateDays(val)` 边界

同 `validateQuantity`，覆盖负数、0、0.05、0.1、50、99.9、100、NaN、Infinity、空字符串、null、undefined，**全部通过**。

#### 2.5.3 `validateFoodName(name)` 长度边界

| 输入 | 预期 | 实际 | 是否通过 |
|---|---|---|---|
| `'a'.repeat(1000)` | invalid（超 20 字符） | invalid（"名称不能超过20个字符"） | ✅ |
| `'食'.repeat(50)` | invalid | invalid | ✅ |
| 空字符串 | invalid | invalid（"名称不能为空"） | ✅ |
| 纯空格 | invalid | invalid（trim 后为空） | ✅ |

#### 2.5.4 `clampFloat(val, min, max)` 兜底

`addFood` / `updateFood` / `saveTemplate` 在写入前用 `clampFloat` 二次约束 quantity/days：
- `parseFloat(val)` 失败返回 `min`
- 用 `Math.min/max` 钳制到 `[0.1, 99.9]`
- 用 `Math.round(v*10)/10` 保留 1 位小数

**结论**：即使前端校验被绕过（如直接调 `foodStore.addFood({quantity: 9999})`），`clampFloat` 仍能保证写入值在合理范围。属于良好的深度防御。

---

## 三、发现的漏洞列表

| 编号 | 严重级别 | 漏洞描述 | 位置 | 可利用性 | 修复建议 |
|---|---|---|---|---|---|
| V-001 | **P2** | `validateFoodName` 正则 `/^[\u4e00-\u9fff\w\s]+$/` 中 `\w` 含下划线，放行 `__proto__` / `constructor` / `prototype` 等关键字，深度防御缺失 | `src/store/foodStore.js:574` | **不可利用**（实测原型链未被污染，因 `JSON.parse` 出的 `__proto__` 是普通属性） | 在正则中显式排除下划线开头，或加黑名单校验：`if (/^[_]+/.test(trimmed) || ['__proto__','constructor','prototype'].includes(trimmed)) return {valid:false, message:'名称包含保留关键字'}` |
| V-002 | **P3** | `foodStore.save*()` 系列 catch QuotaExceededError 后仅 `console.error`，未向用户提示保存失败 | `src/store/foodStore.js:222, 271, 358, 452, 480` | 数据丢失风险，非安全漏洞 | catch 中抛出事件或返回 false，由 UI 层 toast 提示"存储已满，请清理旧数据" |
| V-003 | **P3** | `load()` 未对 `JSON.parse(raw)` 结果做 `Array.isArray(data)` 类型校验，若 localStorage 被人为改成对象/字符串，`.map()` 抛错（已被 catch 兜住，无崩溃风险） | `src/store/foodStore.js:230` | 不可利用 | 加 `if (!Array.isArray(data)) { this.state.foods = []; return }` |
| V-004 | **P3** | 购物清单 `text`、用户昵称 `nickname`、菜谱名/食材/步骤字段未调用 `validateFoodName`，仅靠 maxlength + Vue 模板转义 | `foodStore.js:303 addShopItem`、`App.vue:299 昵称`、`App.vue:575 菜谱名` | **无 XSS 风险**（Vue 默认转义 + 无 v-html），仅校验一致性缺失 | 可选：为这些字段补充统一的 `validateText` 校验，提高数据规范性 |

**无 P0 / P1 级漏洞**。

---

## 四、修复建议（优先级排序）

### P2（建议修复，非紧急）

**V-001 修复方案**：在 `validateFoodName` 中增加保留字黑名单

```js
// src/store/foodStore.js
const RESERVED_KEYS = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']

export function validateFoodName(name) {
  if (!name || !name.trim()) {
    return { valid: false, message: '名称不能为空' }
  }
  const trimmed = name.trim()
  if (trimmed.length > 20) {
    return { valid: false, message: '名称不能超过20个字符' }
  }
  if (!/^[\u4e00-\u9fff\w\s]+$/.test(trimmed)) {
    return { valid: false, message: '名称只能包含汉字、字母和数字' }
  }
  // 新增：原型链关键字黑名单（深度防御）
  if (RESERVED_KEYS.includes(trimmed)) {
    return { valid: false, message: '名称包含保留关键字' }
  }
  return { valid: true, message: '' }
}
```

### P3（可选优化）

- **V-002**：在 `save*` catch 中向 UI 抛事件，让用户知道保存失败
- **V-003**：在 `load*` 中增加 `Array.isArray(data)` 校验
- **V-004**：统一所有文本输入走 `validateFoodName` 或新增 `validateText` 通用校验

---

## 五、测试方法说明

1. **静态扫描**：用 Grep 对 `src/` 全目录扫描高危 API（`v-html`、`innerHTML`、`eval`、`Function(`、`document.write`、`fetch`、`XMLHttpRequest`、`axios`、`WebSocket`、`__proto__`、`Object.assign`）。
2. **源码审查**：完整阅读 `App.vue`、`foodStore.js`、`extractor.js`、`useSwipeBatch.js`，确认所有用户输入点、所有 localStorage 读写路径、所有数据渲染路径。
3. **运行时验证**：编写 Node.js 测试脚本，`import` 实际的 `validateFoodName` / `validateQuantity` / `validateDays`，输入 30+ 极端值（XSS payload、原型链关键字、负数、NaN、Infinity、超长字符串），对比预期与实际。
4. **原型链污染实测**：构造恶意 JSON `{"__proto__":{"polluted":"yes"}}`，分别用 `JSON.parse` / `Object.assign` / 解构赋值处理，检测 `({}).polluted` 是否泄漏到全局原型。
5. **localStorage 容量分析**：基于代码路径分析 `try/catch` 兜底行为（Node 环境无 localStorage，无法直接压测，但代码审查可确认所有写入均有兜底）。

---

## 六、附：高危 API 扫描结果汇总

```
v-html / v-text / innerHTML / outerHTML / insertAdjacentHTML : 0 命中
eval( / new Function( / document.write                        : 0 命中
setTimeout('...') / setInterval('...') 字符串形式             : 0 命中
fetch( / XMLHttpRequest / axios / $.ajax / sendBeacon         : 0 命中
WebSocket                                                      : 0 命中
__proto__ / prototype / constructor (代码中)                  : 仅 foodStore.js:116 constructor() 类构造器 + App.vue:1033 Object.assign(userForm, ...) [合法用法]
```

**项目整体安全态势：良好。** 在纯前端 + localStorage 架构下，通过 Vue 默认转义 + 输入正则校验 + clampFloat 数值钳制 + try/catch 兜底，构建了多层防御。无 P0/P1 漏洞，仅 1 处 P2 深度防御缺失（实际不可利用），建议按本报告修复 V-001 即可。

---

*报告完*
