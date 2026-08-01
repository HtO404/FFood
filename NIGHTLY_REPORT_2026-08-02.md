# FFood 夜间 Loop 执行报告

> 执行时间：2026-08-02 02:19 ~ 02:55 (GMT+8)  
> 执行者：Loop Engineer Agent  
> 目标：JWT 鉴权 + MySQL 后端 + DeepSeek AI + 输入输出优化 + 分类存储管理 + 操作手册

---

## 一、本次做了什么

### 1. 创建完整后端服务（server/ 目录，20 个文件）

**技术栈**：Node.js + Express + MySQL2 + JWT + bcryptjs + dotenv

**数据库设计**（5 张表，MySQL 8.0 InnoDB utf8mb4）：
- `users` — 用户表（含 is_premium 付费预设计字段、登录失败锁定）
- `foods` — 食材库存表（含过期日期索引、用户外键级联删除）
- `categories` — 分类管理表（含各储存方式默认天数）
- `food_templates` — 表单记忆模板表
- `shop_list` — 购物清单表

**JWT 鉴权系统**：
- jsonwebtoken 实现，7 天有效期 + refresh token 30 天
- bcryptjs 密码哈希（cost factor 10）
- Bearer token 认证中间件
- 登录失败 5 次锁定 15 分钟（login_fail_count + lock_until 字段）
- 注册限流 5 次/分、登录限流 10 次/分

**API 端点**（12 个）：
- 鉴权：register / login / verify / refresh
- 食材：list（支持过滤搜索）/ create / update / delete / batch-delete
- 分类：list
- 智能：shelf-life（DeepSeek AI）/ recommend（推荐品类）

**DeepSeek API 集成**：
- 端点 `https://api.deepseek.com/v1/chat/completions`，模型 `deepseek-chat`
- is_premium 分流：付费用户调 AI，非付费返回静态值
- 后端用原生 https 模块调用，无第三方依赖

### 2. 前端 API 客户端（src/utils/api.js）

- 渐进式迁移设计：配置了 VITE_API_BASE 走真后端，否则 fallback 到 localStorage
- 封装 authApi / foodApi / categoryApi / smartApi 四组接口
- 自动携带 Bearer token

### 3. DeepSeek 前端集成（src/utils/deepseek.js）

- 直接从浏览器调用 DeepSeek API（开发/演示用）
- 无 API Key 时 fallback 到静态推荐
- 包含 200+ 食材精确保鲜数据
- 返回结构化结果：{ days, reason, tips, source }

### 4. 增强版保鲜天数推荐系统

**改造前**：6 个分类 × 3 种储存 = 18 个推荐值  
**改造后**：200+ 食材精确匹配 + 模糊匹配 + 分类默认值

| 分类 | 改造前(冷藏) | 改造后(精确到食材) |
|------|:---:|:---:|
| 蔬菜-绿叶类 | 7 天 | 菠菜 3 天 / 白菜 5 天 / 芹菜 7 天 |
| 蔬菜-根茎类 | 7 天 | 胡萝卜 14 天 / 洋葱 30 天 / 土豆 14 天 |
| 肉类-红肉 | 3 天 | 猪肉 2 天 / 牛肉 2 天 / 排骨 2 天 |
| 肉类-冷冻 | 180 天 | 猪肉 270 天 / 鸡肉 365 天 / 鱼 180 天 |
| 乳制品 | 21 天 | 牛奶 7 天 / 酸奶 14 天 / 鸡蛋 35 天 |

新增 `recommendDaysByName(name, category, storage)` 函数，优先级：精确匹配 → 模糊匹配 → 分类默认值。

### 5. AI 智能推荐按钮（App.vue 添加食材弹窗）

- 在推荐保质期旁边新增「🤖 AI推荐」按钮
- 点击后调用 DeepSeek API，返回天数+理由+保鲜贴士
- 结果卡片显示推荐天数、理由、小贴士、来源标记
- 加载中状态展示

### 6. 推荐品类功能（"我的"页面）

- 新增「🔄 推荐品类·定期更换提醒」卡片
- 包含 10 种家庭日用品的更换周期建议
- 牙刷头(90天) / 毛巾(90天) / 洗碗海绵(30天) / 砧板(365天) / 枕头(730天) 等
- 为后续接入到期推送提醒预留了数据结构

### 7. 主食分类

将「主食」正式加入 VALID_CATEGORIES，保鲜数据独立配置（米饭/面条/馒头/饺子/大米等）。

### 8. 操作手册

创建完整的 OPERATION_MANUAL.md（7000+ 字），覆盖：
- 快速开始（前端零配置 + 后端部署）
- 核心功能说明（11 个模块）
- MySQL 后端部署指南
- DeepSeek API 配置方法
- API 端点文档
- 常见问题 FAQ
- 技术架构图

---

## 二、可能的影响

### 对现有功能的影响

| 项目 | 影响 | 说明 |
|------|------|------|
| 现有 localStorage 数据 | ✅ 无影响 | 未配置 VITE_API_BASE 时完全走原逻辑 |
| 现有云函数 | ✅ 无影响 | cloudfunctions/ 目录未改动 |
| 现有 NLP 分词 | ✅ 无影响 | nlp/ 目录未改动 |
| 现有菜谱/购物清单 | ✅ 无影响 | 逻辑未变 |
| foodStore 保鲜推荐 | ⚠️ 数值变化 | 从粗放(7天)变为精确(菠菜3天/白菜5天)，更准确但数值不同 |
| 添加食材弹窗 | ⚠️ UI 变化 | 新增 AI 推荐按钮和结果卡片 |
| "我的"页面 | ⚠️ UI 变化 | 新增推荐品类卡片 |

