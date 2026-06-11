import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  CalendarDays, TrendingUp, Package, ShoppingBag,
  ChevronLeft, ChevronRight, BarChart3, Wallet, ArrowUpRight, RefreshCw
} from 'lucide-react'

const fmt    = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const toISO  = d => d.toISOString().split('T')[0]

const CLIENTE_ID = '1882e9a0-4dc0-4a03-96e4-ffa5712cda09'

const getLunes = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return toISO(d)
}
const getDomingo = (lunes) => {
  const d = new Date(lunes + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return toISO(d)
}

// ── Calcula saldo global igual que MiCartera ──────────────────────────────────
const calcSaldoGlobal = ({ traz20, traz10, cortes, transferencias, balanceInicial }) => {
  // Tienda General 20% (Apr1-May27)
  const gPrendas = traz20.reduce((s, r) => s + parseFloat(r.precio_tienda || 0), 0)
  const gEnvios  = traz20.reduce((s, r) => s + parseFloat(r.precio_envio  || 0), 0)
  const gNeto    = gPrendas * 0.80
  const gPagado  = transferencias
    .filter(t => (t.tienda || 'general') === 'general' && t.fecha <= '2026-05-27')
    .reduce((s, t) => s + (t.monto || 0), 0)
  const gSaldo   = gNeto + balanceInicial - gPagado

  // Tienda General 10% (May28+)
  const g10Prendas = traz10.reduce((s, r) => s + parseFloat(r.precio_tienda || 0), 0)
  const g10Envios  = traz10.reduce((s, r) => s + parseFloat(r.precio_envio  || 0), 0)
  const g10Neto    = g10Prendas * 0.90
  const g10Pagado  = transferencias
    .filter(t => (t.tienda || 'general') === 'general' && t.fecha >= '2026-05-28')
    .reduce((s, t) => s + (t.monto || 0), 0)
  const g10Saldo   = g10Neto - g10Envios - g10Pagado

  // Exclusivos
  const exclNeto   = cortes.reduce((s, c) => s + ((c.ventas_exclusivos || 0) - (c.costo_administracion || 0) - (c.pasarela_pagos || 0) - (c.costo_software || 0)), 0)
  const exclPagado = transferencias.filter(t => t.tienda === 'exclusivos').reduce((s, t) => s + (t.monto || 0), 0)
  const exclSaldo  = exclNeto - exclPagado

  // Eventos
  const evNeto   = cortes.reduce((s, c) => s + ((c.ventas_eventos || 0) - (c.comision_eventos || 0)), 0)
  const evPagado = transferencias.filter(t => t.tienda === 'eventos').reduce((s, t) => s + (t.monto || 0), 0)
  const evSaldo  = evNeto - evPagado

  const total = gSaldo + g10Saldo + exclSaldo + evSaldo

  return {
    total,
    gSaldo, g10Saldo, exclSaldo, evSaldo,
    // desglose de dónde viene
    gPrendas, gEnvios, gNeto, gPagado,
    g10Prendas, g10Envios, g10Neto, g10Pagado,
    exclNeto, exclPagado,
    evNeto, evPagado,
    totalPagado: transferencias.reduce((s, t) => s + (t.monto || 0), 0),
  }
}

export const CierreCaja = ({ clienteIdOverride }) => {
  const cid = clienteIdOverride || CLIENTE_ID
  const hoy = toISO(new Date())

  const [modo,      setModo]      = useState('dia')
  const [fechaSel,  setFechaSel]  = useState(hoy)
  const [loading,   setLoading]   = useState(false)
  const [datos,     setDatos]     = useState(null)
  const [luneSel,   setLuneSel]   = useState(getLunes(new Date()))

  // ── Saldo global ─────────────────────────────────────
  const [saldoGlobal,   setSaldoGlobal]   = useState(null)
  const [loadingSaldo,  setLoadingSaldo]  = useState(true)
  const [showDetalle,   setShowDetalle]   = useState(false)

  // ── Sync Mongo ────────────────────────────────────────
  const [syncing,     setSyncing]     = useState(false)
  const [lastSync,    setLastSync]    = useState(() => localStorage.getItem('caja_last_sync') || null)

  // Fetch saldo global al montar
  useEffect(() => {
    const fetchSaldoGlobal = async () => {
      setLoadingSaldo(true)
      const [cliRes, cortesRes, transRes, traz20Res, traz10Res] = await Promise.all([
        supabase.from('clientes').select('balance_inicial').eq('id', cid).single(),
        supabase.from('cliente_cortes_balance').select('*').eq('cliente_id', cid),
        supabase.from('cliente_transferencias').select('*').eq('cliente_id', cid),
        supabase.from('trazabilidad_guias')
          .select('precio_tienda, precio_envio')
          .eq('cliente_id', cid)
          .ilike('numero_pedido', 'MX-%')
          .gte('fecha_compra', '2026-04-01')
          .lte('fecha_compra', '2026-05-27'),
        supabase.from('trazabilidad_guias')
          .select('precio_tienda, precio_envio')
          .eq('cliente_id', cid)
          .ilike('numero_pedido', 'MX-%')
          .gte('fecha_compra', '2026-05-28'),
      ])

      const result = calcSaldoGlobal({
        traz20:         traz20Res.data  || [],
        traz10:         traz10Res.data  || [],
        cortes:         cortesRes.data  || [],
        transferencias: transRes.data   || [],
        balanceInicial: cliRes.data?.balance_inicial || 0,
      })
      setSaldoGlobal(result)
      setLoadingSaldo(false)
    }
    fetchSaldoGlobal()
  }, [cid])

  // ── Handler de sync Mongo → Supabase ─────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true)
    const toastId = toast.loading('Sincronizando ventas desde Colivery...')
    try {
      // Sincronizar últimas 48 horas para no perder nada
      const desde = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const res = await fetch(`/api/mongo-pedidos?desde=${desde}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error en el servidor')

      const ahora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      setLastSync(ahora)
      localStorage.setItem('caja_last_sync', ahora)

      if (data.nuevos === 0) {
        toast.success('Todo al día — sin órdenes nuevas', { id: toastId })
      } else {
        toast.success(
          `✅ ${data.importados} orden${data.importados !== 1 ? 'es' : ''} importada${data.importados !== 1 ? 's' : ''} de Colivery`,
          { id: toastId, duration: 5000 }
        )
        // Recargar datos del día/semana y saldo
        if (modo === 'dia') fetchDia(fechaSel)
        else fetchSemana(luneSel)
        // Recargar saldo global
        setLoadingSaldo(true)
        const [cliRes, cortesRes, transRes, traz20Res, traz10Res] = await Promise.all([
          supabase.from('clientes').select('balance_inicial').eq('id', cid).single(),
          supabase.from('cliente_cortes_balance').select('*').eq('cliente_id', cid),
          supabase.from('cliente_transferencias').select('*').eq('cliente_id', cid),
          supabase.from('trazabilidad_guias').select('precio_tienda, precio_envio').eq('cliente_id', cid).ilike('numero_pedido', 'MX-%').gte('fecha_compra', '2026-04-01').lte('fecha_compra', '2026-05-27'),
          supabase.from('trazabilidad_guias').select('precio_tienda, precio_envio').eq('cliente_id', cid).ilike('numero_pedido', 'MX-%').gte('fecha_compra', '2026-05-28'),
        ])
        setSaldoGlobal(calcSaldoGlobal({
          traz20: traz20Res.data || [], traz10: traz10Res.data || [],
          cortes: cortesRes.data || [], transferencias: transRes.data || [],
          balanceInicial: cliRes.data?.balance_inicial || 0,
        }))
        setLoadingSaldo(false)
      }
    } catch (err) {
      toast.error('Error al sincronizar: ' + err.message, { id: toastId })
    } finally {
      setSyncing(false)
    }
  }, [modo, fechaSel, luneSel, cid])

  // ── Fetch día / semana ───────────────────────────────
  const fetchDia = useCallback(async (fecha) => {
    setLoading(true)
    const { data } = await supabase
      .from('trazabilidad_guias')
      .select('*')
      .eq('cliente_id', cid)
      .eq('fecha_compra', fecha)
      .order('numero_pedido')
    procesarDatos(data || [], fecha, fecha)
    setLoading(false)
  }, [cid])

  const fetchSemana = useCallback(async (lunes) => {
    setLoading(true)
    const domingo = getDomingo(lunes)
    const { data } = await supabase
      .from('trazabilidad_guias')
      .select('*')
      .eq('cliente_id', cid)
      .gte('fecha_compra', lunes)
      .lte('fecha_compra', domingo)
      .order('fecha_compra')
    procesarDatos(data || [], lunes, domingo)
    setLoading(false)
  }, [cid])

  const procesarDatos = (rows, fechaIni, fechaFin) => {
    // Deduplicar multi-guía
    const baseIdVisto = new Set()
    const rowsDedup = rows.map(r => {
      const baseId = (r.numero_pedido || '').replace(/-\d+$/, '')
      if (baseIdVisto.has(baseId)) return { ...r, precio_tienda: 0 }
      baseIdVisto.add(baseId)
      return r
    })

    const ventas     = rowsDedup.reduce((s, r) => s + parseFloat(r.precio_tienda || 0), 0)
    const envios     = rowsDedup.reduce((s, r) => s + parseFloat(r.precio_envio  || 0), 0)
    const totalBruto = ventas + envios
    const pct        = fechaIni >= '2026-05-28' ? '10%' : '20%'
    const comision   = ventas * (fechaIni >= '2026-05-28' ? 0.10 : 0.20)
    const neto       = ventas - comision

    const pedidosUnicos = [...new Set(rows.map(r => (r.numero_pedido || '').replace(/-\d+$/, '')))]
    const ordenesMX  = pedidosUnicos.filter(p => p.startsWith('MX-'))
    const ordenesExcl = pedidosUnicos.filter(p => !p.startsWith('MX-'))

    // Por día
    const porDia = {}
    rowsDedup.forEach(r => {
      const d = r.fecha_compra
      if (!porDia[d]) porDia[d] = { ventas: 0, envios: 0, ordenes: 0 }
      porDia[d].ventas += parseFloat(r.precio_tienda || 0)
      porDia[d].envios += parseFloat(r.precio_envio  || 0)
    })
    const pedidosPorDia = {}
    rows.forEach(r => {
      const d = r.fecha_compra
      const baseId = (r.numero_pedido || '').replace(/-\d+$/, '')
      if (!pedidosPorDia[d]) pedidosPorDia[d] = new Set()
      pedidosPorDia[d].add(baseId)
    })
    Object.entries(pedidosPorDia).forEach(([d, s]) => {
      if (porDia[d]) porDia[d].ordenes = s.size
    })

    // Top productos
    const prodCount = {}
    rows.forEach(r => {
      const nombre = r.nombre_producto || 'Producto'
      prodCount[nombre] = (prodCount[nombre] || 0) + 1
    })
    const topProductos = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

    setDatos({
      rows, fechaIni, fechaFin, ventas, envios, totalBruto,
      comision, pct, neto, ordenesMX, ordenesExcl,
      porDia: Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])),
      topProductos,
      totalOrdenes: pedidosUnicos.length,
    })
  }

  useEffect(() => {
    if (modo === 'dia') fetchDia(fechaSel)
    else                fetchSemana(luneSel)
  }, [modo, fechaSel, luneSel])

  const cambiarDia    = delta => { const d = new Date(fechaSel + 'T12:00:00'); d.setDate(d.getDate() + delta); setFechaSel(toISO(d)) }
  const cambiarSemana = delta => { const d = new Date(luneSel  + 'T12:00:00'); d.setDate(d.getDate() + delta * 7); setLuneSel(toISO(d)) }
  const tasa = datos?.pct || '20%'

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ══ SALDO COTORRISA — Banner principal ══════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl shadow-xl bg-gradient-to-br from-[#0f3460] via-[#16213e] to-[#1a1a2e] text-white">
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-orange-500/10 rounded-full pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-orange-500/5 rounded-full pointer-events-none" />

        <div className="relative z-10 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Saldo */}
            <div>
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Saldo Cotorrisa
              </p>
              {loadingSaldo ? (
                <div className="w-40 h-9 bg-white/10 rounded-lg animate-pulse" />
              ) : (
                <p className={`text-4xl font-black tracking-tight ${saldoGlobal?.total >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {fmt(saldoGlobal?.total)}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">Saldo libre tras comisiones y payouts · todos los canales</p>
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Sync Mongo */}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md whitespace-nowrap"
                title="Importar órdenes nuevas desde Colivery a esta vista"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Ventas'}
              </button>
              {/* Ver desglose */}
              <button
                onClick={() => setShowDetalle(v => !v)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md whitespace-nowrap"
              >
                <ArrowUpRight className="w-4 h-4" />
                {showDetalle ? 'Ocultar detalle' : 'Ver desglose'}
              </button>
            </div>
            {/* Última sync */}
            {lastSync && (
              <p className="text-[10px] text-gray-400 text-right sm:text-left mt-1 sm:mt-0">
                Última sync: {lastSync}
              </p>
            )}
          </div>

          {/* Desglose por canal (expandible) */}
          {showDetalle && saldoGlobal && (
            <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Tienda General 20%', value: saldoGlobal.gSaldo,    color: saldoGlobal.gSaldo    >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Tienda General 10%', value: saldoGlobal.g10Saldo,  color: saldoGlobal.g10Saldo  >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Exclusivos',          value: saldoGlobal.exclSaldo, color: saldoGlobal.exclSaldo >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Eventos',             value: saldoGlobal.evSaldo,   color: saldoGlobal.evSaldo   >= 0 ? 'text-green-400' : 'text-red-400' },
              ].map((c, i) => (
                <div key={i}>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">{c.label}</p>
                  <p className={`text-base font-black mt-0.5 ${c.color}`}>{fmt(c.value)}</p>
                </div>
              ))}
              <div className="col-span-2 md:col-span-4 pt-3 border-t border-white/10 flex justify-between text-[11px] text-gray-400">
                <span>Total pagado (payouts): <strong className="text-white">{fmt(saldoGlobal.totalPagado)}</strong></span>
                <span>Saldo a favor Marzo 2026 incluido</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Header + Toggle día/semana ══════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-orange-500" />
            Cobro y Cierres de Caja
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">lacotorrisamerch.com.mx · Reporte de ventas diario / semanal</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setModo('dia')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${modo === 'dia' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
            📅 Por Día
          </button>
          <button onClick={() => setModo('semana')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${modo === 'semana' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
            📆 Por Semana
          </button>
        </div>
      </div>

      {/* ══ Navegador de fecha ══════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center justify-between gap-4">
        <button onClick={() => modo === 'dia' ? cambiarDia(-1) : cambiarSemana(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-orange-50 hover:text-orange-600 transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          {modo === 'dia' ? (
            <>
              <p className="font-black text-gray-800 capitalize">{fmtDay(fechaSel)}</p>
              <input type="date" value={fechaSel} max={hoy}
                onChange={e => setFechaSel(e.target.value)}
                className="mt-1 text-xs text-orange-600 font-bold border-0 bg-transparent cursor-pointer text-center outline-none" />
            </>
          ) : (
            <>
              <p className="font-black text-gray-800">
                Semana del <span className="text-orange-600">{luneSel}</span> al <span className="text-orange-600">{getDomingo(luneSel)}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Selecciona cualquier día de la semana:</p>
              <input type="date" max={hoy}
                onChange={e => setLuneSel(getLunes(new Date(e.target.value + 'T12:00:00')))}
                className="mt-0.5 text-xs text-orange-600 font-bold border-0 bg-transparent cursor-pointer text-center outline-none" />
            </>
          )}
        </div>
        <button onClick={() => modo === 'dia' ? cambiarDia(1) : cambiarSemana(1)}
          disabled={fechaSel >= hoy && modo === 'dia'}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-orange-50 hover:text-orange-600 transition-all disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ══ Contenido ══════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !datos || datos.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-500">Sin ventas registradas</p>
          <p className="text-xs text-gray-400 mt-1">No hay órdenes para {modo === 'dia' ? 'este día' : 'esta semana'}</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Órdenes totales',           value: datos.totalOrdenes,    icon: Package,    color: 'text-blue-600',   bg: 'bg-blue-50'   },
              { label: 'Ventas brutas',              value: fmt(datos.totalBruto), icon: TrendingUp, color: 'text-green-600',  bg: 'bg-green-50'  },
              { label: `Comisión Colivery (${tasa})`, value: fmt(datos.comision), icon: Wallet,     color: 'text-red-500',    bg: 'bg-red-50'    },
              { label: 'Neto La Cotorrisa',          value: fmt(datos.neto),       icon: ShoppingBag,color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border shadow-sm p-4">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{k.label}</p>
                <p className={`text-lg font-black mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Cierre de caja */}
          <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-2xl p-6 text-white shadow-xl">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Cierre de Caja — {modo === 'dia' ? fmtDay(datos.fechaIni) : `Semana ${datos.fechaIni} → ${datos.fechaFin}`}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Ventas prendas</span>
                <span className="font-bold">{fmt(datos.ventas)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Envíos cobrados</span>
                <span className="font-bold">{fmt(datos.envios)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2 font-bold">
                <span>Total bruto</span>
                <span className="text-green-400">{fmt(datos.totalBruto)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">− Comisión Colivery ({tasa})</span>
                <span className="text-red-400">−{fmt(datos.comision)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">− Cobranza envíos</span>
                <span className="text-red-400">−{fmt(datos.envios)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-black">
                <span>💰 Neto a favor La Cotorrisa</span>
                <span className="text-orange-400">{fmt(datos.neto)}</span>
              </div>
            </div>
          </div>

          {/* Desglose semanal */}
          {modo === 'semana' && datos.porDia.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h3 className="font-bold text-gray-700 text-sm">Desglose por día</h3>
              </div>
              <div className="divide-y">
                {datos.porDia.map(([fecha, d]) => (
                  <div key={fecha} className="px-5 py-3 flex justify-between items-center hover:bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-700 text-sm capitalize">{fmtDay(fecha)}</p>
                      <p className="text-xs text-gray-400">{d.ordenes} orden{d.ordenes !== 1 ? 'es' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-800">{fmt(d.ventas + d.envios)}</p>
                      <p className="text-xs text-green-600">neto: {fmt(d.ventas * (datos.fechaIni >= '2026-05-28' ? 0.90 : 0.80))}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-orange-50 flex justify-between items-center border-t">
                <p className="font-black text-gray-700 text-sm">Total semana</p>
                <p className="font-black text-orange-600">{fmt(datos.totalBruto)}</p>
              </div>
            </div>
          )}

          {/* Top productos */}
          {datos.topProductos.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h3 className="font-bold text-gray-700 text-sm">🏆 Productos más vendidos</h3>
              </div>
              <div className="divide-y">
                {datos.topProductos.map(([nombre, qty], i) => (
                  <div key={i} className="px-5 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-black flex items-center justify-center">{i + 1}</span>
                      <p className="text-sm font-medium text-gray-700">{nombre}</p>
                    </div>
                    <span className="text-sm font-black text-gray-800">{qty} unid.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de órdenes */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-700 text-sm">Detalle de órdenes ({datos.totalOrdenes})</h3>
              <span className="text-xs text-gray-400">{datos.ordenesMX.length} tienda · {datos.ordenesExcl.length} exclusivos</span>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {datos.rows.map((r, i) => (
                <div key={r.id || i} className="px-5 py-3 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{r.numero_pedido}</p>
                    <p className="text-xs text-gray-400">{r.nombre_producto || '—'} · {r.fecha_compra}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-800">{fmt(parseFloat(r.precio_tienda || 0) + parseFloat(r.precio_envio || 0))}</p>
                    <p className="text-[10px] text-gray-400">prenda: {fmt(r.precio_tienda)} · envío: {fmt(r.precio_envio)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
