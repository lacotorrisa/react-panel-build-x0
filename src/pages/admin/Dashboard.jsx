import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Truck, CheckCircle, AlertCircle, Clock,
  ClipboardList, Shirt, BarChart3, TrendingUp, ArrowRight,
  Building2, Scale, Warehouse, RefreshCw, Users, CalendarDays
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ModalGestionBalance } from '../../components/modals/ModalGestionBalance'
import { Wallet } from 'lucide-react'

const STATUS_CONFIG = [
  { key: 'pendiente',        label: 'Pendientes',       desc: 'Sin procesar',             icon: Clock,         iconColor: 'text-yellow-500', cardBg: 'border-yellow-200 hover:bg-yellow-50',  numColor: 'text-yellow-700', barColor: 'bg-yellow-400' },
  { key: 'en_espera_guia',   label: 'Espera de Guía',   desc: 'Sin número de guía',       icon: ClipboardList, iconColor: 'text-orange-500', cardBg: 'border-orange-200 hover:bg-orange-50',  numColor: 'text-orange-700', barColor: 'bg-orange-400' },
  { key: 'en_espera_prenda', label: 'Falta Prenda',     desc: 'Producto no disponible',   icon: Shirt,         iconColor: 'text-purple-500', cardBg: 'border-purple-200 hover:bg-purple-50',  numColor: 'text-purple-700', barColor: 'bg-purple-400' },
  { key: 'en_transito',      label: 'En Tránsito',      desc: 'En camino al comprador',   icon: Truck,         iconColor: 'text-blue-500',   cardBg: 'border-blue-200 hover:bg-blue-50',      numColor: 'text-blue-700',   barColor: 'bg-blue-400'   },
  { key: 'entregado',        label: 'Entregados',       desc: 'Completados exitosamente', icon: CheckCircle,   iconColor: 'text-green-500',  cardBg: 'border-green-200 hover:bg-green-50',    numColor: 'text-green-700',  barColor: 'bg-green-400'  },
  { key: 'con_retraso',      label: 'Con Retraso',      desc: 'Fuera de tiempo estimado', icon: AlertCircle,   iconColor: 'text-red-500',    cardBg: 'border-red-200 hover:bg-red-50',        numColor: 'text-red-700',    barColor: 'bg-red-400'    },
  { key: 'problema',         label: 'Con Problema',     desc: 'Retorno o incidencia',     icon: AlertCircle,   iconColor: 'text-red-700',    cardBg: 'border-red-300 hover:bg-red-100',       numColor: 'text-red-900',    barColor: 'bg-red-600'    },
]

const ACCESOS = [
  { label: 'Cargar Pedidos',         desc: 'Importar CSV o registrar ventas',    icon: Package,    path: '/admin/pedidos',                color: 'bg-orange-500' },
  { label: 'Recepciones',            desc: 'Alta de inventario recibido',        icon: ClipboardList, path: '/admin/recepciones',         color: 'bg-blue-500'   },
  { label: 'Inventario',             desc: 'Control de stock actual',            icon: Warehouse,  path: '/admin/inventario',             color: 'bg-purple-500' },
  { label: 'Empresas Logísticas',    desc: 'Gestión de proveedores de envío',   icon: Building2,  path: '/admin/empresas-logisticas',    color: 'bg-indigo-500' },
  { label: 'Reconciliación',         desc: 'Balance entregado vs. vendido',      icon: Scale,      path: '/admin/reconciliacion',         color: 'bg-teal-500'   },
  { label: 'Clientes',               desc: 'Administrar cuentas de clientes',    icon: Users,      path: '/admin/clientes',               color: 'bg-pink-500'   },
]

