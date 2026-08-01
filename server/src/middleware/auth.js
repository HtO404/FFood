// JWT 鉴权中间件
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { fail } = require('../utils/response');

/**
 * 验证 Bearer Token
 * req.user 将挂载 { id, username }
 */
function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(fail('未提供认证令牌', 401));
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT.secret);
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(fail('令牌已过期，请重新登录', 401));
    }
    return res.status(401).json(fail('无效的认证令牌', 401));
  }
}

/**
 * 可选鉴权——有 token 就挂载 user，没有就跳过
 */
function authOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, env.JWT.secret);
      req.user = { id: decoded.id, username: decoded.username };
    } catch {
      // 忽略错误，不阻断请求
    }
  }
  next();
}

module.exports = { authRequired, authOptional };
