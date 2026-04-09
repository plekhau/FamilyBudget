import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'

export function PrivateRoute() {
  const user = useAuthStore((s) => s.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
