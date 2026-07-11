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
const DashboardPage = lazy(() => import('@/features/budget/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TransactionsPage = lazy(() =>
  import('@/features/budget/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
)
const CategoriesPage = lazy(() =>
  import('@/features/budget/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
)
const RecurringPage = lazy(() => import('@/features/budget/RecurringPage').then((m) => ({ default: m.RecurringPage })))
const ReportsPage = lazy(() => import('@/features/budget/ReportsPage').then((m) => ({ default: m.ReportsPage })))

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
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: '/dashboard',
            element: (
              <Suspense fallback={<Loader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
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
          {
            path: '/budget/recurring',
            element: (
              <Suspense fallback={<Loader />}>
                <RecurringPage />
              </Suspense>
            ),
          },
          {
            path: '/budget/reports',
            element: (
              <Suspense fallback={<Loader />}>
                <ReportsPage />
              </Suspense>
            ),
          },
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
