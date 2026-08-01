// 食材路由
const express = require('express');
const router = express.Router();
const { list, create, update, remove, batchDelete } = require('../controllers/foodController');
const { authRequired } = require('../middleware/auth');

// 所有食材路由都需要认证
router.use(authRequired);

// 食材 CRUD
router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/batch-delete', batchDelete);

module.exports = router;
