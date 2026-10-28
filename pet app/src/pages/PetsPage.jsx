import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Dog,
  Cat,
  Bird,
  Fish,
  Rabbit,
  PawPrint,
  Plus,
  Trash2,
  Scale,
  Cake,
  X,
  Calendar,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react'
import { api } from '../lib/api'
import { petAgeText, ageInMonths } from '../lib/petAge'
import { lifeStage, nextBirthday, formatKg, todayString } from '../lib/petInsights'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

const SPECIES = [
  ['all', '全部', 'ALL'],
  ['dog', '狗狗', 'DOG'],
  ['cat', '貓咪', 'CAT'],
  ['bird', '鳥類', 'BIRD'],
  ['rabbit', '兔子', 'RABBIT'],
  ['fish', '魚類', 'FISH'],
  ['other', '其他', 'OTHER']
]

const GENDER = [
  ['male', '公 (男)'],
  ['female', '母 (女)'],
  ['unknown', '不明']
]

const SPECIES_MAP = {
  dog: '狗狗',
  cat: '貓咪',
  bird: '鳥類',
  rabbit: '兔子',
  fish: '魚類',
  other: '其他'
}

const SPECIES_EN = {
  dog: 'DOG',
  cat: 'CAT',
  bird: 'BIRD',
  rabbit: 'RABBIT',
  fish: 'FISH',
  other: 'OTHER'
}

function getSpeciesIcon(species, props = {}) {
  const Icon = SPECIES_ICONS[species?.toLowerCase()] || PawPrint
  return <Icon {...props} />
}

const pad = n => String(n).padStart(2, '0')

// Endfield 表單輸入框樣式
const inputCls = "w-full border border-[var(--ef-rule)] bg-[var(--ef-panel)] focus:border-[var(--ef-ink)] px-3 py-2 text-xs text-[var(--ef-ink)] font-mono focus:outline-none transition-colors"
const selectCls = "w-full border border-[var(--ef-rule)] bg-[var(--ef-panel)] focus:border-[var(--ef-ink)] px-3 py-2 text-xs text-[var(--ef-ink)] font-mono focus:outline-none transition-colors"

