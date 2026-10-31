// ======================================================
// 知識庫入庫腳本
//
// 讀取 knowledge/kb_seed_v5.md → 寫入 kb_documents →
// 切片 → Gemini embedding（RETRIEVAL_DOCUMENT）→ 寫入 kb_chunks
//
// 用法（在 pet-api 目錄）：
//   node scripts/ingest-kb.js --dry-run        只解析與切片，不連資料庫、不呼叫 API
//   node scripts/ingest-kb.js --check          只測試 embedding（確認模型名稱與維度）
//   node scripts/ingest-kb.js                  正式入庫（內容沒變的文件會略過）
//   node scripts/ingest-kb.js --force          全部重新切片與向量化
//   node scripts/ingest-kb.js --file knowledge/xxx.md
//
// 可重複執行：以 slug 為唯一鍵，內容變更才會重建切片。
// 來源狀態為 needs_primary_source 的條目會入庫但 is_active = false（不會被檢索到），
// 換成官方來源後把該條改成 draft_needs_review 再重跑即可啟用。
// ======================================================

const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const CHECK = args.includes('--check')
const FORCE = args.includes('--force')

const fileArgIndex = args.indexOf('--file')
const SEED_FILE = path.resolve(
  __dirname,
  '..',
  fileArgIndex >= 0 ? args[fileArgIndex + 1] : 'knowledge/kb_seed_v5.md'
)

const CHUNK_TARGET = 450 // 每段約 450 字（中文）
const CHUNK_MAX = 700
const BATCH_SIZE = 16
const BATCH_DELAY_MS = 800

// ------------------------------------------------------
// 解析種子檔
// ------------------------------------------------------
function parseList(value) {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '')
  if (!inner.trim()) return []
  return inner.split(',').map(s => s.trim()).filter(Boolean)
}

function parseSeed(text) {
  const normalized = text.replace(/\r\n/g, '\n')
  const parts = normalized.split(/\n(?=---\nid: )/).slice(1)
  const docs = []

  for (const part of parts) {
    const rest = part.replace(/^---\n/, '')
    const end = rest.indexOf('\n---\n')
    if (end < 0) throw new Error('找不到欄位區塊結尾：' + rest.slice(0, 60))

    const meta = {}
    for (const line of rest.slice(0, end).split('\n')) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }

    const content = rest.slice(end + 5).trim()

    if (!meta.id || !meta.title || !meta.species || !content) {
      throw new Error('條目缺少必要欄位：' + JSON.stringify(meta))
    }
    if (!['dog', 'cat', 'both'].includes(meta.species)) {
      throw new Error(`條目 ${meta.id} 的 species 不合法：${meta.species}`)
    }

    docs.push({
      slug: meta.id,
      title: meta.title,
      species: meta.species,
      category: meta.category || 'general',
      relatedEventTypes: parseList(meta.related_event_types || '[]'),
      severityHint: meta.severity_hint || null,
      sourceName: meta.source || '',
      sourceUrl: meta.source_url || '',
      retrievedOn: meta.retrieved || null,
      reviewStatus: meta.status || 'draft_needs_review',
      note: meta.note || null,
      content
    })
  }

  const slugs = new Set()
  for (const d of docs) {
    if (slugs.has(d.slug)) throw new Error('slug 重複：' + d.slug)
    slugs.add(d.slug)
    if (!d.sourceName || !d.sourceUrl) {
      throw new Error(`條目 ${d.slug} 缺少來源名稱或網址`)
    }
  }

  return docs
}

// ------------------------------------------------------
// 切片：依段落累積到約 CHUNK_TARGET 字；過長的段落再依句號切開
// ------------------------------------------------------
function splitLongParagraph(p) {
  if (p.length <= CHUNK_MAX) return [p]

  const sentences = p.split(/(?<=[。！？；])/)
  const out = []
  let buf = ''

  for (const s of sentences) {
    if (buf && (buf + s).length > CHUNK_TARGET) {
      out.push(buf)
      buf = ''
    }
    buf += s
  }
  if (buf) out.push(buf)

  return out
}

function chunkText(content) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph)

  const chunks = []
  let buf = ''

  for (const p of paragraphs) {
    if (buf && (buf + '\n\n' + p).length > CHUNK_TARGET) {
      chunks.push(buf)
      buf = p
    } else {
      buf = buf ? buf + '\n\n' + p : p
    }
  }
  if (buf) chunks.push(buf)

  return chunks
}

// ------------------------------------------------------
// 工具
// ------------------------------------------------------
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

