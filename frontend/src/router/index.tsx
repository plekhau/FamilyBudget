/* eslint-disable react-refresh/only-export-components -- router files mix components and config by design */
import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { PrivateRoute } from './PrivateRoute'
import { AppShell } from '@/components/layout/AppShell'

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const SpacesPage = lazy(() => import('@/features/spaces/SpacesPage').then((m) => ({ default: m.SpacesPage })))
const AcceptInvitePage = lazy(() =>
  import('@/features/spaces/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage }))
)
const TransactionsPage = lazy(() =>
  import('@/features/budget/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
)
const CategoriesPage = lazy(() =>
  import('@/features/budget/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
)

const Loader = () => <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>

function ComingSoon({ title }: { title: string }) {
  return <div className="flex h-full items-center justify-center text-muted-foreground">{title} — coming soon</div>
}

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
    path: '/invite',
    element: (
      <Suspense fallback={<Loader />}>
        <AcceptInvitePage />
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
          { path: '/dashboard', element: <ComingSoon title="Dashboard" /> },
          { path: '/budget', element: <Navigate to="/budget/transactions" replace /> },
          {
            path: '/budget/transactions',
            element: (
              <Suspense fallback={<Loader />}>
                <TransactionsPage />
              </Suspense>
            ),
          },
          {
            path: '/budget/categories',
            element: (
              <Suspense fallback={<Loader />}>
                <CategoriesPage />
              </Suspense>
            ),
          },
          { path: '/budget/recurring', element: <ComingSoon title="Recurring" /> },
          { path: '/budget/reports', element: <ComingSoon title="Reports" /> },
          {
            path: '/settings',
            element: (
              <Suspense fallback={<Loader />}>
                <SettingsPage />
              </Suspense>
            ),
          },
          {
            path: '/spaces',
            element: (
              <Suspense fallback={<Loader />}>
                <SpacesPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
])
