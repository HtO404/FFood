// token 校验云函数
// 参数：token（可放在 event.token，或 HTTP 头 Authorization: Bearer <token>）
// 用于前端启动时校验本地 token 是否仍有效

const { verifyToken } = require('../shared/auth');
const { success, fail, parseEvent, respond } = require('../shared/response');

exports.main = async (event, context) => {
  const ctx = parseEvent(event);
  try {
    const token = (ctx.params && ctx.params.token) || ctx.token;
    if (!token) {
      return respond(fail('token 不能为空', 40001), ctx);
    }

    const result = verifyToken(token);
    if (!result.valid) {
      return respond(fail(result.reason || 'token 无效', 40101), ctx);
    }

    return respond(success({
      valid: true,
      payload: result.payload
    }, 'token 有效'), ctx);
  } catch (err) {
    console.error('verifyToken error:', err);
    return respond(fail('服务器内部错误: ' + err.message, 50000), ctx);
  }
};
