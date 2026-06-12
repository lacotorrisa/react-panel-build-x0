import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Wallet, ArrowUpRight, RefreshCw, ChevronDown, ChevronUp,
  Lock, AlertCircle, TrendingUp, Clock
} from 'lucide-react'

const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
const toISO = (d) => (d instanceof Date ? d : new Date(d)).toISOString().split('T')[0]
const MESES_ES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const nomMes = (yyyy, mm) => `${MESES_ES[parseInt(mm)]} ${yyyy}`

// ── Hora local México ────────────────────────────────────────────────────────
const horaFmt = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit'
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Tarjeta de un mes
// ══════════════════════════════════════════════════════════════════════════════
const MesCard = ({ datos, saldoAnterior, isFirst, isLast }) => {
  const [open, setOpen] = useState(isLast)

  const { label, ordenes, prendas, envios, bruto, comision, neto, comPct,
          payouts, payoutTotal, cerrado, subPeriodos, balanceInicial } = datos

  // Para el bloque histórico (Dic-Mar), el saldo al cierre ES el balance inicial
  // ya que los payouts de Mar ya están descontados en ese balance
  const saldoMes = isFirst
    ? balanceInicial   // el balance inicial YA incluye los retiros de Mar/Abr1
    : saldoAnterior + neto - payoutTotal

  const signoPos = saldoMes >= 0
  const netoPos  = neto >= 0

  return (
    <div className="relative">
      {/* Conector vertical entre meses */}
      {!isLast && (
        <div
          className="absolute left-[22px] top-full z-10 w-0.5"
          style={{ height: 28, background: 'linear-gradient(to bottom, #d1d5db, #f3f4f6)' }}
        />
      )}

      <div className={`rounded-2xl border shadow-sm overflow-hidden transition-all
        ${isLast ? 'ring-2 ring-orange-400/40 shadow-orange-100' : ''}`}>

        {/* ── Header ── */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors
            ${isFirst
              ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white'
              : isLast
                ? 'bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100'
                : 'bg-white hover:bg-gray-50'
            }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Dot de estado */}
            <div className={`flex-shrink-0 w-3 h-3 rounded-full
              ${isFirst   ? 'bg-gray-400' :
                cerrado   ? 'bg-green-400' :
                            'bg-orange-400 animate-pulse'}`}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`font-black text-sm truncate ${isFirst ? 'text-white' : 'text-gray-800'}`}>
                  {label}
                </span>
                {isFirst && (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-700 rounded-full px-2 py-0.5">HISTÓRICO</span>
                )}
                {!isFirst && cerrado && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                    <Lock className="w-2.5 h-2.5" /> Cerrado
                  </span>
                )}
                {!isFirst && !cerrado && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                    <AlertCircle className="w-2.5 h-2.5" /> En curso
                  </span>
                )}
                {!isFirst && comPct && (
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                    Com. {comPct}%
                  </span>
                )}
              </div>
              {ordenes > 0 && (
                <span className={`text-[10px] ${isFirst ? 'text-gray-400' : 'text-gray-400'}`}>
                  {ordenes} orden{ordenes !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Saldo al cierre */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isFirst ? 'text-gray-400' : 'text-gray-400'}`}>
                {isFirst ? 'Balance inicial' : 'Saldo cierre'}
              </p>
              <p className={`text-lg font-black leading-none mt-0.5
                ${isFirst ? 'text-green-400' : signoPos ? 'text-green-600' : 'text-red-500'}`}>
                {fmt(saldoMes)}
              </p>
            </div>
            {open
              ? <ChevronUp  className={`w-4 h-4 flex-shrink-0 ${isFirst ? 'text-gray-400' : 'text-gray-400'}`} />
              : <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isFirst ? 'text-gray-400' : 'text-gray-400'}`} />}
          </div>
        </button>

        {/* ── Cuerpo expandible ── */}
        {open && (
          <div className="bg-white border-t px-5 py-4 space-y-3 text-xs">

            {isFirst ? (
              /* ──────────────── BLOQUE HISTÓRICO DIC-MAR ──────────────── */
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs leading-relaxed">
                  <strong>📋 Datos históricos</strong> — Las ventas de Dic 2025 a Mar 2026 se procesaron en el sistema anterior.
                  El saldo resultante de ese periodo fue certificado por Colivery al 1 de Abril 2026.
                </div>

                <div className="flex justify-between items-center py-2.5 border-b">
                  <span className="text-gray-600 font-medium">Saldo certificado al 1 Abr 2026</span>
                  <span className="text-base font-black text-green-600">{fmt(balanceInicial)}</span>
                </div>

                {/* Payouts pre-periodo - informativos, ya descontados */}
                {payouts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Retiros realizados (ya descontados en el balance)
                    </p>
                    {payouts.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50">
                        <div className="text-gray-500">
                          <span className="font-medium">{p.fecha}</span>
                          {p.hora && <span className="text-gray-400"> · {p.hora}</span>}
                          <span className="text-gray-400"> · {p.tienda || 'general'}</span>
                        </div>
                        <span className="font-bold text-red-400">−{fmt(p.monto)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-gray-500 font-bold pt-0.5">
                      <span>Total retirado (pre-periodo)</span>
                      <span className="text-red-400">−{fmt(payouts.reduce((s,p)=>s+(p.monto||0),0))}</span>
                    </div>
                  </div>
                )}

                <div className={`flex justify-between items-center font-black text-sm rounded-xl px-3 py-2.5
                  ${balanceInicial >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Balance al inicio de Abril</span>
                  <span className="text-base">{fmt(balanceInicial)}</span>
                </div>
              </div>

            ) : (
              /* ──────────────── BLOQUE NORMAL DE MES ──────────────── */
              <div className="space-y-2">

                {/* Sub-periodos (Mayo tiene 2: 1-27 al 20%, 28-31 al 10%) */}
                {subPeriodos && subPeriodos.length > 1 ? (
                  <div className="space-y-2.5">
                    {subPeriodos.map((sp, i) => (
                      <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {sp.label} · {sp.ordenes} órdenes · Comisión Colivery {sp.pct}%
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <Row label="Prendas"              val={fmt(sp.prendas)} />
                          <Row label="Envíos cobrados"       val={fmt(sp.envios)} />
                          <Row label={`Comisión ${sp.pct}%`} val={`−${fmt(sp.prendas * sp.pct/100)}`} red />
                          <Row label="Cobranza envíos"        val={`−${fmt(sp.envios)}`} red />
                        </div>
                        <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-200">
                          <span className="text-gray-700">Neto ({100-sp.pct}%)</span>
                          <span className="text-green-600">{fmt(sp.prendas*(1-sp.pct/100) - sp.envios)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Mes sin split */
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5">
                    <Row label="Ventas brutas"   val={fmt(bruto)} bold />
                    <Row label="· Prendas"        val={fmt(prendas)} indent />
                    <Row label="· Envíos cobrados" val={fmt(envios)} indent />
                    {comPct > 0 && <>
                      <div className="border-t border-gray-200 my-1" />
                      <Row label={`Comisión Colivery (${comPct}%)`} val={`−${fmt(comision)}`} red />
                      <Row label="Cobranza envíos"  val={`−${fmt(envios)}`} red />
                      <div className="border-t border-gray-200 my-1" />
                      <Row label={`Neto La Cotorrisa (${100-comPct}%)`} val={fmt(neto)} green bold />
                    </>}
                  </div>
                )}

                {/* Saldo que viene del mes anterior */}
                <div className="flex justify-between text-gray-400 text-xs px-1">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Saldo arrastrado</span>
                  <span className="font-semibold">{fmt(saldoAnterior)}</span>
                </div>

                {/* ── PAYOUTS DEL MES ── */}
                <div className={`rounded-xl border p-3 space-y-1.5
                  ${payouts.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    💸 Retiros del mes
                  </p>
                  {payouts.length === 0 ? (
                    <p className="text-gray-400 text-xs">Sin retiros este mes</p>
                  ) : (
                    <>
                      {payouts.map((p, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-red-100/60">
                          <div className="text-gray-600">
                            <span className="font-semibold">{p.fecha}</span>
                            {p.hora && <span className="text-gray-400"> · {p.hora}</span>}
                            {p.referencia && <span className="text-gray-400"> · {p.referencia}</span>}
                          </div>
                          <span className="font-black text-red-600">−{fmt(p.monto)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-black text-xs text-red-700 pt-1">
                        <span>Total retirado</span>
                        <span>−{fmt(payoutTotal)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Saldo al cierre */}
                <div className={`flex justify-between items-center text-sm font-black rounded-xl px-4 py-3
                  ${signoPos ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Saldo al cierre del mes</span>
                  <span className="text-base">{fmt(saldoMes)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper visual
const Row = ({ label, val, bold, red, green, indent }) => (
  <div className={`flex justify-between ${indent ? 'pl-3' : ''}`}>
    <span className={`${bold ? 'font-bold text-gray-700' : 'text-gray-500'}`}>{label}</span>
    <span className={`font-${bold ? 'black' : 'semibold'} ${red ? 'text-red-500' : green ? 'text-green-600' : 'text-gray-700'}`}>
      {val}
    </span>
  </div>
)

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Canal separado (Exclusivos / Eventos)
// ══════════════════════════════════════════════════════════════════════════════
const CanalCard = ({ canal, cortes, transferencias }) => {
  const [open, setOpen] = useState(false)
  const { key, label, icon, gradFrom, gradTo, netoFn, ventasFn } = canal

  const cortesCanal = cortes.filter(c =>
    key === 'exclusivos' ? (c.ventas_exclusivos || 0) > 0 :
    key === 'eventos'    ? (c.ventas_eventos    || 0) > 0 : false
  )
  const pagos    = transferencias.filter(t => t.tienda === key)
  const ventas   = cortesCanal.reduce((s, c) => s + ventasFn(c), 0)
  const neto     = cortesCanal.reduce((s, c) => s + netoFn(c), 0)
  const pagado   = pagos.reduce((s, t) => s + (t.monto || 0), 0)
  const saldo    = neto - pagado

  if (ventas === 0) return null

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left bg-gradient-to-r ${gradFrom} ${gradTo} text-white`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <p className="font-black text-sm">{label}</p>
            <p className="text-[10px] text-white/60">
              {cortesCanal.length} periodo{cortesCanal.length !== 1 ? 's' : ''} · {fmt(ventas)} ventas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-white/60">Saldo libre</p>
            <p className="text-xl font-black leading-none mt-0.5">{fmt(saldo)}</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="bg-white border-t px-5 py-4 space-y-3 text-xs">
          {/* Periodos */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Periodos cerrados</p>
            {cortesCanal.map((c, i) => (
              <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1">
                <p className="text-[10px] text-gray-400 font-semibold">{c.fecha_inicio} → {c.fecha_fin}</p>
                <div className="flex justify-between font-bold">
                  <span className="text-gray-600">Neto</span>
                  <span className="text-green-600">{fmt(netoFn(c))}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between font-black text-gray-700 pt-1 border-t">
              <span>Neto total</span>
              <span className="text-green-600">{fmt(neto)}</span>
            </div>
          </div>

          {/* Payouts */}
          <div className={`rounded-xl border p-3 space-y-1.5 ${pagos.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">💸 Retiros</p>
            {pagos.length === 0
              ? <p className="text-gray-400">Sin retiros registrados</p>
              : <>
                  {pagos.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-red-100/60">
                      <span className="text-gray-600 font-medium">{p.fecha}{p.hora ? ` · ${p.hora}` : ''}</span>
                      <span className="font-black text-red-600">−{fmt(p.monto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-black text-red-700 pt-1">
                    <span>Total retirado</span>
                    <span>−{fmt(pagado)}</span>
                  </div>
                </>
            }
          </div>

          <div className={`flex justify-between font-black text-sm rounded-xl px-4 py-3
            ${saldo >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            <span>Saldo libre</span>
            <span className="text-base">{fmt(saldo)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: MiCartera
// ══════════════════════════════════════════════════════════════════════════════
export const MiCartera = ({ clienteIdOverride }) => {
  const { perfil }  = useAuth()
  const navigate    = useNavigate()

  const [loading,        setLoading]        = useState(true)
  const [syncing,        setSyncing]        = useState(false)
  const [clienteNombre,  setClienteNombre]  = useState('La Cotorrisa')
  const [balanceInicial, setBalanceInicial] = useState(31154.20)
  const [trazabilidad,   setTrazabilidad]   = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [cortes,         setCortes]         = useState([])
  const [lastSync,       setLastSync]       = useState(() => localStorage.getItem('cartera_last_sync') || null)

  const effectiveClienteId = clienteIdOverride || perfil?.cliente_id

  useEffect(() => { if (effectiveClienteId) fetchData() }, [effectiveClienteId])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    const toastId = toast.loading('🔄 Sincronizando ventas desde Colivery...')
    try {
      const res  = await fetch('/api/sync-full?full=1')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en servidor')
      const ahora = new Date().toLocaleTimeString('es-MX', {
        timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit'
      })
      setLastSync(ahora)
      localStorage.setItem('cartera_last_sync', ahora)
      const { trazabilidad_nuevas = 0, payouts_nuevos = 0 } = data.resultados || {}
      toast.success(
        trazabilidad_nuevas + payouts_nuevos === 0
          ? '✅ Al día — sin cambios nuevos'
          : `✅ ${trazabilidad_nuevas} ventas · ${payouts_nuevos} payouts actualizados`,
        { id: toastId, duration: 4000 }
      )
      await fetchData()
    } catch (err) {
      toast.error('Error al sincronizar: ' + err.message, { id: toastId })
    } finally {
      setSyncing(false)
    }
  }, [effectiveClienteId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cliRes, cortesRes, transRes, trazRes] = await Promise.all([
        supabase.from('clientes').select('nombre,saldo,balance_inicial').eq('id', effectiveClienteId).single(),
        supabase.from('cliente_cortes_balance').select('*').eq('cliente_id', effectiveClienteId).order('fecha_inicio'),
        supabase.from('cliente_transferencias').select('*').eq('cliente_id', effectiveClienteId).order('fecha'),
        supabase.from('trazabilidad_guias')
          .select('fecha_compra,precio_tienda,precio_envio')
          .eq('cliente_id', effectiveClienteId)
          .ilike('numero_pedido', 'MX-%')
          .gte('fecha_compra', '2026-04-01')
          .order('fecha_compra'),
      ])
      setClienteNombre(cliRes.data?.nombre || 'La Cotorrisa')
      setBalanceInicial(cliRes.data?.balance_inicial || 31154.20)
      setCortes(cortesRes.data || [])
      setTransferencias(transRes.data || [])
      setTrazabilidad(trazRes.data || [])
    } catch (err) {
      toast.error('Error al cargar datos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Construir meses de tienda general ──────────────────────────────────────
  const buildMeses = () => {
    // Payouts pre-periodo (ya baked-in en balance_inicial)
    const preIds = new Set(
      transferencias
        .filter(t => (t.tienda || 'general') === 'general' && t.fecha <= '2026-04-01')
        .map(t => t.id)
    )

    // Agrupar trazabilidad por mes
    const trazPorMes = {}
    trazabilidad.forEach(r => {
      const mes = r.fecha_compra?.slice(0, 7)
      if (!mes) return
      if (!trazPorMes[mes]) trazPorMes[mes] = { prendas: 0, envios: 0, ordenes: 0 }
      trazPorMes[mes].prendas += parseFloat(r.precio_tienda || 0)
      trazPorMes[mes].envios  += parseFloat(r.precio_envio  || 0)
      trazPorMes[mes].ordenes++
    })

    // Payouts tienda general por mes (excluir pre-periodo que ya están en bal.ini)
    const payoutsPorMes = {}
    transferencias
      .filter(t => (t.tienda || 'general') === 'general' && !preIds.has(t.id))
      .forEach(t => {
        const mes = t.fecha?.slice(0, 7)
        if (!mes) return
        if (!payoutsPorMes[mes]) payoutsPorMes[mes] = []
        payoutsPorMes[mes].push(t)
      })

    const hoy = toISO(new Date()).slice(0, 7)
    const todos = [...new Set([
      '2026-04', '2026-05', '2026-06',
      ...Object.keys(trazPorMes),
      ...Object.keys(payoutsPorMes),
    ])].sort()

    return todos.map(mes => {
      const [yy, mm]    = mes.split('-')
      const traz        = trazPorMes[mes] || { prendas: 0, envios: 0, ordenes: 0 }
      const pays        = payoutsPorMes[mes] || []
      const payoutTotal = pays.reduce((s, p) => s + (p.monto || 0), 0)
      const isHoy       = mes === hoy
      const isMayo      = mes === '2026-05'

      let subPeriodos = null
      let prendas = traz.prendas, envios = traz.envios
      let comision = 0, neto = 0, comPct = null

      if (isMayo) {
        // Split: May 1-27 @ 20%  +  May 28-31 @ 10%
        const a = trazabilidad.filter(r => r.fecha_compra >= '2026-05-01' && r.fecha_compra <= '2026-05-27')
        const b = trazabilidad.filter(r => r.fecha_compra >= '2026-05-28' && r.fecha_compra <= '2026-05-31')
        const sp1 = {
          label: 'May 1 – 27', pct: 20, ordenes: a.length,
          prendas: a.reduce((s,r) => s+parseFloat(r.precio_tienda||0), 0),
          envios:  a.reduce((s,r) => s+parseFloat(r.precio_envio ||0), 0),
        }
        const sp2 = {
          label: 'May 28 – 31', pct: 10, ordenes: b.length,
          prendas: b.reduce((s,r) => s+parseFloat(r.precio_tienda||0), 0),
          envios:  b.reduce((s,r) => s+parseFloat(r.precio_envio ||0), 0),
        }
        subPeriodos = [sp1, sp2].filter(sp => sp.prendas > 0 || sp.ordenes > 0)
        comision    = sp1.prendas * 0.20 + sp2.prendas * 0.10
        neto        = sp1.prendas * 0.80 - sp1.envios + sp2.prendas * 0.90 - sp2.envios
        comPct      = null // mixed
      } else {
        const rate = mes >= '2026-06' ? 10 : mes >= '2026-04' ? 20 : 0
        comPct      = rate || null
        comision    = prendas * rate / 100
        neto        = prendas * (1 - rate / 100) - envios
      }

      return {
        mesKey: mes,
        label:  nomMes(yy, mm),
        ordenes: traz.ordenes,
        prendas, envios,
        bruto: prendas + envios,
        comision, neto, comPct,
        payouts: pays,
        payoutTotal,
        cerrado: mes < hoy,
        subPeriodos,
      }
    })
  }

  const meses = buildMeses()

  // Payouts pre-periodo informativos (para el bloque Dic-Mar)
  const payoutsPrePeriodo = transferencias.filter(t =>
    (t.tienda || 'general') === 'general' && t.fecha <= '2026-04-01'
  )

  // Saldo acumulado final (tienda general)
  const saldoTiendaFinal = meses.reduce((acc, m) => acc + m.neto - m.payoutTotal, balanceInicial)

  // Otros canales
  const exclNeto   = cortes.reduce((s,c) => s+((c.ventas_exclusivos||0)-(c.costo_administracion||0)-(c.pasarela_pagos||0)-(c.costo_software||0)), 0)
  const exclPagado = transferencias.filter(t => t.tienda==='exclusivos').reduce((s,t) => s+(t.monto||0), 0)
  const evNeto     = cortes.reduce((s,c) => s+((c.ventas_eventos||0)-(c.comision_eventos||0)), 0)
  const evPagado   = transferencias.filter(t => t.tienda==='eventos').reduce((s,t) => s+(t.monto||0), 0)

  const saldoTotalReal = saldoTiendaFinal + (exclNeto-exclPagado) + (evNeto-evPagado)
  const totalPagado    = transferencias.reduce((s,t) => s+(t.monto||0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Running saldo tracker para el render
  let saldoCorriente = balanceInicial

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-orange-500" /> Mi Cartera
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Estado de cuenta mensual · {clienteNombre}</p>
          {lastSync && (
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Última sync: {lastSync}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={() => navigate('/cliente/retiro')}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow"
          >
            <ArrowUpRight className="w-4 h-4" /> Solicitar Retiro
          </button>
        </div>
      </div>

      {/* ── Hero: saldo total ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-2xl p-7 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/5 rounded-full blur-xl" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">
                Saldo Disponible Total
              </p>
              <h1 className={`text-4xl font-black tracking-tight ${saldoTotalReal >= 0 ? 'text-white' : 'text-red-400'}`}>
                {fmt(saldoTotalReal)}
              </h1>
              <p className="text-xs text-gray-400 mt-2">{clienteNombre} · {meses.length} meses de tienda</p>
            </div>
            <TrendingUp className="w-12 h-12 text-orange-400/20" />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/10">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Balance Inicial Abr 1</p>
              <p className="text-lg font-black text-white mt-0.5">{fmt(balanceInicial)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total Retirado</p>
              <p className="text-lg font-black text-orange-400 mt-0.5">{fmt(totalPagado)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Excl. + Eventos</p>
              <p className="text-lg font-black text-white mt-0.5">{fmt((exclNeto-exclPagado)+(evNeto-evPagado))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIMELINE TIENDA GENERAL ── */}
      <div>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-3">
          <span className="flex-shrink-0">Tienda General — Estado de Cuenta Mensual</span>
          <span className="flex-1 h-px bg-gray-100" />
        </h3>

        <div className="space-y-7">
          {/* Bloque histórico Dic-Mar */}
          <MesCard
            datos={{
              label: 'Dic 2025 – Mar 2026',
              balanceInicial,
              ordenes: 0, prendas: 0, envios: 0, bruto: 0,
              comision: 0, neto: balanceInicial, comPct: 0,
              cerrado: true, subPeriodos: null,
              payouts: payoutsPrePeriodo,
              payoutTotal: 0,  // NO restar — ya están en balanceInicial
            }}
            saldoAnterior={0}
            isFirst
            isLast={false}
          />

          {/* Meses reales (Abr, May, Jun…) */}
          {meses.map((m, i) => {
            const saldoAnt  = saldoCorriente
            saldoCorriente  = saldoAnt + m.neto - m.payoutTotal
            return (
              <MesCard
                key={m.mesKey}
                datos={m}
                saldoAnterior={saldoAnt}
                isFirst={false}
                isLast={i === meses.length - 1}
              />
            )
          })}
        </div>
      </div>

      {/* ── OTROS CANALES ── */}
      {(exclNeto > 0 || evNeto > 0) && (
        <div>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-3">
            <span className="flex-shrink-0">Otros Canales</span>
            <span className="flex-1 h-px bg-gray-100" />
          </h3>
          <div className="space-y-3">
            {[
              {
                key:'exclusivos', label:'Exclusivos', icon:'⭐',
                gradFrom:'from-purple-600', gradTo:'to-pink-700',
                netoFn:  c => (c.ventas_exclusivos||0)-(c.costo_administracion||0)-(c.pasarela_pagos||0)-(c.costo_software||0),
                ventasFn: c => c.ventas_exclusivos||0,
              },
              {
                key:'eventos', label:'Eventos', icon:'🎪',
                gradFrom:'from-orange-500', gradTo:'to-amber-600',
                netoFn:  c => (c.ventas_eventos||0)-(c.comision_eventos||0),
                ventasFn: c => c.ventas_eventos||0,
              },
            ].map(canal => (
              <CanalCard key={canal.key} canal={canal} cortes={cortes} transferencias={transferencias} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
