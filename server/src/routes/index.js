// 路由汇总
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const foodRoutes = require('./food');
const smartRoutes = require('./smart');

// 分类控制器直接挂在路由上（只有一个接口）
const categoryController = require('../controllers/categoryController');
const { authRequired } = require('../middleware/auth');

router.use('/auth', authRoutes);
router.use('/foods', foodRoutes);
router.use('/smart', smartRoutes);

// 分类列表——需要认证
router.get('/categories', authRequired, categoryController.list);

module.exports = router;
