// ======================================================
// 檢查「接下來可以問」的追問建議
//
// 1. 檢查 followups.js 裡專屬追問用到的 slug，都存在於知識庫種子檔
//    （slug 打錯或條目被改名，追問就不會出現）
// 2. 對狗、貓各列出所有可能出現的追問，逐題做檢索，
//    看看使用者點下去之後，能不能用到知識庫內容
//
// 用法（在 pet-api 目錄）：
//   node scripts/test-followups.js            # 檢查 slug + 檢索
//   node scripts/test-followups.js --slugs    # 只檢查 slug（不需要 API key 與資料庫）
// ======================================================

const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { FOLLOWUP_SLUGS, listAllFollowups } = require('../src/services/followups')
const { parseSeed } = require('./ingest-kb')

const SEED = path.join(__dirname, '..', 'knowledge', 'kb_seed_v5.md')
const slugsOnly = process.argv.includes('--slugs')

async function main() {
  // ---------- 1. slug 檢查 ----------
  const seedFile = fs.existsSync(SEED)
    ? SEED
    : path.join(__dirname, '..', 'knowledge', fs.readdirSync(path.join(__dirname, '..', 'knowledge')).filter(f => f.startsWith('kb_seed_')).sort().pop())

  const docs = parseSeed(fs.readFileSync(seedFile, 'utf8'))
  const known = new Set(docs.map(d => d.slug))
  const missing = FOLLOWUP_SLUGS.filter(s => !known.has(s))

  console.log(`種子檔：${path.basename(seedFile)}（${docs.length} 份文件）`)
  console.log(
    missing.length
      ? `❌ 追問用到、但知識庫沒有的 slug：${missing.join('、')}`
      : `✅ 追問用到的 ${FOLLOWUP_SLUGS.length} 個 slug 都存在於知識庫`
  )

  if (slugsOnly) {
    process.exit(missing.length ? 1 : 0)
  }

  // ---------- 2. 檢索檢查 ----------
  const pool = require('../src/db')
  const { retrieveKnowledge, getConfig } = require('../src/services/knowledge')

  const REAL = getConfig()
  process.env.KB_MAX_DISTANCE = '2'
  process.env.KB_RELATIVE_MARGIN = '9'

  let total = 0
  let hit = 0
  const misses = []

  for (const species of ['dog', 'cat']) {
    console.log(`\n==================== ${species === 'dog' ? '狗' : '貓'} ====================`)

    for (const text of listAllFollowups(species)) {
      const items = await retrieveKnowledge({ question: text, species, limit: 5 })
      const best = items[0]
      const used = best && best.distance <= REAL.maxDistance

      total++
      if (used) hit++
      else misses.push(`[${species}] ${text}`)

      console.log(
        `${used ? '✅' : '⚪'} ${text}` +
          (best ? `\n     最近 ${best.distance.toFixed(3)} ${best.slug}` : '\n     無結果')
      )
    }
  }

  console.log('\n==================== 結果 ====================')
  console.log(`共 ${total} 則追問，其中 ${hit} 則點下去會用到知識庫，${total - hit} 則不會。`)
  console.log(`目前門檻：KB_MAX_DISTANCE = ${REAL.maxDistance}`)

  if (misses.length) {
    console.log('\n不會用到知識庫的追問（建議改問法，或補知識庫內容）：')
    misses.forEach(m => console.log('  - ' + m))
  }

  await pool.end()
}

main().catch(err => {
  console.error('測試失敗：', err.message)
  process.exit(1)
})
