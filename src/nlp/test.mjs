/**
 * FFood NLP 抽取准确率测试脚本
 * 运行：node src/nlp/test.mjs
 */
import { extractFood, extractRecipe } from './extractor.js'
import fixtures from './fixtures.json' with { type: 'json' }

let pass = 0
let fail = 0

console.log('========== FFood NLP 测试 ==========\n')

// 食材用例
console.log('--- 食材抽取 ---')
for (const c of fixtures.food_cases) {
  const r = await extractFood(c.input)
  if (checkFood(c, r)) {
    pass++
    console.log(`✅ #${c.id} ${c.input} → ${r.name} ${r.quantity}${r.unit} ${r.storage || ''} ${r.days ? r.days + '天' : ''}`.trim())
  } else {
    fail++
    console.log(`❌ #${c.id} ${c.input}`)
    console.log(`   期望: ${JSON.stringify(c.expect)}`)
    console.log(`   实际: name=${r.name} qty=${r.quantity} unit=${r.unit} storage=${r.storage||'-'} days=${r.days||'-'} cat=${r.category||'-'}`)
  }
}

// 食谱用例
console.log('\n--- 食谱抽取 ---')
for (const c of fixtures.recipe_cases) {
  const r = await extractRecipe(c.input)
  if (checkRecipe(c, r)) {
    pass++
    console.log(`✅ #${c.id} ${r.name} / ${r.difficulty} / ${r.time}min / 食材[${r.ingredients.join(',')}] / 步骤${r.steps.length}步`)
  } else {
    fail++
    console.log(`❌ #${c.id} ${c.input}`)
    console.log(`   期望: ${JSON.stringify(c.expect)}`)
    console.log(`   实际: name=${r.name} diff=${r.difficulty} time=${r.time} ing=[${r.ingredients.join(',')}] steps=${r.steps.length}`)
  }
}

console.log('\n========== 结果 ==========')
const total = pass + fail
const rate = total > 0 ? Math.round((pass / total) * 100) : 0
console.log(`通过: ${pass}/${total}  失败: ${fail}  准确率: ${rate}%`)
console.log(rate >= 80 ? '✅ 验收达标（≥80%）' : '❌ 准确率未达 80% 阈值')
process.exit(rate >= 80 ? 0 : 1)

function checkFood(c, r) {
  const e = c.expect
  if (e.name && r.name !== e.name) return false
  if (e.quantity !== undefined && Math.abs(r.quantity - e.quantity) > 0.15) return false
  if (e.unit && r.unit !== e.unit) return false
  if (e.storage && r.storage !== e.storage) return false
  if (e.days !== undefined && r.days !== e.days) return false
  if (e.category && r.category !== e.category) return false
  return true
}

function checkRecipe(c, r) {
  const e = c.expect
  if (e.name && r.name !== e.name) return false
  if (e.difficulty && r.difficulty !== e.difficulty) return false
  if (e.time !== undefined && r.time !== e.time) return false
  if (e.ingredients_includes) {
    for (const ing of e.ingredients_includes) {
      if (!r.ingredients.includes(ing) && !r.ingredients.some(x => x.includes(ing) || ing.includes(x))) return false
    }
  }
  if (e.steps_min_count !== undefined && r.steps.length < e.steps_min_count) return false
  return true
}
