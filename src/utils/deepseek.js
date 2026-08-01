/**
 * DeepSeek API 集成模块（前端直接调用版）
 * 
 * 用途：当后端不可用时，前端直接调用 DeepSeek API 获取食材保存天数推荐
 * 注意：生产环境应通过后端调用，避免暴露 API Key
 *       此模块仅在开发/演示阶段使用
 * 
 * DeepSeek API 端点：https://api.deepseek.com/v1/chat/completions
 * 模型：deepseek-chat
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

// API Key 从环境变量读取（.env.local 中配置 VITE_DEEPSEEK_API_KEY）
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''

export const HAS_DEEPSEEK_KEY = !!API_KEY

/**
 * 调用 DeepSeek API 智能推荐食材保存天数
 * 
 * @param {string} name - 食材名称（如 "白菜"、"鸡胸肉"）
 * @param {string} category - 分类（蔬菜/水果/肉类/乳制品/调料/主食/其他）
 * @param {string} storage - 储存方式（冷藏/冷冻/常温）
 * @returns {Promise<{days: number, reason: string, tips: string}>}
 */
export async function recommendShelfLife(name, category, storage) {
  if (!HAS_DEEPSEEK_KEY) {
    // 无 API Key 时 fallback 到静态推荐
    return staticRecommend(name, category, storage)
  }

  const prompt = `你是一个食品安全与保鲜专家。请根据以下信息推荐保存天数：

食材名称：${name}
分类：${category}
储存方式：${storage}

请严格按照以下 JSON 格式返回（不要包含其他内容）：
{
  "days": <数字，建议保存天数>,
  "reason": "<简短说明为什么是这个天数，30字以内>",
  "tips": "<保鲜小贴士，如包裹方式/注意事项，50字以内>"
}

注意事项：
- 冷藏温度 0-4°C，冷冻 -18°C 以下，常温为室内阴凉处
- 绿叶蔬菜冷藏一般 3-5 天，不宜冷冻
- 肉类冷藏 1-3 天，冷冻可达 3-12 个月
- 解冻后的肉类不宜再次冷冻
- 数据基于常见家庭场景，给出保守安全的建议`

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: '你是食品安全专家，专注家庭食材保鲜。回答必须是指定格式的 JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,  // 低温度保证结果稳定
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.warn('[DeepSeek] API 调用失败，fallback 到静态推荐:', response.status)
      return staticRecommend(name, category, storage)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return staticRecommend(name, category, storage)
    }

    const parsed = JSON.parse(content)

    // 校验返回数据
    const days = parseInt(parsed.days) || staticRecommend(name, category, storage).days
    const reason = parsed.reason || 'AI 推荐'
    const tips = parsed.tips || ''

    return {
      days: Math.min(Math.max(days, 0.5), 365),  // 限制在 0.5-365 天
      reason,
      tips,
      source: 'ai',
    }
  } catch (err) {
    console.warn('[DeepSeek] 调用异常，fallback 到静态推荐:', err)
    return staticRecommend(name, category, storage)
  }
}

/**
 * 推荐品类查询
 * 返回常见家庭日用品的更换周期推荐
 * 
 * @returns {Array<{name, cycle, emoji, desc}>}
 */
export function getRecommendedCategories() {
  return [
    { name: '牙刷头', cycle: 90, emoji: '🪥', desc: '建议每 3 个月更换一次' },
    { name: '毛巾', cycle: 90, emoji: '🧖', desc: '建议每 3 个月更换，日常保持干燥' },
    { name: '洗碗海绵', cycle: 30, emoji: '🧽', desc: '建议每月更换，避免细菌滋生' },
    { name: '砧板', cycle: 365, emoji: '🪵', desc: '建议每年更换，有深痕及时换' },
    { name: '枕头', cycle: 730, emoji: '😴', desc: '建议 1-2 年更换，保持颈椎健康' },
    { name: '隐形眼镜盒', cycle: 90, emoji: '👁️', desc: '建议每 3 个月更换' },
    { name: '床单被套', cycle: 14, emoji: '🛏️', desc: '建议每 2 周清洗更换' },
    { name: '厨房抹布', cycle: 7, emoji: '🧹', desc: '建议每周更换或高温消毒' },
    { name: '滤水器滤芯', cycle: 180, emoji: '💧', desc: '建议每 6 个月更换' },
    { name: '浴花', cycle: 60, emoji: '🚿', desc: '建议每 2 个月更换' },
  ]
}

/**
 * 静态推荐（无 API Key 时的 fallback）
 * 基于公开的食品安全数据整理
 */
