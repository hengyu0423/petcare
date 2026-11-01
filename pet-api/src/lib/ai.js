 /**
 * AI 連線共用模組
 *
 * 兩種模式（由環境變數決定）：
 *
 * 1. 有設定 AI_BASE_URL  → 連到任何「OpenAI 相容」的服務
 *    AI_BASE_URL=https://你的服務網址/v1
 *    AI_API_KEY=金鑰
 *    AI_MODEL=主要模型名稱
 *    AI_WEEKLY_MODEL=週報與圖片辨識用的模型名稱（沒設就沿用 AI_MODEL）
 *
 * 2. 沒設定 AI_BASE_URL  → 維持原本的 Groq（沿用 GROQ_API_KEY / GROQ_MODEL / GROQ_WEEKLY_MODEL）
 *
 * 其他可選設定：
 *   AI_MAX_TOKENS_PARAM  輸出長度的參數名稱，預設 max_tokens。
 *                        若你的服務要求 max_completion_tokens 就改這個。
 */

const Groq = require('groq-sdk')
const OpenAI = require('openai')

// 只有 Groq 看得懂的參數，連到其他服務時要拿掉，否則可能被拒絕（400）
const GROQ_ONLY_PARAMS = [
  'reasoning_effort',
  'include_reasoning',
  'reasoning_format'
]

// 讀環境變數：依序嘗試多個名稱，回傳第一個有值的
function env(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim()) return value.trim()
  }
  return ''
}

const getApiKey = () => env('AI_API_KEY', 'GROQ_API_KEY')
const getBaseURL = () => env('AI_BASE_URL').replace(/\/+$/, '')
const isGroqMode = () => !getBaseURL()

const hasAiKey = () => !!getApiKey()
const getModel = fallback => env('AI_MODEL', 'GROQ_MODEL') || fallback

const getWeeklyModel = fallback =>
  env('AI_WEEKLY_MODEL', 'GROQ_WEEKLY_MODEL') ||
  env('AI_MODEL', 'GROQ_MODEL') ||
  fallback

// ------------------------------------------------------
// 用戶端（用到時才建立，環境變數改了也會重建）
// ------------------------------------------------------

let cached = null
let warned = false

function warnOnce(message) {
  if (warned) return
  warned = true
  console.warn(message)
}

function getClient() {
  const apiKey = getApiKey()
  const baseURL = getBaseURL()
  const signature = `${baseURL}|${apiKey}`

  if (cached && cached.signature === signature) return cached.client

  let client

  if (baseURL) {
    client = new OpenAI({ apiKey, baseURL })
    console.log(`🤖 AI 服務：OpenAI 相容（${baseURL}）`)

    if (!env('AI_MODEL', 'GROQ_MODEL')) {
      warnOnce('⚠️ 沒有設定 AI_MODEL，會使用程式內的預設模型名稱，連到其他服務時通常不存在')
    }
  } else {
    client = new Groq({ apiKey })
    console.log('🤖 AI 服務：Groq')

    if (!apiKey.startsWith('gsk_')) {
      warnOnce(
        '⚠️ 目前使用 Groq，但金鑰開頭不是 gsk_，看起來不是 Groq 的金鑰。' +
        '如果你用的是其他服務，請設定 AI_BASE_URL。'
      )
    }
  }

  cached = { signature, client }
  return client
}

// ------------------------------------------------------
// 連到其他服務時：調整參數、處理不支援的欄位
// ------------------------------------------------------

function adaptParams(params) {
  const body = { ...params }

  for (const key of GROQ_ONLY_PARAMS) delete body[key]

  if ('max_completion_tokens' in body) {
    const name = env('AI_MAX_TOKENS_PARAM') || 'max_tokens'
    const value = body.max_completion_tokens

    delete body.max_completion_tokens
    body[name] = value
  }

  return body
}

// 有些模型會把思考過程用 <think>...</think> 夾在回覆裡，使用者不需要看到
function stripThinking(response) {
  for (const choice of response?.choices || []) {
    const message = choice?.message

    if (message && typeof message.content === 'string') {
      message.content = message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim()
    }
  }

  return response
}

async function createCompatible(client, params, options) {
  const body = adaptParams(params)

  try {
    return stripThinking(
      await client.chat.completions.create(body, options)
    )
  } catch (err) {
    // 部分服務不支援 response_format，拿掉後重試一次
    if (err?.status === 400 && body.response_format) {
      const { response_format, ...rest } = body // eslint-disable-line no-unused-vars

      return stripThinking(
        await client.chat.completions.create(rest, options)
      )
    }

    throw err
  }
}

// ------------------------------------------------------
// 對外介面：用法跟原本的 groq.chat.completions.create(...) 完全一樣
// ------------------------------------------------------

const ai = {
  chat: {
    completions: {
      async create(params, options) {
        if (!hasAiKey()) {
          const err = new Error('尚未設定 AI_API_KEY（或 GROQ_API_KEY）')
          err.status = 401
          throw err
        }

        const client = getClient()

        if (isGroqMode()) {
          return client.chat.completions.create(params, options)
        }

        return createCompatible(client, params, options)
      }
    }
  }
}

module.exports = {
  ai,
  hasAiKey,
  getModel,
  getWeeklyModel
}