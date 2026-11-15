import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import MascotCat from '../components/brand/MascotCat'

function PawMark({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="24" cy="31" rx="10.5" ry="8" />
      <circle cx="12.5" cy="20" r="4" />
      <circle cx="20" cy="13" r="4" />
      <circle cx="28" cy="13" r="4" />
      <circle cx="35.5" cy="20" r="4" />
    </svg>
  )
}

const FEATURES = [
  '新增第一隻寵物只需幾秒鐘',
  '體重・餵食・花費，一本帳記完',
  '異常提醒跟健康問診，隨時待命'
]

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/register', form)
      setAuth(data.data.user, data.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || '註冊失敗，請再試一次')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-dvh paw-soft-dots flex items-center justify-center p-4 sm:p-6">

      <div className="card-shadow-warm w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#f3e3cd] bg-[#fffdf6]">
        <div className="grid lg:grid-cols-2">

          {/* ===== 左側：品牌面板 ===== */}
          <div className="relative overflow-hidden bg-pine-800 px-6 py-7 lg:px-9 lg:py-10 flex flex-col">
            <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div aria-hidden="true" className="absolute -left-20 bottom-16 h-40 w-40 rounded-full bg-white/5" />

            <Link to="/login" className="relative flex items-center gap-2.5 self-start">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f5c04a]">
                <PawMark size={20} className="text-pine-900" />
              </span>
              <span className="font-brand text-xl font-bold tracking-tight text-[#f4f1e8]">
                PawCare
              </span>
            </Link>

            <div className="relative mt-6 lg:mt-auto lg:pt-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="flex items-center gap-4 lg:gap-6">
                <MascotCat size={128} className="lg:hidden shrink-0" />
                <div>
                  <h1 className="font-brand text-2xl sm:text-3xl xl:text-4xl font-extrabold leading-[1.15] text-[#f4f1e8]">
                    一起開始，<br />
                    好好照顧牠。
                  </h1>
                  <p className="mt-2.5 text-xs sm:text-sm text-[#f4f1e8]/70">
                    註冊只需 30 秒，阿橘會陪你和毛孩。
                  </p>
                </div>
              </div>

              <MascotCat size={210} className="hidden lg:block mt-8 self-center" />

              <ul className="relative mt-6 space-y-2 text-left">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[11px] lg:text-xs text-[#f4f1e8]/85">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f5c04a]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#18301f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4.5 4.5L19 8" /></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ===== 右側：註冊表單 ===== */}
          <div className="px-6 py-7 sm:px-10 lg:py-10 flex flex-col justify-center">
            <div className="max-w-sm w-full mx-auto lg:mx-0">
              <p className="font-brand text-[11px] font-bold tracking-[0.2em] text-[#c96f2e]">
                JOIN PAWCARE
              </p>
              <h2 className="font-brand mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-pine-900">
                建立新帳號
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-ink-soft">
                30 秒搞定，馬上開始記錄毛孩的生活。
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#f3c2b8] bg-[#fdf0ec] px-4 py-3 text-xs sm:text-sm text-[#b3402a]"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-ink-soft mb-1.5">
                    姓名
                  </label>
                  <input
                    id="name"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="你的名字"
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-[#e8a33d] focus:bg-white focus:ring-4 focus:ring-[#f5c04a]/30"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-ink-soft mb-1.5">
                    電子郵件
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-[#e8a33d] focus:bg-white focus:ring-4 focus:ring-[#f5c04a]/30"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-ink-soft mb-1.5">
                    密碼
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="至少 6 個字元"
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-[#e8a33d] focus:bg-white focus:ring-4 focus:ring-[#f5c04a]/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#f0a04b] hover:bg-[#e8853d] active:translate-y-px text-pine-900 font-brand font-extrabold py-3.5 text-sm sm:text-base tracking-wide transition-all disabled:opacity-60 shadow-[0_6px_0_#c96f2e] hover:shadow-[0_4px_0_#c96f2e]"
                >
                  {loading ? '建立中…' : '建立帳號'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs sm:text-sm text-ink-soft">
                已有帳號？{' '}
                <Link to="/login" className="font-bold text-pine-800 hover:text-pine-900 underline underline-offset-4 decoration-[#f5c04a] decoration-2">
                  返回登入
                </Link>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
