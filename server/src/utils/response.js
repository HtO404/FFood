// 统一响应格式工具
// 格式: { code: 0, message: "ok", data: {} }

/**
 * 成功响应
 * @param {*} data - 返回数据
 * @param {string} message - 提示消息
 */
function success(data = {}, message = 'ok') {
  return { code: 0, message, data };
}

/**
 * 失败响应
 * @param {string} message - 错误消息
 * @param {number} code - 错误码（非0）
 * @param {*} data - 附加数据
 */
function fail(message = '操作失败', code = 1, data = null) {
  return { code, message, data };
}

module.exports = { success, fail };
