// 鉴权路由
const express = require('express');
const router = express.Router();
const { register, login, verify, refresh } = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

// 注册——限流防刷
router.post('/register', rateLimit(5, 60000), register);

// 登录
router.post('/login', rateLimit(10, 60000), login);

// 验证 token（需要认证）
router.get('/verify', authRequired, verify);

// 刷新 token
router.post('/refresh', refresh);

module.exports = router;
