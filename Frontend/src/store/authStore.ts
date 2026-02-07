import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { authApi } from '../services/api'

interface AuthStore {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  setAuth: (user: User, token: string, refreshToken: string) => void
  setUser: (user: User) => void
  logout: () => void
  login: (userName: string, password: string) => Promise<void>
  refreshAccessToken: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, token, refreshToken) => {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ user, token, refreshToken, isAuthenticated: true })
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
      },

      login: async (userName: string, password: string) => {
        try {
          set({ isLoading: true })
          const response = await authApi.login({ userName, password })
          const { user, accessToken, refreshToken } = response
          
          get().setAuth(user, accessToken, refreshToken)
        } catch (error) {
          set({ isLoading: false })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      refreshAccessToken: async () => {
        try {
          const { refreshToken } = get()
          if (!refreshToken) throw new Error('No refresh token')

          const response = await authApi.refresh({ refreshToken })
          const { accessToken } = response

          localStorage.setItem('token', accessToken)
          set({ token: accessToken })
        } catch (error) {
          get().logout()
          throw error
        }
      },

      checkAuth: async () => {
        try {
          const { token } = get()
          if (!token) {
            set({ isAuthenticated: false })
            return
          }

          const user = await authApi.me()
          set({ user, isAuthenticated: true })
        } catch (error) {
          get().logout()
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