// ------------------------------------------------------
// 主流程
// ------------------------------------------------------
async function main() {
  const docs = parseSeed(fs.readFileSync(SEED_FILE, 'utf8'))
  const plan = docs.map(d => ({ ...d, chunks: chunkText(d.content) }))
  const totalChunks = plan.reduce((s, d) => s + d.chunks.length, 0)

  console.log(`讀到 ${plan.length} 份文件、共 ${totalChunks} 個切片（${path.basename(SEED_FILE)}）`)

  const bySpecies = {}
  const byCategory = {}
  for (const d of plan) {
    bySpecies[d.species] = (bySpecies[d.species] || 0) + 1
    byCategory[d.category] = (byCategory[d.category] || 0) + 1
  }
  console.log('species：', bySpecies)
  console.log('category：', byCategory)

  const inactive = plan.filter(d => d.reviewStatus === 'needs_primary_source')
  if (inactive.length) {
    console.log('以下條目來源待換，會入庫但不啟用：', inactive.map(d => d.slug).join(', '))
  }

  if (DRY_RUN) {
    const longest = Math.max(...plan.flatMap(d => d.chunks.map(c => c.length)))
    console.log(`最長切片 ${longest} 字`)
    console.log('（--dry-run：未連資料庫，也未呼叫 embedding API）')
    return
  }

  const {
    EMBEDDING_MODEL,
    EMBEDDING_DIM,
    embedTexts,
    toVectorLiteral
  } = require('../src/services/knowledge')

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('缺少 GEMINI_API_KEY（請設定在 pet-api/.env）')
  }

  if (CHECK) {
    const [v] = await embedTexts(['貓咪嘔吐怎麼辦'], 'RETRIEVAL_QUERY')
    console.log(`embedding 測試成功：model=${EMBEDDING_MODEL}，維度=${v.length}（預期 ${EMBEDDING_DIM}）`)
    return
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL（請設定在 pet-api/.env）')
  }

  const pool = require('../src/db')
  const modelTag = `${EMBEDDING_MODEL}@${EMBEDDING_DIM}`

  try {
    // 1) 找出需要（重新）向量化的文件
    const todo = []

    for (const d of plan) {
      const existing = await pool.query(
        `SELECT d.id, d.content,
                (SELECT COUNT(*) FROM kb_chunks c
                  WHERE c.document_id = d.id
                    AND c.embedding IS NOT NULL
                    AND c.embedding_model = $2)::int AS embedded_chunks
           FROM kb_documents d WHERE d.slug = $1`,
        [d.slug, modelTag]
      )

      const row = existing.rows[0]
      const unchanged =
        row &&
        row.content === d.content &&
        row.embedded_chunks === d.chunks.length

      // 中繼資料（標題、來源、啟用狀態…）每次都更新，不需要重新向量化
      const isActive = d.reviewStatus !== 'needs_primary_source'

      const up = await pool.query(
        `INSERT INTO kb_documents
           (slug, title, species, category, related_event_types, severity_hint,
            source_name, source_url, retrieved_on, review_status, note, content, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           species = EXCLUDED.species,
           category = EXCLUDED.category,
           related_event_types = EXCLUDED.related_event_types,
           severity_hint = EXCLUDED.severity_hint,
           source_name = EXCLUDED.source_name,
           source_url = EXCLUDED.source_url,
           retrieved_on = EXCLUDED.retrieved_on,
           review_status = EXCLUDED.review_status,
           note = EXCLUDED.note,
           content = EXCLUDED.content,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
         RETURNING id`,
        [
          d.slug, d.title, d.species, d.category, d.relatedEventTypes,
          d.severityHint, d.sourceName, d.sourceUrl, d.retrievedOn,
          d.reviewStatus, d.note, d.content, isActive
        ]
      )

      if (FORCE || !unchanged) {
        todo.push({ ...d, id: up.rows[0].id })
      }
    }

    console.log(`文件已寫入；需要重新向量化的有 ${todo.length} 份`)

    // 2) 攤平成切片，分批 embedding
    const items = todo.flatMap(d =>
      d.chunks.map((text, i) => ({
        documentId: d.id,
        slug: d.slug,
        title: d.title,
        index: i,
        text
      }))
    )

    const vectors = new Map()

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      // 標題一起放進 embedding，讓每段都帶有主題資訊
      const inputs = batch.map(it => `${it.title}\n${it.text}`)
      const result = await embedWithRetry(embedTexts, inputs)

      batch.forEach((it, j) => vectors.set(`${it.documentId}:${it.index}`, result[j]))

      console.log(`embedding ${Math.min(i + BATCH_SIZE, items.length)} / ${items.length}`)
      if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY_MS)
    }

    // 3) 每份文件用一個 transaction 重建切片
    for (const d of todo) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM kb_chunks WHERE document_id = $1', [d.id])

        for (let i = 0; i < d.chunks.length; i++) {
          await client.query(
            `INSERT INTO kb_chunks (document_id, chunk_index, content, embedding, embedding_model)
             VALUES ($1, $2, $3, $4::vector, $5)`,
            [
              d.id,
              i,
              d.chunks[i],
              toVectorLiteral(vectors.get(`${d.id}:${i}`)),
              modelTag
            ]
          )
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM kb_documents)::int AS documents,
         (SELECT COUNT(*) FROM kb_documents WHERE is_active)::int AS active_documents,
         (SELECT COUNT(*) FROM kb_chunks)::int AS chunks`
    )
    console.log('入庫完成：', stats.rows[0])
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('入庫失敗：', err.message)
    process.exit(1)
  })
}

module.exports = { parseSeed, chunkText }