export const Dashboard = () => {
  const navigate = useNavigate()
  const { clienteSeleccionado, setClienteSeleccionado } = useAppStore()
  const [clientes, setClientes]   = useState([])
  const [pedidos, setPedidos]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [recon, setRecon]         = useState({ sobran: 0, faltan: 0 })

  // Estados contables
  const [saldo, setSaldo] = useState(0)
  const [cortes, setCortes] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('*').eq('activo', true).then(({ data }) => { if (data) setClientes(data) })
  }, [])

  useEffect(() => {
    if (clienteSeleccionado) fetchAll()
  }, [clienteSeleccionado])

  const fetchAll = async () => {
    setLoading(true)
    const [pedRes, recRes, cliRes, cortesRes, transRes] = await Promise.all([
      supabase.from('pedidos')
        .select('id, status, fecha_pedido, nombre_comprador, guia, paqueteria_id, created_at')
        .eq('cliente_id', clienteSeleccionado.id),
      supabase.from('reconciliacion_stock')
        .select('entregado_logistica, vendido_cliente')
        .eq('cliente_id', clienteSeleccionado.id),
      supabase.from('clientes')
        .select('saldo')
        .eq('id', clienteSeleccionado.id)
        .single(),
      supabase.from('cliente_cortes_balance')
        .select('*')
        .eq('cliente_id', clienteSeleccionado.id)
        .order('fecha_fin', { ascending: false }),
      supabase.from('cliente_transferencias')
        .select('*')
        .eq('cliente_id', clienteSeleccionado.id)
        .order('fecha', { ascending: false })
    ])
    if (pedRes.data) setPedidos(pedRes.data)
    if (recRes.data) {
      let sobran = 0, faltan = 0
      recRes.data.forEach(r => {
        const p = (r.entregado_logistica || 0) - (r.vendido_cliente || 0)
        if (p > 0) sobran += p
        else if (p < 0) faltan += Math.abs(p)
      })
      setRecon({ sobran, faltan })
    }
    if (cliRes.data) setSaldo(cliRes.data.saldo || 0)
    if (cortesRes.data) setCortes(cortesRes.data)
    if (transRes.data) setTransferencias(transRes.data)
    setLoading(false)
  }

  // ── Métricas derivadas ──────────────────────────────────────────────────────
  const total      = pedidos.length
  const counts     = pedidos.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {})

  // "Ingresados hoy" = creados hoy en hora local del navegador
  const todayLocal  = format(new Date(), 'yyyy-MM-dd')
  const hoy         = pedidos.filter(p => p.created_at && format(new Date(p.created_at), 'yyyy-MM-dd') === todayLocal).length

  // Sin guía: no entregado, no cancelado, no tiene número de guía
  const sinGuia    = pedidos.filter(p =>
    !p.guia && !['entregado', 'problema', 'cancelado'].includes(p.status)
  ).length
  const alertas    = (counts['con_retraso'] || 0) + (counts['problema'] || 0)
  const tasaEntrega = total > 0 ? Math.round(((counts['entregado'] || 0) / total) * 100) : 0

  // Últimos 5 registros (por created_at)
  const recientes = [...pedidos]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Resumen operativo · {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-2">
          {clienteSeleccionado && (
            <button onClick={fetchAll} className="p-2 rounded-lg border hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <div className="w-full sm:w-72">
            <Select value={clienteSeleccionado?.id || ''} onValueChange={(val) => setClienteSeleccionado(clientes.find(c => c.id === val))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar Cliente" /></SelectTrigger>
              <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!clienteSeleccionado ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="h-10 w-10 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-600">Selecciona un cliente</h3>
          <p className="text-sm text-gray-400 mt-1">Elige un cliente para ver todas las métricas.</p>
        </Card>
      ) : (
        <>
          {/* Resumen Financiero del Cliente */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-3 gap-3">
              <div>
                <h3 className="font-bold text-gray-800 text-sm md:text-base">Balance Financiero: {clienteSeleccionado.nombre}</h3>
                <p className="text-xs text-gray-400">Balance contable consolidado y liquidaciones de este merchant</p>
              </div>
              <button 
                onClick={() => setBalanceModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 text-xs bg-[#FF6600] hover:bg-orange-600 text-white font-bold py-2 px-3.5 rounded-lg transition-all shadow-sm"
              >
                <Wallet className="w-4 h-4" />
                Gestionar Balance / Payouts
              </button>
            </div>

            {/* KPIs financieros */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#121220] text-white p-4 rounded-xl relative overflow-hidden">
                <p className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Saldo Neto a Favor</p>
                <p className="text-2xl font-black mt-1">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldo)}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Pendiente de liquidar</p>
              </div>

              <div className="bg-gray-50 border p-4 rounded-xl">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ingresos Totales (Ventas)</p>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                    cortes.reduce((s, c) => s + (c.ventas_general || 0) + (c.ventas_exclusivos || 0), 0)
                  )}
                </p>
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>Gral: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cortes.reduce((s, c) => s + (c.ventas_general || 0), 0))}</span>
                  <span>Excl: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cortes.reduce((s, c) => s + (c.ventas_exclusivos || 0), 0))}</span>
                </div>
              </div>

              <div className="bg-gray-50 border p-4 rounded-xl">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Deducciones Operativas</p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  -{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                    cortes.reduce((s, c) => s + (c.comision_colivery || 0) + (c.pasarela_pagos || 0) + (c.costo_administracion || 0) + (c.costo_software || 0) + (c.gastos_adicionales || 0), 0)
                  )}
                </p>
                <p className="text-[9px] text-gray-400 mt-1">Comisión 20%, pasarela, software</p>
              </div>

              <div className="bg-gray-50 border p-4 rounded-xl">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total Liquidado (Payouts)</p>
                <p className="text-xl font-bold text-green-700 mt-1">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                    transferencias.reduce((s, t) => s + (t.monto || 0), 0)
                  )}
                </p>
                <p className="text-[9px] text-gray-400 mt-1">Suma de transferencias SPEI</p>
              </div>
            </div>
          </div>

          {/* Alertas urgentes */}
          {(sinGuia > 0 || alertas > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sinGuia > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
                  onClick={() => navigate('/admin/pedidos/en_espera_guia')}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">⚠️ {sinGuia} pedidos sin guía asignada</p>
                      <p className="text-xs text-orange-600 mt-0.5">Requieren número de guía para enviar</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-orange-400" />
                </div>
              )}
              {alertas > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => navigate('/admin/pedidos/con_retraso')}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">🔴 {alertas} pedidos con retraso o problema</p>
                      <p className="text-xs text-red-600 mt-0.5">Requieren atención inmediata</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-400" />
                </div>
              )}
            </div>
          )}

          {/* KPIs superiores */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-[#FF6600] to-orange-400 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/admin/pedidos/todos')}>
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-orange-100 uppercase tracking-wide">Total Pedidos</CardTitle>
                <Package className="h-5 w-5 text-orange-200" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-4xl font-black">{loading ? '…' : total}</div>
                <p className="text-xs text-orange-100 mt-1">Todos los registros</p>
              </CardContent>
            </Card>

            <Card className="border cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
              onClick={() => navigate('/admin/pedidos/todos')}>
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingresados Hoy</CardTitle>
                <CalendarDays className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-black text-gray-800">{loading ? '…' : hoy}</div>
                <p className="text-xs text-gray-400 mt-1">{format(new Date(), "d MMM yyyy", { locale: es })}</p>
              </CardContent>
            </Card>

            <Card className="border">
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasa de Entrega</CardTitle>
                <CheckCircle className="h-5 w-5 text-green-400" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-black text-green-700">{loading ? '…' : `${tasaEntrega}%`}</div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${tasaEntrega}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{counts['entregado'] || 0} de {total}</p>
              </CardContent>
            </Card>

            <Card className={`border ${sinGuia + alertas > 0 ? 'border-red-200 bg-red-50/30' : ''}`}>
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Requieren Atención</CardTitle>
                <AlertCircle className={`h-5 w-5 ${sinGuia + alertas > 0 ? 'text-red-400' : 'text-gray-300'}`} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-3xl font-black ${sinGuia + alertas > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                  {loading ? '…' : sinGuia + alertas}
                </div>
                <p className="text-xs text-gray-400 mt-1">{sinGuia} sin guía · {alertas} con problema</p>
              </CardContent>
            </Card>
          </div>

          {/* Reconciliación resumen */}
          {(recon.sobran > 0 || recon.faltan > 0) && (
            <div className="grid gap-3 sm:grid-cols-2 cursor-pointer" onClick={() => navigate('/admin/reconciliacion')}>
              {recon.sobran > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between hover:bg-green-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Falta por devolver al cliente</p>
                      <p className="text-2xl font-black text-green-700">+{recon.sobran} piezas</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-green-400" />
                </div>
              )}
              {recon.faltan > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between hover:bg-red-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Falta por recibir del cliente</p>
                      <p className="text-2xl font-black text-red-600">-{recon.faltan} piezas</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-400" />
                </div>
              )}
            </div>
          )}

          {/* Desglose por status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Desglose por Status</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {STATUS_CONFIG.map(({ key, label, desc, icon: Icon, iconColor, cardBg, numColor, barColor }) => {
                const count = counts[key] || 0
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <Card key={key} className={`cursor-pointer transition-all border ${cardBg} hover:shadow-md hover:-translate-y-0.5`}
                    onClick={() => navigate(`/admin/pedidos/${key}`)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                      <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</CardTitle>
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className={`text-3xl font-black ${numColor}`}>{loading ? '…' : count}</div>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-400">{pct}% del total</p>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">Ver <ArrowRight className="h-3 w-3" /></span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Accesos rápidos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Accesos Rápidos</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACCESOS.map(({ label, desc, icon: Icon, path, color }) => (
                <div key={path}
                  className="bg-white border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                  onClick={() => navigate(path)}>
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Últimos pedidos */}
          {recientes.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Últimos 5 Registros</CardTitle>
                <button className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                  onClick={() => navigate('/admin/pedidos/todos')}>
                  Ver todos <ArrowRight className="h-3 w-3" />
                </button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="divide-y">
                  {recientes.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.nombre_comprador}</p>
                        <p className="text-xs text-gray-400">
                          {p.fecha_pedido?.substring(0, 10)} · {p.guia || 'Sin guía'}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === 'entregado'        ? 'bg-green-100 text-green-700'   :
                        p.status === 'en_transito'      ? 'bg-blue-100 text-blue-700'     :
                        p.status === 'pendiente'        ? 'bg-yellow-100 text-yellow-700' :
                        p.status === 'con_retraso'      ? 'bg-red-100 text-red-700'       :
                        p.status === 'problema'         ? 'bg-red-200 text-red-800'       :
                        p.status === 'en_espera_guia'   ? 'bg-orange-100 text-orange-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{p.status?.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {clienteSeleccionado && (
        <ModalGestionBalance 
          open={balanceModalOpen}
          onOpenChange={setBalanceModalOpen}
          cliente={{ ...clienteSeleccionado, saldo }}
          onRefresh={fetchAll}
        />
      )}
    </div>
  )
}
