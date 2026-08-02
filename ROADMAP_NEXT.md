# FFood 下一阶段路线图（夜间自动执行）

> 基于 2026-08-02 走查完成后的技术债排序。每阶段：先 L1 报告 → 实现 → 验证 → git commit。全部完成后输出次晨报告。
> 优先级依据：安全红线 > 核心价值 > 质量基建 > 功能补全 > 性能收尾

---

## 阶段 A：多设备同步闭环（真后端启用）⭐ 最高优先

**现状**：MySQL 后端 20 文件就绪 + 本地 5.7 测试 9/9 通过，但前端默认走 localStorage，`VITE_API_BASE` 从未启用——多设备同步（PRD P2 遗留项）实际未通。

**任务**：
1. `server/.env` 配置本地 MySQL 连接（root/123456, 端口 3306）
2. 前端 `.env.local` 配 `VITE_API_BASE=http://127.0.0.1:3000/api`
3. 注册 → 登录 → 添加食材 → 验证 MySQL 落库（users/foods 表）
4. 第二个浏览器窗口（隐身）登录同账号，验证数据互通
5. token 过期自动刷新链路验证（accessToken + refreshToken）

**验收**：双窗口数据互通；refresh 流程通；无 camelCase/snake_case 400 错误

**人类 gate**：启用后端模式前确认——用户现有 localStorage 数据是否迁移进 MySQL（迁移脚本 migrate.js 已存在，需跑通）

---

## 阶段 B：DeepSeek Key 收口（安全红线）

**现状**：前端 `deepseek.js` 浏览器直连 api.deepseek.com，API Key 暴露在客户端代码里。后端 smartController.js 已有代理接口（system prompt"只返回数字"、静态降级），但前端没接。

**任务**：
1. 前端 AI 推荐改调后端 `/api/smart/shelf-life`（不再直连）
2. `server/.env` 配 `DEEPSEEK_API_KEY`（用户提供）
3. 验证：免费路径（静态推荐 5 天）与付费路径（AI 推荐真实值）双通
4. is_premium 标志位打通（foodStore / 后端校验）

**验收**：前端源码中 grep 不到 api.deepseek.com 与 key；两种路径分别验证

**人类 gate**：需用户提供 DeepSeek Key 写入 server/.env（夜间若缺失则跳过本阶段并报告）

---

## 阶段 C：Vitest 测试基建

**现状**：零测试。NLP fixtures 已有 15 用例（粘贴识别 100% 准确），没跑起来。

**任务**：
1. 装 vitest + @vue/test-utils
2. 单测覆盖：
   - foodStore 纯函数（validateFoodName/validateQuantity/calcExpiryDate/recommendDays/保鲜映射表）
   - NLP extractor（跑现有 15 fixtures）
   - authStore mock 模式（注册/登录/verifyToken）
3. `npm test` 纳入 package.json

**验收**：npm test 全绿；核心纯函数覆盖率 ≥70%（v8 coverage）

**人类 gate**：无

---

## 阶段 D：PRD 遗留功能（首次引导 + OCR）

**现状**：PRD 29 需求已实现 26，剩余：首次使用引导、OCR 拍照识别（登录注册已做）。

**任务**：
1. 首次使用引导：3 步卡片（添加食材/粘贴识别/到期提醒），可跳过，localStorage 记忆，仅首次显示
2. OCR 拍照识别：评估 Tesseract.js 中文识别（体积大 ~2MB）vs 降级方案。**倾向降级**：拍照存图 + 手动填（扫码录入已存在，OCR 增量价值有限）

**验收**：引导流程截图验证；OCR 若实现则识别 1 张测试图

**人类 gate**：OCR 方案选型（涉及体积/成本权衡，夜间若选降级方案需在报告说明理由）

---

## 阶段 E：性能收尾 + 评分更新

**现状**：评分 80.1/100（A-），性能 3/5 最大短板；segmentit 已分包完成（3.6MB 独立懒加载）。

**任务**：
1. vite build 产物分析（rollup-plugin-visualizer）
2. FoodView 25.44kB 是否需再拆；App 壳再瘦身检查
3. 首屏加载实测（devtools performance 或手动计时）
4. 更新 SYSTEM_SCORE_REPORT.md（架构改造后预期 85+）

**验收**：首屏 <2s（本地）；评分报告更新提交

**人类 gate**：无

---

## 夜间执行规则

- 顺序：A → B → C → D → E，每阶段独立 commit，失败不阻塞后续阶段（记录原因继续）
- 阶段 B 若缺 DeepSeek Key：跳过，报告说明
- 阶段 A 若 localStorage 数据迁移需用户决策：先跑通"新用户注册→同步"路径，旧数据迁移留待用户确认
- 全程留痕：每阶段写 NIGHTLY 分节，最终合并次晨报告（做了什么/可能影响/节省时间/家庭资源管理价值）
- 所有 .env 类文件不提交 git（已在 .gitignore 确认）
