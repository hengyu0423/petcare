// ======================================================
// 寵物健康知識庫（RAG 檢索）
//
// 流程：問題 → Gemini embedding（RETRIEVAL_QUERY）→ pgvector 餘弦距離檢索
//       → 取前幾段相關知識 → 放進健康諮詢的 prompt。
//
// 設計重點：
//   1. 與聊天模型完全分開（聊天用 Groq，向量用 Gemini embedding），
//      所以隊友更換聊天模型或 API key，不會影響知識庫。
//   2. 檢索失敗一律回傳 []，聊天照常運作（降級為原本流程）。
//   3. 向量維度固定 768，必須與 kb_chunks.embedding vector(768) 一致。
//      768 維不是 API 預先正規化的，所以寫入與查詢前都自己做 L2 正規化。
//
// 可用環境變數（都有預設值）：
//   GEMINI_API_KEY          既有
//   GEMINI_EMBEDDING_MODEL  預設 gemini-embedding-001
//   KB_ENABLED              設成 false 可整個關閉檢索
//   KB_TOP_K                最多放進 prompt 的知識段數，預設 4
//   KB_MAX_DISTANCE         餘弦距離上限，預設 0.33。
//                           依 22 題實測：相關題第 1 名最大 0.279；
//                           「與寵物有關但知識庫沒有」的題目第 1 名為 0.357～0.399；
//                           完全無關的題目為 0.456 以上。0.33 落在 0.279 與 0.357 之間。
//                           寧可漏掉（退回沒有檢索的原本流程），也不要把不相關的資料塞進 prompt。
//   KB_RELATIVE_MARGIN      只保留「距離不超過第 1 名 + 此值」的段落，預設 0.07。
//                           實測相關與不相關段落的距離很接近（常差不到 0.1），
//                           只靠上限濾不掉同主題旁邊的雜訊，所以再加相對門檻。
// ======================================================

const { GoogleGenAI } = require('@google/genai')
const pool = require('../db')

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
const EMBEDDING_DIM = 768

const DEFAULTS = {
  topK: 4,
  maxDistance: 0.33,
  relativeMargin: 0.07
}

// 每次呼叫時才讀環境變數（方便測試腳本臨時覆寫）
function getConfig() {
  return {
    enabled: process.env.KB_ENABLED !== 'false',
    topK: Number(process.env.KB_TOP_K || DEFAULTS.topK),
    maxDistance: Number(process.env.KB_MAX_DISTANCE || DEFAULTS.maxDistance),
    relativeMargin: Number(
      process.env.KB_RELATIVE_MARGIN || DEFAULTS.relativeMargin
    )
  }
}

// 每段知識放進 prompt 時的字數上限，避免 prompt 過長
const MAX_CHARS_PER_ITEM = 600

let ai = null

function getAi() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return ai
}

function normalize(values) {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0))
  if (!norm) return values
  return values.map(v => v / norm)
}

function toVectorLiteral(values) {
  return '[' + values.join(',') + ']'
}

// taskType：文件用 RETRIEVAL_DOCUMENT，使用者問題用 RETRIEVAL_QUERY
async function embedTexts(texts, taskType) {
  const res = await getAi().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIM
    }
  })

  const embeddings = res.embeddings || []

  if (embeddings.length !== texts.length) {
    throw new Error(
      `embedding 數量不符：送出 ${texts.length}，收到 ${embeddings.length}`
    )
  }

  return embeddings.map(e => {
    const values = e.values || []
    if (values.length !== EMBEDDING_DIM) {
      throw new Error(
        `embedding 維度不符：預期 ${EMBEDDING_DIM}，收到 ${values.length}`
      )
    }
    return normalize(values)
  })
}

