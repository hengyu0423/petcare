import { create } from 'zustand'

const saved = localStorage.getItem('paw-user')

export const useAuthStore = create((set) => ({
  user:  saved ? JSON.parse(saved) : null,
  token: localStorage.getItem('paw-token') || null,

  setAuth: (user, token) => {
    localStorage.setItem('paw-token', token)
    localStorage.setItem('paw-user', JSON.stringify(user))
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('paw-token')
    localStorage.removeItem('paw-user')
    set({ user: null, token: null })
  },
}))