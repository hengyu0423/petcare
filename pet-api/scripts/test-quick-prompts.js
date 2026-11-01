// ======================================================
// 檢查「預先選項」能不能檢索到知識庫內容
//
// 讀取前端的 quickPromptData.js（健康諮詢頁的預先選項），
// 對狗、貓各跑一次檢索，列出每一題命中的條目與距離。
//
// 用法（在 pet-api 目錄）：
//   node scripts/test-quick-prompts.js
//
// 怎麼讀結果：
//   - 「採用」代表依目前的門檻（KB_MAX_DISTANCE、KB_RELATIVE_MARGIN）會被放進 prompt。
//   - 沒有命中的題目不一定有問題（例如純閒聊），但如果是你希望用到知識庫的題目，
//     可以改問法（讓用詞更接近條目），或補知識庫內容。
//   - 想新增預先選項，改 pet app/src/components/consult/quickPromptData.js，
//     再跑一次這個腳本確認。
// ======================================================

const path = require('path')
const { pathToFileURL } = require('url')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/db')
const { retrieveKnowledge, getConfig } = require('../src/services/knowledge')

const REAL = getConfig()
process.env.KB_MAX_DISTANCE = '2'
process.env.KB_RELATIVE_MARGIN = '9'

function usedSlugs(items) {
  const near = items.filter(i => i.distance <= REAL.maxDistance)
  if (!near.length) return []
  const best = near[0].distance
  return near
    .filter(i => i.distance <= best + REAL.relativeMargin)
    .slice(0, REAL.topK)
    .map(i => i.slug)
}

async function main() {
  const dataPath = path.resolve(
    __dirname,
    '..',
    '..',
    'pet app',
    'src',
    'components',
    'consult',
    'quickPromptData.js'
  )

  const { getQuickPromptCategories } = await import(
    pathToFileURL(dataPath).href
  )

  let total = 0
  let hit = 0
  const misses = []

  for (const species of ['dog', 'cat']) {
    console.log(`\n==================== ${species === 'dog' ? '狗' : '貓'} ====================`)

    for (const category of getQuickPromptCategories(species)) {
      console.log(`\n【${category.label}】`)

      for (const prompt of category.prompts) {
        const items = await retrieveKnowledge({
          question: prompt.text,
          species,
          limit: 5
        })

        const used = usedSlugs(items)
        const best = items[0]

        total++
        if (used.length) hit++
        else misses.push(`[${species}] ${category.label}／${prompt.label}（最近：${best ? best.slug + ' ' + best.distance.toFixed(3) : '無'}）`)

        console.log(
          `${used.length ? '✅' : '⚪'} ${prompt.label.padEnd(8)}` +
            (best
              ? ` 最近 ${best.distance.toFixed(3)} ${best.slug}` +
                (used.length ? `（採用 ${used.length} 段）` : '（未達門檻，略過）')
              : ' 無結果')
        )
      }
    }
  }

  console.log('\n==================== 結果 ====================')
  console.log(`共 ${total} 題，其中 ${hit} 題會用到知識庫，${total - hit} 題不會。`)
  console.log(`目前設定：KB_MAX_DISTANCE = ${REAL.maxDistance}、KB_RELATIVE_MARGIN = ${REAL.relativeMargin}、KB_TOP_K = ${REAL.topK}`)

  if (misses.length) {
    console.log('\n沒有用到知識庫的題目：')
    misses.forEach(m => console.log('  - ' + m))
  }

  await pool.end()
}

main().catch(async err => {
  console.error('測試失敗：', err.message)
  try { await pool.end() } catch (_) {}
  process.exit(1)
})
