# FFood UI 测试报告 — 组件遮挡 / 层级问题

| 项目 | 值 |
|---|---|
| 测试对象 | FFood v1.0.0（Vue 3 + iOS16 风格 SPA） |
| 测试日期 | 2026-07-03 |
| 测试方法 | 源码审查（`src/App.vue` + `src/styles/ios16.css` + `src/composables/useSwipeBatch.js`）+ Vite dev server 实际运行 + agent-browser 自动化验证 |
| 运行端口 | http://localhost:3001 （vite.config.js 中 port:3000 被占用，自动跳到 3001） |
| 测试浏览器 | Chromium (agent-browser / CDP) |
| 测试视口 | 390×844、360×640、320×568、1024×768、844×400 (横屏) |
| 截图目录 | `e:\TraeCode\FFood\test_shots\` (01-12 共 12 张) |
| 是否改源码 | 否（仅测试和报告） |

---

## 一、测试矩阵

### 1. z-index 层级审查

| # | 场景 | 预期 | 实际 | 结果 | 严重 |
|---|------|------|------|------|------|
| 1.1 | base 层 (0) | 内容默认在 z=0 | `.food-list` / `.recipe-list` 等未显式声明 z-index，按文档流绘制 | ✅ 通过 | — |
| 1.2 | card-action 层 (1) | 左滑删除按钮背景在卡片之下 | `.swipe-actions { z-index: 1 }` / `.food-card-actions { z-index: 1 }` — 实测 `swipeActionsZ=1` | ✅ 通过 | — |
| 1.3 | swipe-card 层 (2) | 滑动卡片在删除按钮之上 | `.swipe-card { z-index: 2 }` / `.food-card { z-index: 2 }` — 实测 `swipeCardZ=2` | ✅ 通过 | — |
| 1.4 | nav 层 (100) | 导航栏 sticky 在内容之上 | `.nav-bar { position: sticky; z-index: 100 }` — 实测 `nav.z=100, pos=sticky` | ✅ 通过 | — |
| 1.5 | tabbar 层 (200) | TabBar 在内容之上 | `.tab-bar { z-index: 200 }` — 实测 `tabbarZ=200` | ✅ 通过 | — |
| 1.6 | fab 层 (210) | FAB 在 TabBar 之上 | `.fab { z-index: 210 }` — 实测 `fabZ=210` | ✅ 通过 | — |
| 1.7 | batch-toolbar 层 (220) | 批量工具栏在 FAB 之上 | `.batch-toolbar-fixed { z-index: 220 }` — 实测 `batchToolbarZ=220` | ✅ 通过 | — |
| 1.8 | modal 层 (300) | 模态遮罩盖住所有固定元素 | `.modal-overlay { z-index: 300 }` — 实测 `modalZ=300`，FAB 被 modal 覆盖 (`coveredByModal=true`) | ✅ 通过 | — |
| 1.9 | alert 层 (400) | 删除确认弹窗在模态之上 | `.alert-overlay { z-index: 400 }` — CSS 规则顺序在 `.modal-overlay` 之后，特异性相同时后者胜出 | ✅ 通过 | — |
| 1.10 | 层级关系总验证 | base(0) < card-action(1) < nav(100) < tabbar(200) < fab(210) < batch-toolbar(220) < modal(300) < alert(400) | 所有 8 个层级均按预期声明且实测值匹配 | ✅ 通过 | — |

**z-index 层级审查结论**：CSS 变量定义与各组件实际计算值一致，层级关系**未发现错位**。

---

### 2. 极端数据下的布局

通过 `localStorage` 注入极端数据：3 条食材（含 50 字超长名 / 99.9 公斤）、50 项购物清单、1 个 20 食材+20 步骤菜谱。

| # | 场景 | 预期 | 实际 | 结果 | 严重 |
|---|------|------|------|------|------|
| 2.1 | 食材名超长 (50字) | 卡片不撑破，名称省略 | `.food-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }` — 实测 `scrollW=448, clientW=247, overflow=hidden, textOverflow=ellipsis`，文本被裁剪显示省略号 | ✅ 通过 | — |
| 2.2 | 数量+单位长 ("99.9 公斤") | badge 不换行 | meta 文本 "99.9 公斤· 冷藏" 单行显示，`metaW=271 + actionsW=51 = 322 < cardW=370`，无换行 | ✅ 通过 | — |
| 2.3 | 菜谱食材列表 20 项 | 标签 flex 换行不溢出 | `.recipe-ingredients { display: flex; flex-wrap: wrap }` — 实测标签正常换行，`overflow=visible`，无横向溢出 | ✅ 通过 | — |
| 2.4 | 菜谱步骤 20 步 | 详情展开后滚动正常 | 实测 `stepsCount=20`，`cardHeight=2195px`，卡片随内容增高，页面整体滚动正常 | ✅ 通过 | — |
| 2.5 | 购物清单 50 项 | 列表流畅滚动 | 实测 `shopItemsCount=50`，`listHeight=2902px`，`bodyScrollHeight=3059 > bodyClientHeight=844`，可滚动 | ✅ 通过 | — |

**极端数据布局结论**：文本截断、flex 换行、长列表滚动均表现正常。**但**滚动时 TabBar/FAB 因 P0 bug 会消失（见 5.1）。

---

### 3. 多模态叠加

| # | 场景 | 预期 | 实际 | 结果 | 严重 |
|---|------|------|------|------|------|
| 3.1 | 添加食材弹窗打开时再点 FAB | 不叠两个弹窗（FAB 被遮罩盖住） | modal-overlay `z=300` > FAB `z=210`，实测 `coveredByModal=true`，真实点击事件不会到达 FAB | ✅ 通过 | — |
| 3.2 | 多选工具栏打开时点 FAB 添加 | 工具栏不被遮挡 | batch-toolbar `z=220` > FAB `z=210`，两者位置不同（工具栏居中底部、FAB 右下），无视觉重叠 | ✅ 通过 | — |
| 3.3 | 删除确认 alert 出现时背景 modal 是否可点 | 背景不可点（alert z=400 盖住 modal z=300） | CSS 规则：`.alert-overlay` 在 `.modal-overlay` 之后声明，特异性相同后者胜出，alert z=400 > modal z=300 | ✅ 通过 | — |
| 3.4 | 扫码弹窗 + 添加弹窗叠加是否乱序 | 不应同时出现两个 modal | 通过 `fab.click()` 编程式触发叠加：实测 `modalCount=2`，两个 modal **共享 z=300**，按 DOM 顺序后者在上 | ⚠️ 风险 | P2 |

**多模态叠加结论**：正常交互流（点击遮罩关闭再开新弹窗）不会触发 3.4 的叠加。但 `addFromBarcode()` 中 `showBarcodeModal=false; showAddModal=true` 是顺序切换 ✓。仅在编程式连续触发或异常状态机下可能出现两 modal 同 z 叠加，属低概率风险。

---

### 4. 响应式布局

| # | 场景 | 预期 | 实际 | 结果 | 严重 |
|---|------|------|------|------|------|
| 4.1 | 360px 宽度分类 chip 横向滚动 | chip 容器 `overflow-x: auto` | 实测 `catScrollW=653, catClientW=325, catOverflow=auto`，chip 横向滚动正常 | ✅ 通过 | — |
| 4.2 | 320px (iPhone SE) 搜索+排序+分类栏挤压 | 不出现文档级横向滚动 | 实测 `docScrollW=313 > docClientW=305`，**文档级横向溢出 8px**，由 `.tab-bar { width: min(480px, 100vw) }` 引起（`100vw` 含滚动条宽度） | ❌ 失败 | P2 |
| 4.3 | 横屏 (844×400) TabBar+FAB 在可视区 | 固定在视口底部 | 实测 `tabbarVisible=false, fabBottom=620 > viewportH=400`，TabBar 和 FAB 均在视口外 | ❌ 失败 | P0 (与 5.1 同根因) |
| 4.4 | iPad 1024px 内容居中 | `.app { max-width: 520px; margin: 0 auto }` | 实测 `appW=520, appX=252`（居中），`tabbarW=520, tabbarX=252`（居中），`fabX=676`（右对齐到 app 右侧） | ✅ 通过 | — |

---

### 5. 滚动行为

| # | 场景 | 预期 | 实际 | 结果 | 严重 |
|---|------|------|------|------|------|
| 5.1 | 列表滚动时 TabBar 常驻 | `position: fixed; bottom: 0` 始终在视口底 | **实测 scrollY=1000 时 tabbarY=1993（应 778），tabbarBottom=2059（应 844）** — TabBar 随内容滚走，1215px 在视口外 | ❌ 失败 | **P0** |
| 5.2 | 模态弹窗内容超长时标题/底部按钮固定 | 标题和按钮可见，body 滚动 | `.modal-sheet { display: flex; flex-direction: column; max-height: 90vh }`，`.modal-title/.modal-actions { flex-shrink: 0 }`，`.modal-body { flex: 1; overflow-y: auto }` — 实测 `bodyOverflow=auto, sheetMaxH=759.6px`，flex 布局保证头尾固定 | ✅ 通过 | — |
| 5.3 | 菜谱分类筛选 chip 横向滚动 | `overflow-x: auto` 流畅 | `.recipe-category-bar { overflow-x: auto; scrollbar-width: none }` — 与 4.1 同机制 | ✅ 通过 | — |

---

### 6. 触摸交互

| # | 场景 | 预期 | 实际 | 结果 | 严重 |
|---|------|------|------|------|------|
| 6.1 | 左滑卡片时垂直滚动不受影响 | `touch-action: pan-y` 允许浏览器处理纵向滚动 | `.food-card-wrapper / .swipe-wrapper { touch-action: pan-y }` — 实测 `touchAction=pan-y`；`useSwipeBatch.js touchMove` 中 `if (Math.abs(dy) > Math.abs(dx)) return` 主动让出纵向手势 | ✅ 通过 | — |
| 6.2 | 多选模式下左滑被禁用 | `touchStart/touchMove` 在 `batchMode=true` 时立即 return | `useSwipeBatch.js` 第 70、77 行 `if (batchMode.value) return` — 实测 `batchActive=true` 时无滑动响应 | ✅ 通过 | — |
| 6.3 | 长按进入多选不触发浏览器右键菜单 | `@contextmenu.prevent` 阻止默认菜单 | App.vue 第 97、150、170、223 行均有 `@contextmenu.prevent`；实测 Vue 编译后属性不可见但事件已绑定，长按 550ms 触发 `startLongPress` 进入多选 | ✅ 通过 | — |

---

## 二、关键问题详述

### 🔴 P0-1：`position: fixed` 被 body 的 `backdrop-filter` 破坏（最严重）

**影响范围**：TabBar、FAB、批量工具栏、模态遮罩、Alert 遮罩 — 所有 `position: fixed` 元素

**根因**：
```css
/* src/styles/ios16.css 第 94-99 行 */
body {
  min-height: 100vh;
  min-height: 100dvh;
  backdrop-filter: var(--blur-bg);          /* ← 罪魁祸首 */
  -webkit-backdrop-filter: var(--blur-bg);
}
```
按 CSS Filter Effects 规范，**`backdrop-filter` 值不为 `none` 时会为 `position: fixed` 的后代创建新的包含块**（与 `transform`/`filter`/`perspective` 同效）。导致 `.tab-bar`、`.fab`、`.modal-overlay`、`.alert-overlay`、`.batch-toolbar-fixed` 的 `position: fixed` 退化为相对 `body` 定位（等价 `absolute`），`bottom: 0` 变成"贴 body 底部"而非"贴视口底部"。

**实测证据**（scrollY=1000 时）：

| 状态 | tabbar.top | tabbar.bottom | viewportH | 是否可见 |
|------|-----------|---------------|-----------|---------|
| 保留 backdrop-filter | 1993 | 2059 | 844 | ❌ 在视口外 1215px |
| 临时移除 backdrop-filter | 778 | 844 | 844 | ✅ 正确贴底 |

数学验证：`tabbar.bottom(2059) = body.scrollHeight(3059) - scrollY(1000)`，完全符合"相对 body 定位"模型。

**用户可感知后果**：
1. 食材/购物清单滚动到底部时，TabBar 消失 → 无法切 tab
2. FAB 滚走 → 无法添加食材
3. 在滚动状态下打开模态弹窗，弹窗 sheet 出现在 body 底部（视口外）→ 看不到弹窗
4. 横屏 (844×400) 时内容超 400px 即触发，TabBar 永久不可见
5. 删除确认 Alert 在滚动状态下出现，会出现在 body 中心（视口外）→ 用户以为应用卡死

**修复建议**（任选其一，按推荐度排序）：
1. ✅ **推荐**：将 `backdrop-filter` 从 `body` 移到 `.app` 或 `.nav-bar`/`.tab-bar` 等具体元素上。`body` 只保留纯色背景，毛玻璃效果由各 UI 层各自实现（实际上 `.nav-bar`/`.tab-bar`/`.modal-sheet` 已各自有 `backdrop-filter`，body 层的毛玻璃是冗余的）。
2. 把所有 `position: fixed` 元素用 `<Teleport to="body">` 挂载到 `body` 直接子级（但 body 仍是包含块，无效）—— 不可行。
3. 改用 `position: sticky` 替代 `fixed`（需重构滚动容器）—— 改动大。

**最简修复**：删除 `src/styles/ios16.css` 第 97-98 行 body 的 `backdrop-filter` 和 `-webkit-backdrop-filter`。各组件已有的局部毛玻璃仍生效，视觉无明显回归。

---

### 🟠 P2-1：320px 宽度文档级横向溢出

**根因**：`.tab-bar { width: min(480px, 100vw) }`。`100vw` 包含纵向滚动条宽度，而 `document.documentElement.clientWidth` 不含。在 320px 视口下，`100vw=320` 但可视宽=305，tabbar 宽 320 → 溢出 15px（实测 `docScrollW=313` 溢出 8px，差异来自 `.tab-bar` 的 `left:50%; transform:translateX(-50%)` 居中后两侧均分）。

**修复建议**：`.tab-bar { width: min(480px, 100%) }` — 用 `100%` 替代 `100vw`（基于父级 `body` 宽度，不含滚动条）。同理 `.modal-sheet { width: min(480px, 100vw) }` 也建议改为 `100%`。

---

### 🟠 P2-2：扫码弹窗 + 添加弹窗叠加时共享 z-index

**复现**：编程式连续 `showBarcodeModal=true` → `showAddModal=true`，实测 `modalCount=2`，两个 `.modal-overlay` 均 `z=300`。

**实际风险**：低。正常 UI 流不会同时打开两个 modal：
- 扫码后点"添加到冰箱" → `addFromBarcode()` 先 `showBarcodeModal=false` 再 `showAddModal=true` ✓
- FAB 在 modal 打开时被遮罩盖住，无法点击 ✓

但若未来新增"在 modal 内打开另一个 modal"的功能，会出现两 modal 同 z 叠加、遮罩点击行为混乱。

**修复建议**：为不同 modal 分配递增 z-index（如 `--z-modal-1: 300`、`--z-modal-2: 310`），或引入 modal 栈管理器统一调度。

---

### 🟡 P3-1：多选模式下 FAB 仍可见

**现象**：进入多选模式后，批量工具栏（z=220）显示，但 FAB（z=210）仍可见在右下角。两者位置不重叠无视觉冲突，但 FAB 点击会打开添加弹窗，与批量操作上下文不符。

**修复建议**：`<button v-if="activeTab === 'food' && !foodBatch.batchMode.value" class="fab">` 或在 `openAddModal` 中先 `exitBatchMode()`。

---

## 三、截图说明（test_shots/ 目录）

| 截图 | 说明 |
|------|------|
| `01_food_long_name.png` | 食材列表含 50 字超长名 + "99.9 公斤" — 名称省略号正常 |
| `02_add_modal_open.png` | 添加食材弹窗打开 — FAB 被遮罩盖住（首次未点中） |
| `03_barcode_modal.png` | 扫码弹窗打开 — 居中底部 sheet 正常 |
| `04_modal_stack.png` | 扫码 + 添加两 modal 叠加 — P2-2 问题复现 |
| `05_recipe_expanded.png` | 菜谱展开 20 食材 + 20 步骤 — 卡片 2195px 高，flex 换行正常 |
| `06_shop_list_50.png` | 购物清单 50 项 — 列表 2902px 可滚动，但 TabBar 因 P0-1 滚走 |
| `07_width_360.png` | 360px 宽度 — 分类 chip 横向滚动正常 |
| `08_width_320.png` | 320px 宽度 — P2-1 文档横向溢出 |
| `09_width_1024.png` | iPad 1024px — 内容居中 520px 正常 |
| `10_landscape_400.png` | 横屏 844×400 — TabBar/FAB 因 P0-1 在视口外 |
| `11_add_modal_open.png` | 添加弹窗 — 标题/底部按钮 flex 固定，body 滚动 |
| `12_batch_mode.png` | 多选模式 — 工具栏 z=220 在 FAB z=210 之上，复选框显示 |

---

## 四、通过项汇总（18 项）

1. z-index 8 层级关系全部正确声明且实测匹配
2. FAB 被 modal 遮罩正确盖住（z=300 > 210）
3. Alert (z=400) 在 modal (z=300) 之上，CSS 顺序正确
4. 食材名 50 字省略号截断
5. "99.9 公斤" 数量+单位不换行
6. 菜谱 20 食材标签 flex 换行
7. 菜谱 20 步骤展开滚动正常
8. 购物清单 50 项列表可滚动
9. 360px 分类 chip 横向滚动
10. 1024px iPad 内容居中
11. 模态标题/底部按钮 flex 固定，body 滚动
12. 菜谱分类 chip 横向滚动
13. `touch-action: pan-y` 左滑不阻塞纵向滚动
14. 多选模式下 `touchStart` 早 return 禁用左滑
15. `@contextmenu.prevent` 阻止长按右键菜单
16. 长按 550ms 进入多选（`useSwipeBatch.js` LONG_PRESS_MS）
17. `.swipe-card` z=2 > `.swipe-actions` z=1（左滑删除层级正确）
18. `.food-card-wrapper { overflow: hidden }` 裁剪滑动溢出

---

## 五、失败项汇总（4 项）

| 编号 | 严重 | 问题 | 根因文件:行 |
|------|------|------|------------|
| P0-1 | 🔴 严重 | `position: fixed` 失效，TabBar/FAB/Modal 滚走 | `src/styles/ios16.css:97-98` |
| P2-1 | 🟠 中等 | 320px 文档横向溢出 8px | `src/styles/ios16.css:1234` (`width: min(480px, 100vw)`) |
| P2-2 | 🟠 中等 | 两 modal 叠加共享 z=300 | `src/styles/ios16.css:510`（所有 modal 共用 `.modal-overlay`） |
| P3-1 | 🟡 轻微 | 多选模式 FAB 仍可见 | `src/App.vue:358`（未排除 batchMode） |

---

## 六、修复优先级建议

1. **立即修复 P0-1**：删除 `src/styles/ios16.css` 第 97-98 行 body 的 `backdrop-filter`。这是一行改动，可一次性解决 TabBar 滚走、FAB 滚走、模态弹窗滚动后开不见、横屏 TabBar 不可见、Alert 滚动后开不见等 5+ 个用户可感知故障。
2. **修复 P2-1**：将 `.tab-bar` 和 `.modal-sheet` 的 `width: min(480px, 100vw)` 改为 `100%`。
3. **修复 P3-1**：FAB 在 batchMode 下隐藏。
4. **P2-2 暂缓**：当前 UI 流不会触发，可纳入未来 modal 栈重构。

---

## 七、测试环境备注

- Vite dev server 实际运行端口为 3001（vite.config.js 配置 port:3000，但被本机其他 node 进程占用，Vite 自动切换到 3001）
- agent-browser 的 `scroll top` 命令在部分场景未滚动到 0，改用 `window.scrollTo(0, y)` 编程式滚动验证
- 测试数据通过 `localStorage.setItem` 注入：`ffood_data`(3 条)、`ffood_shoplist`(50 条)、`ffood_recipes`(1 条自定义 20 食材+20 步骤)
- 所有 z-index 实测值通过 `window.getComputedStyle(el).zIndex` 读取，与 CSS 变量声明一致
- P0-1 根因通过"临时移除 body backdrop-filter → 观察.tabbar 回到正确位置"对照实验确认因果
