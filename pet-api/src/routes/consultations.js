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
// 健康事件（與飲食管理整合）
//
// AI 除了回覆飼主，還會輸出一個結構化的 healthEvent。
// 重要事件會寫入既有的 health_records（不另建資料表），
// 並綁定 pet_id，供飲食管理頁面與飲食 AI 使用。
// ======================================================

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Taipei'

const SEVERITY_RANK = {
  normal: 0,
  urgent: 1,
  emergency: 2
}

// 事件類型：label 為顯示名稱，days 為預設的飲食注意天數
const HEALTH_EVENT_TYPES = {
  vomiting: { label: '嘔吐', days: 3 },
  diarrhea: { label: '腹瀉', days: 5 },
  constipation: { label: '便秘／排便異常', days: 5 },
  appetite_loss: { label: '食慾不振', days: 3 },
  dehydration: { label: '脫水', days: 3 },
  allergy: { label: '過敏', days: 14 },
  poisoning: { label: '疑似中毒／誤食', days: 7 },
  illness: { label: '疾病', days: 7 },
  other: { label: '其他健康事件', days: 5 }
}

const MAX_DIET_DAYS = 30

function cleanText(value, maxLen) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function cleanList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const result = []

  for (const item of value) {
    const text = cleanText(item, maxLen)

    if (text && !seen.has(text)) {
      seen.add(text)
      result.push(text)
    }

    if (result.length >= maxItems) break
  }

  return result
}

// 將 AI 輸出的 healthEvent 整理成可安全寫入資料庫的格式
// 不是重要事件則回傳 null
function sanitizeHealthEvent(raw) {
  if (!raw || typeof raw !== 'object' || raw.detected !== true) {
    return null
  }

  const type = HEALTH_EVENT_TYPES[raw.type] ? raw.type : 'other'
  const defaults = HEALTH_EVENT_TYPES[type]

  const title =
    cleanText(raw.title, 60) || defaults.label

  const summary = cleanText(raw.summary, 300)

  const dietRelevant = raw.dietRelevant === true

  let durationDays = Math.round(Number(raw.durationDays))

  if (!Number.isFinite(durationDays) || durationDays < 1) {
    durationDays = defaults.days
  }

  durationDays = Math.min(durationDays, MAX_DIET_DAYS)

  return {
    type,
    title,
    summary,
    dietRelevant,
    symptoms: cleanList(raw.symptoms, 8, 30),
    dietNotes: cleanText(raw.dietNotes, 300),
    avoidFoods: cleanList(raw.avoidFoods, 10, 40),
    dietAdvice: cleanList(raw.dietAdvice, 5, 100),
    durationDays
  }
}

// ------------------------------------------------------
// 關鍵字備援：AI 沒有回傳事件時，只檢查「這一次」飼主的訊息
// 避免因為 AI 格式異常而漏掉嘔吐、腹瀉等重要事件
// ------------------------------------------------------

const FALLBACK_RULES = [
  {
    type: 'vomiting',
    symptom: '嘔吐',
    keywords: ['嘔吐', '一直吐', '反覆吐', '吐了', '吐黃水', '吐白沫']
  },
  {
    type: 'diarrhea',
    symptom: '腹瀉',
    keywords: ['腹瀉', '拉肚子', '稀便', '水便', '軟便', '糞便很稀']
  },
  {
    type: 'constipation',
    symptom: '排便異常',
    keywords: ['便秘', '排便困難', '解不出來', '不大便', '沒有大便']
  },
  {
    type: 'appetite_loss',
    symptom: '食慾不振',
    keywords: ['食慾不振', '完全不吃', '不想吃', '厭食', '不吃飯']
  },
  {
    type: 'allergy',
    symptom: '疑似過敏',
    keywords: ['過敏', '紅疹', '一直抓癢', '皮膚癢']
  },
  {
    type: 'poisoning',
    symptom: '誤食／中毒',
    keywords: ['中毒', '誤食']
  }
]

// 關鍵字前面若有否定詞（例如「沒有嘔吐」），就不算
function isNegated(text, index) {
  const before = text.slice(Math.max(0, index - 3), index)
  return /[沒無未別]/.test(before) || before.endsWith('不會')
}

