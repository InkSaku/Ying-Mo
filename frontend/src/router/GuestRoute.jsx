import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'

export default function GuestRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  const destination = location.state?.from

  if (status === 'authenticated') {
    return <Navigate to={destination || '/'} replace />
  }

  return children
}
