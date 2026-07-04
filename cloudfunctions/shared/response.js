// 统一响应格式 + 事件解析（兼容 HTTP 触发器与 wx.cloud.callFunction）

/**
 * 成功响应
 * @param {*} data 业务数据
 * @param {string} message 提示信息
 */
function success(data = null, message = 'ok') {
  return { code: 0, message, data };
}

/**
 * 失败响应
 * @param {string} message 错误信息
 * @param {number} code 业务错误码（非 0）
 * @param {*} data 附加数据
 */
function fail(message = '操作失败', code = 10001, data = null) {
  return { code, message, data };
}

/**
 * HTTP 触发器响应包装
 */
function httpWrap(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

/**
 * 从 event 提取参数，兼容两种调用模式：
 *  - HTTP 触发器：event.httpMethod 存在，参数在 event.queryString 或 event.body（JSON）
 *  - wx.cloud.callFunction：参数直接在 event 上
 * @param {object} event 云函数入口 event
 */
function parseEvent(event) {
  // HTTP 触发器模式
  if (event && event.httpMethod) {
    let params = {};
    if (event.httpMethod === 'GET' && event.queryString) {
      params = { ...event.queryString };
    } else if (event.body) {
      try {
        params = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (e) {
        params = {};
      }
    }
    const headers = event.headers || {};
    const authHeader = headers['Authorization'] || headers['authorization'] || '';
    return {
      isHttp: true,
      httpMethod: event.httpMethod,
      params,
      token: authHeader.replace(/^Bearer\s+/i, ''),
      raw: event
    };
  }
  // wx.cloud.callFunction 模式
  return {
    isHttp: false,
    httpMethod: null,
    params: event || {},
    token: (event && (event.token || event.authorization)) || '',
    raw: event
  };
}

/**
 * 根据入口模式输出响应：
 *  - HTTP 模式：返回 { statusCode, headers, body }
 *  - callFunction 模式：直接返回 { code, message, data }
 */
function respond(result, ctx) {
  if (ctx && ctx.isHttp) {
    const statusCode = result.code === 0 ? 200 : 400;
    return httpWrap(result, statusCode);
  }
  return result;
}

module.exports = { success, fail, httpWrap, parseEvent, respond };
