import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { 
  Scale, TrendingUp, ArrowDownCircle, ArrowUpRight, DollarSign, 
  FileText, ExternalLink, Calendar, Wallet, Info, Package, AlertTriangle, BarChart3, TrendingDown
} from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip'
import { Badge } from '../../components/ui/badge'

const STATUS_COLORS = {
  pendiente:        'bg-yellow-100 text-yellow-800',
  en_espera_guia:   'bg-orange-100 text-orange-800',
  en_espera_prenda: 'bg-purple-100 text-purple-800',
  en_transito:      'bg-blue-100 text-blue-800',
  entregado:        'bg-green-100 text-green-800',
  con_retraso:      'bg-red-100 text-red-800',
  problema:         'bg-red-200 text-red-900',
}

// Mapeador de precios unitarios exacto deducido del PDF real del cliente
const obtenerPrecioUnitario = (nombre) => {
  const n = nombre.toUpperCase();
  if (n.includes('HOODIE')) return 1749;
  if (n.includes('JERSEY')) return 949;
  if (n.includes('WASHTEE')) return 899;
  if (n.includes('SLOBO') || n.includes('RICARDO') || n.includes('RICKACHU') || n.includes('VACA')) return 649;
  if (n.includes('WHITETEE') || n.includes('TEE NEGRA')) return 749;
  if (n.includes('GERRY')) return 999;
  if (n.includes('ALGODON') || n.includes('ALGODÓN')) return 599;
  return 649; // Precio default playera
}

