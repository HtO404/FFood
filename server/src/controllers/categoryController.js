// 分类管理控制器
const { pool } = require('../config/database');
const { success, fail } = require('../utils/response');

/**
 * 获取分类列表
 * GET /api/categories
 * 返回默认分类 + 用户自定义分类（如果后续扩展）
 */
async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
    );

    res.json(success({ list: rows, total: rows.length }));
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
