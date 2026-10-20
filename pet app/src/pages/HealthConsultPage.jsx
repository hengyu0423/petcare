import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'
import {
  BracketTitle,
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  Dog,
  Cat,
  Bird,
  Rabbit,
  Fish,
  PawPrint,
  Camera,
  Send,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  Info,
  Sparkles,
  HeartPulse,
  X
} from 'lucide-react'

import { api } from '../lib/api'
import { petAgeText } from '../lib/petAge'
import { PetDrawer, PetPickerBar } from '../components/layout/PetDrawer'
import PetEmotionPage from './PetEmotion'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

const QUICK_PROMPTS = [
  { label: '食慾不振', text: '最近食慾不振，不太想吃東西，可能的原因是什麼？' },
  { label: '嘔吐症狀', text: '今天嘔吐了幾次，需要立刻送醫嗎？有哪些危險指標？' },
  { label: '腹瀉問題', text: '排便異常，糞便呈現稀軟水狀，目前該如何照護？' },
  { label: '精神委靡', text: '精神活動力明顯下降，一直在睡覺，比平常安靜許多。' },
  { label: '皮膚搔癢', text: '皮膚出現紅疹或一直頻繁抓癢舔拭，是過敏或感染嗎？' },
  { label: '咳嗽噴嚏', text: '連續頻繁咳嗽或打噴嚏，需要注意哪些呼吸道問題？' }
]

const SEVERITY_CONFIG = {
  normal: {
    label: '一般健康建議',
    className: 'bg-[#fafafa] text-[#191919] border-[#d9d9d9]'
  },
  urgent: {
    label: '建議儘速就醫',
    className: 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
  },
  emergency: {
    label: '緊急狀況注意',
    className: 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
  },
  unknown: {
    label: '諮詢常規指引',
    className: 'bg-[#fafafa] text-[#8a8a8a] border-[#e5e5e5]'
  }
}

function formatAI(text) {
  if (!text) return ''
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#191919]">$1</strong>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<span class="block py-0.5">$1. $2</span>')
    .replace(/^-\s(.+)$/gm, '<span class="block py-0.5">• $1</span>')
    .replace(/\n/g, '<br/>')
}

