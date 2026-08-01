// MySQL 连接池配置
const mysql = require('mysql2/promise');
const env = require('./env');

/** 创建连接池 */
const pool = mysql.createPool({
  host: env.DB.host,
  port: env.DB.port,
  user: env.DB.user,
  password: env.DB.password,
  database: env.DB.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+08:00',
});

/** 测试数据库连接 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[数据库] 连接成功');
  } catch (err) {
    console.error('[数据库] 连接失败:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
