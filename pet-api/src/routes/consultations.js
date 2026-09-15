const router = require('express').Router()

const requireAuth = require('../middleware/auth')
const pool = require('../db')
const Groq = require('groq-sdk')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

router.use(requireAuth)


// ======================================================
// 嚴重程度設定
// ======================================================

const SEVERITY_LABELS = {
  normal: '一般健康建議',
  urgent: '建議儘快就醫',
  emergency: '緊急救護'
}


// ======================================================
// 取得寵物年齡（月）
// ======================================================

function extractAgeMonths(text = '') {
  const monthMatch = text.match(/(\d+)\s*個月/)

  if (monthMatch) {
    return Number(monthMatch[1])
  }

  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*歲/)

  if (yearMatch) {
    return Math.round(Number(yearMatch[1]) * 12)
  }

  return null
}


// ======================================================
// 安全分級規則
//
// AI 判斷之後，再由程式做一次檢查。
// 避免像「幼貓腹瀉」卻被標成一般健康建議。
// ======================================================

function overrideSeverity(text, aiSeverity) {
  const source = String(text || '')
    .replace(/\s+/g, '')
    .toLowerCase()

  let severity = [
    'normal',
    'urgent',
    'emergency'
  ].includes(aiSeverity)
    ? aiSeverity
    : 'urgent'


  // ====================================================
  // 直接視為緊急狀況
  // ====================================================

  const emergencyKeywords = [
    '呼吸困難',
    '喘不過氣',
    '無法呼吸',
    '抽搐',
    '癲癇',
    '昏迷',
    '失去意識',
    '大量出血',
    '血流不止',
    '無法站立',
    '站不起來',
    '嚴重脫水',
    '明顯脫水',
    '血便',
    '吐血',
    '黑便',
    '中毒',
    '誤食毒物',
    '休克',
    '牙齦蒼白',
    '嘴唇發紫',
    '尿不出來',
    '無法排尿'
  ]

  const hasDirectEmergency =
    emergencyKeywords.some(keyword =>
      source.includes(keyword)
    )

  if (hasDirectEmergency) {
    return 'emergency'
  }


  // ====================================================
  // 判斷是不是幼齡寵物
  // ====================================================

  const ageMonths = extractAgeMonths(source)

  const isYoung =
    (ageMonths !== null && ageMonths < 12) ||
    source.includes('幼貓') ||
    source.includes('幼犬') ||
    source.includes('幼齡')


  // ====================================================
  // 腸胃症狀
  // ====================================================

  const hasDiarrhea =
    source.includes('腹瀉') ||
    source.includes('拉肚子') ||
    source.includes('稀便') ||
    source.includes('稀糞') ||
    source.includes('水便')

  const hasVomiting =
    source.includes('嘔吐') ||
    source.includes('一直吐') ||
    source.includes('反覆吐') ||
    source.includes('吐了')

  const hasDehydrationRisk =
    source.includes('脫水') ||
    source.includes('不喝水') ||
    source.includes('喝不下水') ||
    source.includes('無法喝水')


  // ====================================================
  // ⭐ 幼貓 / 幼犬 + 腹瀉或嘔吐
  // 保守提高成緊急救護
  // ====================================================

  if (
    isYoung &&
    (
      hasDiarrhea ||
      hasVomiting
    )
  ) {
    return 'emergency'
  }


  // ====================================================
  // 腸胃症狀 + 脫水
  // ====================================================

  if (
    (hasDiarrhea || hasVomiting) &&
    hasDehydrationRisk
  ) {
    return 'emergency'
  }


  // ====================================================
  // 反覆 / 持續症狀
  // ====================================================

  const hasPersistentSymptom =
    source.includes('持續') ||
    source.includes('反覆') ||
    source.includes('頻繁') ||
    source.includes('多次') ||
    source.includes('一直')


  if (
    hasPersistentSymptom &&
    (
      hasDiarrhea ||
      hasVomiting
    )
  ) {
    if (severity === 'normal') {
      severity = 'urgent'
    }
  }


  // ====================================================
  // 其他建議儘快就醫的症狀
  // ====================================================

  const urgentKeywords = [
    '精神萎靡',
    '精神不佳',
    '食慾不振',
    '完全不吃',
    '發燒',
    '高燒',
    '明顯疼痛',
    '跛腳',
    '咳嗽',
    '持續腹瀉',
    '持續嘔吐'
  ]

  const hasUrgent =
    urgentKeywords.some(keyword =>
      source.includes(keyword)
    )

  if (
    hasUrgent &&
    severity === 'normal'
  ) {
    severity = 'urgent'
  }


  return severity
}


