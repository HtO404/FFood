/**
 * NLP 食材/食谱抽取测试
 * 覆盖 fixtures.json 全部 15 个用例
 */
import { describe, it, expect } from 'vitest'
import { extractFood, extractRecipe } from '../src/nlp/extractor.js'
import fixtures from '../src/nlp/fixtures.json'

describe('NLP 食材抽取 (fixtures 1-10)', () => {
  const foodCases = fixtures.food_cases

  for (const c of foodCases) {
    it(`Case ${c.id}: "${c.input}"`, async () => {
      const result = await extractFood(c.input)

      // 名称必须匹配（注意同义词归一化：西红柿→番茄）
      expect(result.name).toBe(c.expect.name)

      // 数量
      if (c.expect.quantity !== undefined) {
        expect(result.quantity).toBeCloseTo(c.expect.quantity, 1)
      }

      // 单位
      if (c.expect.unit) {
        expect(result.unit).toBe(c.expect.unit)
      }

      // 储存方式
      if (c.expect.storage) {
        expect(result.storage).toBe(c.expect.storage)
      }

      // 分类
      if (c.expect.category) {
        expect(result.category).toBe(c.expect.category)
      }

      // 保质期天数
      if (c.expect.days !== undefined) {
        expect(result.days).toBe(c.expect.days)
      }

      // 置信度必须 > 0（至少匹配到 name）
      expect(result.confidence).toBeGreaterThan(0)
    })
  }
})

describe('NLP 食谱抽取 (fixtures 11-15)', () => {
  const recipeCases = fixtures.recipe_cases

  for (const c of recipeCases) {
    it(`Case ${c.id}: "${c.input}"`, async () => {
      const result = await extractRecipe(c.input)

      // 食谱名
      if (c.expect.name) {
        expect(result.name).toBe(c.expect.name)
      }

      // 难度
      if (c.expect.difficulty) {
        expect(result.difficulty).toBe(c.expect.difficulty)
      }

      // 时间（分钟）
      if (c.expect.time !== undefined) {
        expect(result.time).toBe(c.expect.time)
      }

      // 食材包含检查
      if (c.expect.ingredients_includes) {
        for (const ing of c.expect.ingredients_includes) {
          // 食材列表中应包含该食材（归一化后）
          const normalized = ing
          expect(
            result.ingredients.some(i => i === normalized || i.includes(normalized) || normalized.includes(i))
          ).toBe(true)
        }
      }

      // 步骤最少数量
      if (c.expect.steps_min_count !== undefined) {
        expect(result.steps.length).toBeGreaterThanOrEqual(c.expect.steps_min_count)
      }

      // 置信度
      expect(result.confidence).toBeGreaterThan(0)
    })
  }
})
