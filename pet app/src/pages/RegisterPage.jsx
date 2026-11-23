import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import BrandPanel from '../components/brand/BrandPanel'

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

      <div className="card-shadow-warm w-full max-w-4xl overflow-hidden rounded-[2rem] border border-hair bg-plate">
        <div className="grid lg:grid-cols-2">

          {/* ===== 左側：品牌面板 ===== */}
          <BrandPanel
            lines={['一起開始，', '好好照顧牠。']}
            sub="註冊只需 30 秒，阿橘會陪你和毛孩。"
            features={[
              { t: '幾秒就開始', d: '新增第一隻寵物只需要幾秒鐘' },
              { t: '一本帳記完', d: '體重、餵食、花費，都記在同一處' },
              { t: '隨時待命', d: '異常提醒與健康問診，半夜也不用擔心' }
            ]}
            catSays="喵～加入我們！"
            dogSays="汪！一起玩"
          />

          {/* ===== 右側：註冊表單 ===== */}
          <div className="px-6 py-7 sm:px-10 lg:py-10 flex flex-col justify-center">
            <div className="max-w-sm w-full mx-auto lg:mx-0">
              <p className="font-brand text-[11px] font-bold tracking-[0.2em] text-honey-deep">
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
                  className="mt-5 rounded-2xl border border-clay-200 bg-clay-50 px-4 py-3 text-xs sm:text-sm text-[#b3402a]"
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
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-[#e8a33d] focus:bg-white focus:ring-4 focus:ring-honey/30"
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
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-[#e8a33d] focus:bg-white focus:ring-4 focus:ring-honey/30"
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
                    className="w-full rounded-2xl border border-line bg-sand/50 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 outline-none transition-all focus:border-[#e8a33d] focus:bg-white focus:ring-4 focus:ring-honey/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#f0a04b] hover:bg-[#e8853d] active:translate-y-px text-pine-900 font-brand font-extrabold py-3.5 text-sm sm:text-base tracking-wide transition-all disabled:opacity-60 shadow-press hover:shadow-press"
                >
                  {loading ? '建立中…' : '建立帳號'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs sm:text-sm text-ink-soft">
                已有帳號？{' '}
                <Link to="/login" className="font-bold text-pine-800 hover:text-pine-900 underline underline-offset-4 decoration-honey decoration-2">
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
