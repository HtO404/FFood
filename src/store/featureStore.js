// ==================== 功能开关 Store（本地隔离层） ====================
// 需求：健身指标 / 食材搭配 / 食谱 三类功能默认关闭（不删除代码），
//      用户可在「我的」页自行开启；预留未来付费解锁扩展点。
// 持久化：localStorage key = ffood_features

import { reactive } from 'vue'

const FEATURES_KEY = 'ffood_features'

// 功能开关定义：default=false 表示默认关闭
export const FEATURE_DEFS = [
  {
    key: 'fitness',
    name: '健身指标',
    desc: '身高/体重/年龄/健康目标、冰箱营养概览',
    icon: '💪',
    default: false,
  },
  {
    key: 'pairing',
    name: '食材搭配',
    desc: '根据冰箱食材智能匹配推荐菜谱（猜你喜欢）',
    icon: '🥘',
    default: false,
  },
  {
    key: 'recipes',
    name: '菜谱推荐',
    desc: '菜谱库、自定义菜谱、今天吃什么',
    icon: '📖',
    default: false,
  },
]

const DEFAULT_FLAGS = Object.fromEntries(FEATURE_DEFS.map(f => [f.key, f.default]))

function loadFlags() {
  try {
    const raw = localStorage.getItem(FEATURES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const flags = {}
      for (const def of FEATURE_DEFS) {
        flags[def.key] = typeof parsed[def.key] === 'boolean' ? parsed[def.key] : def.default
      }
      return flags
    }
  } catch (e) {
    console.error('[FFood] 功能开关加载失败:', e)
  }
  return { ...DEFAULT_FLAGS }
}

export function useFeatureStore() {
  const state = reactive({ flags: loadFlags() })

  function persist() {
    try {
      localStorage.setItem(FEATURES_KEY, JSON.stringify(state.flags))
    } catch (e) {
      console.error('[FFood] 功能开关保存失败:', e)
    }
  }

  function toggle(key) {
    if (!(key in state.flags)) return
    state.flags[key] = !state.flags[key]
    persist()
  }

  function setFlag(key, val) {
    if (!(key in state.flags)) return
    state.flags[key] = !!val
    persist()
  }

  /**
   * 未来付费解锁扩展点：当前恒返回 true（本地免费版）。
   * 接入付费体系后，可在此校验会员状态 / 解锁码。
   */
  function isUnlocked(key) {
    void key
    return true
  }

  function resetAll() {
    Object.assign(state.flags, DEFAULT_FLAGS)
    persist()
  }

  return { state, toggle, setFlag, isUnlocked, resetAll, defs: FEATURE_DEFS }
}
