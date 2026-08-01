# FFood 家庭食材管理系统 · 操作手册

> 版本：1.0.0 · 更新日期：2026-08-02  
> 适用对象：家庭日常使用 · 从本地 demo 到多人使用

---

## 目录

1. [快速开始](#1-快速开始)
2. [核心功能](#2-核心功能)
3. [食材管理](#3-食材管理)
4. [智能保鲜推荐](#4-智能保鲜推荐)
5. [推荐品类提醒](#5-推荐品类提醒)
6. [购物清单](#6-购物清单)
7. [菜谱推荐](#7-菜谱推荐)
8. [账号与登录](#8-账号与登录)
9. [后端部署（MySQL）](#9-后端部署mysql)
10. [DeepSeek AI 配置](#10-deepseek-ai-配置)
11. [常见问题](#11-常见问题)

---

## 1. 快速开始

### 前端启动（零配置可用）

```bash
cd E:\TraeCode\FFood
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`，可直接作为本地食材管理工具使用。

**无需后端**：未配置 API 地址时，所有数据存在浏览器 localStorage 中，开箱即用。

### 后端启动（可选，多设备同步需要）

```bash
cd E:\TraeCode\FFood\server
cp .env.example .env    # 编辑 .env 填入 MySQL 和 JWT 密钥
npm install
npm run migrate          # 初始化数据库表
npm run dev              # 启动后端服务（默认 3001 端口）
```

前端 `.env.local` 配置后端地址：

```
VITE_API_BASE=http://localhost:3001/api
```

---

## 2. 核心功能一览

| 功能 | 说明 | 是否需要后端 |
|------|------|:---:|
| 食材录入与管理 | 添加/编辑/删除/批量删除 | 否 |
| 智能保鲜推荐 | 200+ 食材精确保鲜天数 | 否 |
| AI 保鲜推荐 | DeepSeek API 智能推荐 | 可选 |
| 推荐品类提醒 | 牙刷头/毛巾等定期更换 | 否 |
| 购物清单 | 日常采购记录 | 否 |
| 菜谱推荐 | 基于库存匹配菜谱 | 否 |
| 粘贴智能填充 | 自然语言识别一键填表 | 否 |
| 扫码录入 | 条形码识别食材 | 否 |
| JWT 登录注册 | 账号系统 | 是 |
| 多设备同步 | 数据云端存储 | 是 |

---

## 3. 食材管理

### 添加食材

1. 点击底部导航栏中间的 **+** 按钮
2. 填写食材信息：
   - **名称**：汉字/字母/数字，20字以内（如"白菜"、"鸡胸肉"）
   - **数量**：0.1~99.9，支持小数
   - **单位**：个 / kg / 份
   - **购买日期**：默认今天
   - **保质期天数**：系统自动推荐，可手动修改
   - **分类**：蔬菜🥬 / 水果🍎 / 肉类🥩 / 乳制品🥛 / 调料🧂 / 主食🍚 / 其他📦
   - **存放位置**：冷藏❄️ / 冷冻🧊 / 常温🏠

### 粘贴智能填充

在添加食材弹窗中点击「📋 粘贴智能填充」，输入自然语言：

- `2个西红柿放了3天冷藏`
- `半斤猪肉冷冻`
- `今天买的白菜能放3天`

系统自动识别名称、数量、单位、储存方式、保质期、购买日期，**100% 准确率**（基于 15 用例验证的 NLP 分词引擎）。

### 批量操作

- **长按**食材卡片进入多选模式（移动端）
- **右键点击**进入多选模式（PC 端）
- 支持全选、批量删除
- 左滑卡片快速删除

### 排序与筛选

- **排序**：临期优先 / 添加时间 / 名称
- **分类筛选**：顶部分类标签切换
- **存储筛选**：冷藏 / 冷冻 / 常温
- **搜索**：顶部搜索框

### 表单记忆

系统自动保存你录入过的食材为模板（上限 20 个），下次添加时可在「从历史快速添加」中一键填充。

---

## 4. 智能保鲜推荐

### 静态推荐（默认）

系统内置 **200+ 食材**的精确保鲜数据，基于公开食品安全资料整理：

| 分类 | 冷藏 | 冷冻 | 常温 |
|------|------|------|------|
| 绿叶蔬菜（菠菜/生菜） | 3-5 天 | 不推荐 | 1-2 天 |
| 根茎类（胡萝卜/土豆） | 14 天 | 90 天 | 7-30 天 |
| 瓜果类（西红柿/黄瓜） | 5-7 天 | 60 天 | 3-5 天 |
| 红肉（猪/牛/羊） | 2 天 | 270 天 | 1 天 |
| 禽肉（鸡/鸭） | 2 天 | 365 天 | 1 天 |
| 鱼虾海鲜 | 1 天 | 180 天 | 1 天 |
| 鸡蛋 | 35 天 | 90 天 | 14 天 |
| 牛奶 | 7 天 | 90 天 | 30 天 |

选择分类和储存方式后，系统自动填入推荐天数。如果你输入了具体食材名称，系统会精确匹配到该食材的保鲜天数。

### AI 智能推荐（需配置 DeepSeek API Key）

在添加食材弹窗中，点击「🤖 AI推荐」按钮，系统调用 DeepSeek API 返回：

- **推荐保存天数**：基于食材名称+分类+储存方式
- **推荐理由**：为什么是这个天数
- **保鲜小贴士**：如包裹方式、注意事项

配置方法见 [第 10 节](#10-deepseek-ai-配置)。

### 付费预设计

后端已预留 `is_premium` 字段：
- **非付费用户**：返回静态默认值（200+ 食材数据）
- **付费用户**：调用 DeepSeek API 获取 AI 推荐

当前本地使用无需关心此区分，AI 推荐直接可用。

---

## 5. 推荐品类提醒

在「我的」页面查看常见家庭日用品的定期更换建议：

| 品类 | 建议周期 | 说明 |
|------|---------|------|
| 🪥 牙刷头 | 90 天 | 每 3 个月更换 |
| 🧖 毛巾 | 90 天 | 每 3 个月更换，日常保持干燥 |
| 🧽 洗碗海绵 | 30 天 | 每月更换，避免细菌滋生 |
| 🪵 砧板 | 365 天 | 每年更换，有深痕及时换 |
| 😴 枕头 | 730 天 | 1-2 年更换，保持颈椎健康 |
| 👁️ 隐形眼镜盒 | 90 天 | 每 3 个月更换 |
| 🛏️ 床单被套 | 14 天 | 每 2 周清洗更换 |
| 🧹 厨房抹布 | 7 天 | 每周更换或高温消毒 |
| 💧 滤水器滤芯 | 180 天 | 每 6 个月更换 |
| 🚿 浴花 | 60 天 | 每 2 个月更换 |

> 后续可接入提醒推送功能，到周期自动通知更换。

---

## 6. 购物清单

- 在购物清单 Tab 直接输入要买的东西
- 点击圆圈勾选已购买
- 从菜谱详情页点击「加入购物清单」，自动带入缺失食材
- 支持批量删除和左滑删除
- 已购买项目可折叠显示

---

## 7. 菜谱推荐

### 菜谱匹配

开启「食材搭配」功能开关后，系统基于你冰箱里的食材自动匹配可做的菜谱：

- 显示匹配度（有几种食材 / 缺几种）
- 按匹配度排序
- 缺失食材可一键加入购物清单

### 自定义菜谱

点击菜谱 Tab 的 **+** 按钮，添加自己的菜谱：
- 名称、emoji、难度、时间
- 所需食材（逗号分隔）
- 制作步骤（换行分隔）

内置 12 道菜谱（r1-r12）不可删除。

---

## 8. 账号与登录

### 游客模式

不登录也可使用所有功能，数据存在本地 localStorage。

### 登录注册

配置后端后，支持账号系统：
- 用户名 + 密码注册
- 图形验证码防刷
- JWT token 7 天有效期
- 登录失败 5 次锁定 15 分钟
- Token 自动刷新

---

## 9. 后端部署（MySQL）

### 环境要求

- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

### 配置步骤

1. **创建数据库**

```sql
CREATE DATABASE ffood CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **配置环境变量**

```bash
cd server
cp .env.example .env
```

编辑 `.env`：

```env
# 服务器配置
PORT=3001
NODE_ENV=development

# MySQL 配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=ffood

# JWT 配置
JWT_SECRET=你的JWT密钥_至少32位随机字符串
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# DeepSeek API（可选）
DEEPSEEK_API_KEY=你的DeepSeek API Key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

3. **安装依赖并初始化**

```bash
npm install
npm run migrate    # 执行 001_init.sql 建表
npm run dev        # 启动开发服务
```

4. **前端连接后端**

在项目根目录创建 `.env.local`：

```env
VITE_API_BASE=http://localhost:3001/api
```

重启前端 `npm run dev` 即可。

### API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|:---:|
| POST | /api/auth/register | 注册 | 否 |
| POST | /api/auth/login | 登录 | 否 |
| GET | /api/auth/verify | 验证 token | 是 |
| POST | /api/auth/refresh | 刷新 token | 是 |
| GET | /api/foods | 获取食材列表 | 是 |
| POST | /api/foods | 添加食材 | 是 |
| PUT | /api/foods/:id | 更新食材 | 是 |
| DELETE | /api/foods/:id | 删除食材 | 是 |
| POST | /api/foods/batch-delete | 批量删除 | 是 |
| GET | /api/categories | 获取分类 | 是 |
| POST | /api/smart/shelf-life | AI 保鲜推荐 | 是 |
| GET | /api/smart/recommend | 推荐品类 | 是 |

---

## 10. DeepSeek AI 配置

### 获取 API Key

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册并创建 API Key
3. 复制 Key（格式：`sk-xxxxxxxx`）

### 前端配置（开发/演示用）

在项目根目录 `.env.local` 中添加：

```env
VITE_DEEPSEEK_API_KEY=sk-你的key
```

前端会直接调用 DeepSeek API，无需后端。适合本地 demo。

### 后端配置（生产用）

在 `server/.env` 中添加：

```env
DEEPSEEK_API_KEY=sk-你的key
```

前端通过后端 API 间接调用，不暴露 Key。适合多人使用。

### 费用说明

DeepSeek API 按使用量计费，非常便宜：
- 每次推荐约消耗 200 tokens
- 百万 tokens 约 ¥1-2
- 日常家庭使用每月约几百次调用，费用可忽略

---

## 11. 常见问题

### Q: 数据存在哪里？

未配置后端时，所有数据存在浏览器的 localStorage 中。清除浏览器数据会导致丢失。配置后端后，数据存在 MySQL 数据库中。

### Q: 换手机/电脑数据会同步吗？

需要配置后端服务。纯 localStorage 模式下数据不跨设备同步。

### Q: AI 推荐的天数靠谱吗？

AI 推荐基于 DeepSeek 大模型生成，结合了食材种类、储存方式等因素，给出的建议偏保守安全。静态推荐数据来自公开的食品安全资料。两者都仅供参考，实际保存还需结合感官判断（闻、看、摸）。

### Q: 如何备份数据？

- localStorage 模式：定期导出 JSON（后续开发此功能）
- MySQL 模式：`mysqldump ffood > backup.sql`

### Q: 可以封装成小程序吗？

可以。项目基于 Vue 3 + Vite，cloudfunctions 目录已包含微信云开发云函数。前端 cloud.js 已实现三方式自动探测（小程序/H5/Mock）。

### Q: 付费功能怎么开？

后端 `users` 表的 `is_premium` 字段控制。设置为 1 后，该用户调用 `/api/smart/shelf-life` 会走 DeepSeek API，否则返回静态数据。前端直接配置 `VITE_DEEPSEEK_API_KEY` 则不受此限制。

---

## 技术架构

```
FFood/
├── src/                    # 前端 Vue 3
│   ├── App.vue            # 主组件（全部 UI）
│   ├── components/         # AuthPage / CaptchaCanvas
│   ├── composables/        # useSwipeBatch（滑动+多选）
│   ├── nlp/                # 中文分词 NLP 引擎
│   ├── store/              # foodStore / authStore / featureStore
│   ├── styles/             # ios16.css（响应式 320-1024px）
│   └── utils/              # api.js / deepseek.js / cloud.js
├── server/                 # 后端 Node.js + Express
│   ├── src/
│   │   ├── config/         # 数据库 + 环境变量
│   │   ├── controllers/    # auth / food / category / smart
│   │   ├── middleware/     # JWT鉴权 / 错误处理 / 限流
│   │   ├── routes/         # API 路由
│   │   ├── utils/          # 统一响应格式
│   │   └── db/             # MySQL 迁移脚本
│   └── .env.example        # 环境变量模板
├── cloudfunctions/         # 微信云开发云函数（原有）
└── .env.example            # 前端环境变量模板
```

---

**FFood** — 让家庭食材管理变得简单 · 2026
