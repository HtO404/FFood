// 简易限流中间件
// 基于 IP 的内存滑动窗口限流，适合单实例部署

const buckets = new Map();

/**
 * 限流中间件工厂
 * @param {number} maxRequests - 窗口内最大请求数
 * @param {number} windowMs - 窗口时长（毫秒）
 */
function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    const timestamps = buckets.get(key);
    // 清理过期记录
    while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        code: 429,
        message: '请求过于频繁，请稍后再试',
        data: null,
      });
    }

    timestamps.push(now);
    next();
  };
}

module.exports = { rateLimit };
