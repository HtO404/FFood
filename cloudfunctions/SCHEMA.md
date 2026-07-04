# 云数据库 Schema

> 本文档描述微信云开发数据库集合结构。云数据库是 NoSQL（基于 MongoDB），字段可在文档中按需扩展，但建议遵循本文档字段约定以保证一致性。

## 集合一览

| 集合名 | 用途 | TTL 索引建议 |
| --- | --- | --- |
| `users` | 用户主表（账号密码 + 微信登录共用） | 无 |
| `captcha` | 图形验证码 / 短信验证码 | `expireAt`（过期自动删除） |
| `rate_limit` | 限流计数（短信盗刷防护） | `expireAt`（过期自动删除） |

> 在云开发控制台为 `captcha` 和 `rate_limit` 集合的 `expireAt` 字段配置 TTL 索引，避免数据无限增长。

---

## 1. `users` 用户集合

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 是 | 系统自动生成，用户唯一 ID |
| `username` | string | 否 | 账号（注册时传入）；微信登录用户可为 null |
| `passwordHash` | string | 否 | bcrypt 哈希后的密码（含盐）；微信登录用户可为 null |
| `salt` | string | 否 | 额外盐值（bcrypt 自带盐，此字段冗余备份/兼容扩展用） |
| `openid` | string | 否 | 微信小程序 openid；账号密码注册用户可为 null |
| `unionid` | string | 否 | 微信 unionid（如有） |
| `nickname` | string | 是 | 昵称，默认为 username 或「微信用户」 |
| `avatar` | string | 否 | 头像 URL（云存储临时 URL） |
| `createdAt` | Date | 是 | 注册时间 |
| `lastLoginAt` | Date | 否 | 最近登录时间 |
| `loginFailCount` | number | 是 | 连续登录失败次数，登录成功后重置为 0 |
| `lockUntil` | Date | 否 | 账号锁定截止时间；为 null 或已过去表示未锁定 |

### 索引建议

- `username`：唯一索引（仅在非 null 时生效，需在业务层保证唯一性）
- `openid`：唯一索引（同上）

### 安全规则建议

```
{
  "read": "doc._openid == auth.openid || auth.openid != null",  // 仅自己或已登录可读
  "write": "auth.openid != null"  // 不允许客户端直接写，仅通过云函数
}
```

> 实际项目中建议设置为「仅创建者可读写」+ 云函数 admin 权限，所有数据操作走云函数。

---

## 2. `captcha` 验证码集合

同时承载图形验证码与短信验证码，用 `type` 字段区分。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 是 | 系统自动生成 |
| `captchaId` | string | 是 | 业务层生成的验证码 ID（返回给客户端用） |
| `code` | string | 是 | 验证码明文（服务端比对，不下发客户端） |
| `expireAt` | Date | 是 | 过期时间（图形 5 分钟，短信 5 分钟） |
| `used` | boolean | 是 | 是否已使用，校验通过后置 true，防止重放 |
| `type` | string | 否 | `image`（图形，默认）或 `sms`（短信） |
| `phone` | string | 否 | type=sms 时关联的手机号 |

### 索引建议

- `captchaId`：普通索引（查询用）
- `expireAt`：TTL 索引，过期 0 秒后删除

---

## 3. `rate_limit` 限流集合

用于短信盗刷防护，按 `key` 维度计数。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 是 | 系统自动生成 |
| `key` | string | 是 | 限流键，格式 `sms:ip:<ip>` 或 `sms:phone:<phone>` |
| `count` | number | 是 | 当前窗口内已请求次数 |
| `expireAt` | Date | 是 | 窗口截止时间，过期后下次请求重置为 1 |

### 索引建议

- `key`：普通索引
- `expireAt`：TTL 索引，过期 0 秒后自动删除（清理无意义记录）

### 限流规则示例

| 限流维度 | key 示例 | 窗口 | 上限 |
| --- | --- | --- | --- |
| 同 IP 短信请求 | `sms:ip:1.2.3.4` | 60 秒 | 1 次 |
| 同手机号短信请求 | `sms:phone:13800138000` | 24 小时 | 10 次 |
