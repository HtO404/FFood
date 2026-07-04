// 发送短信验证码云函数（用于找回密码等场景）
// 参数：phone, captchaId, captchaCode
// 防盗刷：
//   1. 图形验证码前置校验
//   2. 同 IP 60s 内最多 1 次
//   3. 同手机号每天最多 10 次

const crypto = require('crypto');
const { collection } = require('../shared/db');
const rateLimit = require('../shared/rateLimit');
const captcha = require('../shared/captcha');
const { success, fail, parseEvent, respond } = require('../shared/response');

const SMS_IP_WINDOW_SEC = 60;          // 单 IP 窗口：60 秒
const SMS_IP_MAX = 1;                  // 单 IP 60 秒内最多 1 次
const SMS_PHONE_WINDOW_SEC = 86400;    // 单手机号窗口：24 小时
const SMS_PHONE_MAX = 10;              // 单手机号每天最多 10 次
const SMS_CODE_TTL_MIN = 5;            // 短信验证码 5 分钟有效

/**
 * 从 event 提取客户端 IP（仅 HTTP 触发器模式有真实 IP）
 * callFunction 模式没有 IP 概念，返回固定串使限流仍能按"调用方"维度生效
 */
function getClientIp(event, ctx) {
  if (ctx.isHttp) {
    const h = event.headers || {};
    const xff = h['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
    return h['x-real-ip'] || (event.requestContext && event.requestContext.sourceIp) || 'unknown';
  }
  return 'wxcloud';
}

/**
 * 调用短信服务商 API（示例占位）
 * 实际部署需替换为腾讯云/阿里云短信 SDK 调用
 * @param {string} phone 手机号
 * @param {string} code 6 位验证码
 * @returns {Promise<{success: boolean, msg?: string}>}
 */
async function sendSmsViaProvider(phone, code) {
  // TODO: 在此接入实际短信服务商，例如腾讯云短信：
  //   const tencentcloud = require('tencentcloud-sdk-nodejs-sms');
  //   const SmsClient = tencentcloud.sms.v20210111.Client;
  //   ...
  // 当前为开发占位，通过 SMS_DEV_MODE=1 控制是否真实发送
  if (process.env.SMS_DEV_MODE === '1') {
    console.log(`[SMS DEV MODE] 发送验证码到 ${phone}: ${code}`);
    return { success: true };
  }
  // 未接入服务商且未开启开发模式，直接返回失败
  console.warn('[SMS] 未配置短信服务商，请在 sendSms/index.js 的 sendSmsViaProvider 中接入');
  return { success: false, msg: '短信服务未配置' };
}

exports.main = async (event, context) => {
  const ctx = parseEvent(event);
  try {
    const { phone, captchaId, captchaCode } = ctx.params || {};

    // 1. 参数校验
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return respond(fail('手机号格式不正确', 40001), ctx);
    }
    if (!captchaId || !captchaCode) {
      return respond(fail('请输入图形验证码', 40002), ctx);
    }

    // 2. 校验图形验证码
    const captchaResult = await captcha.verify(captchaId, captchaCode, 'image');
    if (!captchaResult.valid) {
      return respond(fail(captchaResult.reason, 40005), ctx);
    }

    // 3. 限流：同 IP 60s 内 1 次
    const ip = getClientIp(event, ctx);
    const ipKey = `sms:ip:${ip}`;
    const ipCheck = await rateLimit.check(ipKey, SMS_IP_WINDOW_SEC, SMS_IP_MAX);
    if (!ipCheck.allowed) {
      return respond(fail(`操作过于频繁，请 ${ipCheck.retryAfter || 60} 秒后再试`, 42901), ctx);
    }

    // 4. 限流：同手机号每天 10 次
    const phoneKey = `sms:phone:${phone}`;
    const phoneCheck = await rateLimit.check(phoneKey, SMS_PHONE_WINDOW_SEC, SMS_PHONE_MAX);
    if (!phoneCheck.allowed) {
      return respond(fail('该手机号今日接收验证码次数已达上限', 42902), ctx);
    }

    // 5. 生成 6 位数字验证码
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

    // 6. 调用短信服务商发送
    const sendResult = await sendSmsViaProvider(phone, code);
    if (!sendResult.success) {
      return respond(fail('短信发送失败: ' + (sendResult.msg || ''), 50002), ctx);
    }

    // 7. 验证码入库（复用 captcha 集合，type=sms 标记）
    const smsCaptchaId = crypto.randomBytes(16).toString('hex');
    const expireAt = new Date(Date.now() + SMS_CODE_TTL_MIN * 60 * 1000);
    await collection('captcha').add({
      data: {
        captchaId: smsCaptchaId,
        code,
        expireAt,
        used: false,
        type: 'sms',
        phone
      }
    });

    // 开发模式下返回 code 方便联调；生产模式不应返回 code
    const devMode = process.env.SMS_DEV_MODE === '1';
    return respond(success({
      sent: true,
      smsCaptchaId,
      expireIn: SMS_CODE_TTL_MIN * 60,
      ...(devMode ? { code } : {})
    }, '验证码已发送'), ctx);
  } catch (err) {
    console.error('sendSms error:', err);
    return respond(fail('服务器内部错误: ' + err.message, 50000), ctx);
  }
};
