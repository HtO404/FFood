// 注册云函数（账号密码）
// 参数：username, password, captchaId, captchaCode

const { collection } = require('../shared/db');
const { hashPassword, genSalt } = require('../shared/auth');
const captcha = require('../shared/captcha');
const { success, fail, parseEvent, respond } = require('../shared/response');

exports.main = async (event, context) => {
  const ctx = parseEvent(event);
  try {
    const { username, password, captchaId, captchaCode } = ctx.params || {};

    // 1. 参数校验
    if (!username || !password) {
      return respond(fail('用户名和密码不能为空', 40001), ctx);
    }
    if (!captchaId || !captchaCode) {
      return respond(fail('请输入图形验证码', 40002), ctx);
    }
    // 用户名规则：3-20 位字母数字下划线
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return respond(fail('用户名必须为 3-20 位字母数字下划线', 40003), ctx);
    }
    // 密码规则：6-32 位
    if (typeof password !== 'string' || password.length < 6 || password.length > 32) {
      return respond(fail('密码长度必须为 6-32 位', 40004), ctx);
    }

    // 2. 校验图形验证码
    const captchaResult = await captcha.verify(captchaId, captchaCode, 'image');
    if (!captchaResult.valid) {
      return respond(fail(captchaResult.reason, 40005), ctx);
    }

    // 3. 检查用户名是否已存在
    const { data: exist } = await collection('users').where({ username }).get();
    if (exist && exist.length > 0) {
      return respond(fail('用户名已存在', 40006), ctx);
    }

    // 4. 哈希密码 + 生成盐
    const salt = genSalt();
    const passwordHash = await hashPassword(password);

    // 5. 写入用户
    const now = new Date();
    const { _id } = await collection('users').add({
      data: {
        username,
        passwordHash,
        salt,
        openid: null,
        unionid: null,
        nickname: username,
        avatar: '',
        createdAt: now,
        lastLoginAt: null,
        loginFailCount: 0,
        lockUntil: null
      }
    });

    return respond(success({ userId: _id, username }, '注册成功'), ctx);
  } catch (err) {
    console.error('register error:', err);
    return respond(fail('服务器内部错误: ' + err.message, 50000), ctx);
  }
};
