# FFood 响应式适配全面修复 — 测试报告

> 修复主题：复选 / 长按多选 / 左滑删除 / 批量工具栏 / modal 等 iOS16 组件在 320–1024px 全分辨率下的适配
> 修复日期：2026-07-03
> 验证方式：`npm run build` 通过（exit 0）+ dev server 实跑 + CSS 规则确定性推演（每个分辨率下精确计算命中哪条 media query 及最终尺寸）

---

## 1. 修改文件清单

| 文件 | 修改类型 | 说明 |
|---|---|---|
| `src/styles/ios16.css` | 编辑 | 新增 `@media (max-width: 380px)` 中间档；扩展 `@media (max-width: 360px)` 与 `@media (min-width: 769px)` 两块 |
| `src/composables/useSwipeBatch.js` | 编辑 | `SWIPE_THRESHOLD` 由常量 `-64` 改为按 `window.innerWidth` 动态计算的 `computed`（-52 / -60 / -64 三档）；新增 `SWIPE_LIMIT` 同步动态化（-66 / -74 / -90）；加 `resize` 监听 |

> 业务逻辑零改动，只动 CSS 与滑动阈值常量。App.vue / store / nlp 全部未触碰。

---

## 2. 修复前后对比

### 复选框 `.select-checkbox` / `.checkbox-icon`（原疑点 #1 #2）
| 屏宽 | 修复前 | 修复后 |
|---|---|---|
| ≤360px | 24×24（偏大挤压内容） | **20×20** font 12px |
| 361–380px (iPhone 8/SE3 375) | 24×24 | **22×22** font 13px |
| 381–768px | 24×24 | 24×24（默认，不变） |
| ≥769px (iPad) | 24×24（偏小不易点） | **28×28** font 16px |

`.shop-check`（购物清单圆圈）同步适配：≤360 → 20×20，≥769 → 26×26。

### 左滑删除区 `.swipe-actions`（原疑点 #3）
| 屏宽 | 修复前 (food/recipe) | 修复后 | 修复前 (shop) | 修复后 |
|---|---|---|---|---|
| ≤360px | 80px（320屏占 25%） | **56px**（占 17.5%） | 72px | **52px** |
| 361–380px | 80px | **64px** | 72px | 72px（默认） |
| 默认 | 80px | 80px | 72px | 72px |

### 滑动触发阈值 `SWIPE_THRESHOLD`（原疑点 #3）
| 屏宽 | 修复前 | 修复后 | 对应 swipe-actions 宽 |
|---|---|---|---|
| ≤360px | -64（与 80px 不匹配，小屏需滑过远） | **-52** | 56px |
| 361–380px | -64 | **-60** | 64px |
| 默认 | -64 | -64 | 80px |

拖动最大距离 `SWIPE_LIMIT` 同步：-66 / -74 / -90（带约 10px 过冲），避免小屏拖出大片空白红底。

### 批量工具栏 `.batch-toolbar-inner`（原疑点 #4）
| 屏宽 | 修复前 | 修复后 |
|---|---|---|
| ≤360px | gap 8px / padding 10px 14px / btn font 15px / btn padding 7px 14px | **gap 6px / padding 8px 10px / btn font 13px / btn padding 6px 10px** |
| 默认 | 同上 | 不变 |

### 卡片 padding（原疑点 #5 #6）
| 屏宽 | .food-card | .recipe-item-card | .shop-item-card |
|---|---|---|---|
| ≤360px 修复前 | 14px 16px | 14px 16px | gap 12px / padding 12px 14px |
| ≤360px 修复后 | **12px 14px** | **12px 14px** | **gap 8px / padding 10px 12px** |

### FAB（原疑点 #9）
| 屏宽 | 修复前 right | 修复后 right |
|---|---|---|
| ≤360px | 16px（max(16px, calc(...)) 在 <480px 屏解析为 16px） | **12px** |
| 默认 | 16px | 16px |
| ≥769px | 居中 calc | 居中 calc（不变） |

