import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <span className="text-2xl">🐾</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">PawCare</h1>
          <p className="text-gray-400 text-sm mt-1">登入你的帳號</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-500 rounded-lg px-4 py-3 mb-5 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">電子郵件</label>
            <input type="email" required value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              placeholder="your@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">密碼</label>
            <input type="password" required value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white focus:border-transparent transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 text-sm mt-2 shadow-sm">
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          還沒有帳號？{' '}
          <Link to="/register" className="text-green-500 font-semibold hover:underline">立即註冊</Link>
        </p>
      </div>
    </div>
  )
}