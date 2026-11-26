// ======================================================
// Gemini 文字／圖片生成（帶退避重試與備援模型）
//
// 背景：gemini-x.x-flash 偶爾會回 503「high demand」，
// 之前只呼叫一個模型、失敗就吞掉，前端只好顯示「未知食物」。
// 這裡統一處理：
//   1. 503/429/5xx → 等一會重試一次
//   2. 還是不行 → 換備援模型
//   3. 全部失敗 → 抛出最後一個錯誤，讓呼叫方明確回報「服務暫時忙」
// ======================================================

const { GoogleGenAI } = require('@google/genai')

// 主力模型掛掉時依序退到備援（都支援圖片辨識）
const MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
]

const RETRY_DELAY_MS = 1500

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function isRetryable(err) {
  const status = Number(err?.status ?? err?.error?.code)

  if ([429, 500, 502, 503].includes(status)) return true

  return /UNAVAILABLE|high demand|rate limit|quota|deadline|timeout/i.test(
    String(err?.message || '')
  )
}

/**
 * contents: Gemini generateContent 的 contents（圖片 inlineData + 文字皆可）
 * 回傳 { text, model }；全部模型都失敗時抛出最後一個錯誤。
 */
async function generateGeminiText({ contents }) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  })

  let lastError = null

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents
        })

        return {
          text: response.text || '',
          model
        }
      } catch (err) {
        lastError = err

        console.error(
          `Gemini ${model} 第 ${attempt} 次失敗：`,
          err?.status || err?.message
        )

        if (!isRetryable(err)) break

        if (attempt === 1) {
          await sleep(RETRY_DELAY_MS)
        }
      }
    }
  }

  throw lastError || new Error('Gemini 呼叫失敗')
}

module.exports = {
  generateGeminiText
}
