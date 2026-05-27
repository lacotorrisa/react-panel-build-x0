import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, rol, loading } = useAuth()
  const location = useLocation()

  // Esperar a que Supabase confirme la sesión inicial
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Si no hay usuario activo, mandar a login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Si hay usuario pero aún no sabemos su rol, esperar
  if (user && !rol) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Verificar que el rol coincida con el permitido
  if (allowedRoles && !allowedRoles.includes(rol)) {
    if (rol === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    } else if (rol === 'paqueteria') {
      return <Navigate to="/paqueteria/pedidos" replace />
    } else if (rol === 'logistica') {
      return <Navigate to="/logistica/pedidos" replace />
    } else if (rol === 'cliente') {
      return <Navigate to="/cliente/balance" replace />
    } else {
      return <Navigate to="/login" replace />
    }
  }

  return children
}
