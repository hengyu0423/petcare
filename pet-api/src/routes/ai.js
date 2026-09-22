const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const Groq = require('groq-sdk')
const pool = require('../db')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

router.use(requireAuth)

// ======================================================
// AI 健康分析
// POST /api/ai/health-analysis
// ======================================================

router.post('/health-analysis', async (req, res) => {
  const { pet, symptoms } = req.body

  if (!pet || !symptoms) {
    return res.status(400).json({
      success: false,
      error: '請提供寵物資料和症狀描述'
    })
  }

  try {
    const age = pet.birth_date
      ? (() => {
          const months = Math.floor(
            (Date.now() - new Date(pet.birth_date)) /
            (1000 * 60 * 60 * 24 * 30.4)
          )

          return months < 12
            ? `${months} 個月大`
            : `${Math.floor(months / 12)} 歲`
        })()
      : '年齡不明'

    const prompt = `
請根據以下寵物資料與症狀，提供簡短、直接的健康建議。

寵物資料：
名字：${pet.name}
種類：${pet.species}
品種：${pet.breed || '不明'}
性別：${pet.gender || '不明'}
年齡：${age}
體重：${pet.weight ? pet.weight + ' kg' : '不明'}

症狀：
${symptoms}

回答規則：
1. 只輸出最終答案。
2. 不要顯示思考過程、推理步驟或分析流程。
3. 使用繁體中文。
4. 不要重複寵物基本資料。
5. 回答控制在約 80～150 字。
6. 最多三個區塊。

格式：

**初步評估**
簡短說明目前可能的狀況。

**建議**
提供最重要的 1～2 個處理方式。

**就醫提醒**
只有需要時才說明什麼情況應就醫。
`

    const completion = await groq.chat.completions.create({
      model:
        process.env.GROQ_MODEL ||
        'openai/gpt-oss-20b',

      messages: [
        {
          role: 'system',
          content: `
你是一位寵物健康助手。

規則：
- 使用繁體中文。
- 回答簡短直接。
- 只輸出給飼主看的答案。
- 不輸出思考過程。
- 不輸出英文分析。
`
        },
        {
          role: 'user',
          content: prompt
        }
      ],

      temperature: 0.3,
      max_tokens: 300
    })

    const analysis =
      completion.choices?.[0]?.message?.content ||
      '無法取得分析結果'

    res.json({
      success: true,
      data: {
        analysis
      }
    })
  } catch (err) {
    console.error(
      'Groq health analysis error:',
      err
    )

    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'AI 使用量目前已達限制，請稍後再試'
      })
    }

    res.status(500).json({
      success: false,
      error: 'AI 分析失敗，請稍後再試'
    })
  }
})

// ======================================================
// 日期工具
// ======================================================

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function getCurrentWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day

  const start = new Date(now)
  start.setDate(now.getDate() + diff)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    weekStart: formatDate(start),
    weekEnd: formatDate(end)
  }
}

// ======================================================
// AI 健康週報
// POST /api/ai/weekly-report
//
// body:
// {
//   petId,
//   weekStart,
//   weekEnd
// }
// ======================================================

