// 智能推荐路由
const express = require('express');
const router = express.Router();
const { shelfLife, recommend } = require('../controllers/smartController');
const { authRequired } = require('../middleware/auth');

// 所有智能推荐路由都需要认证
router.use(authRequired);

// 智能推荐保存天数
router.post('/shelf-life', shelfLife);

// 推荐品类
router.get('/recommend', recommend);

module.exports = router;
