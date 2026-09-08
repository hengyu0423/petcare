const router = require('express').Router()
const requireAuth = require('../middleware/auth')
const Groq = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

router.use(requireAuth)

router.post('/health-analysis', async (req, res) => {
  const { pet, symptoms } = req.body

  if (!pet || !symptoms) {
    return res.status(400).json({ success: false, error: '請提供寵物資料和症狀描述' })
  }

  try {
    const age = pet.birth_date ? (() => {
      const months = Math.floor((Date.now() - new Date(pet.birth_date)) / (1000 * 60 * 60 * 24 * 30.4))
      return months < 12 ? `${months} 個月大` : `${Math.floor(months / 12)} 歲`
    })() : '年齡不明'

    const prompt = `你是一位專業的獸醫助手，請根據以下寵物資料和症狀描述，提供詳細的醫療分析和建議。

寵物資料：
- 名字：${pet.name}
- 種類：${pet.species}
- 品種：${pet.breed || '不明'}
- 性別：${pet.gender || '不明'}
- 年齡：${age}
- 體重：${pet.weight ? pet.weight + ' kg' : '不明'}

飼主描述的症狀或問題：
${symptoms}

請提供以下格式的分析（請用繁體中文回答）：

## 初步評估
（根據症狀描述，給出初步判斷）

## 可能的原因
（列出2-4個最可能的原因）

## 建議處理方式
（具體的居家處理建議）

## 何時需要立即就醫
（列出需要緊急就醫的警示症狀）

## 預防建議
（未來如何預防類似狀況）

⚠️ 免責聲明：此分析僅供參考，不能替代專業獸醫診斷。如症狀嚴重或持續，請立即就醫。`

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: '你是一位經驗豐富的獸醫助手，專門為寵物飼主提供醫療諮詢和建議。請用繁體中文回答，語氣專業但親切易懂。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const analysis = completion.choices[0]?.message?.content || '無法取得分析結果'

    res.json({ success: true, data: { analysis } })
  } catch (err) {
    console.error('Groq API error:', err)
    res.status(500).json({ success: false, error: 'AI 分析失敗，請稍後再試' })
  }
})

router.post('/weekly-report', async (req, res) => {
  const { pet, feedingStats, healthConsults, expenses } = req.body

  try {
    const age = pet.birth_date ? (() => {
      const months = Math.floor((Date.now() - new Date(pet.birth_date)) / (1000 * 60 * 60 * 24 * 30.4))
      return months < 12 ? `${months} 個月` : `${Math.floor(months / 12)} 歲`
    })() : '年齡不明'

    const prompt = `你是一位專業的寵物健康顧問，請根據以下一週的數據，為飼主生成一份完整的寵物健康週報。請用繁體中文，不要使用 # 符號，語氣親切專業。

寵物資料：
- 名字：${pet.name}
- 種類：${pet.species}
- 品種：${pet.breed || '不明'}
- 年齡：${age}
- 體重：${pet.weight ? pet.weight + ' kg' : '不明'}

本週飲食數據：
${feedingStats.length > 0 ? feedingStats.map(s => 
  `- ${s.date}：${Number(s.total_calories||0).toFixed(0)} kcal，餵食 ${s.meal_count} 次`
).join('\n') : '本週無餵食記錄'}

本週健康諮詢紀錄：
${healthConsults.length > 0 ? healthConsults.map(m =>
  `${m.role === 'user' ? '飼主' : 'AI'}：${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`
).join('\n') : '本週無健康諮詢'}

本週醫療/寵物支出：
${expenses.length > 0 ? expenses.map(e =>
  `- ${e.category}：${e.title} RM${Number(e.amount).toFixed(2)}`
).join('\n') : '本週無支出記錄'}

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
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: '你是一位專業的寵物健康顧問，請用繁體中文生成詳細的健康週報。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 1500,
    })

    const report = completion.choices[0]?.message?.content || '無法生成週報'
    res.json({ success: true, data: { report } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: 'AI 生成失敗' })
  }
})
module.exports = router