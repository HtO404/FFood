// 图形验证码生成 + 校验
// 注意：图形验证码图片渲染在前端完成（如 canvas），本模块仅负责生成 code 并入库校验
// 也可由前端调用云函数 createCaptcha 获取（如需服务端渲染，可扩展 svg-captcha）

const crypto = require('crypto');
const { collection } = require('./db');

const CAPTCHA_TTL_MIN = 5; // 验证码有效期 5 分钟

/**
 * 生成随机验证码（去除易混淆字符 0/O/1/I/L）
 * @param {number} len 长度，默认 4
 */
function genCode(len = 4) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * 生成验证码并写入 captcha 集合
 * @param {string} type 'image' 或 'sms'
 * @param {string} code 验证码明文（短信验证码由调用方生成传入）
 * @returns {{ captchaId: string, code: string }} captchaId 用于客户端校验，code 仅服务端持有
 */
async function create(type = 'image', code) {
  const captchaId = crypto.randomBytes(16).toString('hex');
  const finalCode = code || genCode(4);
  const expireAt = new Date(Date.now() + CAPTCHA_TTL_MIN * 60 * 1000);
  await collection('captcha').add({
    data: {
      captchaId,
      code: finalCode,
      expireAt,
      used: false,
      type
    }
  });
  return { captchaId, code: finalCode };
}

/**
 * 校验验证码（校验通过后置 used=true，防重放）
 * @param {string} captchaId
 * @param {string} inputCode 用户输入
 * @param {string} type 可选，限定类型 'image'/'sms'
 */
async function verify(captchaId, inputCode, type) {
  if (!captchaId || !inputCode) {
    return { valid: false, reason: '缺少验证码参数' };
  }
  const { data } = await collection('captcha').where({ captchaId }).get();
  if (!data || data.length === 0) {
    return { valid: false, reason: '验证码不存在' };
  }
  const record = data[0];

  if (type && record.type && record.type !== type) {
    return { valid: false, reason: '验证码类型不匹配' };
  }
  if (record.used) {
    return { valid: false, reason: '验证码已使用' };
  }
  if (record.expireAt && new Date(record.expireAt).getTime() < Date.now()) {
    return { valid: false, reason: '验证码已过期' };
  }
  // 大小写不敏感比较
  if (String(record.code).toUpperCase() !== String(inputCode).toUpperCase()) {
    return { valid: false, reason: '验证码错误' };
  }
  // 标记已使用
  await collection('captcha').doc(record._id).update({ data: { used: true } });
  return { valid: true, record };
}

module.exports = { create, verify, genCode, CAPTCHA_TTL_MIN };
