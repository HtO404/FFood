// 登录云函数（账号密码）
// 参数：username, password, captchaId, captchaCode
// 防暴力破解：连续失败 5 次锁定 15 分钟

const { collection } = require('../shared/db');
const { verifyPassword, signToken } = require('../shared/auth');
const captcha = require('../shared/captcha');
const { success, fail, parseEvent, respond } = require('../shared/response');

const MAX_FAIL_COUNT = 5;                  // 失败上限
const LOCK_DURATION_MS = 15 * 60 * 1000;   // 锁定 15 分钟

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

    // 2. 校验图形验证码（防止暴力穷举）
    const captchaResult = await captcha.verify(captchaId, captchaCode, 'image');
    if (!captchaResult.valid) {
      return respond(fail(captchaResult.reason, 40005), ctx);
    }

    // 3. 查询用户
    const { data: users } = await collection('users').where({ username }).get();
    if (!users || users.length === 0) {
      // 故意返回与密码错误相同的提示，避免泄露用户是否存在
      return respond(fail('用户名或密码错误', 40010), ctx);
    }
    const user = users[0];

    // 4. 检查锁定状态
    if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
      const remainSec = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000);
      return respond(fail(`账号已锁定，请 ${Math.ceil(remainSec / 60)} 分钟后再试`, 40011), ctx);
    }

    // 5. 校验密码
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      // 失败计数 +1，达 5 次则锁定
      const newFailCount = (user.loginFailCount || 0) + 1;
      const updateData = { loginFailCount: newFailCount };
      if (newFailCount >= MAX_FAIL_COUNT) {
        updateData.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await collection('users').doc(user._id).update({ data: updateData });

      if (newFailCount >= MAX_FAIL_COUNT) {
        return respond(fail('密码错误次数过多，账号已锁定 15 分钟', 40012), ctx);
      }
      const remain = MAX_FAIL_COUNT - newFailCount;
      return respond(fail(`用户名或密码错误，还剩 ${remain} 次尝试机会`, 40010), ctx);
    }

    // 6. 登录成功，重置失败计数与锁定
    await collection('users').doc(user._id).update({
      data: {
        loginFailCount: 0,
        lockUntil: null,
        lastLoginAt: new Date()
      }
    });

    // 7. 生成 token
    const token = signToken({
      userId: user._id,
      username: user.username,
      type: 'password'
    });

    return respond(success({
      token,
      user: {
        userId: user._id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar
      }
    }, '登录成功'), ctx);
  } catch (err) {
    console.error('login error:', err);
    return respond(fail('服务器内部错误: ' + err.message, 50000), ctx);
  }
};
