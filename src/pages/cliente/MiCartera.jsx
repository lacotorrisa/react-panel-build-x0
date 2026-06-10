import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, ArrowUpRight, ArrowDownCircle, Paperclip, TrendingUp, AlertTriangle
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'

const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)

const CANALES = [
  {
    key:      'general',
    label:    'Tienda General',
    sub:      'lacotorrisamerch.com.mx · Abr 1 – May 27',
    icon:     '🛒',
    gradFrom: 'from-blue-600',
    gradTo:   'to-indigo-700',
    positive: 'text-blue-700',
    netoFn:   (c) => (c.ventas_general || 0) - (c.comision_colivery || 0) - (c.gastos_adicionales || 0),
    ventasFn: (c) => (c.ventas_general || 0),
  },
  {
    key:      'general10',
    label:    'Tienda General 10%',
    sub:      'lacotorrisamerch.com.mx · May 28 – hoy',
    icon:     '🛒',
    gradFrom: 'from-teal-500',
    gradTo:   'to-cyan-700',
    positive: 'text-teal-700',
    netoFn:   () => 0,
    ventasFn: () => 0,
  },
  {
    key:      'exclusivos',
    label:    'Exclusivos',
    sub:      'lacotorrisa.shop',
    icon:     '⭐',
    gradFrom: 'from-purple-600',
    gradTo:   'to-pink-700',
    positive: 'text-purple-700',
    netoFn:   (c) => (c.ventas_exclusivos || 0) - (c.costo_administracion || 0) - (c.pasarela_pagos || 0) - (c.costo_software || 0),
    ventasFn: (c) => (c.ventas_exclusivos || 0),
  },
  {
    key:      'eventos',
    label:    'Eventos',
    sub:      '',
    icon:     '🎪',
    gradFrom: 'from-orange-500',
    gradTo:   'to-amber-600',
    positive: 'text-orange-700',
    netoFn:   (c) => (c.ventas_eventos || 0) - (c.comision_eventos || 0),
    ventasFn: (c) => (c.ventas_eventos || 0),
  },
]

