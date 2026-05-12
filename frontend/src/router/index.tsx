/* eslint-disable react-refresh/only-export-components -- router files mix components and config by design */
import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { PrivateRoute } from './PrivateRoute'
import { AppShell } from '@/components/layout/AppShell'

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const Loader = () => <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<Loader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<Loader />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/settings" replace /> },
          {
            path: '/settings',
            element: (
              <Suspense fallback={<Loader />}>
                <SettingsPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
])
