// 云数据库连接工具
// 封装 wx-server-sdk 的初始化与集合访问，便于业务代码引用

const cloud = require('wx-server-sdk');

let inited = false;

/**
 * 初始化云开发 SDK
 * @param {string} env 云开发环境 ID；不传则按优先级读取环境变量 / DYNAMIC_CURRENT_ENV
 */
function init(env) {
  if (inited) return cloud;
  const finalEnv = env || process.env.CLOUD_ENV || cloud.DYNAMIC_CURRENT_ENV;
  cloud.init({ env: finalEnv });
  inited = true;
  return cloud;
}

/**
 * 获取 database 实例
 */
function db() {
  init();
  return cloud.database();
}

/**
 * 获取集合引用
 * @param {string} name 集合名
 */
function collection(name) {
  return db().collection(name);
}

/**
 * 获取数据库命令（用于 where 中的 and/or/gte 等）
 */
function command() {
  init();
  return cloud.database().command;
}

module.exports = { init, db, collection, command, cloud };
