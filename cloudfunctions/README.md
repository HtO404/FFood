# FFood 云开发后端

> 微信云开发（云函数 + 云数据库）后端骨架，为 H5 + 小程序双端提供登录鉴权、短信验证码等基础能力。

## 目录结构

```
cloudfunctions/
├── SCHEMA.md                          # 数据库集合 Schema 文档
├── README.md                          # 本文件
├── client.config.example.js           # 前端调用配置示例（复制为 client.config.js 后使用）
├── shared/                            # 共享工具模块（非云函数，被各云函数 require）
│   ├── package.json
│   ├── db.js                          # 云数据库连接工具
│   ├── auth.js                        # token 生成/校验 + 密码哈希
│   ├── rateLimit.js                   # 限流中间件
│   ├── response.js                    # 统一响应格式 + event 解析
│   └── captcha.js                     # 图形/短信验证码生成与校验
├── register/                          # 注册云函数（账号密码）
│   ├── index.js
│   └── package.json
├── createCaptcha/                     # 图形验证码生成（返回 captchaId + code 供前端 canvas 渲染）
│   ├── index.js
│   └── package.json
├── login/                             # 登录云函数（账号密码 + 失败锁定）
│   ├── index.js
│   └── package.json
├── wxLogin/                           # 微信登录云函数（小程序专用）
│   ├── index.js
│   └── package.json
├── verifyToken/                       # token 校验云函数
│   ├── index.js
│   └── package.json
└── sendSms/                           # 短信验证码发送（限流 + 图形验证码防护）
    ├── index.js
    └── package.json
```

## 一、需要用户提供的配置项

部署前请准备好以下信息：

| 配置项 | 用途 | 获取方式 |
| --- | --- | --- |
| 微信小程序 AppID | wxLogin 调用 code2session | 微信公众平台 → 小程序后台 → 开发管理 → 开发设置 |
| 微信小程序 AppSecret | wxLogin 调用 code2session | 同上（注意保密，不要泄露到前端） |
| 云开发环境 ID | 云函数初始化 SDK | 微信开发者工具 → 云开发 → 设置 → 环境信息 |
| JWT_SECRET | token HMAC 签名密钥 | 自行生成 32+ 位随机串，如 `openssl rand -hex 32` |
| 短信服务商 AppID/AppKey | 调用短信 API（如腾讯云/阿里云） | 短信服务商控制台 |
| 短信签名 / 模板 ID | 短信内容签名与模板 | 短信服务商后台审批通过后获得 |

## 二、部署步骤

### 1. 创建云开发环境

1. 打开微信开发者工具 → 顶部菜单「云开发」→ 创建环境（或使用已有环境），记下环境 ID。
2. 在「数据库」中创建 3 个集合：`users`、`captcha`、`rate_limit`。
3. 按下表为集合设置权限：

| 集合 | 推荐权限 |
| --- | --- |
| `users` | 仅创建者可读写（实际由云函数 admin 写入） |
| `captcha` | 仅创建者可读写 |
| `rate_limit` | 仅创建者可读写 |

> 客户端不应直接读写这三个集合，所有操作走云函数。

### 2. 配置 TTL 索引（避免数据无限增长）

在云开发控制台 → 数据库 → 索引管理，为以下集合添加 TTL 索引：

- `captcha`：字段 `expireAt`，过期秒数 `0`
- `rate_limit`：字段 `expireAt`，过期秒数 `0`

### 3. 同步 shared 目录到各云函数（重要）

微信云开发中，**每个云函数独立部署，上传时只打包该函数目录**，`require('../shared/xxx')` 默认无法跨函数引用。

部署前请将 `shared/` 目录复制到每个云函数内部，例如：

```bash
# PowerShell 示例
foreach ($fn in 'register','createCaptcha','login','wxLogin','verifyToken','sendSms') {
  Copy-Item -Recurse -Force cloudfunctions\shared cloudfunctions\$fn\shared
}
```

复制后，云函数内的 `require('../shared/db')` 路径需同步改为 `require('./shared/db')`。
可通过构建脚本批量替换，或预先将源码中路径写成 `require('./shared/db')` 并维护一份 shared 拷贝。

> 替代方案：用 `npm pack` 把 shared 打成本地 tgz，在各云函数 `package.json` 中以 `"file:../shared"` 形式安装。
> 任选其一即可，关键是部署到云端时 shared 代码必须能被找到。

### 4. 上传部署云函数

1. 用微信开发者工具打开本项目（或单独打开 `cloudfunctions/` 目录所在的小程序项目）。
2. 右键每个云函数目录 → 「上传并部署：云端安装依赖」。
3. 等待上传完成，云端会自动 `npm install` 安装 `bcryptjs`、`wx-server-sdk`。

### 5. 配置环境变量

在微信开发者工具 → 云开发 → 云函数 → 选中函数 → 配置 → 环境变量，为对应函数添加以下变量：

