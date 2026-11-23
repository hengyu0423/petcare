import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import BrandPanel from '../components/brand/BrandPanel'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', form)
      setAuth(data.data.user, data.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || '登入失敗，請再試一次')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-dvh paw-soft-dots flex items-center justify-center p-4 sm:p-6">

      {/* 主卡片：左品牌面板 + 右表單，Kizupi 式圓潤大圓角 */}
      <div className="card-shadow-warm w-full max-w-4xl overflow-hidden rounded-[2rem] border border-hair bg-plate">
        <div className="grid lg:grid-cols-2">

          {/* ===== 左側：品牌面板 ===== */}
          <BrandPanel
            lines={['毛孩的每一天，', '都被好好照顧。']}
            sub="飲食・健康・監控，全部裝進一個 App。"
            features={[
              { t: '一頁看完', d: '飲食、健康、體重、花費，全都在同一處' },
              { t: 'AI 健康問診', d: '先給你初步建議，再決定要不要看醫生' },
              { t: '即時監控', d: '攝影機看見毛孩的每個小動作' }
            ]}
            catSays="歡迎回來！"
            dogSays="汪！等你好久"
          />

          {/* ===== 右側：登入表單 ===== */}
          <div className="px-6 py-7 sm:px-10 lg:py-12 flex flex-col justify-center">
            <div className="max-w-sm w-full mx-auto lg:mx-0">
              <p className="font-brand text-[11px] font-bold tracking-[0.2em] text-honey-deep">
                WELCOME BACK
              </p>
              <h2 className="font-brand mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-pine-900">
                登入你的帳號
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-ink-soft">
                好久不見，毛孩都想你了。
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-clay-200 bg-clay-50 px-4 py-3 text-xs sm:text-sm text-clay"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-honey-500 focus:bg-white focus:ring-4 focus:ring-honey/30"
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
                    autoComplete="current-password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-honey-500 focus:bg-white focus:ring-4 focus:ring-honey/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-tabby hover:bg-tabby-deep active:translate-y-px text-pine-900 font-brand font-extrabold py-3.5 text-sm sm:text-base tracking-wide transition-all disabled:opacity-60 shadow-press hover:shadow-press"
                >
                  {loading ? '登入中…' : '登入 PawCare'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs sm:text-sm text-ink-soft">
                還沒有帳號？{' '}
                <Link to="/register" className="font-bold text-pine-800 hover:text-pine-900 underline underline-offset-4 decoration-honey decoration-2">
                  立即註冊
                </Link>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
