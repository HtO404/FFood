// FFood 前端调用云函数配置示例
//
// 使用方法：
//   1. 复制本文件为 client.config.js（被 .gitignore 忽略，不提交敏感配置）
//   2. 按需修改 ENV_ID、HTTP 触发器域名、JWT_SECRET（仅前端用于自校验 token 时需要，一般不需要）
//
// 本文件仅是示例，前端不需要也不能持有任何服务端密钥（JWT_SECRET、WX_APP_SECRET 等）。
// 前端只持有：云开发环境 ID、HTTP 触发器 URL、已签发的 token。

const CONFIG = {
  // 云开发环境 ID（小程序端 wx.cloud.init 用，H5 端可不需要）
  ENV_ID: 'your-cloud-env-id',

  // HTTP 触发器基础 URL（H5 端调用用）
  // 形如：https://<env-id>.service.tcloudbasegateway.com
  HTTP_BASE: 'https://your-env-id.service.tcloudbasegateway.com',

  // 各云函数的 HTTP 路径（与触发器配置一致）
  FUNCTION_PATHS: {
    register: '/register',
    login: '/login',
    wxLogin: '/wxLogin',
    verifyToken: '/verifyToken',
    sendSms: '/sendSms'
  }
};

/**
 * 通过 HTTP 触发器调用云函数（H5 端用）
 * @param {string} fnName 云函数名，如 'login'
 * @param {object} data 业务参数
 * @param {object} opts { token?: string, method?: 'GET'|'POST' }
 * @returns {Promise<{code:number, message:string, data:any}>}
 */
export async function callHttp(fnName, data = {}, opts = {}) {
  const path = CONFIG.FUNCTION_PATHS[fnName] || '/' + fnName;
  const url = CONFIG.HTTP_BASE + path;
  const method = opts.method || (data && Object.keys(data).length ? 'POST' : 'GET');
  const headers = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;

  const init = { method, headers };
  if (method === 'POST') init.body = JSON.stringify(data);
  // GET 时把 data 拼到 query string
  let finalUrl = url;
  if (method === 'GET' && data && Object.keys(data).length) {
    const qs = new URLSearchParams(data).toString();
    finalUrl = url + (url.includes('?') ? '&' : '?') + qs;
  }

  const res = await fetch(finalUrl, init);
  const json = await res.json();
  // HTTP 触发器返回 { statusCode, headers, body }；body 是 JSON 字符串
  // 微信云函数 HTTP 触发器实际返回的是直接 JSON（body 已被网关解析）
  // 这里兼容两种情况
  if (json && typeof json.body === 'string') {
    try { return JSON.parse(json.body); } catch (e) { return json; }
  }
  return json;
}

/**
 * 通过 wx.cloud.callFunction 调用（小程序端用）
 * @param {string} fnName 云函数名
 * @param {object} data 业务参数
 * @returns {Promise<{code:number, message:string, data:any}>}
 */
export function callWx(fnName, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: fnName,
      data,
      success: (res) => resolve(res.result),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 端能力探测：自动选择 H5 / 小程序调用方式
 */
export function call(fnName, data = {}, opts = {}) {
  if (typeof wx !== 'undefined' && wx.cloud) {
    return callWx(fnName, data);
  }
  return callHttp(fnName, data, opts);
}

/**
 * 前端 token 本地存储工具
 *  - 登录成功后存 token
 *  - 调用受保护接口时取出
 *  - 启动时调用 verifyToken 校验
 */
export const tokenStore = {
  get() {
    if (typeof localStorage !== 'undefined') return localStorage.getItem('ffood_token');
    if (typeof wx !== 'undefined' && wx.getStorageSync) return wx.getStorageSync('ffood_token');
    return null;
  },
  set(token) {
    if (typeof localStorage !== 'undefined') localStorage.setItem('ffood_token', token);
    else if (typeof wx !== 'undefined' && wx.setStorageSync) wx.setStorageSync('ffood_token', token);
  },
  clear() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ffood_token');
    else if (typeof wx !== 'undefined' && wx.removeStorageSync) wx.removeStorageSync('ffood_token');
  }
};

/**
 * 调用受保护接口（自动带上 token）
 */
export async function callAuth(fnName, data = {}) {
  const token = tokenStore.get();
  return call(fnName, data, { token });
};

// ============ 前端可用的签名生成（可选，用于自校验 token 完整性） ============
//
// 注意：前端不应持有 JWT_SECRET，因此一般不在此校验 token 签名。
// 此处仅提供一个用 crypto.subtle 做的「完整性自检」示例，密钥由服务端单独签发一个
// 浏览器专用公钥/对称密钥（如有需要）。绝大多数场景下，前端只需把 token 原样回传给
// verifyToken 云函数即可，无需自己校验签名。
//
// 默认不导出 signTool，按需启用：
//
// export async function verifyTokenSigLocally(token, secret) {
//   const [payloadB64, sigB64] = token.split('.');
//   const key = await crypto.subtle.importKey(
//     'raw',
//     new TextEncoder().encode(secret),
//     { name: 'HMAC', hash: 'SHA-256' },
//     false,
//     ['verify']
//   );
//   const sigBuf = base64UrlDecode(sigB64);
//   return crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(payloadB64));
// }

export default CONFIG;
