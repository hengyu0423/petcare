// ======================================================
// 知識庫檢索測試（只測檢索，不呼叫聊天模型）
//
// 放在 pet-api/scripts/test-retrieve.js，在 pet-api 目錄執行：
//   node scripts/test-retrieve.js
//
// 做法：
//   - 先把距離上限放寬到 2，看「原始」的前 5 名與距離；
//   - 再用目前的 KB_MAX_DISTANCE（預設 0.55）判斷每題「會不會被採用」。
// 看完請依下方「怎麼讀結果」調整 KB_MAX_DISTANCE。
// ======================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/db')
const { retrieveKnowledge, getConfig } = require('../src/services/knowledge')

// 先記下「實際使用」的設定，再把門檻放寬，看原始的前 5 名
const REAL = getConfig()
process.env.KB_MAX_DISTANCE = '2'
process.env.KB_RELATIVE_MARGIN = '9'

// 依實際設定，算出這一題最終會採用哪幾段
function usedSlugs(items) {
  const near = items.filter(i => i.distance <= REAL.maxDistance)
  if (!near.length) return new Set()
  const best = near[0].distance
  return new Set(
    near
      .filter(i => i.distance <= best + REAL.relativeMargin)
      .slice(0, REAL.topK)
      .map(i => i.slug)
  )
}

// expect：期望出現在前 3 名的任一條（空陣列代表「不該有相關結果」）
const CASES = [
  { q: '我的狗吃了含木糖醇的口香糖', species: 'dog', expect: ['aspca-xylitol'] },
  { q: '貓咪偷吃了洋蔥，要緊嗎', species: 'cat', expect: ['aspca-allium'] },
  { q: '狗吃了葡萄怎麼辦', species: 'dog', expect: ['aspca-grapes-raisins'] },
  { q: '狗吃了巧克力', species: 'dog', expect: ['aspca-chocolate-caffeine'] },
  { q: '狗舔了汽車防凍劑', species: 'dog', expect: ['merck-ethylene-glycol'] },
  { q: '公貓一直蹲在貓砂盆，只尿出幾滴還在叫', species: 'cat', expect: ['merck-urethral-obstruction', 'merck-cat-flutd'] },
  { q: '貓一直用力排便卻排不出來', species: 'cat', expect: ['merck-cat-constipation', 'merck-urethral-obstruction'] },
  { q: '貓吐了好幾次，不太想吃東西', species: 'cat', expect: ['merck-cat-gastritis-vomiting', 'merck-cat-digestive-signs'] },
  { q: '貓喉嚨一直發出喘鳴聲，還張著嘴呼吸', species: 'cat', expect: ['merck-cat-breathing-difficulty', 'merck-cat-cough-asthma'] },
  { q: '狗一直乾咳，好像有東西卡在喉嚨', species: 'dog', expect: ['merck-dog-kennel-cough', 'merck-dog-chronic-bronchitis'] },
  { q: '夏天狗狗喘得很厲害，身體很燙', species: 'dog', expect: ['merck-emergency-heat-cold-transport'] },
  { q: '狗狗昏倒了沒有反應', species: 'dog', expect: ['merck-emergency-unconscious-cpr'] },
  { q: '狗吐了好幾次黃水', species: 'dog', expect: ['merck-dog-vomiting', 'merck-dog-digestive-signs'] },
  { q: '狗吐了，需要禁食嗎', species: 'dog', expect: ['merck-dog-vomiting', 'merck-dog-digestive-signs'] },
  { q: '4 公斤的絕育貓一天要吃多少熱量', species: 'cat', expect: ['merck-calories-rer-mer'] },
  { q: '幼犬一天要餵幾餐', species: 'dog', expect: ['merck-feeding-puppies'] },
  { q: '可以給貓吃狗飼料嗎', species: 'cat', expect: ['merck-cat-vs-dog-nutrition'] },
  { q: '狗可以每天吃零食嗎，一天最多多少', species: 'dog', expect: ['merck-feeding-adult-dogs'] },
  // 負向測試：與寵物健康無關，不應有相關結果
  { q: '今天台北天氣如何', species: 'dog', expect: [] },
  { q: '幫我寫一首關於秋天的詩', species: 'cat', expect: [] },
  // 資訊題（不計入通過與否）：跟寵物有關、但知識庫沒有的主題，看看距離落在哪
  { q: '狗要怎麼訓練坐下', species: 'dog', expect: null },
  { q: '貓咪有哪些品種適合新手養', species: 'cat', expect: null }
]

async function main() {
  let pass = 0
  let fail = 0
  const inScopeBest = []
  const offScopeBest = []

  for (const c of CASES) {
    const items = await retrieveKnowledge({ question: c.q, species: c.species, limit: 5 })
    const top3 = items.slice(0, 3).map(i => i.slug)
    const best = items[0] ? items[0].distance : null

    const used = usedSlugs(items)

    let ok
    if (c.expect === null) {
      ok = true // 資訊題
    } else if (c.expect.length === 0) {
      // 負向：依實際設定，不應該採用任何一段
      ok = used.size === 0
      if (best !== null) offScopeBest.push(best)
    } else {
      ok = c.expect.some(s => top3.includes(s))
      if (best !== null) inScopeBest.push(best)
    }

    if (c.expect !== null) ok ? pass++ : fail++

    const mark = c.expect === null ? 'ℹ️ ' : ok ? '✅' : '❌'
    const expectText =
      c.expect === null ? '（資訊題，不計分）'
      : c.expect.length ? c.expect.join(' 或 ')
      : '（無相關結果）'

    console.log(`\n${mark} [${c.species}] ${c.q}`)
    console.log(`   期望：${expectText}`)
    items.slice(0, 5).forEach((it, i) => {
      console.log(`   ${i + 1}. ${it.slug.padEnd(38)} 距離 ${it.distance.toFixed(3)}  ${used.has(it.slug) ? '採用' : '略過'}`)
    })
  }

  const avg = a => (a.reduce((s, v) => s + v, 0) / a.length).toFixed(3)
  console.log('\n==================== 結果 ====================')
  console.log(`通過 ${pass} / ${CASES.filter(c => c.expect !== null).length}，失敗 ${fail}`)
  if (inScopeBest.length) {
    console.log(`相關題「第 1 名距離」：最小 ${Math.min(...inScopeBest).toFixed(3)}、平均 ${avg(inScopeBest)}、最大 ${Math.max(...inScopeBest).toFixed(3)}`)
  }
  if (offScopeBest.length) {
    console.log(`無關題「第 1 名距離」：最小 ${Math.min(...offScopeBest).toFixed(3)}、平均 ${avg(offScopeBest)}`)
  }
  console.log(`目前設定：KB_MAX_DISTANCE = ${REAL.maxDistance}、KB_RELATIVE_MARGIN = ${REAL.relativeMargin}、KB_TOP_K = ${REAL.topK}`)

  await pool.end()
  process.exit(fail ? 1 : 0)
}

main().catch(async err => {
  console.error('測試失敗：', err.message)
  try { await pool.end() } catch (_) {}
  process.exit(1)
})
