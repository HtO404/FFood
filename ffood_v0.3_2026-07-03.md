# FFood v0.3 — 迭代记录

**时间:** 2026-07-03  
**Commit:** `595c3ba`

---

## 本次变更

对照 FFood.md 新增需求（单位系统、日期双栏、记忆习惯）全部实现。

### 1. 数量单位系统

| 变更 | 内容 |
|------|------|
| 单位 | 个 / kg / 份 三选一 |
| UI | 数量输入框 + 胶囊式单位选择器（iOS 分段控件风格） |
| Store | `food.unit` 字段，默认 `'个'` |
| 列表 | 展示 `数量 + 单位`（如 `1.5 kg`） |

### 2. 日期双栏模式

| 变更 | 内容 |
|------|------|
| 左栏 | 购买日期（`<input type="date">`，不超过今天） |
| 右栏 | 保质期天数（0.1-99.9）+ "天"后缀 |
| 预览 | 绿色卡片实时计算：「📅 到期日：2026/7/10」 |
| Store | `food.purchaseDate` + `food.expiryDate` + `food.days` |

### 3. 表单记忆（模板）

| 变更 | 内容 |
|------|------|
| 存储 | localStorage key `ffood_templates` |
| 触发 | 每次 `addFood()` 成功后自动存入 |
| 去重 | 同名+同分类+同单位 → 更新 lastUsed |
| 上限 | 最多 20 条，LRU |
| UI | 弹窗顶部显示最近 6 条模板 chip，点击一键回填 |
| 删除 | 每个 chip 右侧 ✕ 可单独删除 |

### 4. BugFix

- `validateQuantity` / `validateDays` 与 import 同名冲突 → 改为 `checkQuantity` / `checkDays` + 本地 `validateQty()` / `validateDayField()`

## 构建结果

```
✓ vite build — 814ms, 零错误
dist/index.html           0.74 kB
dist/assets/index-*.css  13.37 kB
dist/assets/index-*.js   86.22 kB
```

## TODO

- [ ] 浏览器 UI 截图验证（xbrowser 策略受限）
- [ ] P1 特性评估（批量操作、统计面板、推送提醒）
- [ ] Git remote 配置 & push
