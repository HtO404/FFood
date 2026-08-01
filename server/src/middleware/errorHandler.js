// 统一错误处理中间件
const { fail } = require('../utils/response');

/**
 * 404 处理
 */
function notFound(req, res) {
  res.status(404).json(fail(`路由不存在: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * 全局错误捕获
 */
function errorHandler(err, req, res, next) {
  console.error('[错误]', err.message);

  // JWT 错误
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json(fail('认证失败', 401));
  }

  // 参数校验错误
  if (err.name === 'ValidationError') {
    return res.status(400).json(fail(err.message, 400));
  }

  // 默认服务器错误
  res.status(500).json(fail('服务器内部错误', 500, {
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }));
}

module.exports = { notFound, errorHandler };
