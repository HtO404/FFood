// 鉴权工具：token 生成/校验（HMAC-SHA256） + 密码哈希（bcrypt）

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // token 默认有效期 7 天
const BCRYPT_ROUNDS = 10;               // bcrypt salt rounds，符合安全要求

/**
 * 读取 token 签名密钥（必须通过环境变量注入）
 */
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 未配置');
  return secret;
}

/**
 * Base64Url 编码（去除 padding，URL 安全）
 */
function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64Url 解码
 */
function base64UrlDecode(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

/**
 * 生成 token
 *  token 格式：`<base64url(payload)>.<base64url(hmac-sha256(payload))>`
 *  payload 含 iat（签发时间）与 exp（过期时间），单位秒
 * @param {object} payload 业务字段，如 { userId, username, type }
 * @param {number} ttlSec 有效期秒数，默认 7 天
 */
function signToken(payload, ttlSec = TOKEN_TTL_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSec };
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * 校验 token
 * @param {string} token
 * @returns {{ valid: boolean, payload?: object, reason?: string }}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'token 为空' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'token 格式错误' };
  }
  const [payloadB64, sigB64] = parts;

  // 重算签名并用 timingSafeEqual 比较，防时序攻击
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
  const expectedSigB64 = base64UrlEncode(expectedSig);
  let sigMatch = false;
  try {
    const a = Buffer.from(sigB64);
    const b = Buffer.from(expectedSigB64);
    if (a.length === b.length) {
      sigMatch = crypto.timingSafeEqual(a, b);
    }
  } catch (e) {
    sigMatch = false;
  }
  if (!sigMatch) {
    return { valid: false, reason: '签名不匹配' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch (e) {
    return { valid: false, reason: 'payload 解析失败' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    return { valid: false, reason: 'token 已过期', payload };
  }
  return { valid: true, payload };
}

/**
 * bcrypt 哈希密码
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 校验密码与哈希是否匹配
 */
async function verifyPassword(password, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    return false;
  }
}

/**
 * 生成额外盐值（bcrypt 自带盐，此字段用于扩展/兼容）
 */
function genSalt() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  genSalt,
  TOKEN_TTL_SEC,
  BCRYPT_ROUNDS
};