function detectEventFallback(userText) {
  const text = String(userText || '').replace(/\s+/g, '')

  for (const rule of FALLBACK_RULES) {
    for (const keyword of rule.keywords) {
      const index = text.indexOf(keyword)

      if (index !== -1 && !isNegated(text, index)) {
        const defaults = HEALTH_EVENT_TYPES[rule.type]

        return {
          type: rule.type,
          title: defaults.label,
          summary: cleanText(userText, 200),
          dietRelevant: true,
          symptoms: [rule.symptom],
          dietNotes:
            '飼主回報此症狀，調整飲食前請先留意腸胃狀況，' +
            '避免突然換食物或給予高油脂食物。',
          avoidFoods: [],
          dietAdvice: [],
          durationDays: defaults.days
        }
      }
    }
  }

  return null
}

async function ownsPet(petId, userId) {
  const result = await pool.query(
    'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
    [petId, userId]
  )

  return result.rows.length > 0
}

function mergeUnique(a = [], b = [], max) {
  return [...new Set([...(a || []), ...(b || [])])].slice(0, max)
}

// ------------------------------------------------------
// 儲存健康事件到 health_records
//
// 同一隻寵物、同一天、同一種事件，只會保留一筆（更新而不是重複新增），
// 避免飼主連續追問時產生一堆重複紀錄。
// ------------------------------------------------------
async function saveHealthEvent({ petId, event, severity }) {
  const dietInfo = {
    symptoms: event.symptoms,
    dietNotes: event.dietNotes,
    avoidFoods: event.avoidFoods,
    dietAdvice: event.dietAdvice
  }

  const existingResult = await pool.query(
    `
    SELECT *
    FROM health_records
    WHERE pet_id = $1
      AND source = 'ai_consult'
      AND type = $2
      AND date = (NOW() AT TIME ZONE $3::text)::date
    ORDER BY id DESC
    LIMIT 1
    `,
    [petId, event.type, APP_TIMEZONE]
  )

  // ---------- 已有同一天同類型：合併更新 ----------
  if (existingResult.rows.length > 0) {
    const old = existingResult.rows[0]
    const oldInfo = old.diet_info || {}

    const mergedSeverity =
      (SEVERITY_RANK[severity] ?? 0) >=
      (SEVERITY_RANK[old.severity] ?? 0)
        ? severity
        : old.severity

    const mergedInfo = {
      symptoms: mergeUnique(oldInfo.symptoms, dietInfo.symptoms, 8),
      dietNotes: dietInfo.dietNotes || oldInfo.dietNotes || '',
      avoidFoods: mergeUnique(oldInfo.avoidFoods, dietInfo.avoidFoods, 10),
      dietAdvice: mergeUnique(oldInfo.dietAdvice, dietInfo.dietAdvice, 5)
    }

    const updated = await pool.query(
      `
      UPDATE health_records
      SET
        title = $2,
        description = COALESCE(NULLIF($3, ''), description),
        severity = $4,
        diet_relevant = (diet_relevant OR $5),
        diet_info = $6::jsonb,
        diet_until = GREATEST(
          diet_until,
          (NOW() AT TIME ZONE $7::text)::date + $8::int
        )
      WHERE id = $1
      RETURNING *
      `,
      [
        old.id,
        event.title,
        event.summary,
        mergedSeverity,
        event.dietRelevant,
        JSON.stringify(mergedInfo),
        APP_TIMEZONE,
        event.durationDays
      ]
    )

    return { record: updated.rows[0], isUpdate: true }
  }

  // ---------- 新增 ----------
  const inserted = await pool.query(
    `
    INSERT INTO health_records
      (pet_id, type, title, description, date,
       source, severity, diet_relevant, diet_info, diet_until)
    VALUES
      (
        $1, $2, $3, $4,
        (NOW() AT TIME ZONE $5::text)::date,
        'ai_consult', $6, $7, $8::jsonb,
        (NOW() AT TIME ZONE $5::text)::date + $9::int
      )
    RETURNING *
    `,
    [
      petId,
      event.type,
      event.title,
      event.summary || null,
      APP_TIMEZONE,
      severity,
      event.dietRelevant,
      JSON.stringify(dietInfo),
      event.durationDays
    ]
  )

  return { record: inserted.rows[0], isUpdate: false }
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
      messages,
      petId
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


【healthEvent：重要健康事件】

除了回答飼主，你還要判斷「這次對話」是否出現值得記錄的重要健康事件，
例如嘔吐、腹瀉、便秘或排便異常、食慾不振、脫水、過敏、疑似中毒或誤食、
疾病，或需要調整飲食的情況。

- 有重要事件：detected 填 true，並填寫其他欄位。
- 只是一般閒聊、預防保健、衛教問題，或飼主明確表示沒有症狀：
  detected 填 false，其他欄位可省略。
- 只根據飼主實際描述的內容填寫，不要編造飼主沒說過的症狀。

healthEvent 欄位：

- type：只能是 vomiting、diarrhea、constipation、appetite_loss、
  dehydration、allergy、poisoning、illness、other 其中之一
- title：10 字內的短標題，例如「嘔吐」「急性腹瀉」
- summary：一句話（40 字內）描述發生了什麼事
- symptoms：症狀關鍵字陣列，例如 ["嘔吐", "精神差"]
- dietRelevant：是否與飲食有關（true 或 false）。
  腸胃症狀、食慾、過敏、誤食、需要限制或調整食物的疾病，通常為 true
- dietNotes：與飲食有關的重要提醒，一句話（60 字內）。
  例如「腸胃不適期間避免高脂肪食物，少量多餐」。沒有就填空字串
- avoidFoods：這段期間應避免的食物或食物類型陣列，沒有就填 []
- dietAdvice：飲食調整建議陣列，最多 3 項，每項 30 字內，沒有就填 []
- durationDays：飲食注意事項建議持續幾天（1～30 的整數）

請只輸出 JSON，不要輸出其他文字：

{
  "severity": "normal 或 urgent 或 emergency",
  "content": "完整給飼主看的回答",
  "healthEvent": {
    "detected": true,
    "type": "vomiting",
    "title": "嘔吐",
    "summary": "今天嘔吐數次",
    "symptoms": ["嘔吐"],
    "dietRelevant": true,
    "dietNotes": "腸胃不適期間避免高脂肪食物，少量多餐",
    "avoidFoods": ["高脂肪食物", "人類食物"],
    "dietAdvice": ["暫時少量多餐"],
    "durationDays": 3
  }
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

        max_completion_tokens: 800,

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
      content: '',
      healthEvent: null
    }


    try {
      const parsed =
        JSON.parse(rawContent)

      aiResult.severity =
        parsed.severity || 'urgent'

      aiResult.content =
        parsed.content || ''

      aiResult.healthEvent =
        parsed.healthEvent || null

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
    // ⭐ 儲存重要健康事件（與飲食管理整合）
    //
    // 不能因為儲存失敗而讓飼主收不到 AI 回覆，
    // 所以整段包在 try/catch 裡。
    // ==================================================

    let savedEvent = null

    try {
      const aiFailed =
        content.startsWith('AI 回覆格式異常') ||
        content.startsWith('目前無法取得 AI 回覆')

      // 優先使用 AI 的判斷，沒有的話用關鍵字備援（只看最新一則飼主訊息）
      let event =
        sanitizeHealthEvent(
          aiResult.healthEvent
        )

      if (!event && !aiFailed) {
        const lastUserMessage =
          [...cleanMessages]
            .reverse()
            .find(msg =>
              msg.role === 'user'
            )

        event =
          detectEventFallback(
            lastUserMessage?.content
          )
      }

      // 只記錄「重要」事件：與飲食有關，或嚴重程度不是一般
      const isImportant =
        event &&
        (
          event.dietRelevant ||
          finalSeverity !== 'normal'
        )

      if (
        isImportant &&
        petId &&
        await ownsPet(
          petId,
          req.userId
        )
      ) {
        const saved =
          await saveHealthEvent({
            petId,
            event,
            severity:
              finalSeverity
          })

        savedEvent = {
          id: saved.record.id,
          type: saved.record.type,
          title: saved.record.title,
          dietRelevant:
            saved.record.diet_relevant,
          isUpdate:
            saved.isUpdate
        }

        console.log(
          '🩺 已記錄健康事件：',
          savedEvent
        )
      }

    } catch (saveErr) {
      console.error(
        '儲存健康事件失敗（不影響 AI 回覆）：',
        saveErr
      )
    }


    // ==================================================
    // 回傳前端
    // ==================================================

    res.json({
      success: true,

      data: {
        content,

        healthEvent:
          savedEvent,

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
// POST /consultations
// ======================================================

router.post('/', async (req, res) => {
  const {
    petId,
    role,
    content,
    severity
  } = req.body

  console.log('📥 收到要儲存的訊息：', {
    petId,
    role,
    severity,
    content
  })

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

  // 只有 assistant 才儲存 severity
  let finalSeverity = null

  if (role === 'assistant') {
    if (
      ['normal', 'urgent', 'emergency'].includes(severity)
    ) {
      finalSeverity = severity
    }
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO health_consultations
        (
          pet_id,
          role,
          content,
          severity
        )
      VALUES
        ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        petId,
        role,
        content,
        finalSeverity
      ]
    )

    console.log(
      '✅ 已存入資料庫：',
      result.rows[0]
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
      error: '無法儲存對話訊息'
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