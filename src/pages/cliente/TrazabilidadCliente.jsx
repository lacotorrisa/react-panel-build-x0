import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart2, TrendingUp, TrendingDown, DollarSign,
  Package, Truck, Info, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card, CardContent } from '../../components/ui/card'

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
const fmtPct = v => `${Number(v || 0).toFixed(1)}%`

const calcRow = (row, isDuplicateOrder, mode = '20') => {
  const pt  = parseFloat(row.precio_tienda || 0)

  // Use the REAL precio_envio from DB — same source as MiCartera.
  // If before 2026-04-01, envio = 0.
  // If it's a duplicate guide of the same order, envio = 0.
  let pe = parseFloat(row.precio_envio || 0)
  if (row.fecha_compra && row.fecha_compra < '2026-04-01') {
    pe = 0
  } else if (isDuplicateOrder) {
    pe = 0
  }

  const comisionPct = mode === '10' ? 0.10 : 0.20
  const comision    = pt * comisionPct           // 10% or 20% commission
  const utilidad    = pt * (1 - comisionPct)     // 90% or 80% for La Cotorrisa
  const almacenaje  = mode === '10' ? 0 : pt * 0.03  // 3% only in 20% mode

  const cg      = parseFloat(row.costo_guia || 0)
  const margen  = pe - cg

  // Pasarela: 3.6% of (precio_tienda + precio_envio) + $3
  const pasarela    = (pt + pe) * 0.036 + 3
  const netColivery = comision - pasarela - almacenaje

  return {
    ...row,
    precio_envio:   pe,
    _comision:      comision,
    _utilidad:      utilidad,
    _almacenaje:    almacenaje,
    _margen:        margen,
    _pasarela:      pasarela,
    _totalColivery: comision,
    _netColivery:   netColivery
  }
}

// ─── Columna con tooltip ────────────────────────────────────────────────────────
const ColTip = ({ label, tip, className = '' }) => (
  <th className={`px-4 py-3 text-right font-black text-gray-600 group relative ${className}`}>
    <span className="flex items-center justify-end gap-1 cursor-default">
      {label}
      <Info className="w-3 h-3 opacity-40 group-hover:opacity-80 transition-opacity" />
    </span>
    <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 text-white text-[10px] rounded-lg px-3 py-2 w-52 hidden group-hover:block shadow-xl font-normal text-left leading-relaxed">
      {tip}
    </div>
  </th>
)

