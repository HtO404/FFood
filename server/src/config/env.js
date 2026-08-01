// 环境变量加载与校验
require('dotenv').config();

const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

/** 检查必填环境变量 */
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[启动失败] 缺少必填环境变量: ${key}`);
    process.exit(1);
  }
}

const env = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DB: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },
  JWT: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  DEEPSEEK: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  SECURITY: {
    maxLoginFail: parseInt(process.env.MAX_LOGIN_FAIL, 10) || 5,
    lockDuration: parseInt(process.env.LOCK_DURATION, 10) || 15,
  },
};

module.exports = env;
