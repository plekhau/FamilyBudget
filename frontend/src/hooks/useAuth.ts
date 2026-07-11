import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/store/authStore'

// Only allow same-origin relative paths as a post-auth redirect target.
function safeRedirect(search: string): string {
  const raw = new URLSearchParams(search).get('redirect') ?? '/'
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

interface LoginData {
  email: string
  password: string
}

interface RegisterData {
  email: string
  display_name: string
  password: string
}

export function useLogin() {
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  return useMutation({
    mutationFn: (data: LoginData) =>
      api.post<{ access: string; refresh: string }>('/api/auth/token/', data).then((r) => r.data),
    onSuccess: async (tokens) => {
      setTokens(tokens.access, tokens.refresh)
      const { data: user } = await api.get<AuthUser>('/api/auth/me/')
      setUser(user)
      navigate(safeRedirect(location.search), { replace: true })
    },
  })
}

export function useRegister() {
  const navigate = useNavigate()
  const location = useLocation()

  return useMutation({
    mutationFn: (data: RegisterData) => api.post('/api/auth/register/', data).then((r) => r.data),
    onSuccess: () => {
      // Carry any invite redirect through to the login page so the new user
      // lands back on the invite (or wherever they came from) after signing in.
      toast.success('Account created — please sign in.')
      navigate(`/login${location.search}`, { replace: true })
    },
  })
}

export function useLogout() {
  const { refreshToken, clearAuth } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => api.post('/api/auth/token/blacklist/', { refresh: refreshToken }),
    onSettled: () => {
      clearAuth()
      qc.clear()
      navigate('/login', { replace: true })
    },
  })
}

export function useMe() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<AuthUser>('/api/auth/me/').then((r) => r.data),
    enabled: !!user,
  })
}

export function useUpdateProfile() {
  const { setUser } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: { display_name: string }) => api.patch<AuthUser>('/api/auth/me/', data).then((r) => r.data),
    onSuccess: (user) => {
      setUser(user)
      qc.setQueryData(['me'], user)
    },
  })
}
