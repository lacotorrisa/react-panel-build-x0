import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './lib/auth'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Layout } from './components/layout/Layout'

import { Login } from './pages/auth/Login'
import { Dashboard } from './pages/admin/Dashboard'
import { CargarPedidos } from './pages/admin/CargarPedidos'
import { PedidosEntregados } from './pages/admin/PedidosEntregados'
import { PedidosRetraso } from './pages/admin/PedidosRetraso'
import { GestionClientes } from './pages/admin/GestionClientes'
import { GestionPaqueterias } from './pages/admin/GestionPaqueterias'
import { GestionUsuarios } from './pages/admin/GestionUsuarios'
import { MisPedidos } from './pages/paqueteria/MisPedidos'

const RootRedirect = () => {
  const { user, rol, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (rol === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (rol === 'paqueteria') return <Navigate to="/paqueteria/pedidos" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Rutas Admin */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pedidos" element={<CargarPedidos />} />
          <Route path="entregados" element={<PedidosEntregados />} />
          <Route path="retrasos" element={<PedidosRetraso />} />
          <Route path="clientes" element={<GestionClientes />} />
          <Route path="paqueterias" element={<GestionPaqueterias />} />
          <Route path="usuarios" element={<GestionUsuarios />} />
        </Route>

        {/* Rutas Paquetería */}
        <Route path="/paqueteria" element={<ProtectedRoute allowedRoles={['paqueteria']}><Layout /></ProtectedRoute>}>
          <Route path="pedidos" element={<MisPedidos />} />
        </Route>

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
