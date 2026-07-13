import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'

export default function AdminRoute({ children, systemOnly = false }) {
  const { status, user } = useAuth(); const location = useLocation()
  if (status === 'initializing') return <main className="auth-pending">正在验证管理权限…</main>
  if (status !== 'authenticated') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  const allowed = systemOnly ? user.role === 'system_admin' : ['content_admin', 'system_admin'].includes(user.role)
  return allowed ? children : <section className="page-container state-message state-message--error"><h1>403</h1><p>你没有访问管理后台的权限。</p></section>
}

export function SystemAdminRoute({ children }) {
  return <AdminRoute systemOnly>{children}</AdminRoute>
}