// 新增寵物對話框 (Endfield 工業風格彈窗)
function PetModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: '',
    species: 'dog',
    breed: '',
    gender: 'unknown',
    birthDate: '',
    weight: '',
    notes: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const modal = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 font-sans animate-fade-in">
      <div
        className="bg-[var(--ef-panel)] border-2 border-[var(--ef-ink)] shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'
        }}
      >
        {/* 彈窗頂部 */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--ef-paper)] border-b border-[var(--ef-rule)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
            <h2 className="text-xs font-mono font-bold tracking-wider text-[var(--ef-ink)] uppercase">
              // REGISTER // 登記寵物檔案
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 border border-[var(--ef-rule)] hover:border-[var(--ef-ink)] text-[var(--ef-ink-2)] hover:text-[var(--ef-ink)] flex items-center justify-center transition-colors"
            aria-label="關閉"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* 登記表單 */}
        <form
          onSubmit={e => {
            e.preventDefault()
            onSave({ ...form, weight: form.weight ? Number(form.weight) : undefined })
          }}
          className="p-5 space-y-3.5 bg-[var(--ef-panel)]"
        >
          <div>
            <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
              寵物名字 / NAME *
            </label>
            <input
              required
              placeholder="例如：咪咪、Lucky"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
                物種 / SPECIES
              </label>
              <select
                value={form.species}
                onChange={e => set('species', e.target.value)}
                className={selectCls}
              >
                {SPECIES.filter(s => s[0] !== 'all').map(([v, l, en]) => (
                  <option key={v} value={v}>{l} ({en})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
                性別 / GENDER
              </label>
              <select
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
                className={selectCls}
              >
                {GENDER.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
              品種 / BREED
            </label>
            <input
              placeholder="例如：米克斯、英國短毛貓 (選填)"
              value={form.breed}
              onChange={e => set('breed', e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
                出生日期 / BIRTH
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
                體重 / WEIGHT (KG)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                placeholder="例如：4.5"
                value={form.weight}
                onChange={e => set('weight', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">
              備註記事 / NOTES
            </label>
            <textarea
              placeholder="過敏體質、飲食偏好或特殊生活照顧事項 (選填)"
              value={form.notes}
              rows={2}
              onChange={e => set('notes', e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex gap-2.5 pt-3 border-t border-[var(--ef-rule)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 ef-btn small"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 ef-btn small go"
            >
              {saving ? '儲存中...' : '確認登記'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}

export default function PetsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [activeSpecies, setActiveSpecies] = useState('all')

  const { data: pets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const addPet = useMutation({
    mutationFn: payload => api.post('/pets', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pets'] })
      setShowModal(false)
    }
  })

  const deletePet = useMutation({
    mutationFn: id => api.delete(`/pets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pets'] })
  })

  // 各物種計數
  const speciesCounts = useMemo(() => {
    const counts = { all: pets.length }
    for (const p of pets) {
      const sp = p.species?.toLowerCase() || 'other'
      counts[sp] = (counts[sp] || 0) + 1
    }
    return counts
  }, [pets])

  // 篩選後寵物列表
  const filteredPets = useMemo(() => {
    if (activeSpecies === 'all') return pets
    return pets.filter(p => (p.species?.toLowerCase() || 'other') === activeSpecies)
  }, [pets, activeSpecies])

  const today = todayString()

  return (
    <div className="ef pc-home min-h-full p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

      {/* 頂部三色條與頁首標題 */}
      <div className="pc-head">
        <span className="ef-eyebrow slash">PawCare / Roster</span>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ef-ink)] tracking-tight">
              我的寵物 <span className="ef-marker ef-in-stroke">名冊</span>
            </h1>
            <p className="text-xs text-[var(--ef-ink-2)] font-mono mt-1">
              // REGISTERED PET SPECIMEN DATABASE
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ef-btn go"
              onClick={() => setShowModal(true)}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>登記新寵物</span>
            </button>
          </div>
        </div>

        {/* 真實數據狀態橫列 */}
        <ul className="ef-facts ef-field mt-2">
          <li><time dateTime={today}>{today.replaceAll('-', '.')}</time></li>
          <li>登錄個體 <b>{pets.length}</b> 隻</li>
          <li>當前檢視 <b>{filteredPets.length}</b> 筆</li>
          <li>健康資料庫正常</li>
        </ul>
      </div>

      {/* 篩選標籤列表 (Endfield .ef-chip) */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[var(--ef-rule)]" aria-label="物種篩選">
        <span className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase mr-1 tracking-wider flex items-center gap-1">
          <SlidersHorizontal size={12} />
          // FILTER:
        </span>
        {SPECIES.map(([id, label, en]) => {
          const count = speciesCounts[id] || 0
          const isActive = activeSpecies === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSpecies(id)}
              className={`ef-chip ${isActive ? 'is-active' : ''} text-xs font-mono`}
              aria-pressed={isActive}
            >
              <span>{label}</span>
              <span className="n">{count}</span>
            </button>
          )
        })}
      </div>

      {showModal && (
        <PetModal
          onClose={() => setShowModal(false)}
          onSave={d => addPet.mutate(d)}
          saving={addPet.isPending}
        />
      )}

      {/* 資料載入中狀態 */}
      {isLoading ? (
        <div className="ef-progress is-unknown my-12" role="progressbar" aria-label="載入寵物檔案中">
          <span className="ef-eyebrow">Loading / 載入寵物檔案庫</span>
          <i></i>
        </div>
      ) : isError ? (
        <section className="ef-panel p-6 border border-[var(--ef-rule)]">
          <h2><span className="ef-pair"><span className="ef-eyebrow">Error</span><span>讀取失敗</span></span></h2>
          <p className="ef-notice" data-flag="錯誤">寵物名冊讀取失敗，請確認伺服器連線狀態。</p>
          <p className="ef-actions mt-4">
            <button type="button" className="ef-btn go" onClick={() => refetch()}>重新讀取</button>
          </p>
        </section>
      ) : pets.length === 0 ? (
        /* 全域空狀態 */
        <section className="ef-panel p-8 text-center border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
          <div className="w-12 h-12 mx-auto mb-3 bg-[var(--ef-ink)] text-[var(--ef-signal)] flex items-center justify-center"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
          >
            <PawPrint size={24} strokeWidth={2} />
          </div>
          <h2><span className="ef-pair"><span className="ef-eyebrow">Start</span><span>名冊尚未登錄</span></span></h2>
          <p className="ef-empty mt-2">
            尚未新增任何寵物檔案。建立第一隻毛小孩後，系統將自動啟動健康、飲食管理與即時心情辨識。
          </p>
          <p className="ef-actions mt-4">
            <button type="button" className="ef-btn go" onClick={() => setShowModal(true)}>
              + 登記第一隻寵物
            </button>
          </p>
        </section>
      ) : filteredPets.length === 0 ? (
        /* 篩選無結果 */
        <div className="p-8 text-center border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
          <p className="ef-empty">此篩選類別下目前沒有已登錄的寵物。</p>
          <p className="ef-actions mt-3">
            <button type="button" className="ef-btn small" onClick={() => setActiveSpecies('all')}>
              顯示全部寵物
            </button>
          </p>
        </div>
      ) : (
        /* 寵物名冊工業卡片網格 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPets.map((pet, idx) => {
            const birthDate = pet.birth_date ? String(pet.birth_date).slice(0, 10) : null
            const months = birthDate ? ageInMonths(birthDate) : null
            const stage = lifeStage(pet.species, months)
            const birthday = nextBirthday(birthDate, today)
            const soon = birthday && birthday.daysUntil <= 30

            return (
              <div
                key={pet.id}
                className="ef-panel cut-br flex flex-col justify-between border border-[var(--ef-rule)] bg-[var(--ef-panel)] transition-all hover:border-[var(--ef-ink)] group p-4.5"
              >
                {/* 卡片標頭列 */}
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--ef-rule)]/80">
                    <div className="flex items-center gap-2">
                      <span className="ef-tag font-mono font-bold text-[10px]">
                        No.{pad(idx + 1)}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--ef-ink-2)] tracking-wider uppercase">
                        // {SPECIES_EN[pet.species] || 'PET'}
                      </span>
                    </div>

                    {/* 刪除按鈕 (紅色只給刪除) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`確定要刪除「${pet.name}」的檔案嗎？此動作將清除該寵物所有健康與飲食紀錄，無法復原。`)) {
                          deletePet.mutate(pet.id)
                        }
                      }}
                      className="ef-btn small danger p-1 text-[11px]"
                      title="刪除寵物檔案"
                      aria-label={`刪除 ${pet.name}`}
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>

                  {/* 寵物核心個體資訊 */}
                  <div className="mt-3.5 flex items-start gap-3.5">
                    {/* 個體頭像方塊 (墨底切角) */}
                    <div
                      className="w-12 h-12 bg-[var(--ef-ink)] text-[var(--ef-panel)] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                      style={{
                        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)'
                      }}
                    >
                      {getSpeciesIcon(pet.species, { size: 24, strokeWidth: 2, className: 'text-[var(--ef-signal)]' })}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-[var(--ef-ink)] truncate leading-tight">
                          {pet.name}
                        </h2>
                        {stage && (
                          <span className="ef-state text-[10px] font-mono shrink-0">
                            {stage.label}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[var(--ef-ink-2)] font-mono truncate mt-0.5">
                        {pet.breed || '未設定品種'}
                        {pet.gender && pet.gender !== 'unknown' ? ` · ${pet.gender === 'male' ? '公' : '母'}` : ''}
                      </p>

                      {/* 生日醒目提醒 (Endfield 醒目提醒填黃，不用彩虹紅橘) */}
                      {soon && (
                        <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--ef-signal)] text-[var(--ef-on-signal)] text-[10px] font-mono font-bold">
                          <Cake size={11} strokeWidth={2.5} />
                          <span>{birthday.isToday ? '今天生日！' : `${birthday.daysUntil}天後生日`}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 數據清單 (Endfield .ef-ledger) */}
                  <ul className="ef-ledger mt-3.5 text-xs">
                    <li>
                      <span>生命階段</span>
                      <span className="ef-field">{stage ? stage.label : '—'}</span>
                    </li>
                    <li>
                      <span>生理年齡</span>
                      <span className="ef-field">{petAgeText(pet.birth_date) || '未設定生日'}</span>
                    </li>
                    <li>
                      <span>目前體重</span>
                      <span className="ef-field font-bold">{pet.weight ? `${formatKg(pet.weight)} kg` : '未記錄'}</span>
                    </li>
                    {pet.notes && (
                      <li className="items-start">
                        <span>備註記事</span>
                        <span className="ef-field text-[11px] truncate max-w-[160px]" title={pet.notes}>
                          {pet.notes}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* 卡片底部操作列 */}
                <div className="mt-4 pt-3 border-t border-[var(--ef-rule)] flex items-center justify-between gap-2">
                  <Link
                    to={`/dashboard?pet=${pet.id}`}
                    className="ef-btn small flex-1 text-center"
                    title="在首頁總覽顯示此寵物"
                  >
                    首頁聚焦
                  </Link>

                  <Link
                    to={`/pets/${pet.id}`}
                    className="ef-btn small go flex-1 text-center flex items-center justify-center gap-1"
                  >
                    <span>詳細檔案</span>
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}