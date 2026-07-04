// 限流中间件，基于 rate_limit 集合实现计数限流
// 适用场景：短信盗刷防护等

const { collection } = require('./db');

/**
 * 检查并自增计数
 *  - 若当前 key 在窗口内已达上限，返回 { allowed: false, retryAfter }
 *  - 否则计数 +1 并返回 { allowed: true, count }
 *  - 若窗口已过期，重置为 1
 * @param {string} key 限流键，如 "sms:ip:1.2.3.4"
 * @param {number} windowSec 时间窗口（秒）
 * @param {number} maxCount 窗口内最大允许次数
 */
async function check(key, windowSec, maxCount) {
  const now = Date.now();
  const expireAt = new Date(now + windowSec * 1000);
  const col = collection('rate_limit');

  const { data } = await col.where({ key }).get();
  if (data && data.length > 0) {
    const record = data[0];
    const expireTs = record.expireAt ? new Date(record.expireAt).getTime() : 0;

    if (expireTs > now) {
      if (record.count >= maxCount) {
        return {
          allowed: false,
          reason: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((expireTs - now) / 1000)
        };
      }
      await col.doc(record._id).update({ data: { count: record.count + 1 } });
      return { allowed: true, count: record.count + 1 };
    }
    // 窗口已过期，重置
    await col.doc(record._id).update({ data: { count: 1, expireAt } });
    return { allowed: true, count: 1 };
  }

  // 新建记录
  await col.add({ data: { key, count: 1, expireAt } });
  return { allowed: true, count: 1 };
}

/**
 * 仅查询不增加计数
 */
async function peek(key) {
  const { data } = await collection('rate_limit').where({ key }).get();
  if (data && data.length > 0) return data[0];
  return null;
}

module.exports = { check, peek };
