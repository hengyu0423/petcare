
const express = require('express')
const multer = require('multer')
const Groq = require('groq-sdk')
const requireAuth = require('../middleware/auth')

const router = express.Router()

// 沿用 PetCare 原本的登入驗證
router.use(requireAuth)

// AI 視覺模型
const VISION_MODEL =
  process.env.GROQ_WEEKLY_MODEL ||
  'qwen/qwen3.8-27b'

// 設定照片上傳
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error('請上傳 JPG、PNG 或 WebP 照片')
      )
    }

    callback(null, true)
  }
})

// 處理照片上傳錯誤
function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: '照片不能超過 3MB'
      })
    }

    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      })
    }

    next()
  })
}

// POST /api/pet-emotion
router.post('/', uploadPhoto, async (req, res) => {
  try {
    // 確認 Groq 金鑰
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Groq API Key 尚未設定'
      })
    }

    // 確認照片
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '請先拍照或上傳照片'
      })
    }

    // 使用原本的 Groq SDK
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    })

    // 把圖片轉成 Base64
    const imageBase64 =
      req.file.buffer.toString('base64')

    const imageUrl =
      `data:${req.file.mimetype};base64,${imageBase64}`

    // 呼叫 Groq AI
    const completion =
      await groq.chat.completions.create({
        model: VISION_MODEL,

        messages: [
          {
            role: 'system',
            content: `
你是一位寵物行為觀察助手。

請用繁體中文回答。

你的任務是分析使用者上傳的
貓咪或狗狗照片，根據外觀與
身體語言推測可能的情緒。

請觀察：
1. 耳朵的位置
2. 眼睛的狀態
3. 嘴巴是否放鬆
4. 尾巴姿勢（如果看得見）
5. 整體身體姿勢

請使用以下格式：

🐾 寵物種類：
貓咪、狗狗或無法辨識

😊 可能的情緒：
描述寵物可能的情緒狀態

🔍 觀察依據：
列出照片中真正看得到的特徵

❤️ 照護建議：
提供簡短、安全的建議

注意：
- 如果照片沒有貓或狗，請告知無法分析
- 不能編造照片中看不到的特徵
- 不能百分之百確定寵物真正的情緒
- 資訊不足時請明確說明
- 不要只根據照片診斷疾病
- 如果有明顯受傷跡象，建議聯絡獸醫
- 回答清楚、簡單，不要輸出思考過程
`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '請分析這隻寵物可能的心情'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],

        temperature: 0.3,
        max_completion_tokens: 1200
      })

    const analysis =
      completion.choices?.[0]?.message?.content

    if (!analysis) {
      return res.status(502).json({
        success: false,
        error: 'AI 沒有回傳分析結果'
      })
    }

    return res.json({
      success: true,
      analysis,
      model: VISION_MODEL
    })

  } catch (err) {
    console.error(
      'Pet Emotion Error:',
      err.status,
      err.message
    )

    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'AI 請求太頻繁，請稍後再試'
      })
    }

    if (err.status === 401) {
      return res.status(502).json({
        success: false,
        error: 'Groq API 金鑰驗證失敗'
      })
    }

    if (err.status === 404) {
      return res.status(502).json({
        success: false,
        error: '目前設定的視覺模型無法使用'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'AI 心情分析失敗，請稍後再試'
    })
  }
})

module.exports = router
