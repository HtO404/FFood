// Express 应用入口
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const env = require('./config/env');
const { testConnection } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// 路由
const routes = require('./routes');

const app = express();

// ===== 中间件 =====
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志（简易版）
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ===== 路由挂载 =====
app.use('/api', routes);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

// ===== 错误处理 =====
app.use(notFound);
app.use(errorHandler);

// ===== 启动服务 =====
async function start() {
  // 测试数据库连接
  await testConnection();

  app.listen(env.PORT, () => {
    console.log(`[FFood Server] 服务已启动: http://localhost:${env.PORT}`);
    console.log(`[FFood Server] 环境: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch((err) => {
  console.error('[启动失败]', err);
  process.exit(1);
});

module.exports = app;
