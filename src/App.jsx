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
  const [showSpinner, setShowSpinner] = React.useState(true)

  React.useEffect(() => {
    // Si sigue en loading despues de 2 segundos, lo quitamos a la fuerza
    const timer = setTimeout(() => setShowSpinner(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  // Eliminamos el spinner completamente para asegurar que pase directo a la validación
  // Si no hay user, manda a login inmediatamente.

  
  if (!user) return <Navigate to="/login" replace />
  if (rol === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (rol === 'paqueteria') return <Navigate to="/paqueteria/pedidos" replace />
  
  // Usuario autenticado pero sin rol asignado o rol no reconocido
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <p style={{ color:'#333', fontFamily:'sans-serif', fontSize:18, fontWeight:'bold' }}>⚠️ Sin rol asignado ({rol || 'ninguno'})</p>
      <p style={{ color:'#666', fontFamily:'sans-serif' }}>Tu cuenta no tiene un rol configurado o no se pudo cargar. Email: {user?.email}</p>
      <button onClick={() => { window.location.href='/admin/dashboard' }}
        style={{ background:'#FF6600', color:'white', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontFamily:'sans-serif', marginBottom: '10px' }}>
        Forzar Entrada a Dashboard
      </button>
      <button onClick={() => { window.supabaseClient?.auth.signOut(); window.localStorage.clear(); window.location.href='/login' }}
        style={{ background:'#ccc', color:'#333', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontFamily:'sans-serif' }}>
        Cerrar Sesión
      </button>
    </div>
  )
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
