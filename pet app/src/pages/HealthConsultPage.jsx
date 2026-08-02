import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const EMOJI = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }

const QUICK_PROMPTS = [
  { label: '食慾不振', text: '最近食慾不振，不太想吃東西，可能的原因是什麼？' },
  { label: '嘔吐', text: '今天嘔吐了幾次，需要就醫嗎？' },
  { label: '腹瀉', text: '排便異常，糞便很稀，該怎麼辦？' },
  { label: '精神不佳', text: '精神很差，一直在睡覺，比平常安靜很多。' },
  { label: '皮膚問題', text: '皮膚出現紅疹或一直在抓癢，是過敏嗎？' },
  { label: '咳嗽', text: '一直在咳嗽或打噴嚏，是感冒嗎？' },
]

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export default function HealthConsultPage() {
  const qc = useQueryClient()
  const [selectedPet, setSelectedPet] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const { data: messages = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['consultations', selectedPet?.id],
    queryFn: () => api.get(`/consultations/pet/${selectedPet.id}`).then(r => r.data.data),
    enabled: !!selectedPet
  })

  const addMessage = useMutation({
    mutationFn: payload => api.post('/consultations', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations', selectedPet?.id] })
  })

  const clearHistory = useMutation({
    mutationFn: petId => api.delete(`/consultations/pet/${petId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations', selectedPet?.id] })
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const getAge = (birthDate) => {
    if (!birthDate) return '年齡不明'
    const months = Math.floor((Date.now() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 30.4))
    return months < 12 ? `${months} 個月` : `${Math.floor(months / 12)} 歲`
  }

  const sendMessage = async (text) => {
    const content = text || input.trim()
    if (!content || !selectedPet || loading) return
    setInput('')
    setLoading(true)

    // 儲存用戶訊息到資料庫
    await addMessage.mutateAsync({ petId: selectedPet.id, role: 'user', content })

    const pet = selectedPet
    const systemPrompt = `你是一位專業的獸醫助手，專門為寵物飼主提供醫療諮詢和建議。

目前諮詢的寵物資料：
- 名字：${pet.name}
- 種類：${pet.species}
- 品種：${pet.breed || '不明'}
- 性別：${pet.gender || '不明'}
- 年齡：${getAge(pet.birth_date)}
- 體重：${pet.weight ? pet.weight + ' kg' : '不明'}

請用繁體中文回答，語氣專業但親切易懂。針對症狀給出：
1. **初步評估** — 可能的原因
2. **建議處理** — 居家照護方式
3. **就醫時機** — 何時需要立即就醫

結尾務必提醒此分析僅供參考，不能替代專業獸醫診斷。`

    // 把歷史對話帶入 API（最近 10 條）
    const recentMessages = messages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))
    recentMessages.push({ role: 'user', content })

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...recentMessages],
          max_tokens: 1200,
          temperature: 0.4
        })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error.message)
      const aiText = data.choices[0].message.content

      // 儲存 AI 回覆到資料庫
      await addMessage.mutateAsync({ petId: selectedPet.id, role: 'ai', content: aiText })
    } catch (err) {
      await addMessage.mutateAsync({ petId: selectedPet.id, role: 'ai', content: `❌ 發生錯誤：${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const formatAI = (text) => {
    let badge = ''
    if (/緊急|立即就醫|危險|嚴重/i.test(text)) {
      badge = '<span class="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-full mb-2">🔴 建議緊急就醫</span><br/>'
    } else if (/觀察|注意|建議就醫/i.test(text)) {
      badge = '<span class="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full mb-2">🟡 建議觀察或就醫</span><br/>'
    } else {
      badge = '<span class="inline-flex items-center gap-1 text-xs font-semibold bg-green-50 text-green-600 px-2 py-0.5 rounded-full mb-2">🟢 一般諮詢</span><br/>'
    }
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^## (.+)$/gm, '<p class="font-bold text-gray-700 mt-3 mb-1">$1</p>')
      .replace(/^- (.+)$/gm, '<span class="block pl-2">• $1</span>')
      .replace(/\n/g, '<br/>')
    return badge + formatted
  }

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 0px)' }}>
      {/* 左側：選擇寵物 */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">選擇寵物</h2>
          <p className="text-xs text-gray-400 mt-0.5">選擇要諮詢的寵物</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">還沒有寵物</p>
          ) : pets.map(pet => (
            <button key={pet.id} onClick={() => setSelectedPet(pet)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedPet?.id === pet.id
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-100 hover:border-green-200 hover:bg-green-50'
              }`}>
              <span className="text-2xl">{EMOJI[pet.species] || '🐾'}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{pet.name}</p>
                <p className="text-xs text-gray-400 truncate">{pet.breed || pet.species}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右側：對話區 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPet ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">
            <span className="text-6xl">🏥</span>
            <p className="text-base font-semibold text-gray-500">請先選擇要諮詢的寵物</p>
            <p className="text-sm">從左側選擇一隻寵物開始健康諮詢</p>
          </div>
        ) : (
          <>
            {/* 寵物資訊列 */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
              <span className="text-3xl">{EMOJI[selectedPet.species] || '🐾'}</span>
              <div>
                <p className="text-sm font-bold text-gray-800">{selectedPet.name}</p>
                <p className="text-xs text-gray-400">
                  {selectedPet.breed || selectedPet.species}
                  {selectedPet.weight ? ` · ${selectedPet.weight} kg` : ''}
                  {selectedPet.birth_date ? ` · ${getAge(selectedPet.birth_date)}` : ''}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-1 rounded-full">Powered by Groq</span>
                {messages.length > 0 && (
                  <button
                    onClick={() => { if (confirm('確定清除所有對話紀錄？')) clearHistory.mutate(selectedPet.id) }}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors border border-gray-200 px-2 py-1 rounded-lg">
                    🗑️ 清除紀錄
                  </button>
                )}
              </div>
            </div>

            {/* 訊息區 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingHistory ? (
                <div className="text-center py-12 text-gray-400 text-sm">載入對話紀錄中...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🐾</p>
                  <p className="text-gray-500 font-semibold mb-1">開始諮詢 {selectedPet.name} 的健康狀況</p>
                  <p className="text-sm text-gray-400 mb-6">描述症狀或選擇常見問題快速開始</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {QUICK_PROMPTS.map(q => (
                      <button key={q.label} onClick={() => sendMessage(q.text)}
                        className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all">
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                        msg.role === 'user' ? 'bg-green-500 text-white font-bold' : 'bg-green-50 text-lg'
                      }`}>
                        {msg.role === 'user' ? '我' : '🐾'}
                      </div>
                      <div className={`max-w-lg flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-green-500 text-white rounded-br-sm'
                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                        }`}>
                          {msg.role === 'user'
                            ? msg.content
                            : <div dangerouslySetInnerHTML={{ __html: formatAI(msg.content) }} />
                          }
                        </div>
                        <p className="text-xs text-gray-400 mt-1 px-1">
                          {new Date(msg.created_at).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-lg shrink-0">🐾</div>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1.5 items-center h-5">
                          {[0,1,2].map(i => (
                            <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* 輸入框 */}
            <div className="bg-white border-t border-gray-200 p-4 shrink-0">
              {messages.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {QUICK_PROMPTS.slice(0, 4).map(q => (
                    <button key={q.label} onClick={() => sendMessage(q.text)}
                      className="text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-gray-500 hover:border-green-300 hover:text-green-600 transition-all">
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-3 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder={`描述 ${selectedPet.name} 的症狀或問題...`}
                  rows={2}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all resize-none"
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  className="w-11 h-11 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 shrink-0 text-lg">
                  ➤
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">⚠️ 此諮詢僅供參考，不能替代專業獸醫診斷</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}