// ======================================================
// 取得某隻寵物的對話紀錄
//
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
//
// POST /consultations/ai
// ======================================================

router.post('/ai', async (req, res) => {
  try {
    const {
      systemPrompt,
      messages
    } = req.body


    // ==================================================
    // 檢查資料
    // ==================================================

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

        if (
          !['user', 'assistant']
            .includes(msg.role)
        ) {
          return false
        }

        if (
          typeof msg.content !== 'string'
        ) {
          return false
        }

        if (msg.role === 'user') {
          return true
        }

        const text =
          msg.content.toLowerCase()

        return !badMarkers.some(marker =>
          text.includes(
            marker.toLowerCase()
          )
        )
      })
      .slice(-6)


    // ==================================================
    // 建立安全判斷用完整文字
    // ==================================================

    const safetyText = [
      systemPrompt,

      ...cleanMessages
        .filter(msg =>
          msg.role === 'user'
        )
        .map(msg =>
          msg.content
        )
    ].join('\n')


    // ==================================================
    // AI Prompt
    // ==================================================

    const instructionPrompt = `
${systemPrompt}

你是一位寵物健康諮詢與分級助手。

你必須根據寵物目前症狀，先判斷嚴重程度。

severity 只能使用以下三種：

normal
= 一般健康建議

urgent
= 建議儘快就醫

emergency
= 緊急救護


分級原則：

【emergency 緊急救護】

包含但不限於：

- 呼吸困難
- 抽搐或失去意識
- 大量出血
- 吐血或血便
- 中毒
- 無法站立
- 嚴重脫水
- 無法排尿
- 幼貓或幼犬出現腹瀉、反覆嘔吐等容易快速脫水的症狀
- 其他可能快速危及生命的情況


【urgent 建議儘快就醫】

包含：

- 持續腹瀉
- 反覆嘔吐
- 明顯食慾不振
- 精神萎靡
- 發燒
- 症狀持續或惡化


【normal 一般健康建議】

只有在症狀輕微、短暫，
且精神、食慾與活動正常時才能使用。


請特別注意：

幼齡動物的病情可能快速惡化，
判定時請採取較保守的安全標準。


回答規則：

- 使用繁體中文。
- 不輸出思考過程。
- 不輸出 reasoning。
- 不輸出 <think>。
- 不重複寵物基本資料。
- 回答簡短直接。
- 大約 80～150 個中文字。
- 最多三個區塊。


content 必須使用以下格式：

**初步評估**

簡短說明目前可能的狀況。

**建議**

提供 1～2 個最重要、可以立即執行的建議。

**就醫提醒**

說明是否需要立即或儘快就醫。


請只輸出 JSON，不要輸出其他文字：

{
  "severity": "normal 或 urgent 或 emergency",
  "content": "完整給飼主看的回答"
}
`


    // ==================================================
    // Groq 模型
    // ==================================================

    const model =
      process.env.GROQ_MODEL ||
      'openai/gpt-oss-20b'

    console.log(
      '目前 Groq 模型：',
      model
    )


    // ==================================================
    // 呼叫 Groq
    // ==================================================

    const completion =
      await groq.chat.completions.create({
        model,

        messages: [
          {
            role: 'system',
            content: instructionPrompt
          },

          ...cleanMessages
        ],

        reasoning_effort: 'low',

        include_reasoning: false,

        max_completion_tokens: 350,

        temperature: 0.3,

        response_format: {
          type: 'json_object'
        }
      })


    // ==================================================
    // 取得 AI 原始回覆
    // ==================================================

    let rawContent =
      completion
        .choices?.[0]
        ?.message
        ?.content
        ?.trim() || ''


    console.log(
      'AI 原始回覆：',
      rawContent
    )


    // ==================================================
    // 清除 think
    // ==================================================

    rawContent = rawContent
      .replace(
        /<think>[\s\S]*?<\/think>/gi,
        ''
      )
      .trim()


    // 清除 ```json
    rawContent = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()


    // ==================================================
    // JSON 解析
    // ==================================================

    let aiResult = {
      severity: 'urgent',
      content: ''
    }


    try {
      const parsed =
        JSON.parse(rawContent)

      aiResult.severity =
        parsed.severity || 'urgent'

      aiResult.content =
        parsed.content || ''

    } catch (err) {
      console.error(
        'AI JSON 解析失敗：',
        rawContent
      )

      // 如果 JSON 失敗，
      // 至少保留 AI 原始文字
      aiResult.content =
        rawContent ||
        '目前無法完整分析，建議持續觀察，若症狀惡化請儘快就醫。'
    }


    // ==================================================
    // 正規化 severity
    // ==================================================

    if (
      ![
        'normal',
        'urgent',
        'emergency'
      ].includes(aiResult.severity)
    ) {
      aiResult.severity = 'urgent'
    }


    // ==================================================
    // ⭐ 安全規則覆寫
    // ==================================================

    const finalSeverity =
      overrideSeverity(
        safetyText,
        aiResult.severity
      )


    console.log(
      'AI 原判定：',
      aiResult.severity
    )

    console.log(
      '安全規則最終判定：',
      finalSeverity
    )


    // ==================================================
    // 內容檢查
    // ==================================================

    let content =
      String(
        aiResult.content || ''
      ).trim()


    const stillContainsThinking =
      badMarkers.some(marker =>
        content
          .toLowerCase()
          .includes(
            marker.toLowerCase()
          )
      )


    if (stillContainsThinking) {
      console.warn(
        '偵測到 AI 分析內容'
      )

      content =
        'AI 回覆格式異常，請重新描述寵物目前的症狀。'
    }


    if (!content) {
      content =
        '目前無法取得 AI 回覆，請稍後再試。'
    }


    // ==================================================
    // 如果是 emergency
    // 確保就醫提醒不會過於輕描淡寫
    // ==================================================

    if (
      finalSeverity === 'emergency' &&
      !content.includes('立即')
    ) {
      content +=
        '\n\n建議立即聯絡獸醫或前往動物醫院評估。'
    }


    // ==================================================
    // 回傳前端
    // ==================================================

    res.json({
      success: true,

      data: {
        content,

        severity:
          finalSeverity,

        severityLabel:
          SEVERITY_LABELS[
            finalSeverity
          ]
      }
    })


  } catch (err) {
    console.error(
      'Groq API error：',
      err
    )


    // Rate Limit
    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error:
          'AI 目前請求較多，請稍後再試'
      })
    }


    // 找不到模型
    if (err.status === 404) {
      return res.status(500).json({
        success: false,
        error:
          '目前設定的 AI 模型無法使用'
      })
    }


    // API Key
    if (err.status === 401) {
      return res.status(500).json({
        success: false,
        error:
          'AI 服務驗證失敗'
      })
    }


    res.status(500).json({
      success: false,
      error:
        'AI 回覆失敗，請稍後再試'
    })
  }
})


