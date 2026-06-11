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
  History,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardList,
  CheckSquare,
  Warehouse,
  Building2,
  Scale,
  Wallet,
  SendHorizontal,
  DollarSign,
  BarChart2
} from 'lucide-react'

export const Layout = () => {
  const { rol, user, perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const adminLinks = [
    { name: 'Dashboard',      path: '/admin/dashboard',   icon: LayoutDashboard },
    { name: 'Cargar Pedidos', path: '/admin/pedidos',     icon: Package },
    { name: 'Entregados',     path: '/admin/entregados',  icon: History },
    { name: 'Con Retraso',    path: '/admin/retrasos',    icon: AlertCircle },
    { name: 'Inventario',     path: '/admin/inventario',  icon: Warehouse },
    { name: 'Empresas Log.',  path: '/admin/empresas-logisticas', icon: Building2 },
    { name: 'Clientes',       path: '/admin/clientes',    icon: Users },
    {
      name: 'La Cotorrisa',
      path: '/admin/lacotorrisa/cartera',
      icon: Scale,
      subLinks: [
        { name: 'Mi Cartera',              path: '/admin/lacotorrisa/cartera',        icon: Wallet },
        { name: 'Cobro y Cierres de Caja', path: '/admin/lacotorrisa/caja',           icon: BarChart2 },
        { name: 'Trazabilidad',            path: '/admin/lacotorrisa/trazabilidad',   icon: BarChart2 },
        { name: 'Trazabilidad (10%)',      path: '/admin/lacotorrisa/trazabilidad10', icon: BarChart2 },
      ]
    },
    { name: 'Finanzas',       path: '/admin/finanzas',    icon: DollarSign },
    { name: 'Trazabilidad',   path: '/admin/trazabilidad',icon: BarChart2 },
    { name: 'Trazabilidad (10%)', path: '/admin/trazabilidad10', icon: BarChart2 },
    { name: 'Paqueterías',    path: '/admin/paqueterias', icon: Truck },
    { name: 'Usuarios',       path: '/admin/usuarios',    icon: Settings },
  ]

  const logisticaLinks = [
    { name: 'Mis Pedidos',    path: '/logistica/pedidos',     icon: Package },
    { name: 'Inventario',     path: '/logistica/inventario',  icon: Warehouse },
  ]

  const clienteLinks = [
    { name: 'Mi Cartera',      path: '/cliente/cartera',    icon: Wallet },
    { name: 'Retiro de Saldo', path: '/cliente/retiro',     icon: SendHorizontal },
    { name: 'Mis Pedidos',     path: '/cliente/pedidos',    icon: Package },
    { name: 'Mi Inventario',   path: '/cliente/inventario', icon: Warehouse },
    { name: 'Trazabilidad',    path: '/cliente/trazabilidad',icon: BarChart2 },
    {
      name: '10% Comisión Colivery',
      path: '/cliente/trazabilidad10',
      icon: Scale,
      subLinks: [
        { name: 'Mi Cartera', path: '/cliente/cartera10', icon: Wallet },
        { name: 'Trazabilidad', path: '/cliente/trazabilidad10', icon: BarChart2 }
      ]
    }
  ]

  const links = rol === 'admin' ? adminLinks : rol === 'cliente' ? clienteLinks : logisticaLinks

  const handleLogout = async () => {
    try { await logout(); navigate('/login') } catch (e) { console.error(e) }
  }

  /* ── Shared sidebar inner ── */
  const Sidebar = ({ mobile = false }) => {
    const isCollapsed = collapsed && !mobile
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)'
        }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/logo-blanco.svg" alt="Colivery" style={{ height: 32 }} />
            </div>
          )}
          {isCollapsed && <div style={{ width: 32 }} />}

          {mobile ? (
            <button onClick={() => setMobileOpen(false)}
              style={{ color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
              <X size={20} />
            </button>
          ) : (
            <button onClick={() => setCollapsed(!collapsed)}
              style={{ color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}
              title={isCollapsed ? 'Expandir' : 'Colapsar'}>
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {links.map((link) => {
            if (link.subLinks) {
              const Icon = link.icon;
              return (
                <div key={link.name} style={{ display: 'flex', flexDirection: 'column' }}>
                  <NavLink
                    to={link.path || link.subLinks[0].path}
                    onClick={() => mobile && setMobileOpen(false)}
                    title={isCollapsed ? link.name : ''}
                    style={({ isActive }) => {
                      const isSubActive = link.subLinks.some(sub => window.location.pathname.startsWith(sub.path)) || isActive;
                      return {
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: isCollapsed ? 0 : 10,
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: isCollapsed ? '10px 0' : '10px 14px',
                        borderRadius: 8,
                        marginBottom: 2,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: 500,
                        color: isSubActive ? '#ffffff' : '#9ca3af',
                        background: isSubActive ? '#FF6600' : 'transparent',
                        transition: 'background 0.15s, color 0.15s',
                      };
                    }}
                    onMouseEnter={e => {
                      if (!e.currentTarget.style.background.includes('FF6600')) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                        e.currentTarget.style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.style.background.includes('FF6600')) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#9ca3af'
                      }
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{link.name}</span>}
                  </NavLink>
                  {!isCollapsed && (
                    <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2, marginBottom: 4 }}>
                      {link.subLinks.map((sub) => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          onClick={() => mobile && setMobileOpen(false)}
                          style={({ isActive }) => ({
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            fontSize: 12,
                            fontWeight: 500,
                            color: isActive ? '#ffffff' : '#a3a3a3',
                            background: isActive ? 'rgba(255,102,0,0.15)' : 'transparent',
                            borderLeft: isActive ? '2px solid #FF6600' : '2px solid transparent',
                            paddingLeft: isActive ? '10px' : '12px',
                            transition: 'background 0.15s, color 0.15s, border-left-color 0.15s',
                          })}
                          onMouseEnter={e => {
                            if (!e.currentTarget.style.background.includes('rgba(255,102,0,0.15)')) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                              e.currentTarget.style.color = '#ffffff'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!e.currentTarget.style.background.includes('rgba(255,102,0,0.15)')) {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = '#a3a3a3'
                            }
                          }}
                        >
                          <sub.icon size={13} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap' }}>{sub.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => mobile && setMobileOpen(false)}
                title={isCollapsed ? link.name : ''}
                style={({ isActive }) => ({
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: isCollapsed ? 0 : 10,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '10px 0' : '10px 14px',
                  borderRadius: 8,
                  marginBottom: 2,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? '#ffffff' : '#9ca3af',
                  background: isActive ? '#FF6600' : 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                })}
                onMouseEnter={e => {
                  if (!e.currentTarget.style.background.includes('FF6600')) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.color = '#ffffff'
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background.includes('FF6600')) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#9ca3af'
                  }
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{link.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer user */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#FF6600',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', flexShrink: 0
              }}>
                {(perfil?.nombre || user?.email || 'U').charAt(0)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {perfil?.nombre || user?.email}
                </p>
                <p style={{ color: '#6b7280', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>{rol}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Cerrar Sesión' : ''}
            style={{
              display: 'flex', flexDirection: 'row', alignItems: 'center',
              gap: isCollapsed ? 0 : 10,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              width: '100%', padding: isCollapsed ? '10px 0' : '10px 14px',
              borderRadius: 8, border: 'none', background: 'none',
              color: '#9ca3af', cursor: 'pointer', fontSize: 14, fontWeight: 500
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af' }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FA' }}>

      {/* Desktop sidebar */}
      <aside style={{
        display: 'none',
        flexDirection: 'column',
        background: '#1a1a2e',
        width: collapsed ? 64 : 240,
        minHeight: '100vh',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        position: 'relative',
        zIndex: 10
      }} className="md-sidebar">
        <style>{`.md-sidebar { display: flex !important; } @media (max-width: 767px) { .md-sidebar { display: none !important; } }`}</style>
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}

      {/* Mobile drawer */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: 240,
        background: '#1a1a2e', zIndex: 50,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
      }} className="mobile-drawer">
        <style>{`@media (min-width: 768px) { .mobile-drawer { display: none !important; } }`}</style>
        <Sidebar mobile />
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 30, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 4 }}
            className="mobile-menu-btn"
          >
            <style>{`@media (min-width: 768px) { .mobile-menu-btn { display: none !important; } }`}</style>
            <Menu size={22} />
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            Bienvenido, <strong style={{ color: '#1a1a2e' }}>{perfil?.nombre || user?.email}</strong>
          </span>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
