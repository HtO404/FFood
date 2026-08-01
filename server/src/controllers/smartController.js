// 智能推荐控制器——调用 DeepSeek API
const https = require('https');
const http = require('http');
const { pool } = require('../config/database');
const env = require('../config/env');
const { success, fail } = require('../utils/response');

/**
 * 调用 DeepSeek API 的封装
 * @param {string} prompt - 用户 prompt
 * @returns {Promise<string>} - 模型回复文本
 */
function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.DEEPSEEK.apiUrl);
    const body = JSON.stringify({
      model: env.DEEPSEEK.model,
      messages: [
        {
          role: 'system',
          content: '你是一个食材保鲜专家。用户会告诉你食材名称、分类和储存方式，你需要返回推荐的保存天数。只返回一个数字，不要其他文字。例如：7',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 10,
      temperature: 0.1,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK.apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            resolve(parsed.choices[0].message.content.trim());
          } else {
            reject(new Error('DeepSeek API 返回格式异常'));
          }
        } catch (e) {
          reject(new Error('DeepSeek API 响应解析失败: ' + e.message));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

/**
 * 静态默认保存天数表（非付费用户使用）
 */
const DEFAULT_DAYS = {
  '蔬菜': { 冷藏: 5, 冷冻: 180, 常温: 2 },
  '水果': { 冷藏: 7, 冷冻: 180, 常温: 3 },
  '肉类': { 冷藏: 3, 冷冻: 90, 常温: 1 },
  '乳制品': { 冷藏: 7, 冷冻: 30, 常温: 0 },
  '调料': { 冷藏: 180, 冷冻: 365, 常温: 365 },
  '主食': { 冷藏: 7, 冷冻: 90, 常温: 30 },
  '其他': { 冷藏: 7, 冷冻: 180, 常温: 3 },
};

/**
 * 智能推荐保存天数
 * POST /api/smart/shelf-life
 * body: { name, category, storage }
 */
async function shelfLife(req, res, next) {
  try {
    const { name, category = '其他', storage = '冷藏' } = req.body;

    if (!name) {
      return res.status(400).json(fail('食材名称不能为空', 400));
    }

    const userId = req.user.id;

    // 查询用户是否付费
    const [rows] = await pool.query(
      'SELECT is_premium FROM users WHERE id = ?',
      [userId]
    );
    const isPremium = rows.length > 0 && rows[0].is_premium === 1;

    if (!isPremium) {
      // 非付费用户返回静态默认值
      const defaultDays = (DEFAULT_DAYS[category] || DEFAULT_DAYS['其他'])[storage] || 7;
      return res.json(success({
        days: defaultDays,
        source: 'static',
        is_premium: false,
      }, '使用默认保存天数（非付费用户）'));
    }

    // 付费用户调用 DeepSeek API
    if (!env.DEEPSEEK.apiKey) {
      // API Key 未配置，降级为静态值
      const defaultDays = (DEFAULT_DAYS[category] || DEFAULT_DAYS['其他'])[storage] || 7;
      return res.json(success({
        days: defaultDays,
        source: 'fallback',
        is_premium: true,
      }, 'API 未配置，使用默认值'));
    }

    const prompt = `食材：${name}，分类：${category}，储存方式：${storage}。请推荐保存天数。`;
    const aiResponse = await callDeepSeek(prompt);
    const days = parseFloat(aiResponse) || (DEFAULT_DAYS[category] || DEFAULT_DAYS['其他'])[storage] || 7;

    res.json(success({
      days,
      source: 'ai',
      is_premium: true,
    }, 'AI 推荐保存天数'));
  } catch (err) {
    next(err);
  }
}

/**
 * 推荐品类
 * GET /api/smart/recommend
 * 返回一些品类更换建议（如牙刷头一个月换一次）
 */
async function recommend(req, res, next) {
  try {
    const userId = req.user.id;

    // 查询用户是否付费
    const [rows] = await pool.query(
      'SELECT is_premium FROM users WHERE id = ?',
      [userId]
    );
    const isPremium = rows.length > 0 && rows[0].is_premium === 1;

    // 静态推荐列表
    const staticRecommendations = [
      { item: '牙刷头', cycle: 30, unit: '天', tip: '建议每月更换' },
      { item: '厨房抹布', cycle: 7, unit: '天', tip: '建议每周更换或消毒' },
      { item: '冰箱密封条', cycle: 180, unit: '天', tip: '半年检查一次' },
      { item: '砧板', cycle: 365, unit: '天', tip: '有深痕时应更换' },
      { item: '滤水器滤芯', cycle: 90, unit: '天', tip: '三个月更换一次' },
    ];

    if (!isPremium) {
      return res.json(success({
        list: staticRecommendations,
        source: 'static',
        is_premium: false,
      }));
    }

    // 付费用户调用 AI 生成更个性化的推荐
    if (!env.DEEPSEEK.apiKey) {
      return res.json(success({
        list: staticRecommendations,
        source: 'fallback',
        is_premium: true,
      }));
    }

    const prompt = '推荐 5 个家庭日用品的更换周期，返回 JSON 数组格式，每项包含 item、cycle(天数)、unit、tip 字段。';
    const aiResponse = await callDeepSeek(prompt);

    let recommendations;
    try {
      // 尝试解析 AI 返回的 JSON
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : staticRecommendations;
    } catch {
      recommendations = staticRecommendations;
    }

    res.json(success({
      list: recommendations,
      source: 'ai',
      is_premium: true,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = { shelfLife, recommend };
