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
      model: 'llama-3.3-70b-versatile',
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

module.exports = router