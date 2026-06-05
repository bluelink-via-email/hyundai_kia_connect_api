import { Navigate, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'
import { useStore } from '../lib/store'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { sessionId } = useStore()
  const location = useLocation()

  if (!sessionId) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  return <>{children}</>
}
