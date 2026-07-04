// 图形验证码生成云函数
// 调用 shared/captcha.create 生成验证码并入库
// 返回 { captchaId, code } —— code 由前端 canvas 渲染成图片，captchaId 用于后续校验
//
// 安全说明：
//  - code 在服务端生成并入库，前端只负责渲染展示
//  - 校验时由 login/register/sendSms 云函数调用 captcha.verify 做二次校验
//  - 即使前端被篡改，后端校验仍以数据库记录为准

const captcha = require('../shared/captcha');
const { success, fail, parseEvent, respond } = require('../shared/response');

exports.main = async (event, context) => {
  const ctx = parseEvent(event);
  try {
    const { type = 'image' } = ctx.params || {};
    const result = await captcha.create(type);
    // 注意：code 返回给前端用于 canvas 渲染，captchaId 用于后续校验
    // 这是图形验证码的标准做法（非短信验证码，短信 code 不应返回前端）
    return respond(success({
      captchaId: result.captchaId,
      code: result.code
    }, 'ok'), ctx);
  } catch (err) {
    console.error('createCaptcha error:', err);
    return respond(fail('生成验证码失败: ' + err.message, 50000), ctx);
  }
};
