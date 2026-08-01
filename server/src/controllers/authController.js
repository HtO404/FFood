// 鉴权控制器——注册/登录/验证Token/刷新Token
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const env = require('../config/env');
const { success, fail } = require('../utils/response');

/**
 * 注册
 * POST /api/auth/register
 * body: { username, password, nickname? }
 */
async function register(req, res, next) {
  try {
    const { username, password, nickname } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.status(400).json(fail('用户名和密码不能为空', 400));
    }
    if (username.length < 2 || username.length > 50) {
      return res.status(400).json(fail('用户名长度需在 2~50 之间', 400));
    }
    if (password.length < 6) {
      return res.status(400).json(fail('密码长度不能少于 6 位', 400));
    }

    // 检查用户名是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json(fail('用户名已被注册', 409));
    }

    // 哈希密码并插入
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)',
      [username, passwordHash, nickname || '']
    );

    // 生成 token
    const token = jwt.sign(
      { id: result.insertId, username },
      env.JWT.secret,
      { expiresIn: env.JWT.expiresIn }
    );
    const refreshToken = jwt.sign(
      { id: result.insertId, username },
      env.JWT.refreshSecret,
      { expiresIn: env.JWT.refreshExpiresIn }
    );

    res.status(201).json(success({
      token,
      refreshToken,
      user: {
        id: result.insertId,
        username,
        nickname: nickname || '',
        avatar: '',
        is_premium: 0,
      },
    }, '注册成功'));
  } catch (err) {
    next(err);
  }
}

/**
 * 登录
 * POST /api/auth/login
 * body: { username, password }
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(fail('用户名和密码不能为空', 400));
    }

    // 查询用户
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json(fail('用户名或密码错误', 401));
    }

    const user = rows[0];

    // 检查是否被锁定
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const remainMs = new Date(user.lock_until) - new Date();
      const remainMin = Math.ceil(remainMs / 60000);
      return res.status(403).json(fail(`账号已被锁定，请 ${remainMin} 分钟后再试`, 403));
    }

    // 校验密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      // 增加失败计数
      const failCount = user.login_fail_count + 1;
      const shouldLock = failCount >= env.SECURITY.maxLoginFail;

      await pool.query(
        'UPDATE users SET login_fail_count = ?, lock_until = ? WHERE id = ?',
        [
          failCount,
          shouldLock ? new Date(Date.now() + env.SECURITY.lockDuration * 60000) : null,
          user.id,
        ]
      );

      if (shouldLock) {
        return res.status(403).json(fail(`密码错误次数过多，账号已锁定 ${env.SECURITY.lockDuration} 分钟`, 403));
      }

      const remaining = env.SECURITY.maxLoginFail - failCount;
      return res.status(401).json(fail(`用户名或密码错误，还剩 ${remaining} 次尝试机会`, 401));
    }

    // 登录成功——重置失败计数
    await pool.query(
      'UPDATE users SET login_fail_count = 0, lock_until = NULL, last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // 生成 token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      env.JWT.secret,
      { expiresIn: env.JWT.expiresIn }
    );
    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      env.JWT.refreshSecret,
      { expiresIn: env.JWT.refreshExpiresIn }
    );

    res.json(success({
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        is_premium: user.is_premium,
      },
    }, '登录成功'));
  } catch (err) {
    next(err);
  }
}

/**
 * 验证 Token
 * GET /api/auth/verify
 * 需要 authRequired 中间件
 */
async function verify(req, res) {
  // authRequired 已挂载 req.user
  const [rows] = await pool.query(
    'SELECT id, username, nickname, avatar, is_premium FROM users WHERE id = ?',
    [req.user.id]
  );

  if (rows.length === 0) {
    return res.status(404).json(fail('用户不存在', 404));
  }

  res.json(success({
    valid: true,
    user: rows[0],
  }, 'token 有效'));
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 * body: { refreshToken }
 */
async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json(fail('缺少 refreshToken', 400));
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT.refreshSecret);
    const newToken = jwt.sign(
      { id: decoded.id, username: decoded.username },
      env.JWT.secret,
      { expiresIn: env.JWT.expiresIn }
    );
    res.json(success({ token: newToken }, '刷新成功'));
  } catch (err) {
    return res.status(401).json(fail('refreshToken 无效或已过期，请重新登录', 401));
  }
}

module.exports = { register, login, verify, refresh };
