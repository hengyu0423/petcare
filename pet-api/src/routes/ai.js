const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const Groq = require('groq-sdk')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

router.use(requireAuth)

// ==============================
// AI 健康分析
// ==============================
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
1. 只輸出最終答案，絕對不要顯示思考過程、推理步驟或分析流程。
2. 不要出現 "thinking process"、"Analyze User Input"、"Reasoning" 等內容。
3. 使用繁體中文。
4. 不要重複寵物基本資料或症狀。
5. 回答控制在約 80～150 字。
6. 最多只使用以下三個區塊。
7. 每個區塊最多 1～2 句。

格式：

**初步評估**
簡短說明目前可能的狀況。

**建議**
提供最重要的 1～2 個處理方式。

**就醫提醒**
只有需要時才說明什麼情況應就醫。

不要提供額外前言、結尾、免責聲明或分析過程。
`

const completion = await groq.chat.completions.create({
  model: process.env.GROQ_MODEL || 'qwen/qwen3.6-27b',
  messages: [
    {
      role: 'system',
      content: `
你是一位寵物健康助手。

你必須遵守以下規則：
- 使用繁體中文。
- 回答簡短直接。
- 只輸出給飼主看的最終答案。
- 絕對不要輸出內部思考、推理過程、分析步驟。
- 不要解釋你如何得到答案。
- 不要輸出英文分析。
- 回答盡量控制在 150 字以內。
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
      completion.choices[0]?.message?.content || '無法取得分析結果'

    res.json({
      success: true,
      data: {
        analysis
      }
    })
  } catch (err) {
    console.error('Groq health analysis error:', err)

    res.status(500).json({
      success: false,
      error: 'AI 分析失敗，請稍後再試'
    })
  }
})

// ==============================
// AI 每週健康報告
// ==============================
router.post('/weekly-report', async (req, res) => {
  const {
    pet,
    feedingStats = [],
    healthConsults = [],
    expenses = []
  } = req.body

  if (!pet) {
    return res.status(400).json({
      success: false,
      error: '請提供寵物資料'
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
            ? `${months} 個月`
            : `${Math.floor(months / 12)} 歲`
        })()
      : '年齡不明'

    const prompt = `你是一位專業的寵物健康顧問，請根據以下一週的數據，為飼主生成一份完整的寵物健康週報。請用繁體中文，不要使用 # 符號，語氣親切專業。

寵物資料：
- 名字：${pet.name}
- 種類：${pet.species}
- 品種：${pet.breed || '不明'}
- 年齡：${age}
- 體重：${pet.weight ? pet.weight + ' kg' : '不明'}

本週飲食數據：
${
  feedingStats.length > 0
    ? feedingStats
        .map(
          s =>
            `- ${s.date}：${Number(
              s.total_calories || 0
            ).toFixed(0)} kcal，餵食 ${s.meal_count} 次`
        )
        .join('\n')
    : '本週無餵食記錄'
}

本週健康諮詢紀錄：
${
  healthConsults.length > 0
    ? healthConsults
        .map(
          m =>
            `${m.role === 'user' ? '飼主' : 'AI'}：${m.content.slice(
              0,
              100
            )}${m.content.length > 100 ? '...' : ''}`
        )
        .join('\n')
    : '本週無健康諮詢'
}

本週醫療/寵物支出：
${
  expenses.length > 0
    ? expenses
        .map(
          e =>
            `- ${e.category}：${e.title} RM${Number(
              e.amount
            ).toFixed(2)}`
        )
        .join('\n')
    : '本週無支出記錄'
}

請生成以下格式的週報（不要使用 # 符號，用 **粗體** 作為標題）：

**🐾 ${pet.name} 的本週健康週報**

**📊 本週總結**
（用2-3句話總結本週整體狀況）

**🍽️ 飲食分析**
（分析本週飲食規律性、熱量是否達標、有無異常）

**💊 健康狀況**
（根據諮詢紀錄分析健康狀況，如無諮詢則說明）

**💰 本週花費**
（分析本週支出是否合理）

**⭐ 本週亮點**
（列出本週值得表揚的好事）

**⚠️ 需要注意**
（列出需要改善或關注的事項）

**📋 下週建議**
（給飼主具體可執行的建議）`

const completion = await groq.chat.completions.create({
  model: process.env.GROQ_MODEL || "qwen/qwen3.6-27b",
  messages: [
    {
      role: "user",
      content: prompt
    }
  ],

  reasoning_effort: "none",
  reasoning_format: "hidden",

  temperature: 0.7,
  max_tokens: 900,
})

    const report =
      completion.choices[0]?.message?.content || '無法生成週報'

    res.json({
      success: true,
      data: {
        report
      }
    })
  } catch (err) {
    console.error('Groq weekly report error:', err)

    res.status(500).json({
      success: false,
      error: 'AI 生成失敗'
    })
  }
})

module.exports = router