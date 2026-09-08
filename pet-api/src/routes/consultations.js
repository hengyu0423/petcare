const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const pool = require('../db')
const Groq = require('groq-sdk')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

router.use(requireAuth)

// ======================================================
// 取得某隻寵物的對話紀錄
// GET /consultations/pet/:petId
// ======================================================
router.get('/pet/:petId', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM health_consultations
      WHERE pet_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.params.petId]
    )

    // 資料庫先抓最新 50 筆，再反轉成聊天由舊到新的順序
    const messages = result.rows.reverse()

    res.json({
      success: true,
      data: messages
    })
  } catch (err) {
    console.error('取得對話紀錄失敗：', err)

    res.status(500).json({
      success: false,
      error: '無法取得對話紀錄'
    })
  }
})

// ======================================================
// AI 健康諮詢
// POST /consultations/ai
// ======================================================
router.post('/ai', async (req, res) => {
  try {
    const { systemPrompt, messages } = req.body

    // 檢查資料
    if (
      !systemPrompt ||
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: '缺少 systemPrompt 或 messages'
      })
    }

    // ==================================================
    // 過濾舊的 AI thinking process
    // ==================================================
    const badMarkers = [
      "Here's a thinking process",
      'Analyze User Input',
      'Self-Correction',
      'Verification during drafting',
      'Chain of Thought',
      'Reasoning:',
      '<think>'
    ]

    const cleanMessages = messages
      .filter(msg => {
        if (!msg) {
          return false
        }

        if (!['user', 'assistant'].includes(msg.role)) {
          return false
        }

        if (typeof msg.content !== 'string') {
          return false
        }

        // 使用者訊息保留
        if (msg.role === 'user') {
          return true
        }

        // 過濾掉舊的 AI thinking 回覆
        const text = msg.content.toLowerCase()

        return !badMarkers.some(marker =>
          text.includes(marker.toLowerCase())
        )
      })
      .slice(-6)

    // ==================================================
    // AI 回答規則
    // ==================================================
    const instructionPrompt = `
${systemPrompt}

請嚴格遵守以下規則：

- 你是一位寵物健康諮詢助手。
- 只回答與寵物健康有關的問題。
- 使用繁體中文。
- 只輸出飼主需要看到的最終答案。
- 不要輸出思考過程。
- 不要輸出推理步驟。
- 不要輸出分析流程。
- 不要輸出英文 reasoning。
- 不要輸出 <think> 標籤。
- 不要重複列出寵物的姓名、種類、體重等基本資料。
- 回答簡短直接。
- 回答控制在約 80～150 個中文字。
- 最多三個區塊。
- 不使用 #、##、### 標題。

回答格式：

**初步評估**
簡短說明目前可能的狀況。

**建議**
提供 1～2 個最重要、可以立即執行的建議。

**就醫提醒**
只有必要時才說明需要注意的警示症狀。

請直接回答，不要解釋你如何得到答案。
`

    // ==================================================
    // Groq 模型
    // ==================================================
    const model =
      process.env.GROQ_MODEL || 'qwen/qwen3.6-27b'

    console.log('目前 Groq 模型：', model)

    // ==================================================
    // 呼叫 Groq
    // ==================================================
    const completion = await groq.chat.completions.create({
      model,

      messages: [
        {
          role: 'user',
          content: instructionPrompt
        },
        ...cleanMessages
      ],

      // 關閉 Qwen reasoning
      reasoning_effort: 'none',

      // 不回傳 reasoning
      reasoning_format: 'hidden',

      // 限制輸出長度
      max_completion_tokens: 250,

      temperature: 0.7
    })

    // ==================================================
    // 取得 AI 回覆
    // ==================================================
    let content =
      completion.choices?.[0]?.message?.content?.trim() || ''

    console.log('AI 原始回覆：', completion.choices?.[0]?.message)
    console.log('AI 最終 content：', content)

    // ==================================================
    // 額外清除 <think>...</think>
    // ==================================================
    content = content.replace(
      /<think>[\s\S]*?<\/think>/gi,
      ''
    ).trim()

    // 如果有 </think>，只保留後面的正式答案
    if (content.includes('</think>')) {
      content =
        content.split('</think>').pop()?.trim() || ''
    }

    // ==================================================
    // 檢查是否還有 thinking process
    // ==================================================
    const stillContainsThinking = badMarkers.some(marker =>
      content
        .toLowerCase()
        .includes(marker.toLowerCase())
    )

    if (stillContainsThinking) {
      console.warn('偵測到不應顯示的 AI 分析內容：')
      console.warn(content)

      content = 'AI 回覆格式異常，請重新描述寵物目前的症狀。'
    }

    // 沒有取得內容
    if (!content) {
      content = '目前無法取得 AI 回覆，請稍後再試。'
    }

    // ==================================================
    // 回傳給前端
    // ==================================================
    res.json({
      success: true,
      data: {
        content
      }
    })
  } catch (err) {
    console.error('Groq API error：', err)

    // Rate Limit
    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'AI 目前請求較多，請稍後再試'
      })
    }

    // 找不到模型
    if (err.status === 404) {
      return res.status(500).json({
        success: false,
        error: '目前設定的 AI 模型無法使用'
      })
    }

    // API Key 問題
    if (err.status === 401) {
      return res.status(500).json({
        success: false,
        error: 'AI 服務驗證失敗'
      })
    }

    res.status(500).json({
      success: false,
      error: 'AI 回覆失敗，請稍後再試'
    })
  }
})

// ======================================================
// 儲存一則對話訊息
// POST /consultations
// ======================================================
router.post('/', async (req, res) => {
  const { petId, role, content } = req.body

  if (!petId || !role || !content) {
    return res.status(400).json({
      success: false,
      error: '缺少 petId、role 或 content'
    })
  }

  if (!['user', 'assistant'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: '無效的訊息角色'
    })
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO health_consultations
        (pet_id, role, content)
      VALUES
        ($1, $2, $3)
      RETURNING *
      `,
      [petId, role, content]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (err) {
    console.error('儲存對話訊息失敗：', err)

    res.status(500).json({
      success: false,
      error: '無法儲存對話訊息'
    })
  }
})

// ======================================================
// 清除某隻寵物的所有對話紀錄
// DELETE /consultations/pet/:petId
// ======================================================
router.delete('/pet/:petId', async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM health_consultations
      WHERE pet_id = $1
      `,
      [req.params.petId]
    )

    res.json({
      success: true
    })
  } catch (err) {
    console.error('清除對話紀錄失敗：', err)

    res.status(500).json({
      success: false,
      error: '無法清除對話紀錄'
    })
  }
})

module.exports = router