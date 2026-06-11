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
import { PedidosPorStatus } from './pages/admin/PedidosPorStatus'
import { GestionClientes } from './pages/admin/GestionClientes'
import { GestionPaqueterias } from './pages/admin/GestionPaqueterias'
import { GestionUsuarios } from './pages/admin/GestionUsuarios'
import { InventarioAdmin } from './pages/admin/InventarioAdmin'
import { GestionEmpresasLogisticas } from './pages/admin/GestionEmpresasLogisticas'
import { FinanzasAdmin } from './pages/admin/FinanzasAdmin'
import { TrazabilidadGuias } from './pages/admin/TrazabilidadGuias'
import { GestionRecepciones } from './pages/admin/GestionRecepciones'
import { ReconciliacionStock } from './pages/admin/ReconciliacionStock'
import { MisPedidos } from './pages/logistica/MisPedidos'
import { RecepcionesPaqueteria } from './pages/logistica/RecepcionesPaqueteria'
import { InventarioPaqueteria } from './pages/logistica/InventarioPaqueteria'
import { MisPedidosCliente } from './pages/cliente/MisPedidosCliente'
import { InventarioCliente } from './pages/cliente/InventarioCliente'

import { MiCartera } from './pages/cliente/MiCartera'
import { RetiroSaldo } from './pages/cliente/RetiroSaldo'
import { TrazabilidadCliente } from './pages/cliente/TrazabilidadCliente'
import { CierreCaja } from './pages/admin/CierreCaja'

const RootRedirect = () => {
  const { user, rol, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', backgroundColor:'#F8F9FA' }}>
        <div style={{ width: 32, height: 32, border: '4px solid #FF6600', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (user && !rol) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', backgroundColor:'#F8F9FA' }}>
        <div style={{ width: 32, height: 32, border: '4px solid #FF6600', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    )
  }

  if (rol === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (rol === 'logistica') return <Navigate to="/logistica/pedidos" replace />
  if (rol === 'cliente') return <Navigate to="/cliente/cartera" replace />
  
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
          <Route path="pedidos/:status" element={<PedidosPorStatus />} />
          <Route path="entregados" element={<PedidosEntregados />} />
          <Route path="retrasos" element={<PedidosRetraso />} />
          <Route path="clientes" element={<GestionClientes />} />
          <Route path="paqueterias" element={<GestionPaqueterias />} />
          <Route path="usuarios" element={<GestionUsuarios />} />
          <Route path="inventario" element={<InventarioAdmin />} />
          <Route path="empresas-logisticas" element={<GestionEmpresasLogisticas />} />

          <Route path="lacotorrisa/cartera" element={<MiCartera clienteIdOverride="1882e9a0-4dc0-4a03-96e4-ffa5712cda09" />} />
          <Route path="lacotorrisa/trazabilidad" element={<TrazabilidadCliente clienteIdOverride="1882e9a0-4dc0-4a03-96e4-ffa5712cda09" />} />
          <Route path="lacotorrisa/trazabilidad10" element={<TrazabilidadCliente clienteIdOverride="1882e9a0-4dc0-4a03-96e4-ffa5712cda09" mode="10" />} />
          <Route path="lacotorrisa/caja" element={<CierreCaja clienteIdOverride="1882e9a0-4dc0-4a03-96e4-ffa5712cda09" />} />
          <Route path="finanzas" element={<FinanzasAdmin />} />
          <Route path="trazabilidad" element={<TrazabilidadGuias />} />
          <Route path="trazabilidad10" element={<TrazabilidadGuias mode="10" />} />
        </Route>

        {/* Rutas Empresa Logística */}
        <Route path="/logistica" element={<ProtectedRoute allowedRoles={['logistica']}><Layout /></ProtectedRoute>}>
          <Route path="pedidos" element={<MisPedidos />} />
          <Route path="inventario" element={<InventarioPaqueteria />} />
        </Route>

        {/* Rutas Cliente */}
        <Route path="/cliente" element={<ProtectedRoute allowedRoles={['cliente']}><Layout /></ProtectedRoute>}>
          <Route path="pedidos" element={<MisPedidosCliente />} />
          <Route path="inventario" element={<InventarioCliente />} />

          <Route path="cartera" element={<MiCartera />} />
          <Route path="cartera10" element={<MiCartera mode="10" />} />
          <Route path="retiro" element={<RetiroSaldo />} />
          <Route path="trazabilidad" element={<TrazabilidadCliente />} />
          <Route path="trazabilidad10" element={<TrazabilidadCliente mode="10" />} />
        </Route>

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