export default function HealthConsultPage() {
  const queryClient = useQueryClient()
  const [selectedPet, setSelectedPet] = useState(null)
  const [petOpen, setPetOpen] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'emotion' ? 'emotion' : 'consult'
  const showConsult = () => setSearchParams({})
  const showEmotion = () => setSearchParams({ view: 'emotion' })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)
  const [savedNotice, setSavedNotice] = useState(null)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: async () => {
      const response = await api.get('/pets')
      return response.data.data
    }
  })

  // 預設選取第一隻寵物
  useEffect(() => {
    if (!selectedPet && pets.length > 0) {
      setSelectedPet(pets[0])
    }
  }, [pets, selectedPet])

  const { data: messages = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['consultations', selectedPet?.id],
    queryFn: async () => {
      const response = await api.get(`/consultations/pet/${selectedPet.id}`)
      return response.data.data
    },
    enabled: !!selectedPet
  })

  const addMessage = useMutation({
    mutationFn: payload => api.post('/consultations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['consultations', selectedPet?.id]
      })
    }
  })

  const clearHistory = useMutation({
    mutationFn: petId => api.delete(`/consultations/pet/${petId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['consultations', selectedPet?.id]
      })
    }
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const getAge = birthDate => petAgeText(birthDate) || '年齡不明'

  const sendMessage = async text => {
    const content = text || input.trim()
    if (!content || !selectedPet || loading) return

    setInput('')
    setLoading(true)

    try {
      await addMessage.mutateAsync({
        petId: selectedPet.id,
        role: 'user',
        content,
        severity: null
      })

      const pet = selectedPet
      const systemPrompt = `
你是一位專業且親切的寵物健康諮詢助手。

目前諮詢的寵物資料：
名字：${pet.name}
種類：${pet.species}
品種：${pet.breed || '不明'}
性別：${pet.gender || '不明'}
年齡：${getAge(pet.birth_date)}
體重：${pet.weight ? `${pet.weight} kg` : '不明'}

請根據目前寵物的年齡、種類、症狀與先前對話提供健康建議。
規則：
1. 使用繁體中文。
2. 只回答寵物健康相關問題。
3. 不輸出思考過程。
4. 不重複寵物基本資料。
5. 不直接斷定疾病。
6. 回答簡短清楚、列點條理。
7. 幼犬幼貓需特別注意脫水及快速惡化風險。
8. 有危險症狀時明確提醒儘快就醫。
`

      const recentMessages = messages.slice(-6).map(message => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content
      }))
      recentMessages.push({ role: 'user', content })

      const response = await api.post('/consultations/ai', {
        systemPrompt,
        petId: selectedPet.id,
        messages: recentMessages
      })

      const aiText = response.data?.data?.content
      const aiSeverity = response.data?.data?.severity ?? null

      if (!aiText) {
        throw new Error('沒有收到 AI 回覆內容')
      }

      const healthEvent = response.data?.data?.healthEvent
      if (healthEvent) {
        queryClient.invalidateQueries({ queryKey: ['diet-health-events', selectedPet.id] })
        queryClient.invalidateQueries({ queryKey: ['meal-plan', selectedPet.id] })
        setSavedNotice({ ...healthEvent, petId: selectedPet.id })
      }

      await addMessage.mutateAsync({
        petId: selectedPet.id,
        role: 'assistant',
        content: aiText,
        severity: aiSeverity
      })
    } catch (err) {
      console.error('AI 健康諮詢失敗：', err)
      const errorMessage = err.response?.data?.error || err.message || 'AI 回覆失敗'
      try {
        await addMessage.mutateAsync({
          petId: selectedPet.id,
          role: 'assistant',
          content: `無法取得建議：${errorMessage}`,
          severity: null
        })
      } catch (saveError) {
        // 容错
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]" data-theme="light">
      {/* 寵物選單抽屜 */}
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-60">
        <div className="px-4 py-4 border-b border-[#e5e5e5] bg-[#fafafa]">
          <h2 className="text-xs font-bold text-[#191919] uppercase tracking-wider font-mono">
            選擇寵物 // SELECT_PET
          </h2>
          <p className="text-[11px] font-mono text-[#8a8a8a] mt-0.5">選擇要進行諮詢的毛孩</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pets.length === 0 ? (
            <p className="text-xs font-mono text-[#8a8a8a] text-center py-8">
              尚未登錄寵物檔案
            </p>
          ) : (
            pets.map(pet => {
              const Icon = SPECIES_ICONS[pet.species] || PawPrint
              const active = view === 'consult' && selectedPet?.id === pet.id
              return (
                <button
                  key={pet.id}
                  onClick={() => {
                    setSelectedPet(pet)
                    showConsult()
                    setPetOpen(false)
                  }}
                  className={`w-full flex items-center gap-2.5 p-2.5 border text-left transition-colors ${
                    active
                      ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold'
                      : 'bg-white border-[#e5e5e5] hover:border-[#191919] text-[#191919]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 flex items-center justify-center border shrink-0 ${
                      active
                        ? 'bg-[#fffa00] text-[#191919] border-[#fffa00]'
                        : 'bg-[#fafafa] text-[#191919] border-[#e5e5e5]'
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{pet.name}</p>
                    <p className={`text-[10px] font-mono truncate ${active ? 'text-[#fffa00]/80' : 'text-[#8a8a8a]'}`}>
                      {pet.breed || pet.species}
                    </p>
                  </div>
                </button>
              )
            })
          )}

          <div className="mt-4 border-t border-[#e5e5e5] pt-3">
            <p className="px-1 pb-2 text-[10px] font-mono uppercase tracking-wider text-[#8a8a8a]">
              附屬功能 // TOOLS
            </p>

            <button
              type="button"
              onClick={() => {
                showEmotion()
                setPetOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 p-2.5 border text-left transition-colors ${
                view === 'emotion'
                  ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold'
                  : 'bg-white border-[#e5e5e5] hover:border-[#191919] text-[#191919]'
              }`}
            >
              <div
                className={`w-8 h-8 flex items-center justify-center border shrink-0 ${
                  view === 'emotion'
                    ? 'bg-[#fffa00] text-[#191919] border-[#fffa00]'
                    : 'bg-[#fafafa] text-[#191919] border-[#e5e5e5]'
                }`}
              >
                <Camera size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">AI 心情辨識</p>
                <p className={`text-[10px] font-mono truncate ${view === 'emotion' ? 'text-[#fffa00]/80' : 'text-[#8a8a8a]'}`}>
                  拍照解析情緒狀態
                </p>
              </div>
            </button>
          </div>
        </div>
      </PetDrawer>

      {/* 右側主互動區 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <PetPickerBar
          name={view === 'emotion' ? 'AI 心情辨識' : selectedPet?.name}
          sub={view === 'emotion' ? '拍照解析情緒狀態' : selectedPet ? (selectedPet.breed || selectedPet.species) : ''}
          onOpen={() => setPetOpen(true)}
        />

        {view === 'emotion' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            <PetEmotionPage
              embedded
              selectedPet={selectedPet}
              pets={pets}
              onSelectPet={petId => {
                const found = pets.find(p => p.id === petId)
                if (found) setSelectedPet(found)
              }}
            />
          </div>
        ) : !selectedPet ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 p-8 text-center">
            <HeartPulse size={36} className="text-[#8a8a8a]" />
            <p className="font-bold text-sm text-[#191919]">請先選擇要諮詢的寵物</p>
            <p className="text-xs font-mono text-[#8a8a8a]">自左側選單點選寵物以開始健康問答</p>
          </div>
        ) : (
          <>
            {/* 寵物資訊抬頭 */}
            <div className="bg-white border-b border-[#e5e5e5] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#f8f8f8] border border-[#d9d9d9] flex items-center justify-center text-[#191919]">
                  {(() => {
                    const Icon = SPECIES_ICONS[selectedPet.species] || PawPrint
                    return <Icon size={18} />
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#191919]">{selectedPet.name}</span>
                    <Tag size="sm" variant="default" className="text-[10px] font-mono">
                      {selectedPet.breed || selectedPet.species}
                    </Tag>
                  </div>
                  <p className="text-[11px] font-mono text-[#8a8a8a]">
                    {selectedPet.weight ? `${selectedPet.weight} kg · ` : ''}
                    {getAge(selectedPet.birth_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Tag size="sm" variant="default" className="bg-[#191919] text-[#fffa00] border-[#191919] font-mono text-[10px]">
                  AI MODEL ONLINE
                </Tag>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('確定清除此寵物的所有諮詢紀錄嗎？')) {
                        clearHistory.mutate(selectedPet.id)
                      }
                    }}
                    className="border border-[#e5e5e5] hover:border-[#dc2626] hover:text-[#dc2626] text-[#8a8a8a] px-2.5 py-1 text-xs font-mono flex items-center gap-1 transition-colors"
                    title="清除對話紀錄"
                  >
                    <Trash2 size={12} />
                    <span>清除紀錄</span>
                  </button>
                )}
              </div>
            </div>

            {/* 訊息流動區域 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {loadingHistory ? (
                <div className="text-center py-16 text-xs font-mono text-[#8a8a8a]">
                  讀取對話紀錄中... // LOADING_HISTORY
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 max-w-lg mx-auto">
                  <div className="w-12 h-12 bg-white border border-[#d9d9d9] mx-auto flex items-center justify-center text-[#191919] mb-3">
                    <HeartPulse size={24} />
                  </div>
                  <p className="font-bold text-sm text-[#191919]">
                    開始諮詢 {selectedPet.name} 的健康照護
                  </p>
                  <p className="text-xs font-mono text-[#8a8a8a] mt-1 mb-6">
                    可具體描述生活症狀，或點擊下方常見情況進行初步評估
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {QUICK_PROMPTS.map(q => (
                      <button
                        key={q.label}
                        onClick={() => sendMessage(q.text)}
                        disabled={loading}
                        className="bg-white border border-[#d9d9d9] hover:border-[#191919] text-[#191919] px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => {
                    const isUser = msg.role === 'user'
                    const severity = msg.severity && SEVERITY_CONFIG[msg.severity]
                      ? SEVERITY_CONFIG[msg.severity]
                      : SEVERITY_CONFIG.unknown

                    return (
                      <div
                        key={msg.id || `${msg.created_at}-${index}`}
                        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                      >
                        {/* 大頭貼 */}
                        <div
                          className={`w-7 h-7 flex items-center justify-center text-xs font-mono shrink-0 border ${
                            isUser
                              ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold'
                              : 'bg-white text-[#191919] border-[#d9d9d9]'
                          }`}
                        >
                          {isUser ? 'ME' : 'AI'}
                        </div>

                        {/* 氣泡內容 */}
                        <div className={`max-w-xl flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`p-4 text-xs leading-relaxed ${
                              isUser
                                ? 'bg-[#191919] text-white border border-[#191919]'
                                : 'bg-white text-[#191919] border border-[#d9d9d9] shadow-2xs'
                            }`}
                          >
                            {isUser ? (
                              msg.content
                            ) : (
                              <>
                                {/* 嚴重度標籤 */}
                                {!msg.content?.startsWith('無法取得建議') && (
                                  <div
                                    className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 border mb-2.5 ${severity.className}`}
                                  >
                                    <span>//</span>
                                    <span>{severity.label}</span>
                                  </div>
                                )}

                                <div
                                  className="space-y-1 font-sans text-[13px] leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: formatAI(msg.content)
                                  }}
                                />
                              </>
                            )}
                          </div>

                          {msg.created_at && (
                            <p className="text-[10px] font-mono text-[#8a8a8a] mt-1 px-1">
                              {new Date(msg.created_at).toLocaleTimeString('zh-TW', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 bg-white border border-[#d9d9d9] flex items-center justify-center text-xs font-mono text-[#191919] shrink-0">
                        AI
                      </div>
                      <div className="bg-white border border-[#d9d9d9] px-4 py-3 text-xs font-mono text-[#8a8a8a] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#191919] animate-pulse" />
                        <span>AI 分析診斷生成中...</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* 輸入控制區 */}
            <div className="bg-white border-t border-[#e5e5e5] p-4 shrink-0 space-y-3">
              {/* 健康事件自動捕捉提示 */}
              {savedNotice && savedNotice.petId === selectedPet?.id && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#fafafa] border border-[#d9d9d9] text-xs text-[#191919]">
                  <div className="flex items-center gap-2">
                    <Stethoscope size={14} className="text-[#191919] shrink-0" />
                    <span>
                      已自動記錄「{savedNotice.title}」至 {selectedPet?.name} 的健康歷程
                      {savedNotice.dietRelevant && '，飲食計畫將參照更新'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavedNotice(null)}
                    className="text-[#8a8a8a] hover:text-[#191919] shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* 快捷症狀標籤 */}
              {messages.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_PROMPTS.slice(0, 4).map(q => (
                    <button
                      key={q.label}
                      onClick={() => sendMessage(q.text)}
                      disabled={loading}
                      className="text-[11px] font-mono bg-[#fafafa] border border-[#e5e5e5] hover:border-[#191919] text-[#555] px-2.5 py-1 transition-colors disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 文本輸入欄 */}
              <div className="flex gap-2.5 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder={`輸入 ${selectedPet.name} 的症狀、日常飲食或照護疑問... (Enter 發送)`}
                  rows={2}
                  disabled={loading}
                  className="flex-1 bg-[#fafafa] border border-[#d9d9d9] px-3.5 py-2.5 text-xs text-[#191919] focus:bg-white focus:border-[#191919] focus:outline-hidden transition-colors resize-none disabled:opacity-60"
                />

                <Button
                  variant="action"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 flex items-center justify-center p-0 shrink-0"
                >
                  <Send size={15} />
                </Button>
              </div>

              <p className="text-[10px] font-mono text-[#8a8a8a] text-center">
                // NOTICE: 本 AI 諮詢僅提供生活照護與健康建議參考，不可取代專業獸醫臨床診斷與處方。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}