export const MiCartera = ({ clienteIdOverride, mode = '20' }) => {
  const { perfil } = useAuth()
  const navigate   = useNavigate()
  const [loading,        setLoading]        = useState(true)
  const [saldoTotal,     setSaldoTotal]     = useState(0)
  const [balanceInicial, setBalanceInicial] = useState(0)
  const [cortes,         setCortes]         = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [clienteNombre,  setClienteNombre]  = useState('La Cotorrisa')
  // Números reales de MongoDB para Tienda General (20% y 10%)
  const [mongoGeneral,   setMongoGeneral]   = useState({ ventas: 0, envios: 0, total: 0, ordenes: 0 })
  const [mongoGeneral10, setMongoGeneral10] = useState({ ventas: 0, envios: 0, total: 0, ordenes: 0 })
  const [pagos10,        setPagos10]        = useState([])

  const effectiveClienteId = clienteIdOverride || perfil?.cliente_id

  useEffect(() => { if (effectiveClienteId) fetchData() }, [effectiveClienteId, mode])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cliRes, cortesRes, transRes, mongoRes, mongo10Res] = await Promise.all([
        supabase.from('clientes').select('nombre, saldo, balance_inicial').eq('id', effectiveClienteId).single(),
        supabase.from('cliente_cortes_balance').select('*').eq('cliente_id', effectiveClienteId).order('fecha_inicio'),
        supabase.from('cliente_transferencias').select('*').eq('cliente_id', effectiveClienteId).order('fecha', { ascending: false }),
        // Tienda General 20%: Apr1-May27
        supabase.from('trazabilidad_guias')
          .select('precio_tienda, precio_envio')
          .eq('cliente_id', effectiveClienteId)
          .like('numero_pedido', 'MX-%')
          .gte('fecha_compra', '2026-04-01')
          .lte('fecha_compra', '2026-05-27'),
        // Tienda General 10%: May28 en adelante
        supabase.from('trazabilidad_guias')
          .select('precio_tienda, precio_envio')
          .eq('cliente_id', effectiveClienteId)
          .like('numero_pedido', 'MX-%')
          .gte('fecha_compra', '2026-05-28'),
      ])

      const rawCortes = cortesRes.data || []
      const rawTrans  = transRes.data  || []

      // Tienda General 20% (Apr1-May27)
      const trazRows = mongoRes.data || []
      const mPrendas = trazRows.reduce((s, r) => s + parseFloat(r.precio_tienda || 0), 0)
      const mEnvios  = trazRows.reduce((s, r) => s + parseFloat(r.precio_envio  || 0), 0)
      setMongoGeneral({ ventas: mPrendas, envios: mEnvios, total: mPrendas + mEnvios, ordenes: trazRows.length })

      // Tienda General 10% (May28+)
      const traz10Rows = mongo10Res.data || []
      const m10Prendas = traz10Rows.reduce((s, r) => s + parseFloat(r.precio_tienda || 0), 0)
      const m10Envios  = traz10Rows.reduce((s, r) => s + parseFloat(r.precio_envio  || 0), 0)
      setMongoGeneral10({ ventas: m10Prendas, envios: m10Envios, total: m10Prendas + m10Envios, ordenes: traz10Rows.length })

      // Pagos del canal general desde May 28
      const allTrans = transRes.data || []
      setPagos10(allTrans.filter(t => (t.tienda || 'general') === 'general' && t.fecha >= '2026-05-28'))

      // mode='10': solo muestra datos desde May 28 (periodo de comisión 10%)
      // mode='20' (default): muestra TODOS los datos sin filtrar
      const filteredCortes = mode === '10'
        ? rawCortes.filter(c => c.fecha_inicio && c.fecha_inicio >= '2026-05-28')
        : rawCortes

      const filteredTrans = mode === '10'
        ? rawTrans.filter(t => t.fecha && t.fecha >= '2026-05-28')
        : rawTrans

      const balIni = cliRes.data?.balance_inicial || 0
      setBalanceInicial(balIni)
      setCortes(filteredCortes)
      setTransferencias(filteredTrans)
      setClienteNombre(cliRes.data?.nombre || perfil?.nombre || 'La Cotorrisa')

      const totalPagado = filteredTrans.reduce((s, t) => s + (t.monto || 0), 0)
      const totalNeto   = filteredCortes.reduce((s, c) => s + (c.neto_favor || 0), 0)
      setSaldoTotal(balIni + totalNeto - totalPagado)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Cálculos por canal ─────────────────────────────────────────
  const calcCanal = (canal) => {
    const netoAcum   = cortes.reduce((s, c) => s + canal.netoFn(c), 0)
    const ventasAcum = cortes.reduce((s, c) => s + canal.ventasFn(c), 0)
    const pagos      = transferencias.filter(t => (t.tienda || 'general') === canal.key)
    const pagado     = pagos.reduce((s, t) => s + (t.monto || 0), 0)
    const extras     = canal.key === 'general' ? balanceInicial : 0
    const saldo      = extras + netoAcum - pagado
    const hayVentas  = ventasAcum > 0

    // Desglose de comisiones por tipo (leídas directamente del corte)
    let desglose = []
    if (canal.key === 'general') {
      const comis = cortes.reduce((s, c) => s + (c.comision_colivery  || 0), 0)
      const envio = cortes.reduce((s, c) => s + (c.gastos_adicionales || 0), 0)
      if (comis > 0) desglose.push({ label: `Comisión Colivery (${mode === '10' ? '10%' : '20%'})`, monto: comis })
      if (envio > 0) desglose.push({ label: 'Cobranza envíos',  monto: envio, isEnvio: true })
    } else if (canal.key === 'exclusivos') {
      const plat  = cortes.reduce((s, c) => s + (c.costo_administracion || 0), 0)
      const pase  = cortes.reduce((s, c) => s + (c.pasarela_pagos       || 0), 0)
      const env   = cortes.reduce((s, c) => s + (c.costo_software       || 0), 0)
      if (plat > 0) desglose.push({ label: `Comisión Colivery (${mode === '10' ? '10%' : '20%'})`,  monto: plat })
      if (pase > 0) desglose.push({ label: 'Pasarela de pago',   monto: pase })
      if (env  > 0) desglose.push({ label: 'Cobranza envíos',    monto: env,  isEnvio: true })
    } else if (canal.key === 'eventos') {
      const mp = cortes.reduce((s, c) => s + (c.comision_eventos || 0), 0)
      if (mp > 0) desglose.push({ label: 'Comisión MercadoPago', monto: mp })
    }

    return { netoAcum, ventasAcum, pagado, saldo, pagos, extras, hayVentas, desglose }
  }

  // ── Saldo total real = suma de los 4 módulos ─────────────────────────────
  const calcSaldoTotal = () => {
    // Tienda General 20%
    const gPrendas = mongoGeneral.ventas
    const gEnvios  = mongoGeneral.envios
    const gNeto    = gPrendas * 0.80
    const gPagado  = transferencias.filter(t => (t.tienda||'general') === 'general' && t.fecha <= '2026-05-27').reduce((s,t)=>s+(t.monto||0),0)
    const gSaldo   = gNeto + balanceInicial - gPagado

    // Tienda General 10%
    const g10Neto   = mongoGeneral10.ventas * 0.90
    const g10Envios = mongoGeneral10.envios
    const g10Pagado = pagos10.reduce((s,t)=>s+(t.monto||0),0)
    const g10Saldo  = g10Neto - g10Envios - g10Pagado

    // Exclusivos
    const exclNeto   = cortes.reduce((s,c) => s + ((c.ventas_exclusivos||0)-(c.costo_administracion||0)-(c.pasarela_pagos||0)-(c.costo_software||0)), 0)
    const exclPagado = transferencias.filter(t => t.tienda === 'exclusivos').reduce((s,t)=>s+(t.monto||0),0)
    const exclSaldo  = exclNeto - exclPagado

    // Eventos
    const evNeto   = cortes.reduce((s,c) => s + ((c.ventas_eventos||0)-(c.comision_eventos||0)), 0)
    const evPagado = transferencias.filter(t => t.tienda === 'eventos').reduce((s,t)=>s+(t.monto||0),0)
    const evSaldo  = evNeto - evPagado

    return gSaldo + g10Saldo + exclSaldo + evSaldo
  }

  const saldoTotalReal = calcSaldoTotal()

  // Totales para el hero (informativo)
  const totalPagado = transferencias.reduce((s, t) => s + (t.monto || 0), 0)
  const totalNeto   = cortes.reduce((s, c) => s + (c.neto_favor || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-orange-500" /> Mi Cartera {mode === '10' ? '(10%)' : ''}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === '10'
              ? 'Balance real por canal de venta · Comisión Colivery 10% (desde 28 de Mayo)'
              : 'Balance real por canal de venta · Comisión Colivery 20% (hasta 27 de Mayo)'}
          </p>
        </div>
        <button
          onClick={() => navigate('/cliente/retiro')}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-md"
        >
          <ArrowUpRight className="w-4 h-4" /> Solicitar Retiro
        </button>
      </div>

      {/* ── Saldo Total Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-2xl p-7 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/5 rounded-full" />

        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Saldo Disponible Total</p>
              <h1 className="text-4xl font-black tracking-tight">{fmt(saldoTotalReal)}</h1>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                {clienteNombre} · {cortes.length} período{cortes.length !== 1 ? 's' : ''} cerrado{cortes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Wallet className="w-14 h-14 text-orange-400/20" />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Neto total (tras comisiones)</p>
              <p className="text-lg font-black text-green-400 mt-0.5">{fmt(totalNeto)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total pagado / depositado</p>
              <p className="text-lg font-black text-orange-400 mt-0.5">{fmt(totalPagado)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Balance inicial incluido</p>
              <p className="text-lg font-black text-white mt-0.5">{fmt(balanceInicial)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cards por Canal ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CANALES.map(canal => {
          const { netoAcum, ventasAcum, pagado, saldo, pagos, extras, hayVentas, desglose } = calcCanal(canal)

          // Para Tienda General 20% usamos números reales de MongoDB (Apr1-May27)
          const isGeneral   = canal.key === 'general'
          const isGeneral10 = canal.key === 'general10'

          // --- TIENDA GENERAL 20% ---
          const gVentas      = isGeneral ? mongoGeneral.ventas : ventasAcum
          const gEnvios      = isGeneral ? mongoGeneral.envios : 0
          const gVentasBrutas = isGeneral ? gVentas + gEnvios : ventasAcum
          const gCom20       = isGeneral ? gVentas * 0.20 : 0
          const gNeto        = isGeneral ? gVentas * 0.80 : netoAcum
          const gPagado      = isGeneral ? pagos.reduce((s,t) => s+(t.monto||0), 0) : pagado
          const gSaldo       = isGeneral ? (gNeto + balanceInicial - gPagado) : saldo

          // --- TIENDA GENERAL 10% ---
          const g10Ventas      = mongoGeneral10.ventas
          const g10Envios      = mongoGeneral10.envios
          const g10VentasBrutas = g10Ventas + g10Envios
          const g10Com10       = g10Ventas * 0.10
          const g10Neto        = g10Ventas * 0.90
          const g10Pagado      = pagos10.reduce((s,t) => s+(t.monto||0), 0)
          const g10Saldo       = g10Neto - g10Envios - g10Pagado

          const displaySaldo = isGeneral ? gSaldo : isGeneral10 ? g10Saldo : saldo

          // Card de Tienda General 10% — layout propio
          if (isGeneral10) return (
            <Card key="general10" className="border-0 shadow-md overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-700 p-4 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-lg">🛒</span>
                    <p className="font-black text-sm mt-1">Tienda General 10%</p>
                    <p className="text-[10px] text-white/70 font-medium">lacotorrisamerch.com.mx · May 28 – hoy</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/60 font-medium">Saldo libre</p>
                    <p className="text-2xl font-black">{fmt(g10Saldo)}</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 bg-white flex-1 space-y-2">
                {/* Ventas brutas */}
                <div className="flex justify-between items-center text-xs text-gray-500 py-1">
                  <span>Ventas brutas</span>
                  <span className="font-bold text-gray-700">{fmt(g10VentasBrutas)}</span>
                </div>
                <div className="text-[10px] text-gray-400 pl-3 -mt-1 space-y-0.5">
                  <div className="flex justify-between"><span>· Prendas</span><span>{fmt(g10Ventas)}</span></div>
                  <div className="flex justify-between"><span>· Envíos cobrados</span><span>{fmt(g10Envios)}</span></div>
                </div>

                {/* Deducciones */}
                <div className="border-l-2 border-red-100 pl-3 space-y-1 py-0.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-500">Comisión Colivery (10%)</span>
                    <span className="font-medium text-red-500">−{fmt(g10Com10)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-500">Cobranza envíos</span>
                    <span className="font-medium text-red-500">−{fmt(g10Envios)}</span>
                  </div>
                </div>

                {/* Neto */}
                <div className="flex justify-between items-center text-xs font-bold py-1 border-t">
                  <span className="text-gray-700">Neto La Cotorrisa (90%)</span>
                  <span className="text-gray-800">{fmt(g10Neto)}</span>
                </div>

                {/* Saldo libre */}
                <div className={`flex justify-between items-center text-sm font-black py-2 px-2.5 rounded-lg ${g10Saldo >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <span>Saldo libre</span>
                  <span className="text-lg">{fmt(g10Saldo)}</span>
                </div>

                {/* Payouts */}
                {pagos10.length > 0 ? (
                  <div className="pt-1 border-t space-y-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Payouts realizados</p>
                    {pagos10.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">{p.fecha}{p.hora ? ` ${p.hora}` : ''}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-700">{fmt(p.monto)}</span>
                          {p.comprobante_url && (
                            <a href={p.comprobante_url} target="_blank" rel="noreferrer">
                              <Paperclip className="w-3 h-3 text-orange-400 hover:text-orange-600" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-[11px] font-black border-t border-gray-100 pt-1 text-gray-700">
                      <span>Total pagado</span>
                      <span>−{fmt(g10Pagado)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 pt-1 border-t">Sin payouts registrados en este período</p>
                )}

                {/* Info ordenes */}
                <p className="text-[10px] text-gray-400 pt-1">{mongoGeneral10.ordenes} órdenes registradas (May 28 – hoy)</p>
              </CardContent>
            </Card>
          )

          return (
            <Card key={canal.key} className="border-0 shadow-md overflow-hidden flex flex-col">
              {/* Header degradado */}
              <div className={`bg-gradient-to-r ${canal.gradFrom} ${canal.gradTo} p-4 text-white`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-lg">{canal.icon}</span>
                    <p className="font-black text-sm mt-1">{canal.label}</p>
                    {canal.sub && <p className="text-[10px] text-white/70 font-medium">{canal.sub}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/60 font-medium">Saldo libre</p>
                    <p className="text-2xl font-black">{fmt(displaySaldo)}</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 bg-white flex-1 space-y-2">

                {/* ── TIENDA GENERAL: usa números reales de MongoDB ── */}
                {isGeneral ? (
                  <>
                    {/* Ventas brutas (prendas + envíos, precio real cobrado) */}
                    <div className="flex justify-between items-center text-xs text-gray-500 py-1">
                      <span>Ventas brutas</span>
                      <span className="font-bold text-gray-700">{fmt(gVentasBrutas)}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 pl-3 -mt-1 space-y-0.5">
                      <div className="flex justify-between"><span>· Prendas</span><span>{fmt(gVentas)}</span></div>
                      <div className="flex justify-between"><span>· Envíos cobrados</span><span>{fmt(gEnvios)}</span></div>
                    </div>

                    {/* Deducciones */}
                    <div className="border-l-2 border-red-100 pl-3 space-y-1 py-0.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Comisión Colivery (20%)</span>
                        <span className="font-medium text-red-500">−{fmt(gCom20)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Cobranza envíos</span>
                        <span className="font-medium text-red-500">−{fmt(gEnvios)}</span>
                      </div>
                    </div>

                    {/* Neto Cotorrisa */}
                    <div className="flex justify-between items-center text-xs font-bold py-1 border-t">
                      <span className="text-gray-700">Neto La Cotorrisa (80%)</span>
                      <span className="text-gray-800">{fmt(gNeto)}</span>
                    </div>

                    {/* Balance inicial */}
                    <div className="flex justify-between items-center text-[11px] text-gray-500 pl-1">
                      <span>+ Saldo a favor Marzo 2026</span>
                      <span className="font-medium text-green-600">+{fmt(balanceInicial)}</span>
                    </div>

                    {/* Total disponible */}
                    <div className="flex justify-between items-center text-xs font-bold border-t pt-1">
                      <span className="text-gray-700">Total disponible</span>
                      <span className="text-gray-800">{fmt(gNeto + balanceInicial)}</span>
                    </div>

                    {/* Saldo libre */}
                    <div className={`flex justify-between items-center text-sm font-black py-2 px-2.5 rounded-lg ${gSaldo >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      <span>Saldo libre</span>
                      <span className="text-lg">{fmt(gSaldo)}</span>
                    </div>

                    {/* Payouts */}
                    {pagos.length > 0 && (
                      <div className="pt-1 border-t space-y-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Payouts realizados</p>
                        {pagos.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-500">{p.fecha}{p.hora ? ` ${p.hora}` : ''}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-700">{fmt(p.monto)}</span>
                              {p.comprobante_url && (
                                <a href={p.comprobante_url} target="_blank" rel="noreferrer">
                                  <Paperclip className="w-3 h-3 text-orange-400 hover:text-orange-600" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-[11px] font-black border-t border-gray-100 pt-1 text-gray-700">
                          <span>Total pagado</span>
                          <span>−{fmt(pagado)}</span>
                        </div>
                      </div>
                    )}
                  </>

                ) : !hayVentas ? (
                  <div className="text-center py-5 text-gray-400">
                    <p className="text-xs">Sin ventas registradas en este canal</p>
                  </div>
                ) : (
                  <>
                    {/* Ventas brutas */}
                    <div className="flex justify-between items-center text-xs text-gray-500 py-1">
                      <span>Ventas brutas</span>
                      <span className="font-bold text-gray-700">{fmt(ventasAcum)}</span>
                    </div>

                    {/* Desglose comisiones */}
                    {desglose.length > 0 ? (() => {
                      const comisItems = desglose.filter(d => !d.isEnvio)
                      const envioItem  = desglose.find(d => d.isEnvio)
                      return (
                        <>
                          <div className="border-l-2 border-red-100 pl-3 space-y-1 py-0.5">
                            {comisItems.map((d, i) => (
                              <div key={i} className="flex justify-between items-start text-[11px]">
                                <span className="leading-tight pr-2 text-gray-500">{d.label}</span>
                                <span className="font-medium whitespace-nowrap text-red-500">−{fmt(d.monto)}</span>
                              </div>
                            ))}
                          </div>
                          {envioItem && (
                            <div className="flex justify-between items-center text-[11px] text-gray-500 pl-3 border-l-2 border-red-100">
                              <span>{envioItem.label}</span>
                              <span className="font-medium text-red-500">−{fmt(envioItem.monto)}</span>
                            </div>
                          )}
                        </>
                      )
                    })() : (
                      <div className="flex justify-between items-center text-xs text-amber-600 pl-3 border-l-2 border-amber-100 py-0.5">
                        <span>Comisiones / deducciones</span>
                        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />En proceso</span>
                      </div>
                    )}

                    {/* Neto */}
                    <div className="flex justify-between items-center text-xs font-bold py-1 border-t">
                      <span className="text-gray-700">Neto La Cotorrisa</span>
                      <span className="text-gray-800">{fmt(netoAcum)}</span>
                    </div>

                    {/* Saldo libre */}
                    <div className={`flex justify-between items-center text-sm font-black py-2 px-2.5 rounded-lg ${saldo >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      <span>Saldo libre</span>
                      <span className="text-lg">{fmt(saldo)}</span>
                    </div>

                    {/* Payouts */}
                    {pagos.length > 0 && (
                      <div className="pt-1 border-t space-y-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Payouts realizados</p>
                        {pagos.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-500">{p.fecha}{p.hora ? ` ${p.hora}` : ''}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-700">{fmt(p.monto)}</span>
                              {p.comprobante_url && (
                                <a href={p.comprobante_url} target="_blank" rel="noreferrer">
                                  <Paperclip className="w-3 h-3 text-orange-400 hover:text-orange-600" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-[11px] font-black border-t border-gray-100 pt-1 text-gray-700">
                          <span>Total pagado</span>
                          <span>−{fmt(pagado)}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Historial de movimientos ── */}
      {transferencias.length > 0 && (
        <Card className="border shadow-sm bg-white">
          <div className="px-5 py-3.5 border-b flex justify-between items-center">
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Historial de Depósitos</h4>
              <p className="text-xs text-gray-400">Todos los pagos realizados a tu cuenta</p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {transferencias.length} registros
            </span>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {transferencias.map(t => {
              const canalInfo = CANALES.find(c => c.key === (t.tienda || 'general'))
              return (
                <div key={t.id} className="px-5 py-3 flex justify-between items-center hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{canalInfo?.icon || '💸'}</span>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{t.destinatario || 'Depósito'}</p>
                      <p className="text-xs text-gray-400">
                        {t.fecha}{t.hora ? ` · ${t.hora} hrs` : ''} · {canalInfo?.label}
                        {t.referencia ? ` · ${t.referencia}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-black text-gray-900 text-sm">{fmt(t.monto)}</p>
                    {t.comprobante_url && (
                      <a href={t.comprobante_url} target="_blank" rel="noreferrer"
                        className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1 hover:bg-green-100">
                        <Paperclip className="w-3 h-3" /> Ver
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── CTA ── */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 flex justify-between items-center">
        <div>
          <p className="font-black text-gray-800">¿Listo para solicitar tu retiro?</p>
          <p className="text-sm text-gray-500 mt-0.5">Saldo total disponible: <strong className="text-orange-600">{fmt(saldoTotal)}</strong></p>
        </div>
        <button
          onClick={() => navigate('/cliente/retiro')}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-md whitespace-nowrap"
        >
          <ArrowUpRight className="w-4 h-4" /> Solicitar Retiro
        </button>
      </div>
    </div>
  )
}