### Modal（原疑点 #8）
| 屏宽 | 修复前 | 修复后 |
|---|---|---|
| ≤360px | padding-top --spacing-md(12px)、title font 20px、actions padding 16px 22px 24px、form-input 44px | padding-top --spacing-sm(10px)、**title font 16px**、**actions padding 10px 12px 16px gap 6px**、**form-input 40px** |

modal-sheet `max-height: 90vh` 在 320×568 = 511px，配合上述收紧，标题+输入+按钮完整可见，超出时 body 内部滚动。

---

## 3. 分辨率 × 组件 检查矩阵

> 命中档位说明：A=≤360px 档，B=≤380px 中间档，D=默认档，L=大屏档(≥769px)，LS=横屏档(landscape & max-height:500px)
> ✅ = 通过  ⚠️ = 可接受（与原设计一致或非本次范围）  ❌ = 失败

### 3.1 竖屏手机

| 设备 | 宽×高 | 命中档 | 复选框 | 左滑删除 | 批量工具栏 | 卡片密度 | FAB | Modal | nav/sort/chip | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| iPhone SE 1 | 320×568 | A | ✅ 20×20 | ✅ 56px / 阈值-52 | ✅ font13 不换行 | ✅ padding 12px14 | ✅ right 12px | ✅ 90vh=511px 够用 | ✅ 横向滚动 | ✅ |
| iPhone 8 / SE 3 | 375×667 | B | ✅ 22×22 | ✅ 64px / 阈值-60 | ✅ 默认 font15 | ✅ 默认 | ✅ 16px | ✅ | ✅ | ✅ |
| Samsung S23 | 360×780 | A | ✅ 20×20 | ✅ 56px / 阈值-52 | ✅ font13 | ✅ padding 12px14 | ✅ 12px | ✅ | ✅ | ✅ |
| iPhone 12/13/14 | 390×844 | D | ✅ 24×24 | ✅ 80px / 阈值-64 | ✅ | ✅ | ✅ 16px | ✅ | ✅ | ✅ |
| iPhone 14 Pro / 15 | 393×852 | D | ✅ 24×24 | ✅ 80px / -64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xiaomi 14 | 393×873 | D | ✅ 24×24 | ✅ 80px / -64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| iPhone 14 Plus / Pro Max | 428×926 | D | ✅ 24×24 | ✅ 80px / -64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OPPO/vivo 中端 | 412×915 | D | ✅ 24×24 | ✅ 80px / -64 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 平板竖屏

| 设备 | 宽×高 | 命中档 | 复选框 | 左滑删除 | 批量工具栏 | 卡片密度 | FAB | Modal | app 居中 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| iPad Mini | 744×1133 | D | ✅ 24×24 | ✅ 80px / -64 | ✅ | ✅ | ✅ | ✅ | ✅ max-width 480 居中 | ✅ |
| iPad Pro 11 | 834×1194 | L | ✅ 28×28 易点 | ✅ 80px / -64 | ✅ | ✅ | ✅ 60×60 | ✅ 520px | ✅ max-width 520 居中 | ✅ |
| iPad Pro 12.9 | 1024×1366 | L | ✅ 28×28 | ✅ 80px / -64 | ✅ | ✅ | ✅ | ✅ | ✅ 520 居中 | ✅ |

### 3.3 横屏

| 设备 | 宽×高 | 命中档 | 复选框 | 左滑删除 | 批量工具栏 | TabBar | FAB | Modal | 结论 |
|---|---|---|---|---|---|---|---|---|---|
| 横屏 iPhone 14 | 844×390 | L + LS | ✅ 28×28 | ✅ 80px / -64 | ✅ | ✅ 44px 压缩 | ✅ 50×50 | ✅ 95vh=371px | ✅ |
| 横屏 iPad | 1194×834 | L | ✅ 28×28 | ✅ 80px / -64 | ✅ | ✅ 64px | ✅ 60×60 | ✅ | ✅ |

---

## 4. 关键回归项（第4步清单）

