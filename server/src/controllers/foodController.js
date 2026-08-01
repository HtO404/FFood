// 食材 CRUD 控制器
const { pool } = require('../config/database');
const { success, fail } = require('../utils/response');

/**
 * 获取食材列表
 * GET /api/foods?category=&storage=&search=
 */
async function list(req, res, next) {
  try {
    const userId = req.user.id;
    const { category, storage, search } = req.query;

    let sql = 'SELECT * FROM foods WHERE user_id = ?';
    const params = [userId];

    if (category && category !== '全部') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (storage && storage !== '全部') {
      sql += ' AND storage = ?';
      params.push(storage);
    }
    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY expiry_date ASC, created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(success({ list: rows, total: rows.length }));
  } catch (err) {
    next(err);
  }
}

/**
 * 添加食材
 * POST /api/foods
 * body: { name, category, quantity, unit, purchase_date, expiry_date, storage, days }
 */
async function create(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      name, category = '其他', quantity = 1.0, unit = '个',
      purchase_date, expiry_date, storage = '冷藏', days = 7.0,
    } = req.body;

    if (!name || !purchase_date || !expiry_date) {
      return res.status(400).json(fail('食材名称、购买日期、过期日期不能为空', 400));
    }

    const [result] = await pool.query(
      `INSERT INTO foods (user_id, name, category, quantity, unit, purchase_date, expiry_date, storage, days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, category, quantity, unit, purchase_date, expiry_date, storage, days]
    );

    // 同步更新模板表（方便下次添加时自动填充）
    await pool.query(
      `INSERT INTO food_templates (user_id, name, category, quantity, unit, storage)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category),
       quantity = VALUES(quantity), unit = VALUES(unit), storage = VALUES(storage),
       last_used = CURRENT_TIMESTAMP`,
      [userId, name, category, quantity, unit, storage]
    );

    res.status(201).json(success({ id: result.insertId }, '添加成功'));
  } catch (err) {
    next(err);
  }
}

/**
 * 更新食材
 * PUT /api/foods/:id
 */
async function update(req, res, next) {
  try {
    const userId = req.user.id;
    const foodId = req.params.id;
    const fields = [
      'name', 'category', 'quantity', 'unit',
      'purchase_date', 'expiry_date', 'storage', 'days',
    ];

    // 收集要更新的字段
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json(fail('没有需要更新的字段', 400));
    }

    values.push(foodId, userId);
    const [result] = await pool.query(
      `UPDATE foods SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(fail('食材不存在或无权操作', 404));
    }

    res.json(success({}, '更新成功'));
  } catch (err) {
    next(err);
  }
}

/**
 * 删除食材
 * DELETE /api/foods/:id
 */
async function remove(req, res, next) {
  try {
    const userId = req.user.id;
    const foodId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM foods WHERE id = ? AND user_id = ?',
      [foodId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(fail('食材不存在或无权操作', 404));
    }

    res.json(success({}, '删除成功'));
  } catch (err) {
    next(err);
  }
}

/**
 * 批量删除食材
 * POST /api/foods/batch-delete
 * body: { ids: [1, 2, 3] }
 */
async function batchDelete(req, res, next) {
  try {
    const userId = req.user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(fail('请提供要删除的食材 ID 列表', 400));
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await pool.query(
      `DELETE FROM foods WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, userId]
    );

    res.json(success({ deleted: result.affectedRows }, `已删除 ${result.affectedRows} 条食材`));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, batchDelete };