// ======================================================
// 儲存一則對話訊息
//
// POST /consultations
// ======================================================

router.post('/', async (req, res) => {
  const {
    petId,
    role,
    content
  } = req.body


  if (
    !petId ||
    !role ||
    !content
  ) {
    return res.status(400).json({
      success: false,
      error:
        '缺少 petId、role 或 content'
    })
  }


  if (
    ![
      'user',
      'assistant'
    ].includes(role)
  ) {
    return res.status(400).json({
      success: false,
      error: '無效的訊息角色'
    })
  }


  try {
    const result =
      await pool.query(
        `
        INSERT INTO health_consultations
          (pet_id, role, content)
        VALUES
          ($1, $2, $3)
        RETURNING *
        `,
        [
          petId,
          role,
          content
        ]
      )


    res.json({
      success: true,
      data: result.rows[0]
    })


  } catch (err) {
    console.error(
      '儲存對話訊息失敗：',
      err
    )

    res.status(500).json({
      success: false,
      error:
        '無法儲存對話訊息'
    })
  }
})


// ======================================================
// 清除某隻寵物的所有對話紀錄
//
// DELETE /consultations/pet/:petId
// ======================================================

router.delete(
  '/pet/:petId',
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM health_consultations
        WHERE pet_id = $1
        `,
        [
          req.params.petId
        ]
      )


      res.json({
        success: true
      })


    } catch (err) {
      console.error(
        '清除對話紀錄失敗：',
        err
      )

      res.status(500).json({
        success: false,
        error:
          '無法清除對話紀錄'
      })
    }
  }
)


module.exports = router