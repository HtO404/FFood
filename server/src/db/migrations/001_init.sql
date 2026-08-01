-- FFood 数据库初始化脚本
-- 创建数据库及所有表

CREATE DATABASE IF NOT EXISTS ffood
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ffood;

-- ===== 用户表 =====
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  nickname VARCHAR(50) DEFAULT '' COMMENT '昵称',
  avatar VARCHAR(500) DEFAULT '' COMMENT '头像URL',
  is_premium TINYINT(1) DEFAULT 0 COMMENT '是否付费用户: 0否 1是',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
  login_fail_count INT DEFAULT 0 COMMENT '连续登录失败次数',
  lock_until TIMESTAMP NULL COMMENT '锁定截止时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ===== 食材库存表 =====
CREATE TABLE IF NOT EXISTS foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '所属用户ID',
  name VARCHAR(100) NOT NULL COMMENT '食材名称',
  category VARCHAR(50) NOT NULL DEFAULT '其他' COMMENT '分类',
  quantity DECIMAL(5,1) NOT NULL DEFAULT 1.0 COMMENT '数量',
  unit VARCHAR(20) DEFAULT '个' COMMENT '单位',
  purchase_date DATE NOT NULL COMMENT '购买日期',
  expiry_date DATE NOT NULL COMMENT '过期日期',
  storage VARCHAR(20) DEFAULT '冷藏' COMMENT '储存方式: 冷藏/冷冻/常温',
  days DECIMAL(5,1) DEFAULT 7.0 COMMENT '预计保存天数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_expiry_date (expiry_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='食材库存表';

-- ===== 分类管理表 =====
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT '分类名称',
  emoji VARCHAR(10) DEFAULT '' COMMENT '分类emoji',
  cold_days INT DEFAULT 7 COMMENT '冷藏默认保存天数',
  frozen_days INT DEFAULT 180 COMMENT '冷冻默认保存天数',
  room_days INT DEFAULT 3 COMMENT '常温默认保存天数',
  sort_order INT DEFAULT 0 COMMENT '排序权重'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类管理表';

-- ===== 食材模板表（用户表单记忆） =====
CREATE TABLE IF NOT EXISTS food_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '所属用户ID',
  name VARCHAR(100) NOT NULL COMMENT '食材名称',
  category VARCHAR(50) DEFAULT '其他' COMMENT '分类',
  quantity DECIMAL(5,1) DEFAULT 1.0 COMMENT '数量',
  unit VARCHAR(20) DEFAULT '个' COMMENT '单位',
  storage VARCHAR(20) DEFAULT '冷藏' COMMENT '储存方式',
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后使用时间',
  INDEX idx_user_id (user_id),
  UNIQUE INDEX uk_user_name (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='食材模板表';

-- ===== 购物清单表 =====
CREATE TABLE IF NOT EXISTS shop_list (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '所属用户ID',
  text VARCHAR(200) NOT NULL COMMENT '清单条目内容',
  checked TINYINT(1) DEFAULT 0 COMMENT '是否已勾选: 0否 1是',
  source VARCHAR(100) DEFAULT '' COMMENT '来源',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物清单表';

-- ===== 插入默认分类数据 =====
INSERT INTO categories (name, emoji, cold_days, frozen_days, room_days, sort_order) VALUES
  ('蔬菜', '🥬', 5, 180, 2, 1),
  ('水果', '🍎', 7, 180, 3, 2),
  ('肉类', '🥩', 3, 90, 1, 3),
  ('乳制品', '🥛', 7, 30, 0, 4),
  ('调料', '🧂', 180, 365, 365, 5),
  ('主食', '🍚', 7, 90, 30, 6),
  ('其他', '📦', 7, 180, 3, 7);
