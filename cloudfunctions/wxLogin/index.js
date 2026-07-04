// 微信登录云函数（小程序专用）
// 参数：code（wx.login 拿到的临时登录凭证）
// 流程：code -> code2session 接口换 openid/unionid/session_key -> 查或建用户 -> 签发 token
// 注意：本函数仅适合小程序端调用（H5 端用 wxLogin 无法拿到 code，需走 OAuth 网页授权流程，本骨架暂不实现）

const https = require('https');
const { collection } = require('../shared/db');
const { signToken } = require('../shared/auth');
const { success, fail, parseEvent, respond } = require('../shared/response');

const CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

/**
 * 调用微信 code2session 接口
 * 使用 Node 内置 https 模块，避免引入 axios 等额外依赖
 */
function code2session(appid, secret, code) {
  const url = `${CODE2SESSION_URL}?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('解析微信响应失败: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

exports.main = async (event, context) => {
  const ctx = parseEvent(event);
  try {
    const { code } = ctx.params || {};
    if (!code) {
      return respond(fail('code 不能为空', 40001), ctx);
    }

    const appid = process.env.WX_APP_ID;
    const secret = process.env.WX_APP_SECRET;
    if (!appid || !secret) {
      return respond(fail('微信小程序 AppID/AppSecret 未配置', 50001), ctx);
    }

    // 1. code 换 openid
    const wxRes = await code2session(appid, secret, code);
    if (!wxRes || wxRes.errcode) {
      return respond(fail(`微信登录失败: ${wxRes ? wxRes.errmsg : '无响应'}`, 40020), ctx);
    }
    const { openid, session_key, unionid } = wxRes;
    if (!openid) {
      return respond(fail('未获取到 openid', 40021), ctx);
    }

    // 2. 查询或创建用户
    const { data: exist } = await collection('users').where({ openid }).get();
    let user;
    if (exist && exist.length > 0) {
      user = exist[0];
      // 更新最近登录时间，失败计数清零（微信登录不走密码，无需锁定）
      await collection('users').doc(user._id).update({
        data: { lastLoginAt: new Date(), loginFailCount: 0, lockUntil: null }
      });
    } else {
      // 创建新用户
      const now = new Date();
      const addRes = await collection('users').add({
        data: {
          username: null,
          passwordHash: null,
          salt: null,
          openid,
          unionid: unionid || null,
          nickname: '微信用户',
          avatar: '',
          createdAt: now,
          lastLoginAt: now,
          loginFailCount: 0,
          lockUntil: null
        }
      });
      user = {
        _id: addRes._id,
        openid,
        username: null,
        nickname: '微信用户',
        avatar: ''
      };
    }

    // 3. 签发 token
    const token = signToken({
      userId: user._id,
      openid,
      type: 'wx'
    });

    // 注意：session_key 包含敏感信息，原则上不下发客户端。
    // 如客户端需要解密手机号/微信运动等数据，可将其也存到服务端并按需下发，或用云开发 openapi 解密。
    return respond(success({
      token,
      user: {
        userId: user._id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        openid
      }
    }, '登录成功'), ctx);
  } catch (err) {
    console.error('wxLogin error:', err);
    return respond(fail('服务器内部错误: ' + err.message, 50000), ctx);
  }
};
