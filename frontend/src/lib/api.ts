import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({ baseURL: BASE_URL })

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: attempt silent token refresh, then retry original request
let isRefreshing = false
let pending: Array<(token: string) => void> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    if (isRefreshing) {
      return new Promise((resolve) => {
        pending.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(api(original))
        })
      })
    }

    isRefreshing = true
    const { refreshToken, setTokens, clearAuth } = useAuthStore.getState()

    if (!refreshToken) {
      clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post<{ access: string }>(
        `${BASE_URL}/api/auth/token/refresh/`,
        { refresh: refreshToken }
      )
      setTokens(data.access, refreshToken)
      pending.forEach((cb) => cb(data.access))
      pending = []
      original.headers.Authorization = `Bearer ${data.access}`
      return api(original)
    } catch {
      clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)
