// ======================================================
// 知識庫 embedding 回填腳本
//
// 只處理 kb_chunks 中 embedding IS NULL 的切片，
// 已補齊的切片完全不動（不重新切片、不刪除、不改內容）。
//
// 用法（在 pet-api 目錄）：
//   node scripts/backfill-kb-embeddings.js --dry-run   只列出待補筆數，不呼叫 API、不寫資料庫
//   node scripts/backfill-kb-embeddings.js             正式回填
//
// 與 ingest-kb.js 一致：
//   - 文件用 RETRIEVAL_DOCUMENT
//   - embedding_model 寫成 gemini-embedding-001@768
//   - 送入 embedding 的文字為「標題 + 切片內容」，並做 L2 正規化
// ======================================================

const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const DRY_RUN = process.argv.slice(2).includes('--dry-run')

const BATCH_SIZE = 16
const BATCH_DELAY_MS = 800

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function embedWithRetry(embedTexts, texts, retries = 4) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await embedTexts(texts, 'RETRIEVAL_DOCUMENT')
    } catch (err) {
      if (attempt >= retries) throw err
      const wait = 2000 * 2 ** attempt
      console.warn(`embedding 失敗（${err.message}），${wait}ms 後重試…`)
      await sleep(wait)
    }
  }
}

async function countMissing(pool) {
  const res = await pool.query(
    'SELECT COUNT(*)::int AS missing FROM kb_chunks WHERE embedding IS NULL'
  )
  return res.rows[0].missing
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL（請設定在 pet-api/.env）')
  }

  const {
    EMBEDDING_MODEL,
    EMBEDDING_DIM,
    embedTexts,
    toVectorLiteral
  } = require('../src/services/knowledge')

  const modelTag = `${EMBEDDING_MODEL}@${EMBEDDING_DIM}`

  if (!DRY_RUN && !process.env.GEMINI_API_KEY) {
    throw new Error('缺少 GEMINI_API_KEY（請設定在 pet-api/.env）')
  }

  const pool = require('../src/db')

  try {
    const before = await countMissing(pool)
    console.log(`embedding 為 NULL 的切片：${before} 筆`)
    console.log(`使用模型：${EMBEDDING_MODEL}，維度 ${EMBEDDING_DIM}，embedding_model=${modelTag}`)

    if (before === 0) {
      console.log('沒有需要補的資料。')
      return
    }

    const result = await pool.query(
      `SELECT c.id, c.chunk_index, c.content, d.title
         FROM kb_chunks c
         JOIN kb_documents d ON d.id = c.document_id
        WHERE c.embedding IS NULL
        ORDER BY c.id`
    )
    const items = result.rows

    if (DRY_RUN) {
      console.log(`（--dry-run：未呼叫 embedding API，也未寫入資料庫）`)
      return
    }

    let updated = 0

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const inputs = batch.map(it => `${it.title}\n${it.content}`)

      const vectors = await embedWithRetry(embedTexts, inputs)

      for (let j = 0; j < batch.length; j++) {
        const res = await pool.query(
          `UPDATE kb_chunks
              SET embedding = $1::vector,
                  embedding_model = $2
            WHERE id = $3
              AND embedding IS NULL`,
          [toVectorLiteral(vectors[j]), modelTag, batch[j].id]
        )
        updated += res.rowCount
      }

      console.log(`已補 ${Math.min(i + BATCH_SIZE, items.length)} / ${items.length}`)
      if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY_MS)
    }

    const after = await countMissing(pool)
    console.log(`本次更新 ${updated} 筆；embedding 仍為 NULL 的切片：${after} 筆`)
    if (after !== 0) process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('回填失敗：', err.message)
    process.exit(1)
  })
}

module.exports = { main }