| 验证项 | 结果 | 说明 |
|---|---|---|
| 320×568 复选框可点不挤 | ✅ | 20×20 复选框 + food-card padding 12px14，单卡内容宽 ≈ 320−2×10(app)−2×14−20 = 252px，足够放名称+到期徽章 |
| 320×568 批量工具栏不换行 | ✅ | 4 按钮 + flex:1 info，按钮 white-space:nowrap，font 13px / padding 6px10，估算总宽 ≈ 230px < 248px 可用 |
| 320×568 左滑删除可触发 | ✅ | swipe-actions 56px，阈值 -52，拖动上限 -66；只需滑 52px 即触发（原 64px） |
| 320×568 modal 完整显示 | ✅ | max-height 90vh=511px；title 16px / actions padding 收紧 / form-input 40px；body 超长时内部滚动 |
| 390×844 默认体验良好 | ✅ | 命中默认档，所有尺寸与原设计一致 |
| 428×926 大屏不空旷 | ✅ | app max-width 480 居中，两侧留白均匀；复选框 24×24 默认 |
| 744×1133 iPad 居中 | ✅ | app max-width 480 居中（744<769 未进大屏档） |
| 844×390 横屏紧凑 | ✅ | 大屏档 + 横屏档叠加：复选框 28×28、TabBar 44px、FAB 50×50、modal 95vh |

---

## 5. 技术实现要点

### 5.1 media query 顺序（关键）
`@media (max-width: 380px)` 必须置于 `@media (max-width: 360px)` **之前**。CSS 同特异性规则后定义者胜，因此 ≤360px 屏两块都命中，由后定义的 360px 块覆盖 380px 块，得到更小的 20×20 / 56px；361–380px 屏只命中 380px 块，得到中间值 22×22 / 64px。

### 5.2 shop swipe-actions 特异性
`.shop-item-wrapper .swipe-actions`（特异性 0,2,0）默认 72px。在 ≤360px 块内用同特异性选择器覆盖为 52px（后定义胜）。在 380px 中间档**未**覆盖 shop（按规格只动通用 `.swipe-actions`），故 361–380px 屏 shop 仍 72px，与默认阈值 -60 配合（reveal 60/72px），比例合理。

### 5.3 SWIPE_THRESHOLD 动态化
- 改为 `computed`，依赖 `viewportWidth` ref
- `onMounted` 注册 `resize` 监听，`onUnmounted` 注销
- `cardStyle` / `touchEnd` 改用 `SWIPE_THRESHOLD.value`
- 新增 `SWIPE_LIMIT` computed 用于 `touchMove` 拖动上限，替代硬编码 `-90`
- `useSwipeBatch` 在 `<script setup>` 内调用，生命周期钩子正常绑定

### 5.4 未触碰项
- 业务逻辑、store、nlp、App.vue 模板与 script 全部未改
- iOS16 设计语言（毛玻璃、圆角、iOS 系统色、卡片阴影）完整保留
- 默认档（381–768px）尺寸零改动，保证主流机型体验不回归

---

## 6. 构建验证

```
> ffood@1.0.0 build
> vite build
✓ 17 modules transformed.
dist/assets/index-CLFSjomr.css   40.30 kB │ gzip:  7.42 kB
dist/assets/index-DNE5wXA-.js    149.95 kB │ gzip: 53.20 kB
✓ built in 1.42s
```

exit code 0，无错误。`segmentit` chunk >500kB 警告为既有问题（第三方分词库），与本次改动无关。

---

## 7. 实机验证指引

dev server 已启动：`http://localhost:3001/`（5173 被占用，vite 自动切到 3001）。

打开 DevTools → Device Toolbar，依次切换下列分辨率重点观察：
1. **iPhone SE (320×568)**：长按食材进多选 → 复选框 20×20 不挤；左滑 → 56px 删除区，滑 52px 触发；批量工具栏 4 按钮一行不换行；点 + 打开 modal 标题+输入+按钮完整。
2. **iPhone 8 (375×667)**：复选框 22×22，swipe 64px。
3. **iPhone 12 (390×844)**：默认档，与原体验一致。
4. **iPad Pro 11 (834×1194)**：复选框 28×28 易点，app 520px 居中。
5. **横屏 iPhone 14 (844×390)**：TabBar 44px 紧凑，modal 95vh。
