import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  PawPrint,
  ArrowRight,
  AlertCircle,
  User,
  Mail,
  Lock
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/register', form)
      setAuth(data.data.user, data.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || '註冊失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4" data-theme="light">
      <div className="relative bg-white border border-[#191919] shadow-2xl p-8 w-full max-w-sm">
        <CornerBrackets size="md" />

        {/* 品牌標識 */}
        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-[#191919] border border-[#191919] flex items-center justify-center text-[#fffa00] relative mx-auto mb-3 shadow-xs">
            <PawPrint size={24} strokeWidth={2.2} />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#fffa00]" />
          </div>

          <h1 className="text-xl font-black tracking-wider text-[#191919] font-sans">
            PAWCARE
          </h1>
          <p className="text-[11px] font-mono text-[#8a8a8a] tracking-widest mt-0.5">
            // CREATE ACCOUNT
          </p>
        </div>

        {error && (
          <div className="bg-[#fff5f5] border border-[#ef4444] text-[#ef4444] p-3 mb-5 text-xs font-mono flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
              使用者名稱 / USERNAME
            </label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="您的稱呼或暱稱"
              className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3.5 py-2.5 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
              電子郵件 / EMAIL
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"
              className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3.5 py-2.5 text-xs text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
              設定密碼 / PASSWORD
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="至少 6 位密碼"
              className="w-full bg-[#f8f8f8] border border-[#d9d9d9] px-3.5 py-2.5 text-xs text-[#191919] font-mono focus:border-[#191919] focus:outline-hidden transition-colors"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="action"
              disabled={loading}
              className="w-full py-2.5 text-xs font-bold tracking-wider"
            >
              <span>{loading ? '建立中...' : '確認註冊並進入'}</span>
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-[#e5e5e5] text-center">
          <p className="text-xs text-[#8a8a8a] font-mono">
            已有帳號？{' '}
            <Link to="/login" className="text-[#191919] font-bold underline hover:text-[#d97706] transition-colors ml-1">
              返回登入 →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}