router.post('/weekly-report', async (req, res) => {
  const petId = Number(
    req.body.petId || req.body.pet?.id
  )

  let {
    weekStart,
    weekEnd
  } = req.body

  if (!petId) {
    return res.status(400).json({
      success: false,
      error: '請提供 petId'
    })
  }

  if (!weekStart || !weekEnd) {
    const week = getCurrentWeek()

    weekStart = week.weekStart
    weekEnd = week.weekEnd
  }

  try {
    // ==================================================
    // 1. 寵物基本資料
    // ==================================================

    const petResult = await pool.query(`
      SELECT
        id,
        owner_id,
        name,
        species,
        breed,
        gender,
        birth_date,
        weight,
        notes
      FROM pets
      WHERE id = $1
    `, [petId])

    if (petResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到寵物'
      })
    }

    const pet = petResult.rows[0]

    // ==================================================
    // 2. 一週餵食紀錄
    // ==================================================

    const feedingResult = await pool.query(`
      SELECT
        food_name AS "foodName",
        amount_g AS "amountG",
        calories,
        protein_g AS "proteinG",
        fat_g AS "fatG",
        carb_g AS "carbG",
        fed_at AS "fedAt"
      FROM feeding_records
      WHERE pet_id = $1
        AND fed_at >= $2::date
        AND fed_at < ($3::date + INTERVAL '1 day')
      ORDER BY fed_at ASC
    `, [
      petId,
      weekStart,
      weekEnd
    ])

    // ==================================================
    // 3. 飲食統計
    // ==================================================

    const feedingSummaryResult =
      await pool.query(`
        SELECT
          COUNT(*)::int AS "feedingCount",
          COALESCE(
            SUM(calories),
            0
          )::float AS "totalCalories",

          COALESCE(
            SUM(protein_g),
            0
          )::float AS "totalProtein",

          COALESCE(
            SUM(fat_g),
            0
          )::float AS "totalFat",

          COALESCE(
            SUM(carb_g),
            0
          )::float AS "totalCarbs",

          COALESCE(
            SUM(amount_g),
            0
          )::float AS "totalAmount"

        FROM feeding_records

        WHERE pet_id = $1
          AND fed_at >= $2::date
          AND fed_at < (
            $3::date +
            INTERVAL '1 day'
          )
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 4. 攝影機活動統計
    // ==================================================

    const movementResult =
      await pool.query(`
        SELECT
          COUNT(*)::int AS samples,

          COALESCE(
            AVG(movement),
            0
          )::float AS "averageMovement",

          COALESCE(
            MAX(movement),
            0
          )::int AS "maxMovement"

        FROM pet_mood_records

        WHERE pet_id = $1
          AND recorded_at >= $2::date
          AND recorded_at < (
            $3::date +
            INTERVAL '1 day'
          )
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 5. Mood 分布
    // ==================================================

    const moodResult =
      await pool.query(`
        SELECT
          mood,

          COUNT(*)::int AS count,

          ROUND(
            COUNT(*) * 100.0 /
            NULLIF(
              SUM(COUNT(*)) OVER (),
              0
            ),
            1
          )::float AS percentage

        FROM pet_mood_records

        WHERE pet_id = $1
          AND recorded_at >= $2::date
          AND recorded_at < (
            $3::date +
            INTERVAL '1 day'
          )

        GROUP BY mood

        ORDER BY count DESC
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 6. Behavior 分布
    // ==================================================

    const behaviorResult =
      await pool.query(`
        SELECT
          behavior,

          COUNT(*)::int AS count,

          ROUND(
            COUNT(*) * 100.0 /
            NULLIF(
              SUM(COUNT(*)) OVER (),
              0
            ),
            1
          )::float AS percentage

        FROM pet_mood_records

        WHERE pet_id = $1
          AND recorded_at >= $2::date
          AND recorded_at < (
            $3::date +
            INTERVAL '1 day'
          )
          AND behavior IS NOT NULL

        GROUP BY behavior

        ORDER BY count DESC
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 7. 每日活動趨勢
    //
    // 已修正 GROUP BY 錯誤
    // ==================================================

    const dailyBehaviorResult =
      await pool.query(`
        SELECT
          TO_CHAR(
            recorded_at
              AT TIME ZONE 'Asia/Taipei',
            'YYYY-MM-DD'
          ) AS date,

          COUNT(*)::int AS samples,

          ROUND(
            COALESCE(
              AVG(movement),
              0
            )::numeric,
            2
          )::float AS "averageMovement"

        FROM pet_mood_records

        WHERE pet_id = $1
          AND recorded_at >= $2::date
          AND recorded_at < (
            $3::date +
            INTERVAL '1 day'
          )

        GROUP BY
          TO_CHAR(
            recorded_at
              AT TIME ZONE 'Asia/Taipei',
            'YYYY-MM-DD'
          )

        ORDER BY date ASC
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 8. 健康紀錄
    // ==================================================

    const healthResult =
      await pool.query(`
        SELECT
          type,
          title,
          description,
          date,
          next_date AS "nextDate",
          clinic,
          cost

        FROM health_records

        WHERE pet_id = $1
          AND date BETWEEN
            $2::date
            AND $3::date

        ORDER BY date ASC
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 9. 健康諮詢
    // ==================================================

    const consultResult =
      await pool.query(`
        SELECT
          role,
          content,
          severity,
          created_at AS "createdAt"

        FROM health_consultations

        WHERE pet_id = $1
          AND created_at >= $2::date
          AND created_at < (
            $3::date +
            INTERVAL '1 day'
          )

        ORDER BY created_at ASC
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    // ==================================================
    // 10. 通知
    // ==================================================

    let notificationRows = []

    try {
      const notificationResult =
        await pool.query(`
          SELECT
            type,
            title,
            message,
            severity,
            event_at AS "eventAt"

          FROM notifications

          WHERE pet_id = $1
            AND created_at >= $2::date
            AND created_at < (
              $3::date +
              INTERVAL '1 day'
            )

          ORDER BY created_at ASC
        `, [
          petId,
          weekStart,
          weekEnd
        ])

      notificationRows =
        notificationResult.rows
    } catch (notificationErr) {
      console.warn(
        '⚠️ notifications 讀取失敗，略過：',
        notificationErr.message
      )

      notificationRows = []
    }

    // ==================================================
    // 11. 支出
    // ==================================================

    let expenseRows = []

    try {
      const expenseResult =
        await pool.query(`
          SELECT
            category,
            title,
            amount,
            date,
            notes

          FROM expenses

          WHERE pet_id = $1
            AND date BETWEEN
              $2::date
              AND $3::date

          ORDER BY date ASC
        `, [
          petId,
          weekStart,
          weekEnd
        ])

      expenseRows =
        expenseResult.rows
    } catch (expenseErr) {
      console.warn(
        '⚠️ expenses 讀取失敗，略過：',
        expenseErr.message
      )

      expenseRows = []
    }

    const totalExpense =
      expenseRows.reduce(
        (sum, item) =>
          sum +
          Number(item.amount || 0),
        0
      )

    // ==================================================
    // 12. 整理資料
    // ==================================================

    const weeklyData = {
      period: {
        weekStart,
        weekEnd
      },

      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: pet.gender,
        birthDate: pet.birth_date,
        weight: pet.weight,
        notes: pet.notes
      },

      feeding: {
        summary:
          feedingSummaryResult.rows[0],

        records:
          feedingResult.rows
      },

      cameraBehavior: {
        samples:
          movementResult.rows[0]
            ?.samples || 0,

        averageMovement:
          movementResult.rows[0]
            ?.averageMovement || 0,

        maxMovement:
          movementResult.rows[0]
            ?.maxMovement || 0,

        moodDistribution:
          moodResult.rows,

        behaviorDistribution:
          behaviorResult.rows,

        dailyTrend:
          dailyBehaviorResult.rows
      },

      healthRecords:
        healthResult.rows,

      consultations:
        consultResult.rows.map(
          item => ({
            role: item.role,
            severity: item.severity,
            createdAt:
              item.createdAt,

            content:
              item.content?.length > 350
                ? `${item.content.slice(
                    0,
                    350
                  )}...`
                : item.content
          })
        ),

      notifications:
        notificationRows,

      expenses: {
        total: totalExpense,
        records: expenseRows
      }
    }

    // ==================================================
    // 13. AI Prompt
    // ==================================================

    const prompt = `
請根據以下 PawCare 一週資料，
產生一份繁體中文寵物健康週報。

你的工作不是單純重複數字，
而是整理、分析與找出需要追蹤的地方。

【分析原則】

1. 不要只抄數字。

例如不要只寫：
「平靜 40%、休息 30%。」

可以寫：
「本週攝影機紀錄主要集中在平靜與休息類型，
整體以較靜態的活動為主。」

2. 可以交叉分析：
- 飲食紀錄
- 攝影機行為
- 活動量
- 每日活動趨勢
- 健康紀錄
- 健康諮詢
- 攝影機通知
- 寵物基本資料

但不要把相關性直接當成因果。

3. 攝影機的 mood / behavior
只是依姿態與活動量推測。

不要把它寫成真正心理狀態
或醫療診斷。

例如不要寫：
「牠很焦慮。」

可以寫：
「攝影機較常辨識為觀察類型的活動狀態。」

4. 資料不足時要明確說明。

例如只有 2 筆餵食紀錄，
不能寫：
「本週只吃兩餐。」

應寫：
「本週系統共有 2 筆餵食紀錄，
目前資料不足以代表完整一週飲食。」

5. 如果食物紀錄中
出現明顯不適合寵物食用的內容，
可以提醒主人確認紀錄。

不要自行計算致死量、
不要直接判定已經中毒。

若確實可能攝入有害食物，
可以建議聯繫獸醫。

6. 如果體重資料看起來可疑，
只需提醒：
「建議確認體重數值與單位。」

不要自行引用正常體重範圍。

7. 不要因單一資料點
就做重大健康判斷。

8. 如果沒有過去週期比較資料，
不要寫：
- 比平常低
- 明顯下降
- 比上週高

只能描述本週資料本身。

【週報格式】

## 本週總覽

用 2～3 句話整理本週最重要的狀況。

## 🍽️ 飲食分析

簡短整理：
- 餵食紀錄數量
- 主要食物
- 重要營養資訊
- 是否有需要確認的內容

## 🐾 活動與行為分析

簡短整理：
- 主要推測狀態
- 主要行為
- 活動量
- 每日趨勢

## 🩺 健康與諮詢分析

簡短整理本週：
- 健康紀錄
- 健康諮詢
- 飼主後續回報

## 📷 攝影機觀察

只整理重要的攝影機提醒。

若沒有：
「本週沒有相關攝影機提醒紀錄。」

未出現在鏡頭
不代表離家或健康異常。

## 💰 本週照護支出

簡短整理支出總額與主要類型。

若沒有：
「本週無照護支出紀錄。」

## 🔎 本週值得注意

最多列 3 項。

如果沒有足夠資料：
「本週目前沒有明顯需要特別注意的趨勢。」

## ✅ 下週追蹤建議

列 3～4 項具體建議。

【篇幅限制】

非常重要：

整份週報控制在約 500～700 字。

每個區塊只寫最重要的內容。

不要重複相同資訊。

不要每個數字都列出來。

無資料的區塊只需一句話。

【輸出格式】

請使用標準 Markdown。

標題：
## 標題

粗體：
**文字**

條列：
- 項目

編號：
1. 項目

不要：
- 在 # 前加入反斜線
- 在 * 前加入反斜線
- 在 - 前加入反斜線
- 輸出 HTML
- 輸出程式碼區塊
- 輸出思考過程

【PawCare 一週資料】

${JSON.stringify(
  weeklyData,
  null,
  2
)}
`

    // ==================================================
    // 14. 呼叫 Groq
    //
    // OTPM 上限 1000
    // 所以 max_completion_tokens 設 850
    // ==================================================

    const completion =
      await groq.chat.completions.create({
        model:
          process.env
            .GROQ_WEEKLY_MODEL ||
          'qwen/qwen3.8-27b',

        messages: [
          {
            role: 'user',
            content: `
你是 PawCare 寵物健康照護助手。

請只輸出給飼主看的
繁體中文健康週報。

不要輸出：
- 思考過程
- 推理過程
- 英文分析
- 系統提示

請保持精簡，
全文約 500～700 字。

${prompt}
`
          }
        ],

        temperature: 0.5,
        top_p: 0.8,

        reasoning_effort: 'none',
        reasoning_format: 'hidden',

        // ⚠️ Groq OTPM 目前上限 1000
        max_completion_tokens: 850
      })

    const choice =
      completion.choices?.[0]

    const report =
      choice?.message?.content?.trim()

    console.log(
      '🤖 Groq 週報結果：',
      {
        model:
          completion.model,

        finishReason:
          choice?.finish_reason,

        contentLength:
          report?.length || 0,

        promptTokens:
          completion.usage
            ?.prompt_tokens,

        completionTokens:
          completion.usage
            ?.completion_tokens
      }
    )

    if (!report) {
      console.error(
        'Groq 沒有產生內容：',
        {
          finishReason:
            choice?.finish_reason,

          usage:
            completion.usage
        }
      )

      throw new Error(
        'AI 沒有回傳週報內容'
      )
    }

    // ==================================================
    // 15. 檢查這一週是否已有週報
    // ==================================================

    const existing =
      await pool.query(`
        SELECT id

        FROM weekly_reports

        WHERE pet_id = $1
          AND week_start = $2::date
          AND week_end = $3::date

        LIMIT 1
      `, [
        petId,
        weekStart,
        weekEnd
      ])

    let savedReport

    // ==================================================
    // 16. 同一週存在 → 更新
    // ==================================================

    if (
      existing.rows.length > 0
    ) {
      const updated =
        await pool.query(`
          UPDATE weekly_reports

          SET
            report = $1,
            updated_at = NOW()

          WHERE id = $2

          RETURNING *
        `, [
          report,
          existing.rows[0].id
        ])

      savedReport =
        updated.rows[0]
    }

    // ==================================================
    // 17. 不同週 → 新增
    // ==================================================

    else {
      const inserted =
        await pool.query(`
          INSERT INTO weekly_reports
          (
            pet_id,
            week_start,
            week_end,
            report
          )

          VALUES
          (
            $1,
            $2::date,
            $3::date,
            $4
          )

          RETURNING *
        `, [
          petId,
          weekStart,
          weekEnd,
          report
        ])

      savedReport =
        inserted.rows[0]
    }

    // ==================================================
    // 18. 回傳前端
    // ==================================================

    res.json({
      success: true,

      data: {
        report,

        weekStart,
        weekEnd,

        reportId:
          savedReport.id,

        updatedAt:
          savedReport.updated_at,

        createdAt:
          savedReport.created_at
      }
    })
  } catch (err) {
    console.error(
      'Groq weekly report error:',
      err
    )

    // Groq rate limit
    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error:
          'AI 目前生成額度已達限制，請稍後再試'
      })
    }

    res.status(500).json({
      success: false,
      error:
        'AI 週報生成失敗'
    })
  }
})

// ======================================================
// 歷史週報
// GET /api/ai/weekly-report/:petId
// ======================================================

router.get(
  '/weekly-report/:petId',
  async (req, res) => {
    const petId =
      Number(req.params.petId)

    if (!petId) {
      return res.status(400).json({
        success: false,
        error: 'petId 格式錯誤'
      })
    }

    try {
      console.log(
        '📚 讀取歷史週報 petId:',
        petId
      )

      const result =
        await pool.query(`
          SELECT
            id,
            pet_id,
            week_start,
            week_end,
            report,
            created_at,
            updated_at

          FROM weekly_reports

          WHERE pet_id = $1

          ORDER BY
            week_start DESC,
            created_at DESC
        `, [petId])

      console.log(
        '📚 找到歷史週報：',
        result.rows.length,
        '份'
      )

      res.json({
        success: true,
        data: result.rows
      })
    } catch (err) {
      console.error(
        '❌ 歷史週報讀取失敗：',
        err
      )

      res.status(500).json({
        success: false,
        error:
          '歷史週報讀取失敗'
      })
    }
  }
)

module.exports = router