| 云函数 | 变量名 | 必填 | 示例 |
| --- | --- | --- | --- |
| 全部 | `CLOUD_ENV` | 否（推荐填） | `your-cloud-env-id` |
| 全部 | `JWT_SECRET` | 是 | `a1b2c3...（32 位以上随机串）` |
| wxLogin | `WX_APP_ID` | 是 | `wx1234567890abcdef` |
| wxLogin | `WX_APP_SECRET` | 是 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| sendSms | `SMS_APP_ID` | 是 | 短信服务商 AppID |
| sendSms | `SMS_APP_KEY` | 是 | 短信服务商 AppKey |
| sendSms | `SMS_SIGN` | 是 | 短信签名（如 `FFood`） |
| sendSms | `SMS_TEMPLATE_ID` | 是 | 短信模板 ID |
| sendSms | `SMS_DEV_MODE` | 否 | `1` 时跳过真实发送，仅日志（开发联调用） |

> 注意：`JWT_SECRET`、`WX_APP_SECRET`、`SMS_APP_KEY` 是高敏感凭据，**绝不**提交到 git 仓库或下发到前端。

## 三、HTTP 触发器配置

H5 端无法使用 `wx.cloud.callFunction`，需通过 HTTP 触发器调用云函数。

### 1. 开启 HTTP 触发器

在微信开发者工具 → 云开发 → 云函数 → 选中函数 → 触发器 → 添加触发器：

- 触发器类型：HTTP 触发器
- 路径：自定义，如 `register`、`login` 等
- 鉴权方式：按需（建议「免鉴权」用于 register/login/sendSms，verifyToken 可也用免鉴权；需保护的业务接口建议用「云开发鉴权」）

### 2. HTTP 触发器 URL 模板

```
https://<env-id>.service.tcloudbasegateway.com/<function-name>
```

例如：
```
https://ffood-abc123.service.tcloudbasegateway.com/register
https://ffood-abc123.service.tcloudbasegateway.com/createCaptcha
https://ffood-abc123.service.tcloudbasegateway.com/login
https://ffood-abc123.service.tcloudbasegateway.com/wxLogin
https://ffood-abc123.service.tcloudbasegateway.com/verifyToken
https://ffood-abc123.service.tcloudbasegateway.com/sendSms
```

### 3. 调用约定

- `GET` 请求：参数走 query string
- `POST` 请求：参数走 JSON body（`Content-Type: application/json`）
- 携带 token：HTTP 头 `Authorization: Bearer <token>`
- 响应格式：`{ "code": 0, "message": "ok", "data": {...} }`，`code === 0` 表示成功

### 4. CORS 说明

云函数已统一返回 `Access-Control-Allow-Origin: *`，允许 H5 跨域调用。
如需收紧，请修改 `shared/response.js` 的 `httpWrap` 函数，将 `*` 替换为白名单域名。

## 四、双端调用方式

### 小程序端

```js
// 初始化
wx.cloud.init({ env: 'your-env-id' });

// 调用云函数
const res = await wx.cloud.callFunction({
  name: 'login',
  data: { username: 'alice', password: 'xxxxxx', captchaId, captchaCode }
});
console.log(res.result); // { code, message, data }
```

### H5 端

```js
// 通过 HTTP 触发器 URL 调用
const res = await fetch('https://ffood-abc123.service.tcloudbasegateway.com/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'alice', password: 'xxxxxx', captchaId, captchaCode })
});
const json = await res.json(); // { code, message, data }
```

详细示例见 `client.config.example.js`。

## 五、安全要点回顾

1. **短信防盗刷**：图形验证码 + IP/手机号双维度限流（见 `sendSms/index.js`）
2. **图床防盗刷**：云存储用临时 URL（`cloud.getTempFileURL`）+ Referer 白名单（在云函数中校验或腾讯云 COS 防盗链配置）
3. **密码哈希**：bcrypt，salt rounds = 10（见 `shared/auth.js`）
4. **token 签名**：HMAC-SHA256 + 过期时间 + timingSafeEqual 防时序攻击（见 `shared/auth.js`）
5. **防暴力破解**：登录失败 5 次锁定 15 分钟（见 `login/index.js`）
6. **统一错误处理**：所有云函数 try/catch 包裹，统一响应格式 `{ code, message, data }`

## 六、本地开发与调试

- 云函数本地调试：微信开发者工具 → 云函数右键 → 「本地调试」
- 模拟短信发送：在 sendSms 云函数环境变量中设置 `SMS_DEV_MODE=1`，验证码会返回在响应中（仅开发联调用，生产环境务必关闭）
- 验证 token：调用 `verifyToken` 云函数，传入 login/wxLogin 返回的 token

## 七、后续可扩展项（不在本骨架范围内）

- 找回密码云函数（验证手机号 + 短信验证码 → 重置 passwordHash）
- 用户信息更新（昵称、头像上传到云存储后写入 users）
- 微信小程序手机号授权登录（button open-type="getPhoneNumber" → 解密 → 关联 users）
- H5 微信网页授权（OAuth2 流程换 openid，与 wxLogin 复用 token 签发逻辑）
- 资源防盗链：云存储 Referer 白名单 + 业务云函数签发临时 URL