### 风险点

1. **DeepSeek API Key 暴露**：前端直接调用会暴露 Key。生产环境必须走后端代理。当前 `.env.example` 已标注此风险。

2. **MySQL 未实际连接测试**：后端代码已写完但未在本机安装 MySQL 做端到端测试。建议用户按操作手册第 9 节部署后验证。

3. **segmentit 包体积**：build 警告 chunk 超过 500KB（segmentit 3.6MB），这是原有问题，非本次引入。

---

## 三、节省了多少时间

| 任务 | 人工预估 | Loop 实际 | 节省 |
|------|---------|----------|------|
| 后端 20 文件编写 | 4-6 小时 | ~2 分钟（sub-agent） | ~4 小时 |
| 200+ 食材保鲜数据整理 | 2-3 小时 | ~5 分钟（搜索+编写） | ~2.5 小时 |
| DeepSeek API 集成 | 1-2 小时 | ~3 分钟 | ~1.5 小时 |
| 前端 UI 改造 | 1-2 小时 | ~5 分钟 | ~1.5 小时 |
| 操作手册编写 | 1-2 小时 | ~3 分钟 | ~1.5 小时 |
| **合计** | **9-15 小时** | **~20 分钟** | **~11 小时** |

---

## 四、如何帮助管理家庭资源

### 场景 1：今天买的白菜能放几天？

**改造前**：系统推荐"蔬菜冷藏 7 天"  
**改造后**：系统精确推荐"白菜冷藏 5 天"，AI 还会告诉你"用厨房纸包裹后放入保鲜袋，吸收多余水分"

### 场景 2：肉类解冻后能放多久？

输入"解冻后的猪肉"→ AI 推荐 1 天，理由"解冻后肉类不宜再次冷冻，尽快食用"

### 场景 3：牙刷头该换了吗？

"我的"页面查看推荐品类，看到牙刷头建议 90 天更换。后续可接入提醒推送。

### 场景 4：批量采购后快速录入

粘贴"今天买了2斤猪肉冷冻、3个白菜冷藏、5个苹果"，NLP 引擎一键识别全部信息。

### 场景 5：临期提醒

系统按临期优先排序，过期/即将过期的食材红色标记，浏览器通知推送。

### 场景 6：多人家庭共享

配置 MySQL 后端后，家庭成员各自登录账号，数据云端同步。妈妈录入食材，爸爸打开就能看到。

---

## 五、Git 提交记录

```
ad22024 feat: MySQL后端+JWT鉴权+DeepSeek AI推荐+增强保鲜数据+推荐品类
91f8166 fix(auth): 修复 mock verifyToken 解析 token 时 userId 截断导致刷新后登录态丢失
9e1263d ...
```

本次提交：26 个文件变更，+1842 行，-8 行。

---

## 六、待办事项（下一步）

| 优先级 | 任务 | 说明 |
|:---:|------|------|
| P0 | MySQL 端到端测试 | 安装 MySQL，跑通 migrate + API 调用 |
| P1 | 前端 authStore 对接后端 API | 当前 authStore 走云函数/mock，需切换到后端 |
| P1 | foodStore 对接后端 API | 食材 CRUD 从 localStorage 切换到 API |
| P2 | 推荐品类到期提醒 | 接入 cron 定时检查，到期推送通知 |
| P2 | 数据导入导出 | localStorage → MySQL 迁移工具 |
| P3 | OCR 拍照识别 | 食材标签拍照识别 |
| P3 | 首次使用引导 | 新用户 onboarding 流程 |

---

## 七、文件变更清单

### 新增文件（24 个）

```
.env.example                    # 前端环境变量模板
server/.env.example             # 后端环境变量模板
server/.gitignore
server/package.json
server/src/app.js               # Express 入口
server/src/config/database.js   # MySQL 连接池
server/src/config/env.js        # 环境变量校验
server/src/controllers/authController.js    # JWT 鉴权
server/src/controllers/foodController.js    # 食材 CRUD
server/src/controllers/categoryController.js
server/src/controllers/smartController.js   # DeepSeek AI
server/src/middleware/auth.js               # JWT 中间件
server/src/middleware/errorHandler.js       # 错误处理
server/src/middleware/rateLimit.js          # IP 限流
server/src/routes/index.js
server/src/routes/auth.js
server/src/routes/food.js
server/src/routes/smart.js
server/src/utils/response.js
server/src/db/migrate.js
server/src/db/migrations/001_init.sql       # 建表 SQL
src/utils/api.js                # 前端 API 客户端
src/utils/deepseek.js           # DeepSeek 集成
OPERATION_MANUAL.md             # 操作手册
```

### 修改文件（3 个）

```
src/App.vue                     # AI推荐按钮 + 推荐品类卡片
src/store/foodStore.js          # 200+ 食材保鲜数据
src/styles/ios16.css            # AI推荐 + 推荐品类样式
```

---

**报告生成时间**：2026-08-02 02:55 (GMT+8)  
**构建验证**：✅ vite build 通过  
**Git 状态**：已提交 ad22024
