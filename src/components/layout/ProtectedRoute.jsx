import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, rol, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(rol)) {
    // Redirigir según el rol del usuario si intenta acceder a una ruta no permitida
    if (rol === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    } else if (rol === 'paqueteria') {
      return <Navigate to="/paqueteria/pedidos" replace />
    } else {
      return <Navigate to="/login" replace />
    }
  }

  return children
}
