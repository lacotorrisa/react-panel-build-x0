import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Truck, 
  Settings, 
  LogOut, 
  Menu,
  X,
  History,
  AlertCircle
} from 'lucide-react'

export const Layout = () => {
  const { rol, user, perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Cargar Pedidos', path: '/admin/pedidos', icon: <Package size={20} /> },
    { name: 'Entregados', path: '/admin/entregados', icon: <History size={20} /> },
    { name: 'Con Retraso', path: '/admin/retrasos', icon: <AlertCircle size={20} /> },
    { name: 'Clientes', path: '/admin/clientes', icon: <Users size={20} /> },
    { name: 'Paqueterías', path: '/admin/paqueterias', icon: <Truck size={20} /> },
    { name: 'Usuarios', path: '/admin/usuarios', icon: <Settings size={20} /> },
  ]

  const paqueteriaLinks = [
    { name: 'Mis Pedidos', path: '/paqueteria/pedidos', icon: <Package size={20} /> },
  ]

  const links = rol === 'admin' ? adminLinks : paqueteriaLinks

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-[#1a1a2e] text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-[#FF6600]">Colivery</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-[#1a1a2e] text-white
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col
      `}>
        <div className="p-6 hidden md:block">
          <h1 className="text-2xl font-bold text-[#FF6600]">Colivery<span className="text-white text-sm font-normal ml-2">Admin</span></h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${isActive 
                  ? 'bg-[#FF6600] text-white' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <span className="mr-3">{link.icon}</span>
              {link.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold uppercase">
              {perfil?.nombre?.charAt(0) || user?.email?.charAt(0)}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium truncate">{perfil?.nombre || user?.email}</p>
              <p className="text-xs text-gray-400 capitalize">{rol}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut size={18} className="mr-3" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Desktop Header */}
        <header className="hidden md:flex bg-white shadow-sm border-b border-gray-200 py-4 px-6 justify-end items-center">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-[#6B7280]">Bienvenido, <strong className="text-[#1a1a2e]">{perfil?.nombre}</strong></span>
          </div>
        </header>

        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
