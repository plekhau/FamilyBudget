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
let pending: ((token: string) => void)[] = []

// Auth endpoints whose own 401 means "bad credentials / expired session", not
// "access token expired" — never run the silent-refresh flow for these, or the
// caller's error state (e.g. the login form) never gets a chance to render.
const AUTH_ENDPOINTS = ['/api/auth/token/', '/api/auth/token/refresh/']

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    const url = original?.url ?? ''
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url.endsWith(path))

    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) {
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
      const { data } = await axios.post<{ access: string; refresh?: string }>(`${BASE_URL}/api/auth/token/refresh/`, {
        refresh: refreshToken,
      })
      // The backend rotates refresh tokens (ROTATE_REFRESH_TOKENS) and blacklists
      // the old one, so we must persist the new refresh token or the next refresh
      // fails with 401 and forces a logout.
      setTokens(data.access, data.refresh ?? refreshToken)
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