// ------------------------------------------------------
// 檢索
//   species：'dog' | 'cat'（其他值或空值則不過濾）
//   傳回每份文件最相關的一段，依距離由近到遠。
// ------------------------------------------------------
async function retrieveKnowledge({ question, species, limit }) {
  const cfg = getConfig()
  if (!cfg.enabled) return []
  const topK = limit || cfg.topK

  const text = String(question || '').trim()
  if (!text) return []

  try {
    const [vec] = await embedTexts([text.slice(0, 600)], 'RETRIEVAL_QUERY')

    const speciesFilter =
      species === 'dog' || species === 'cat' ? species : null

    const result = await pool.query(
      `
      SELECT
        d.id,
        d.slug,
        d.title,
        d.category,
        d.severity_hint,
        d.source_name,
        d.source_url,
        c.content,
        (c.embedding <=> $1::vector) AS distance
      FROM kb_chunks c
      JOIN kb_documents d ON d.id = c.document_id
      WHERE d.is_active
        AND c.embedding IS NOT NULL
        AND ($2::text IS NULL OR d.species IN ($2::text, 'both'))
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
      `,
      [toVectorLiteral(vec), speciesFilter, topK * 3]
    )

    // 每份文件只留最相關的一段
    const seen = new Set()
    const candidates = []

    for (const row of result.rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)

      const distance = Number(row.distance)
      if (seen.size <= 5) {
        console.log(`[KB] ${row.slug} distance=${distance.toFixed(3)}`)
      }

      // 1) 絕對上限：太遠的一律不要（例如與寵物無關的問題）
      if (distance > cfg.maxDistance) continue

      candidates.push({
        slug: row.slug,
        title: row.title,
        category: row.category,
        severityHint: row.severity_hint,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        content: row.content,
        distance
      })
    }

    // 2) 相對門檻：只留跟第 1 名距離差不多的，濾掉同主題旁邊的雜訊
    //    （結果已依距離由近到遠排序）
    const best = candidates.length ? candidates[0].distance : null
    const items = candidates
      .filter(item => item.distance <= best + cfg.relativeMargin)
      .slice(0, topK)

    return items
  } catch (err) {
    console.error('知識庫檢索失敗（已略過，不影響回覆）：', err.message)
    return []
  }
}

// ------------------------------------------------------
// 轉成放進 prompt 的文字；沒有結果時回傳空字串（prompt 與原本完全相同）
// ------------------------------------------------------
function formatKnowledgeForPrompt(items) {
  if (!Array.isArray(items) || items.length === 0) return ''

  const blocks = items
    .map((item, i) => {
      const text =
        item.content.length > MAX_CHARS_PER_ITEM
          ? item.content.slice(0, MAX_CHARS_PER_ITEM) + '…'
          : item.content

      return `[${i + 1}] ${item.title}（${item.sourceName}）\n${text}`
    })
    .join('\n\n')

  return `
【參考資料（獸醫資料庫摘錄，僅供參考）】

${blocks}

使用參考資料的規則：

- 回答時優先依據上述資料；資料沒有涵蓋的部分不要編造，
  可以說明不確定，並建議就醫。
- 資料中的「禁食、限水、用藥」屬於獸醫的處置，
  絕對不要寫成對飼主的直接指示（例如「先禁食 24 小時」「先給某某藥」），
  只能說明「獸醫可能會…，是否需要請依獸醫指示」。
  另外，不要建議飼主自行限制飲水。
- 資料提到的分級警訊（例如尿不出來、呼吸困難、中毒），
  若與你的分級判斷不同，以較保守（較高）的分級為準。
- 急救或居家處置只能依上述資料；資料沒有寫的處置
  （例如催吐、餵牛奶或水、餵人用藥），不要自行建議，
  請飼主先聯絡獸醫，由獸醫指示怎麼做。
- 不要在 content 裡寫網址或「參考資料[1]」之類的標記，
  來源會由系統另外顯示。
- 仍要遵守上面的回答格式與字數限制。
`
}

// ------------------------------------------------------
// 依 slug 取得要顯示的來源資料
//
// 前端儲存 AI 回覆時，只傳來源的 slug；來源名稱與網址一律由資料庫查出來，
// 不信任前端傳來的網址（避免被塞入不明連結）。
// 回傳順序與傳入順序相同，並自動去除重複與不存在的 slug。
// ------------------------------------------------------
async function resolveSourceSlugs(slugs) {
  const wanted = [
    ...new Set(
      (Array.isArray(slugs) ? slugs : [])
        .filter(s => typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s))
    )
  ].slice(0, 8)

  if (wanted.length === 0) return []

  const result = await pool.query(
    `SELECT slug, title, source_name, source_url
       FROM kb_documents
      WHERE slug = ANY($1::text[])`,
    [wanted]
  )

  const bySlug = new Map(result.rows.map(r => [r.slug, r]))

  return wanted
    .filter(slug => bySlug.has(slug))
    .map(slug => {
      const r = bySlug.get(slug)
      return {
        slug: r.slug,
        title: r.title,
        source: r.source_name,
        url: r.source_url
      }
    })
}

module.exports = {
  DEFAULTS,
  getConfig,
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
  embedTexts,
  toVectorLiteral,
  retrieveKnowledge,
  formatKnowledgeForPrompt,
  resolveSourceSlugs
}