function staticRecommend(name, category, storage) {
  // 详细保鲜天数对照表（基于公开食品安全数据整理）
  const SHELF_LIFE = {
    '蔬菜': {
      '冷藏': {
        default: 5,
        // 绿叶菜
        '白菜': 5, '菠菜': 3, '生菜': 3, '油麦菜': 3, '油菜': 3,
        '芹菜': 7, '韭菜': 3, '空心菜': 3, '茼蒿': 3,
        // 根茎类
        '胡萝卜': 14, '白萝卜': 14, '土豆': 14, '红薯': 14, '山药': 14,
        '莲藕': 7, '洋葱': 30, '大蒜': 30, '生姜': 30,
        // 瓜果类蔬菜
        '西红柿': 5, '番茄': 5, '黄瓜': 5, '茄子': 5, '青椒': 7,
        '辣椒': 7, '西葫芦': 7, '丝瓜': 5, '苦瓜': 5, '冬瓜': 7,
        // 豆类/菌菇
        '豆角': 5, '四季豆': 5, '豌豆': 5, '西兰花': 5, '花菜': 7,
        '蘑菇': 5, '香菇': 7, '金针菇': 7, '杏鲍菇': 7, '平菇': 5,
        '木耳': 7, '海带': 7,
        // 其他
        '秋葵': 5, '玉米': 5, '南瓜': 14, '芋头': 14, '芦笋': 5,
        '豆芽': 3, '黄豆芽': 3, '绿豆芽': 3,
      },
      '冷冻': { default: 90 },
      '常温': { default: 3 },
    },
    '水果': {
      '冷藏': {
        default: 7,
        '苹果': 14, '橙子': 14, '橘子': 10, '柚子': 21, '柠檬': 21,
        '梨': 7, '桃': 5, '李子': 5, '樱桃': 5, '葡萄': 7,
        '草莓': 3, '蓝莓': 7, '猕猴桃': 10, '芒果': 5, '菠萝': 7,
        '西瓜': 5, '哈密瓜': 7, '榴莲': 3, '荔枝': 5, '龙眼': 5,
        '枇杷': 5, '杨梅': 3, '椰子': 7, '柿子': 10, '石榴': 14,
        '香蕉': 5, '木瓜': 5, '火龙果': 7,
      },
      '冷冻': { default: 60 },
      '常温': { default: 7 },
    },
    '肉类': {
      '冷藏': {
        default: 2,
        '猪肉': 2, '牛肉': 2, '羊肉': 2,
        '鸡肉': 2, '鸭肉': 2, '排骨': 2,
        '鱼': 1, '虾': 1, '蟹': 1,
        '五花肉': 2, '里脊': 2, '鸡胸': 2, '鸡腿': 2,
        '鸡翅': 2, '牛腩': 2, '牛排': 2,
        '草鱼': 1, '鲤鱼': 1, '鲈鱼': 1, '三文鱼': 1,
        '虾仁': 1, '带鱼': 1, '鱿鱼': 1,
        '肝脏': 1, '内脏': 1,
        '香肠': 4, '火腿': 4, '培根': 4, '腊肉': 7,
      },
      '冷冻': {
        default: 180,
        '猪肉': 270, '牛肉': 270, '羊肉': 270,
        '鸡肉': 365, '鸭肉': 270,
        '鱼': 180, '虾': 180, '蟹': 90,
        '排骨': 270, '五花肉': 270,
        '香肠': 60, '火腿': 60,
      },
      '常温': { default: 1 },
    },
    '乳制品': {
      '冷藏': {
        default: 14,
        '牛奶': 7, '酸奶': 14, '奶酪': 30,
        '黄油': 30, '奶油': 7, '芝士': 30,
        '鸡蛋': 35, '鸭蛋': 35, '鹌鹑蛋': 35,
      },
      '冷冻': { default: 90 },
      '常温': { default: 30 },
    },
    '调料': {
      '冷藏': { default: 180 },
      '冷冻': { default: 365 },
      '常温': { default: 365 },
    },
    '主食': {
      '冷藏': {
        default: 7,
        '米饭': 3, '面条': 3, '馒头': 5, '面包': 5,
        '包子': 3, '饺子': 3, '汤圆': 3,
        '玉米': 5, '燕麦': 30,
      },
      '冷冻': {
        default: 60,
        '饺子': 60, '包子': 60, '汤圆': 60, '馒头': 60,
      },
      '常温': {
        default: 180,
        '大米': 365, '面粉': 365, '面条': 365,
      },
    },
    '其他': {
      '冷藏': { default: 14 },
      '冷冻': { default: 90 },
      '常温': { default: 30 },
    },
  }

  const catMap = SHELF_LIFE[category] || SHELF_LIFE['其他']
  const storeMap = catMap[storage] || catMap['冷藏']

  // 先精确匹配食材名称，再模糊匹配，最后用 default
  let days = storeMap[name]
  if (!days) {
    // 模糊匹配
    for (const key in storeMap) {
      if (key !== 'default' && (name.includes(key) || key.includes(name))) {
        days = storeMap[key]
        break
      }
    }
  }
  if (!days) days = storeMap.default || 7

  return {
    days,
    reason: `基于${category}类${storage}保存数据`,
    tips: getStorageTips(name, category, storage),
    source: 'static',
  }
}

/**
 * 获取保鲜小贴士
 */
function getStorageTips(name, category, storage) {
  const tips = {
    '蔬菜': {
      '冷藏': '用厨房纸包裹后放入保鲜袋，吸收多余水分',
      '冷冻': '焯水后沥干分装冷冻，可延长保存',
      '常温': '置于阴凉通风处，避免阳光直射',
    },
    '水果': {
      '冷藏': '单独存放，避免释放乙烯加速其他水果成熟',
      '冷冻': '冷冻前不要清洗，平铺摆放防止粘连',
      '常温': '热带水果不宜冷藏，常温保存即可',
    },
    '肉类': {
      '冷藏': '务必密封分装，防止交叉污染',
      '冷冻': '按次分装冷冻，避免反复解冻',
      '常温': '常温下肉类极易变质，建议尽快食用',
    },
    '乳制品': {
      '冷藏': '开封后及时密封，防止串味',
      '冷冻': '冷冻后质地可能改变，建议尽快使用',
      '常温': '未开封 UHT 产品可常温保存',
    },
  }

  const catTips = tips[category] || tips['其他']
  return catTips[storage] || ''
}
