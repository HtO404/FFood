// 数据库迁移脚本——读取并执行 SQL 文件
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

async function migrate() {
  let conn;

  try {
    // 先不指定 database 连接，确保能创建数据库
    conn = await mysql.createConnection({
      host: env.DB.host,
      port: env.DB.port,
      user: env.DB.user,
      password: env.DB.password,
      multipleStatements: true,
    });

    const sqlFile = path.join(__dirname, 'migrations', '001_init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('[迁移] 开始执行 SQL...');
    await conn.query(sql);
    console.log('[迁移] 数据库初始化完成 ✅');

    // 验证表是否创建成功
    await conn.changeUser({ database: env.DB.database });
    const [tables] = await conn.query('SHOW TABLES');
    console.log(`[迁移] 当前表列表 (${tables.length} 个):`);
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      console.log(`  - ${tableName}`);
    }

    // 验证默认分类数据
    const [cats] = await conn.query('SELECT * FROM categories ORDER BY sort_order');
    console.log(`[迁移] 默认分类 (${cats.length} 个):`);
    for (const cat of cats) {
      console.log(`  - ${cat.emoji} ${cat.name} (冷藏${cat.cold_days}天/冷冻${cat.frozen_days}天/常温${cat.room_days}天)`);
    }

  } catch (err) {
    console.error('[迁移] 失败:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