export const BalanceCliente = () => {
  const { perfil } = useAuth()
  const [saldo, setSaldo] = useState(0)
  const [balanceInicial, setBalanceInicial] = useState(0)
  const [cortes, setCortes] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [pedidosRecientes, setPedidosRecientes] = useState([])
  const [productosMasVendidos, setProductosMasVendidos] = useState([])
  const [inventarioBajo, setInventarioBajo] = useState([])
  const [loading, setLoading] = useState(true)

  // Selector de pestaña del PDF (Emulación)
  const [pdfTab, setPdfTab] = useState('resumen') // 'resumen' | 'desglose' | 'mas_vendidos'

  const fetchData = async () => {
    if (!perfil?.cliente_id) return
    try {
      setLoading(true)
      const [cliRes, cortesRes, transRes, pedTodosRes, invRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('saldo, balance_inicial')
          .eq('id', perfil.cliente_id)
          .single(),
        supabase
          .from('cliente_cortes_balance')
          .select('*')
          .eq('cliente_id', perfil.cliente_id)
          .order('fecha_fin', { ascending: false }),
        supabase
          .from('cliente_transferencias')
          .select('*')
          .eq('cliente_id', perfil.cliente_id)
          .order('fecha', { ascending: false }),
        supabase
          .from('pedidos')
          .select('*')
          .eq('cliente_id', perfil.cliente_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('inventario')
          .select('*, empresas_logisticas(nombre)')
          .eq('cliente_id', perfil.cliente_id)
          .order('cantidad')
      ])

      if (cliRes.error) throw cliRes.error
      if (cortesRes.error) throw cortesRes.error
      if (transRes.error) throw transRes.error

      setSaldo(cliRes.data?.saldo || 0)
      setBalanceInicial(cliRes.data?.balance_inicial || 0)
      setCortes(cortesRes.data || [])
      setTransferencias(transRes.data || [])
      
      const orders = pedTodosRes.data || []
      setPedidosRecientes(orders.slice(0, 5))

      // Existencias bajas en inventario
      if (invRes.data) {
        setInventarioBajo(invRes.data.filter(i => (i.cantidad || 0) < 15))
      }

      // Agrupación dinámica para la tabla de Productos Más Vendidos
      const prodMap = {}
      orders.forEach(p => {
        const prods = p.productos || []
        prods.forEach(prod => {
          const nombre = prod.nombre || 'Producto'
          const talla = prod.talla || ''
          const key = talla ? `${nombre} (${talla})` : nombre
          const cantidad = parseInt(prod.cantidad) || 1
          
          if (!prodMap[key]) {
            prodMap[key] = { producto: key, nombreBase: nombre, talla, cantidad: 0, ingresos: 0, stock: 0 }
          }
          prodMap[key].cantidad += cantidad
        })
      })
      
      const prodArray = Object.values(prodMap)
      prodArray.forEach(p => {
        const precio = obtenerPrecioUnitario(p.nombreBase)
        p.ingresos = p.cantidad * precio
        
        // Buscar stock actual en el inventario
        const itemInv = invRes.data?.find(inv => {
          const lowerInv = inv.producto.toLowerCase().trim()
          const lowerKey = p.producto.toLowerCase().trim()
          const lowerBase = p.nombreBase.toLowerCase().trim()
          return lowerInv === lowerKey || lowerInv.startsWith(lowerBase)
        })
        p.stock = itemInv ? itemInv.cantidad : 0
      })
      
      // Ordenar por cantidad vendida descendente
      prodArray.sort((a, b) => b.cantidad - a.cantidad)
      setProductosMasVendidos(prodArray.slice(0, 10)) // Mostrar top 10 más vendidos

    } catch (err) {
      toast.error('Error al cargar balance operativo')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (perfil?.cliente_id) {
      fetchData()
    }
  }, [perfil])

  // Formateador de Moneda
  const fmt = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0)

  // Totales acumulados
  const totalGeneral = cortes.reduce((acc, c) => acc + (c.ventas_general || 0), 0)
  const totalExclusivos = cortes.reduce((acc, c) => acc + (c.ventas_exclusivos || 0), 0)
  const totalVentasBrutas = totalGeneral + totalExclusivos

  const totalDeducciones = cortes.reduce((acc, c) => {
    return acc + 
      (c.comision_colivery || 0) + 
      (c.pasarela_pagos || 0) + 
      (c.costo_administracion || 0) + 
      (c.costo_software || 0) + 
      (c.gastos_adicionales || 0)
  }, 0)

  const totalNetoFavor = cortes.reduce((acc, c) => acc + (c.neto_favor || 0), 0)
  const totalPagado = transferencias.reduce((acc, t) => acc + (t.monto || 0), 0)

  // Desglose
  const comisionColiverySum = cortes.reduce((acc, c) => acc + (c.comision_colivery || 0), 0)
  const otrasDeduccionesSum = totalDeducciones - comisionColiverySum

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-800">Resumen de Balance - Tienda</h2>
          <p className="text-sm text-gray-500 font-semibold mt-0.5">La Cotorrisamerch · Período: 31 de marzo de 2026 - 26 de mayo de 2026</p>
        </div>
        
        {/* Selector de Vistas Estilo Reporte PDF */}
        <div className="flex bg-gray-100 p-1 rounded-lg border shrink-0">
          <button 
            onClick={() => setPdfTab('resumen')}
            className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${pdfTab === 'resumen' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Resumen Balance
          </button>
          <button 
            onClick={() => setPdfTab('desglose')}
            className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${pdfTab === 'desglose' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Desglose Actividad
          </button>
          <button 
            onClick={() => setPdfTab('mas_vendidos')}
            className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${pdfTab === 'mas_vendidos' ? 'bg-white shadow text-[#FF6600]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Productos Más Vendidos
          </button>
        </div>
      </div>

      {/* ────────────────── SECCIÓN EMULACIÓN REPORTE PDF ────────────────── */}

      {/* VISTA 1: RESUMEN DE BALANCE (PÁGINA 1 DEL PDF) */}
      {pdfTab === 'resumen' && (
        <Card className="border shadow-lg bg-white overflow-hidden max-w-3xl mx-auto">
          <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
            <span className="font-bold text-gray-700 text-sm tracking-wide">Resumen de Balance General</span>
            <Wallet className="w-4 h-4 text-orange-500" />
          </div>
          <CardContent className="p-6">
            <div className="divide-y space-y-4">
              
              {/* Balance Inicial */}
              <div className="flex justify-between items-center py-2 text-sm font-semibold text-gray-700">
                <span>Balance inicial — 31 de marzo de 2026</span>
                <span>{fmt(balanceInicial)}</span>
              </div>

              {/* Cambio de balance por actividad */}
              <div className="pt-4 space-y-2.5">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cambio de balance por actividad</p>
                
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-green-500" /> Ingresos por productos (Ventas Brutas)</span>
                  <span>{fmt(totalVentasBrutas)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                  <span className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-red-400" /> Comisión de plataforma (20% Colivery)</span>
                  <span>-{fmt(comisionColiverySum)}</span>
                </div>

                <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                  <span className="flex items-center gap-1.5"><ArrowDownCircle className="w-4 h-4 text-red-400" /> Costos de envío / deducciones</span>
                  <span>-{fmt(otrasDeduccionesSum)}</span>
                </div>
              </div>

              {/* Cambio neto por actividad */}
              <div className="pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-gray-700 py-1">
                  <span>Cambio neto de balance por actividad</span>
                  <span>{fmt(totalNetoFavor)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm font-semibold text-red-600 py-1">
                  <span>Total de pagos realizados (SPEI Payouts)</span>
                  <span>-{fmt(totalPagado)}</span>
                </div>
              </div>

              {/* Balance Final (Saldo Actual) */}
              <div className="pt-4">
                <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-200">
                  <span className="text-base font-black text-green-800">Balance final — 26 de mayo de 2026</span>
                  <span className="text-2xl font-black text-green-700">{fmt(saldo)}</span>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* VISTA 2: DESGLOSE DE ACTIVIDAD (PÁGINA 2 DEL PDF) */}
      {pdfTab === 'desglose' && (
        <div className="grid gap-6 max-w-4xl mx-auto md:grid-cols-2">
          {/* Cobros */}
          <Card className="border shadow-md bg-white">
            <CardHeader className="border-b py-3 px-5">
              <CardTitle className="text-sm font-bold text-gray-800">Desglose de Cobros por Actividad</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm text-gray-600">
              <p className="text-xs text-gray-400">Detalles acumulados de compras y retenciones del periodo.</p>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span>Cantidad de órdenes declaradas</span>
                <span className="font-semibold text-gray-800">{cortes.length > 0 ? 'Periodos de corte cerrados' : '0'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span>Monto Bruto de Ventas</span>
                <span className="font-semibold text-gray-800">{fmt(totalVentasBrutas)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 text-red-500 font-semibold">
                <span>Comisiones / Deducciones</span>
                <span>-{fmt(totalDeducciones)}</span>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex justify-between items-center font-bold text-green-800">
                <span>Cambio Neto por Actividad:</span>
                <span>{fmt(totalNetoFavor)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pagos Realizados */}
          <Card className="border shadow-md bg-white">
            <CardHeader className="border-b py-3 px-5">
              <CardTitle className="text-sm font-bold text-gray-800">Pagos Realizados (Payouts)</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm text-gray-600">
              <p className="text-xs text-gray-400">Detalle de transferencias Spei enviadas a tu banco.</p>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span>Cantidad de transferencias recibidas</span>
                <span className="font-semibold text-gray-800">{transferencias.length}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span>Monto Bruto Recibido</span>
                <span className="font-semibold text-gray-800">{fmt(totalPagado)}</span>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex justify-between items-center font-bold text-blue-800">
                <span>Total pagado en cuenta:</span>
                <span>{fmt(totalPagado)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VISTA 3: PRODUCTOS MÁS VENDIDOS (PÁGINA 3 DEL PDF) */}
      {pdfTab === 'mas_vendidos' && (
        <Card className="border shadow-md bg-white max-w-4xl mx-auto">
          <CardHeader className="border-b py-3 px-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-800">Productos Más Vendidos</CardTitle>
              <p className="text-xs text-gray-400">Resumen de los productos con mayor cantidad vendida durante el período.</p>
            </div>
            <BarChart3 className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-xs">Cargando estadísticas...</div>
            ) : productosMasVendidos.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center p-8">No se registran ventas para tu cuenta.</p>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center font-semibold">Cantidad Vendida</TableHead>
                    <TableHead className="text-right">Ingresos Generados</TableHead>
                    <TableHead className="text-right font-semibold">Stock Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosMasVendidos.map(p => (
                    <TableRow key={p.producto} className="hover:bg-orange-50/15">
                      <TableCell className="font-bold text-gray-800 text-xs">{p.producto}</TableCell>
                      <TableCell className="text-center font-semibold text-xs">{p.cantidad}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-gray-700">{fmt(p.ingresos)}</TableCell>
                      <TableCell className="text-right text-xs">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.stock > 10 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {p.stock} piezas
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────────────── SECCIÓN METRICAS AUXILIARES DEL DASHBOARD ────────────────── */}

      <div className="grid gap-6 md:grid-cols-2">
        {/* PEDIDOS RECIENTES */}
        <Card className="border shadow-sm bg-white">
          <CardHeader className="border-b py-3 px-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-gray-800">Últimos Pedidos</CardTitle>
              <p className="text-[10px] text-gray-400">Estado de tus 5 ventas más recientes</p>
            </div>
            <Package className="w-4.5 h-4.5 text-gray-400" />
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="text-center text-gray-400 text-xs py-4">Cargando...</div>
            ) : pedidosRecientes.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Sin pedidos registrados.</p>
            ) : (
              <div className="divide-y space-y-2">
                {pedidosRecientes.map(p => (
                  <div key={p.id} className="flex justify-between items-center pt-2 text-xs">
                    <div>
                      <p className="font-bold text-gray-800">{p.nombre_comprador}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {p.fecha_pedido} · Guía: <span className="font-mono">{p.guia || 'Pendiente'}</span>
                      </p>
                    </div>
                    <Badge className={`${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'} text-[10px] font-bold`}>
                      {p.status?.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* STOCK BAJO O CRÍTICO */}
        <Card className="border shadow-sm bg-white">
          <CardHeader className="border-b py-3 px-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Stock Crítico / Por Agotarse
              </CardTitle>
              <p className="text-[10px] text-gray-400">Prendas con menos de 15 piezas disponibles</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center text-gray-400 text-xs py-8">Cargando...</div>
            ) : inventarioBajo.length === 0 ? (
              <p className="text-xs text-green-700 font-medium text-center py-8 bg-green-50/20 m-4 rounded-lg">
                ✅ Todo tu inventario cuenta con stock saludable.
              </p>
            ) : (
              <div className="max-h-[220px] overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bodega</TableHead>
                      <TableHead>Prenda</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventarioBajo.map(i => (
                      <TableRow key={i.id} className="hover:bg-red-50/20">
                        <TableCell className="text-gray-500">{i.empresas_logisticas?.nombre || 'General'}</TableCell>
                        <TableCell className="font-bold text-gray-800">{i.producto}</TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            i.cantidad === 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {i.cantidad} pzs
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