// ─── Página Cliente ─────────────────────────────────────────────────────────────
export const TrazabilidadCliente = ({ clienteIdOverride, mode = '20' }) => {
  const { perfil } = useAuth()
  const [filas,         setFilas]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [expandedRow,   setExpandedRow]   = useState(null)
  const [showExplainer, setShowExplainer] = useState(false)

  const effectiveClienteId = clienteIdOverride || perfil?.cliente_id

  const comisionPctText = mode === '10' ? '10%' : '20%'
  const utilidadPctText = mode === '10' ? '90%' : '80%'

  const fetchFilas = useCallback(async () => {
    if (!effectiveClienteId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('trazabilidad_guias')
      .select('*')
      .eq('cliente_id', effectiveClienteId)

    // JS Filtering: keep only records based on mode
    const filtered = (data || []).filter(r => {
      if (mode === '10') {
        return r.fecha_compra && r.fecha_compra >= '2026-05-28'
      } else {
        return !r.fecha_compra || (r.fecha_compra >= '2026-04-01' && r.fecha_compra <= '2026-05-27')
      }
    })

    // JS Sorting: chronologically descending (most recent first)
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.fecha_compra || ''
      const dateB = b.fecha_compra || ''
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA)
      }
      const pedA = a.numero_pedido || ''
      const pedB = b.numero_pedido || ''
      return pedB.localeCompare(pedA)
    })

    // Process duplicate order numbers to set precio_envio = 0 for duplicate items
    const seenPedidos = new Set()
    const mapped = sorted.map(row => {
    // Dedup: strip "-N" suffix so MX-123456-1 and MX-123456-2 are the same order
    const pedKey = row.numero_pedido ? row.numero_pedido.trim().toUpperCase().replace(/-\d+$/, '') : null
      let isDuplicate = false
      if (pedKey) {
        if (seenPedidos.has(pedKey)) {
          isDuplicate = true
        } else {
          seenPedidos.add(pedKey)
        }
      }
      return calcRow(row, isDuplicate, mode)
    })

    setFilas(mapped)
    setLoading(false)
  }, [effectiveClienteId, mode])

  useEffect(() => { fetchFilas() }, [fetchFilas])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalPrendas     = filas.reduce((s, r) => s + (r.precio_tienda || 0), 0)
  const totalSaldoEnvio  = filas.reduce((s, r) => s + (r.precio_envio  || 0), 0)
  // Total Ventas = precio prenda + envío cobrado al cliente (igual que reporte de tienda)
  const totalVentas      = totalPrendas + totalSaldoEnvio
  const totalComision    = filas.reduce((s, r) => s + (r._comision     || 0), 0)
  const totalUtilidadCli = filas.reduce((s, r) => s + (r._utilidad     || 0), 0)
  const totalAlmacenaje  = filas.reduce((s, r) => s + (r._almacenaje   || 0), 0)
  const totalCostoGuias  = filas.reduce((s, r) => s + (r.costo_guia    || 0), 0)
  const totalMargenGuias = totalSaldoEnvio - totalCostoGuias
  const totalPasarela    = filas.reduce((s, r) => s + (r._pasarela     || 0), 0)
  const totalColivery    = totalComision
  const totalNeto        = totalComision - totalPasarela - totalAlmacenaje

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!effectiveClienteId) return (
    <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
      <p>Sin cuenta de cliente vinculada.</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-orange-500" /> Trazabilidad de Envíos
            {mode === '10'
              ? <span className="bg-blue-100 text-blue-800 text-xs font-black px-2 py-1 rounded-full">10% Colivery — May 28 en adelante</span>
              : <span className="bg-orange-100 text-orange-800 text-xs font-black px-2 py-1 rounded-full">20% Colivery — Abr 1 al 27 May</span>}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === '10'
              ? 'Tu desglose financiero completo — Comisión Colivery 10% (desde 28 de Mayo 2026 en adelante)'
              : 'Tu desglose financiero completo — Comisión Colivery 20% (del 1ro de Abril al 27 de Mayo 2026)'}
          </p>
        </div>
        <button
          onClick={() => setShowExplainer(p => !p)}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors">
          <Info className="w-4 h-4" /> ¿Cómo se calculan estos números?
        </button>
      </div>

      {/* Explainer panel */}
      {showExplainer && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 space-y-3">
          <h3 className="font-black text-blue-900 text-base">¿Cómo funciona el desglose?</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div className="space-y-2">
              <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                <p className="font-black text-gray-800 mb-1">💰 Precio Tienda</p>
                <p className="text-xs text-gray-600">El value de venta del producto. Es la base sobre la que se calcula todo.</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
                <p className="font-black text-orange-700 mb-1">📊 Comisión Colivery ({comisionPctText})</p>
                <p className="text-xs text-gray-600">Nuestra comisión por gestionar la operación: almacenaje, picking, atención al cliente y plataforma.</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
                <p className="font-black text-amber-700 mb-1">📦 Almacenaje y Resguardo {mode === '10' ? '(0%)' : '(3%)'}</p>
                <p className="text-xs text-gray-600">
                  {mode === '10'
                    ? 'Sin costo de almacenaje (0%), ya que la mercancía se resguarda y empaqueta en la oficina de La Cotorrisa.'
                    : 'Costo del 3% cobrado por la empresa de almacenamiento por empaque y resguardo.'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
                <p className="font-black text-green-700 mb-1">✅ Utilidad La Cotorrisa ({utilidadPctText})</p>
                <p className="text-xs text-gray-600">Lo que te corresponde: Precio Tienda menos el {comisionPctText} de comisión (libres de comisión de venta).</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                <p className="font-black text-blue-700 mb-1">📦 Saldo Envío vs Costo Guía</p>
                <p className="text-xs text-gray-600">
                  Cobramos <strong>$99 fijos</strong> por envío una vez por pedido (desde el 1ro de abril). El costo real de la guía varía según la paquetería y distancia.
                  Cualquier envío adicional dentro de un mismo pedido es cubierto por Colivery.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
            <p className="font-black text-gray-800 mb-2">📐 Fórmulas</p>
            <div className="font-mono text-[11px] text-gray-600 space-y-1">
              <p>Ventas Brutas  = Precio Prenda + Envío cobrado al cliente</p>
              <p>Utilidad La Cotorrisa = Precio Prenda − (Precio Prenda × {mode === '10' ? '10.0%' : '20.0%'})</p>
              <p>Almacenaje ({mode === '10' ? '0%' : '3%'}) = {mode === '10' ? '$0 (Mercancía en oficina Cotorrisa)' : 'Precio Prenda × 3.0%'}</p>
              <p>Pasarela Pago  = (Precio Prenda + Envío) × 3.6% + $3 MXN (Absorbido por Colivery de su {comisionPctText})</p>
              <p>NET Coli. (Prenda) = Comisión ({comisionPctText}) − Pasarela Pago − Almacenaje ({mode === '10' ? '0%' : '3%'}) (El envío no se toca)</p>
              <p>Colchón Envío  = Envío cobrado ($99 o $0) − Costo real guía</p>
            </div>
          </div>
        </div>
      )}

      {/* Contador de pedidos */}
      <div className="flex justify-end">
        <p className="text-xs text-gray-400">{filas.length} productos en total</p>
      </div>

      {/* KPI Cards grandes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Total Ventas */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-600 to-blue-700 text-white overflow-hidden">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Total Ventas Brutas</p>
                <p className="text-3xl font-black mt-1">{fmt(totalVentas)}</p>
                <p className="text-[11px] opacity-60 mt-1">{fmt(totalPrendas)} prendas + {fmt(totalSaldoEnvio)} envíos · {filas.length} productos</p>
              </div>
              <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total utilidad Cotorrisa */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-600 to-emerald-700 text-white overflow-hidden">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70 font-semibold">Utilidad La Cotorrisa (Libres {comisionPctText})</p>
                <p className="text-3xl font-black mt-1">{fmt(totalUtilidadCli)}</p>
                <p className="text-[11px] opacity-60 mt-1">Prendas − {mode === '10' ? '10.0%' : '20.0%'} comisión Colivery</p>
              </div>
              <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Colivery */}
        <Card className={`border-0 shadow-md text-white overflow-hidden ${totalNeto >= 0 ? 'bg-gradient-to-br from-orange-500 to-amber-600' : 'bg-gradient-to-br from-red-600 to-rose-700'}`}>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Lo Nuestro (NET Colivery)</p>
                <p className="text-3xl font-black mt-1">{fmt(totalNeto)}</p>
                <p className="text-[11px] opacity-60 mt-1">{fmt(totalColivery)} bruto − {fmt(totalPasarela)} pasarela − {fmt(totalAlmacenaje)} almac.</p>
              </div>
              <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-totales financieros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Almacenaje Total ({mode === '10' ? '0%' : '3%'})</p>
          <p className="text-xl font-black text-amber-600 mt-1">{fmt(totalAlmacenaje)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{mode === '10' ? 'Sin costo — Mercancía en oficina Cotorrisa' : '3% del precio de la prenda'}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pasarela de Pago (Stripe)</p>
          <p className="text-xl font-black text-red-600 mt-1">{fmt(totalPasarela)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">3.6% + $3 MXN por transacción</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Envíos Cobrados</p>
          <p className="text-xl font-black text-blue-600 mt-1">{fmt(totalSaldoEnvio)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">$99 por pedido (desde 1-Abr)</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Costo Real / Margen Guías</p>
          <p className="text-xl font-black text-purple-600 mt-1">{fmt(totalCostoGuias)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Margen neto: {fmt(totalMargenGuias)}</p>
        </div>
      </div>

      {/* Tabla solo lectura */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <p className="font-black text-gray-800 text-sm">
            Detalle por Pedido
            <span className="ml-2 bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filas.length} registros
            </span>
          </p>
        </div>

        {filas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-bold">Sin registros en este período</p>
            <p className="text-sm mt-1">El administrador aún no ha cargado información de guías.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Pedido</th>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Fecha</th>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Producto</th>
                  <ColTip label="P. Tienda"       tip="Precio de venta del producto en tu tienda." />
                  <ColTip label={`Comisión (${comisionPctText})`}  tip={`${comisionPctText} del Precio Tienda. Comisión de Colivery por la gestión operativa.`} className="text-orange-600" />
                  <ColTip label={`Tu Utilidad (${utilidadPctText})`} tip={`Lo que te queda: ${utilidadPctText} del Precio Tienda (libres después del ${comisionPctText}).`} className="text-green-700" />
                  <ColTip label={`Almacenaje (${mode === '10' ? '0%' : '3%'})`} tip={mode === '10' ? 'Sin costo de almacenaje, mercancía en oficina de La Cotorrisa.' : 'El 3% del valor de la prenda cobra la empresa de almacenamiento por empaque y resguardo de la prenda.'} className="text-amber-700" />
                  <ColTip label="% Pasarela"      tip="3.6% + $3 MXN de (Prenda + Envío). Colivery descuenta esto de su ganancia." className="text-red-600" />
                  <ColTip label="NET Coli. (Prenda)" tip={`Lo que le queda a Colivery de ganancia por prenda: Comisión (${comisionPctText}) menos pasarela y almacenaje (${mode === '10' ? '0%' : '3%'}).`} className="text-orange-500 font-bold" />
                  <ColTip label="Envío Cobrado"   tip="Lo que Colivery cobra al comprador por el envío ($99 fijos, cobrado desde el 1ro de abril, una vez por pedido)." className="text-blue-600" />
                  <ColTip label="Costo Guía"      tip="Lo que Colivery pagó realmente a la paquetería por la guía ($75–$229)." className="text-purple-600" />
                  <ColTip label="Colchón Envío"   tip="Diferencia entre lo cobrado ($99 o $0) y el costo real. Se mantiene como reserva de emergencia." className="text-gray-500 font-bold" />
                </tr>
              </thead>
              <tbody>
                {filas.map(row => (
                  <React.Fragment key={row.id}>
                    <tr className="border-b hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-gray-800">{row.numero_pedido}</td>
                      <td className="px-4 py-3 text-gray-700">{row.nombre || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.fecha_compra || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{row.producto || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(row.precio_tienda)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(row._comision)}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(row._utilidad)}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">{fmt(row._almacenaje)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(row._pasarela)}</td>
                      <td className="px-4 py-3 text-right font-black text-orange-600 bg-orange-50/5">
                        {fmt(row._netColivery)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{fmt(row.precio_envio)}</td>
                      <td className="px-4 py-3 text-right font-bold text-purple-600">
                        {row.costo_guia ? fmt(row.costo_guia) : <span className="text-gray-300 italic">pendiente</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.costo_guia ? (
                          <span className={`font-black ${row._margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row._margen >= 0 ? '+' : ''}{fmt(row._margen)}
                          </span>
                        ) : <span className="text-gray-300 italic">—</span>}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              {/* Totales */}
              <tfoot className="bg-gray-900 text-white">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-black text-sm uppercase tracking-wide">TOTALES</td>
                  <td className="px-4 py-3 text-right font-black">{fmt(totalPrendas)}</td>
                  <td className="px-4 py-3 text-right font-black text-orange-300">{fmt(totalComision)}</td>
                  <td className="px-4 py-3 text-right font-black text-green-300">{fmt(totalUtilidadCli)}</td>
                  <td className="px-4 py-3 text-right font-black text-amber-300">{fmt(totalAlmacenaje)}</td>
                  <td className="px-4 py-3 text-right font-black text-red-300">{fmt(totalPasarela)}</td>
                  <td className="px-4 py-3 text-right font-black text-orange-300 bg-orange-950/20">{fmt(totalNeto)}</td>
                  <td className="px-4 py-3 text-right font-black text-blue-300">{fmt(totalSaldoEnvio)}</td>
                  <td className="px-4 py-3 text-right font-black text-purple-300">{fmt(totalCostoGuias)}</td>
                  <td className={`px-4 py-3 text-right font-black ${totalMargenGuias >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {totalMargenGuias >= 0 ? '+' : ''}{fmt(totalMargenGuias)}
                  </td>
                </tr>
                <tr className="border-t border-white/20">
                  <td colSpan={4} className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wide">Ventas Brutas (prendas + envíos)</td>
                  <td colSpan={9} className="px-4 py-2 text-right font-black text-indigo-300">{fmt(totalVentas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
