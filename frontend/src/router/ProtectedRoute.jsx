import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'initializing') return <main className="auth-pending" aria-live="polite">正在恢复登录状态…</main>
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return children
}
