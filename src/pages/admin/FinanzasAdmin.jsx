import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CheckCircle2, XCircle, Clock, TrendingUp,
  ChevronDown, ChevronUp, Send, RefreshCw,
  DollarSign, ArrowUpRight, Paperclip, Upload, Trash2,
  Store, Star, PartyPopper, Edit3, Save, AlertTriangle,
  PenLine, ShieldCheck, BarChart3
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/card'
import { toast } from 'sonner'

const COTORRISA_ID = '1882e9a0-4dc0-4a03-96e4-ffa5712cda09'

const fmt     = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
const today   = () => new Date().toISOString().split('T')[0]
const nowTime = () => new Date().toTimeString().slice(0, 5)
const clean   = s => (s || '').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\u00FF\u0100-\u017F]/g, '').trim()

const TIENDAS = [
  { key: 'general',    label: 'Tienda General', icon: <Store    className="w-4 h-4" /> },
  { key: 'exclusivos', label: 'Exclusivos',      icon: <Star     className="w-4 h-4" /> },
  { key: 'eventos',    label: 'Eventos',         icon: <PartyPopper className="w-4 h-4" /> },
]

const BADGE = {
  pendiente: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  aprobado:  { label: 'Aprobado',  cls: 'bg-blue-100   text-blue-800   border-blue-200'   },
  pagado:    { label: 'Pagado',    cls: 'bg-green-100  text-green-800  border-green-200'  },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100    text-red-800    border-red-200'    },
}

// ── Modal: Aprobar y Registrar Pago ─────────────────────────────────────────
const ModalPago = ({ solicitud, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    tienda: 'general', fecha: today(), hora: nowTime(),
    destinatario: solicitud?.nombre_beneficiario || '',
    referencia: '',
    monto: solicitud?.monto_total || solicitud?.monto_solicitado || 0,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePagar = async () => {
    if (!form.monto || parseFloat(form.monto) <= 0) return toast.error('Monto invalido')
    setSaving(true)
    try {
      const { error: e1 } = await supabase.from('cliente_transferencias').insert({
        cliente_id: solicitud.cliente_id, fecha: form.fecha, hora: form.hora,
        monto: parseFloat(form.monto), tienda: form.tienda,
        destinatario: form.destinatario,
        referencia: form.referencia || `Retiro aprobado #${solicitud.id.slice(0, 8)}`,
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('solicitudes_retiro').update({
        estado: 'pagado',
        nota_admin: `Pagado el ${form.fecha} a las ${form.hora}. Canal: ${form.tienda}.`,
        updated_at: new Date().toISOString(),
      }).eq('id', solicitud.id)
      if (e2) throw e2
      toast.success(`Pago de ${fmt(form.monto)} registrado`)
      onSuccess()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" /> Aprobar y Pagar
          </h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 border">
            <div className="flex justify-between"><span className="text-gray-500">Beneficiario</span><span className="font-bold">{solicitud.nombre_beneficiario}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Banco</span><span className="font-bold">{solicitud.banco}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CLABE</span><span className="font-mono text-xs">{solicitud.clabe_tarjeta}</span></div>
            {solicitud.con_iva && <div className="flex justify-between text-orange-600"><span>IVA {solicitud.porcentaje_iva}%</span><span className="font-bold">{fmt(solicitud.monto_iva)}</span></div>}
            <div className="flex justify-between font-black text-gray-900 border-t pt-1.5">
              <span>Total a pagar</span><span className="text-green-700 text-base">{fmt(solicitud.monto_total || solicitud.monto_solicitado)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Canal</label>
            <div className="flex gap-2">
              {TIENDAS.map(t => (
                <button key={t.key} onClick={() => set('tienda', t.key)}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-1 ${form.tienda === t.key ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Hora</label>
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Monto (MXN)</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" /></div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Referencia</label>
            <input type="text" value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="Numero de operacion, concepto..." className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={handlePagar} disabled={saving}
            className="flex-1 py-2.5 text-sm font-black text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Procesando...</> : <><CheckCircle2 className="w-4 h-4" />Confirmar Pago</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Payout Manual ─────────────────────────────────────────────────────
const ModalPayoutManual = ({ clientes, clientePresel, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    cliente_id: clientePresel?.id || '',
    tienda: 'general', fecha: today(), hora: nowTime(),
    monto: '', destinatario: '', referencia: '',
  })
  const [archivo, setArchivo] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleArchivo = e => {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['jpg','jpeg','png','pdf'].includes(ext)) return toast.error('Solo JPG, PNG o PDF')
    if (f.size > 5 * 1024 * 1024) return toast.error('Max 5 MB')
    setArchivo(f)
  }

  const handleGuardar = async () => {
    if (!form.cliente_id) return toast.error('Selecciona un cliente')
    if (!form.monto || parseFloat(form.monto) <= 0) return toast.error('Monto invalido')
    setSaving(true)
    try {
      const { data: trans, error } = await supabase.from('cliente_transferencias').insert({
        cliente_id: form.cliente_id, fecha: form.fecha, hora: form.hora,
        monto: parseFloat(form.monto), tienda: form.tienda,
        destinatario: form.destinatario || null,
        referencia: form.referencia || null,
      }).select().single()
      if (error) throw error

      if (archivo && trans?.id) {
        const ext  = archivo.name.split('.').pop().toLowerCase()
        const path = `comprobantes/${form.cliente_id}/${trans.id}.${ext}`
        const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, archivo, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
          await supabase.from('cliente_transferencias').update({
            comprobante_url:    urlData.publicUrl,
            comprobante_nombre: archivo.name,
          }).eq('id', trans.id)
        }
      }
      toast.success(`Payout de ${fmt(form.monto)} registrado${archivo ? ' con comprobante' : ''}`)
      onSuccess()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-orange-500" /> Registrar Payout
          </h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 font-medium">
            Este payout se restara del saldo del cliente al confirmar.
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Cliente *</label>
            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} — {fmt(c.saldo)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Canal</label>
            <div className="flex gap-2">
              {TIENDAS.map(t => (
                <button key={t.key} onClick={() => set('tienda', t.key)}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-1 ${form.tienda === t.key ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Hora</label>
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Monto (MXN) *</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" /></div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Destinatario</label>
            <input type="text" value={form.destinatario} onChange={e => set('destinatario', e.target.value)} placeholder="A quien se realizo el pago" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Referencia</label>
            <input type="text" value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="Numero de operacion..." className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Comprobante (JPG, PNG, PDF)</label>
            {archivo ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-green-700 font-medium">
                  <Paperclip className="w-4 h-4" /><span className="truncate max-w-[200px]">{archivo.name}</span>
                </div>
                <button onClick={() => setArchivo(null)} className="text-red-400 hover:text-red-600 text-xs font-bold ml-2">Quitar</button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-orange-400 rounded-lg py-4 cursor-pointer transition-all group">
                <Upload className="w-5 h-5 text-gray-300 group-hover:text-orange-400" />
                <span className="text-xs text-gray-400 group-hover:text-orange-500 font-medium">Haz clic para subir comprobante</span>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleArchivo} />
              </label>
            )}
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-2.5 text-sm font-black text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</> : <><Send className="w-4 h-4" />Registrar Payout</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Agregar Saldo (corte manual) ──────────────────────────────────────
const ModalAgregarSaldo = ({ clientes, clientePresel, onClose, onSuccess }) => {
  const [clienteId, setClienteId] = useState(clientePresel?.id || '')
  const [canal, setCanal]         = useState('general')
  const [fechaInicio, setFI]      = useState(today())
  const [fechaFin,    setFF]      = useState(today())
  const [referencia,  setRef]     = useState('')
  const [saving, setSaving]       = useState(false)

  const [gen,  setGen]  = useState({ bruto: '', comision_pct: 20, envios: '' })
  const [excl, setExcl] = useState({ bruto: '', plataforma: '', pasarela: '', envios: '' })
  const [evt,  setEvt]  = useState({ bruto: '', comision_mp: '' })

  const setG = (k, v) => setGen(p  => ({ ...p, [k]: v }))
  const setE = (k, v) => setExcl(p => ({ ...p, [k]: v }))
  const setV = (k, v) => setEvt(p  => ({ ...p, [k]: v }))

  const netoGen  = parseFloat(gen.bruto  || 0) * (1 - parseFloat(gen.comision_pct || 0) / 100) - parseFloat(gen.envios || 0)
  const netoExcl = parseFloat(excl.bruto || 0) - parseFloat(excl.plataforma || 0) - parseFloat(excl.pasarela || 0) - parseFloat(excl.envios || 0)
  const netoEvt  = parseFloat(evt.bruto  || 0) - parseFloat(evt.comision_mp  || 0)
  const netoTotal = canal === 'general' ? netoGen : canal === 'exclusivos' ? netoExcl : netoEvt

  const handleGuardar = async () => {
    if (!clienteId) return toast.error('Selecciona un cliente')
    if (netoTotal <= 0) return toast.error('El neto debe ser mayor a $0')
    setSaving(true)
    try {
      let payload = {
        cliente_id: clienteId, fecha_inicio: fechaInicio, fecha_fin: fechaFin,
        referencia: referencia || `Corte manual ${canal} — ${fechaInicio}`,
        neto_favor: netoTotal,
        ventas_general: 0, comision_colivery: 0, gastos_adicionales: 0,
        ventas_exclusivos: 0, costo_administracion: 0, pasarela_pagos: 0, costo_software: 0,
        ventas_eventos: 0, comision_eventos: 0,
      }
      if (canal === 'general') {
        payload.ventas_general    = parseFloat(gen.bruto || 0)
        payload.comision_colivery = parseFloat(gen.bruto || 0) * parseFloat(gen.comision_pct || 0) / 100
        payload.gastos_adicionales= parseFloat(gen.envios || 0)
      } else if (canal === 'exclusivos') {
        payload.ventas_exclusivos    = parseFloat(excl.bruto || 0)
        payload.costo_administracion = parseFloat(excl.plataforma || 0)
        payload.pasarela_pagos       = parseFloat(excl.pasarela || 0)
        payload.costo_software       = parseFloat(excl.envios || 0)
      } else {
        payload.ventas_eventos   = parseFloat(evt.bruto || 0)
        payload.comision_eventos = parseFloat(evt.comision_mp || 0)
      }
      const { error } = await supabase.from('cliente_cortes_balance').insert(payload)
      if (error) throw error
      toast.success(`Saldo de ${fmt(netoTotal)} agregado al balance`)
      onSuccess()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" /> Agregar Saldo al Balance
          </h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-medium">
            Agrega un nuevo corte de ventas. El saldo neto calculado se sumara al balance del cliente.
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} — Saldo: {fmt(c.saldo)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Canal *</label>
            <div className="flex gap-2">
              {TIENDAS.map(t => (
                <button key={t.key} onClick={() => setCanal(t.key)}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${canal === t.key ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Periodo inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFI(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Periodo fin</label>
              <input type="date" value={fechaFin} onChange={e => setFF(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Referencia</label>
            <input type="text" value={referencia} onChange={e => setRef(e.target.value)} placeholder="Ej: Reporte Dopo Abril, Ventas Evento Tijuana..." className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-black text-gray-700 uppercase tracking-wider">Datos de Ventas — {TIENDAS.find(t => t.key === canal)?.label}</p>
            {canal === 'general' && (
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Ventas brutas (MXN)</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" value={gen.bruto} onChange={e => setG('bruto', e.target.value)} placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" /></div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-gray-600 block mb-1">Comision (%)</label>
                    <input type="number" value={gen.comision_pct} onChange={e => setG('comision_pct', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" /></div>
                  <div><label className="text-xs font-bold text-gray-600 block mb-1">Costos envio (MXN)</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input type="number" value={gen.envios} onChange={e => setG('envios', e.target.value)} placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" /></div></div>
                </div>
              </div>
            )}
            {canal === 'exclusivos' && (
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Ventas brutas (MXN)</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" value={excl.bruto} onChange={e => setE('bruto', e.target.value)} placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" /></div></div>
                <div className="grid grid-cols-3 gap-2">
                  {[['plataforma','Plataforma'],['pasarela','Pasarela pago'],['envios','Envios']].map(([k, l]) => (
                    <div key={k}><label className="text-[10px] font-bold text-gray-600 block mb-1">{l}</label>
                      <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input type="number" value={excl[k]} onChange={e => setE(k, e.target.value)} placeholder="0" className="w-full border rounded-lg pl-5 pr-2 py-2 text-xs" /></div></div>
                  ))}
                </div>
              </div>
            )}
            {canal === 'eventos' && (
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Ventas brutas (MXN)</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" value={evt.bruto} onChange={e => setV('bruto', e.target.value)} placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" /></div></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Comision MercadoPago (MXN)</label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" value={evt.comision_mp} onChange={e => setV('comision_mp', e.target.value)} placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" /></div></div>
              </div>
            )}
          </div>
          <div className={`rounded-xl p-4 border-2 ${netoTotal > 0 ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-xs text-gray-500 font-medium">Neto que se sumara al balance</p>
            <p className={`text-3xl font-black mt-1 ${netoTotal > 0 ? 'text-green-700' : 'text-gray-400'}`}>{fmt(netoTotal)}</p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving || netoTotal <= 0}
            className="flex-1 py-2.5 text-sm font-black text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</> : <><TrendingUp className="w-4 h-4" />Agregar {fmt(netoTotal)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Editar Payout ─────────────────────────────────────────────────────
const ModalEditarPayout = ({ pago, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    monto:        pago.monto        || 0,
    fecha:        pago.fecha        || '',
    hora:         pago.hora         || '',
    destinatario: pago.destinatario || '',
    referencia:   pago.referencia   || '',
    tienda:       pago.tienda       || 'general',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleGuardar = async () => {
    if (!form.monto || parseFloat(form.monto) <= 0) return toast.error('Monto invalido')
    setSaving(true)
    try {
      const { error } = await supabase.from('cliente_transferencias').update({
        monto:        parseFloat(form.monto),
        fecha:        form.fecha,
        hora:         form.hora,
        destinatario: form.destinatario || null,
        referencia:   form.referencia   || null,
        tienda:       form.tienda,
      }).eq('id', pago.id)
      if (error) throw error
      toast.success('Payout actualizado')
      onSuccess()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-500" /> Editar Payout
          </h3>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-bold text-gray-600 block mb-1">Hora</label>
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-xs font-bold text-gray-600 block mb-1">Monto (MXN)</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" /></div></div>
          <div><label className="text-xs font-bold text-gray-600 block mb-1">Destinatario</label>
            <input type="text" value={form.destinatario} onChange={e => set('destinatario', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-bold text-gray-600 block mb-1">Referencia</label>
            <input type="text" value={form.referencia} onChange={e => set('referencia', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Canal</label>
            <div className="flex gap-2">
              {TIENDAS.map(t => (
                <button key={t.key} onClick={() => set('tienda', t.key)}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-1 ${form.tienda === t.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-2.5 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar Cambios</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pagina Principal ──────────────────────────────────────────────────────────
export const FinanzasAdmin = () => {
  const [loading,        setLoading]        = useState(true)
  const [clientes,       setClientes]       = useState([])
  const [solicitudes,    setSolicitudes]    = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [cortes,         setCortes]         = useState([])
  const [traz20,         setTraz20]         = useState({ ventas: 0, envios: 0 })
  const [traz10,         setTraz10]         = useState({ ventas: 0, envios: 0 })
  const [tab,            setTab]            = useState('cotorrisa')
  const [modalPago,      setModalPago]      = useState(null)
  const [modalPayout,    setModalPayout]    = useState(false)
  const [modalSaldo,     setModalSaldo]     = useState(false)
  const [modalEditPago,  setModalEditPago]  = useState(null)
  const [clientePresel,  setClientePresel]  = useState(null)
  const [expandido,      setExpandido]      = useState({})
  const [filtroEstado,   setFiltroEstado]   = useState('pendiente')
  const [ajuste,         setAjuste]         = useState({ campo: '', valor: '', nota: '', fecha: today() })
  const [ajustando,      setAjustando]      = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [cliRes, solRes, transRes, cortesRes, t20Res, t10Res] = await Promise.all([
      supabase.from('clientes').select('id, nombre, saldo, balance_inicial').order('nombre'),
      supabase.from('solicitudes_retiro').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('cliente_transferencias').select('*').order('fecha', { ascending: false }),
      supabase.from('cliente_cortes_balance').select('*').eq('cliente_id', COTORRISA_ID),
      supabase.from('trazabilidad_guias').select('precio_tienda, precio_envio').eq('cliente_id', COTORRISA_ID).ilike('numero_pedido', 'MX-%').gte('fecha_compra', '2026-04-01').lte('fecha_compra', '2026-05-27'),
      supabase.from('trazabilidad_guias').select('precio_tienda, precio_envio').eq('cliente_id', COTORRISA_ID).ilike('numero_pedido', 'MX-%').gte('fecha_compra', '2026-05-28'),
    ])
    setClientes(cliRes.data || [])
    setSolicitudes(solRes.data || [])
    setTransferencias(transRes.data || [])
    setCortes(cortesRes.data || [])
    const sum = (arr, f) => (arr || []).reduce((s, r) => s + parseFloat(r[f] || 0), 0)
    setTraz20({ ventas: sum(t20Res.data, 'precio_tienda'), envios: sum(t20Res.data, 'precio_envio') })
    setTraz10({ ventas: sum(t10Res.data, 'precio_tienda'), envios: sum(t10Res.data, 'precio_envio') })
    setLoading(false)
  }

  const rechazar = async id => {
    if (!window.confirm('Rechazar esta solicitud?')) return
    const { error } = await supabase.from('solicitudes_retiro').update({ estado: 'rechazado', updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Solicitud rechazada')
    fetchAll()
  }

  // ── Sync La Cotorrisa ────────────────────────────────────────────────────
  const cotorrisaTrans = transferencias.filter(t => t.cliente_id === COTORRISA_ID)
  const cotorrisa      = clientes.find(c => c.id === COTORRISA_ID)
  const balIni         = cotorrisa?.balance_inicial || 0

  const g20Neto   = traz20.ventas * 0.80
  const g20Pagado = cotorrisaTrans.filter(t => (t.tienda || 'general') === 'general' && t.fecha <= '2026-05-27').reduce((s, t) => s + (t.monto || 0), 0)
  const g20Saldo  = g20Neto + balIni - g20Pagado

  const g10Neto   = traz10.ventas * 0.90
  const g10Pagado = cotorrisaTrans.filter(t => (t.tienda || 'general') === 'general' && t.fecha >= '2026-05-28').reduce((s, t) => s + (t.monto || 0), 0)
  const g10Saldo  = g10Neto - traz10.envios - g10Pagado

  const exclNeto   = cortes.reduce((s, c) => s + ((c.ventas_exclusivos || 0) - (c.costo_administracion || 0) - (c.pasarela_pagos || 0) - (c.costo_software || 0)), 0)
  const exclPagado = cotorrisaTrans.filter(t => t.tienda === 'exclusivos').reduce((s, t) => s + (t.monto || 0), 0)
  const exclSaldo  = exclNeto - exclPagado

  const evNeto   = cortes.reduce((s, c) => s + ((c.ventas_eventos || 0) - (c.comision_eventos || 0)), 0)
  const evPagado = cotorrisaTrans.filter(t => t.tienda === 'eventos').reduce((s, t) => s + (t.monto || 0), 0)
  const evSaldo  = evNeto - evPagado

  const saldoTotal     = g20Saldo + g10Saldo + exclSaldo + evSaldo
  const totalPagadoCot = cotorrisaTrans.reduce((s, t) => s + (t.monto || 0), 0)

  // ── Ajuste manual ────────────────────────────────────────────────────────
  const handleAjuste = async () => {
    if (!ajuste.campo || !ajuste.valor) return toast.error('Completa todos los campos')
    if (!ajuste.nota) return toast.error('Escribe una nota explicativa')
    setAjustando(true)
    try {
      if (ajuste.campo === 'payout_manual') {
        const { error } = await supabase.from('cliente_transferencias').insert({
          cliente_id: COTORRISA_ID, fecha: ajuste.fecha, hora: '00:00',
          monto: Math.abs(parseFloat(ajuste.valor)),
          tienda: 'general',
          referencia: `[AJUSTE MANUAL] ${ajuste.nota}`,
          destinatario: 'Ajuste manual admin',
        })
        if (error) throw error
        toast.success('Payout manual registrado')
      } else if (ajuste.campo === 'balance_inicial') {
        const { error } = await supabase.from('clientes').update({ balance_inicial: parseFloat(ajuste.valor) }).eq('id', COTORRISA_ID)
        if (error) throw error
        toast.success('Balance inicial actualizado')
      } else if (ajuste.campo === 'corte_neto') {
        const { error } = await supabase.from('cliente_cortes_balance').insert({
          cliente_id: COTORRISA_ID, fecha_inicio: ajuste.fecha, fecha_fin: ajuste.fecha,
          referencia: `[AJUSTE MANUAL] ${ajuste.nota}`, neto_favor: parseFloat(ajuste.valor),
          ventas_general: 0, comision_colivery: 0, gastos_adicionales: 0,
          ventas_exclusivos: 0, costo_administracion: 0, pasarela_pagos: 0, costo_software: 0,
          ventas_eventos: 0, comision_eventos: 0,
        })
        if (error) throw error
        toast.success('Corte neto registrado')
      }
      setAjuste({ campo: '', valor: '', nota: '', fecha: today() })
      fetchAll()
    } catch (e) { toast.error(e.message) }
    finally { setAjustando(false) }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const pendientesCount = solicitudes.filter(s => s.estado === 'pendiente').length
  const totalSaldos     = clientes.reduce((s, c) => s + (c.saldo || 0), 0)
  const solFiltradas    = filtroEstado === 'all' ? solicitudes : solicitudes.filter(s => s.estado === filtroEstado)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-orange-500" /> Gestion Financiera
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Administra balances, payouts y solicitudes de retiro</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchAll} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-3 py-2 rounded-xl">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button onClick={() => { setClientePresel(null); setModalPayout(true) }}
            className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold text-sm px-4 py-2 rounded-xl border border-orange-200">
            <ArrowUpRight className="w-4 h-4" /> Payout Manual
          </button>
          <button onClick={() => { setClientePresel(null); setModalSaldo(true) }}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-md">
            <TrendingUp className="w-4 h-4" /> Agregar Saldo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Saldo La Cotorrisa',   value: fmt(saldoTotal),                                   from: 'from-orange-500', to: 'to-amber-600',   big: false },
          { label: 'Clientes',             value: clientes.length,                                   from: 'from-blue-600',   to: 'to-indigo-700',  big: true  },
          { label: 'Saldo Total Clientes', value: fmt(totalSaldos),                                  from: 'from-green-600',  to: 'to-emerald-700', big: false },
          { label: 'Solicitudes Pendientes',value: pendientesCount,                                  from: 'from-purple-600', to: 'to-pink-700',    big: true  },
        ].map(k => (
          <Card key={k.label} className={`border-0 shadow-sm bg-gradient-to-br ${k.from} ${k.to} text-white`}>
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{k.label}</p>
              <p className={`font-black mt-1 ${k.big ? 'text-3xl' : 'text-xl'}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          ['cotorrisa', '🧾 La Cotorrisa'],
          ['retiros',   'Solicitudes de Retiro'],
          ['clientes',  'Balances y Payouts'],
          ['historial', 'Historial de Pagos'],
          ['ajuste',    '🔧 Ajuste Manual'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-sm font-bold px-4 py-2 rounded-lg transition-all ${tab === k ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
            {k === 'retiros' && pendientesCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendientesCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: La Cotorrisa sincronizado ── */}
      {tab === 'cotorrisa' && (
        <div className="space-y-5">
          {/* Hero saldo */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0f3460] via-[#16213e] to-[#1a1a2e] rounded-2xl p-6 text-white shadow-xl">
            <div className="absolute -top-8 -right-8 w-36 h-36 bg-orange-500/10 rounded-full pointer-events-none" />
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Saldo Libre La Cotorrisa — Sincronizado en tiempo real
            </p>
            <p className={`text-5xl font-black tracking-tight ${saldoTotal >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(saldoTotal)}</p>
            <p className="text-xs text-gray-400 mt-2">Calculado desde trazabilidad + cortes + transferencias · todos los canales</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-white/10">
              {[
                { label: 'General 20%', neto: g20Neto, pagado: g20Pagado, saldo: g20Saldo, extra: `Saldo Marzo: ${fmt(balIni)}` },
                { label: 'General 10%', neto: g10Neto, pagado: g10Pagado, saldo: g10Saldo, extra: `Envios: ${fmt(traz10.envios)}` },
                { label: 'Exclusivos',  neto: exclNeto, pagado: exclPagado, saldo: exclSaldo, extra: '' },
                { label: 'Eventos',     neto: evNeto,   pagado: evPagado,   saldo: evSaldo,   extra: '' },
              ].map((c, i) => (
                <div key={i}>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">{c.label}</p>
                  <p className={`text-lg font-black mt-0.5 ${c.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(c.saldo)}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">neto: {fmt(c.neto)} · pagado: {fmt(c.pagado)}</p>
                  {c.extra && <p className="text-[9px] text-orange-400 mt-0.5">{c.extra}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Mini KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ventas brutas 20%',    value: fmt(traz20.ventas), color: 'text-blue-600',   bg: 'bg-blue-50'   },
              { label: 'Ventas brutas 10%',    value: fmt(traz10.ventas), color: 'text-teal-600',   bg: 'bg-teal-50'   },
              { label: 'Total pagado (payouts)',value: fmt(totalPagadoCot),color: 'text-red-500',    bg: 'bg-red-50'    },
              { label: 'Saldo arrastre Marzo', value: fmt(balIni),        color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border shadow-sm p-4">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{k.label}</p>
                <p className={`text-xl font-black mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Payouts realizados */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                Payouts Realizados ({cotorrisaTrans.length})
              </h3>
              <button onClick={() => { setClientePresel(cotorrisa); setModalPayout(true) }}
                className="text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Nuevo Payout
              </button>
            </div>
            {cotorrisaTrans.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">Sin payouts registrados</p>
              </div>
            ) : (
              <div className="divide-y">
                {cotorrisaTrans.map(t => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.tienda === 'exclusivos' ? 'bg-purple-100 text-purple-700' :
                          t.tienda === 'eventos'    ? 'bg-yellow-100 text-yellow-700' :
                          t.fecha >= '2026-05-28'   ? 'bg-teal-100 text-teal-700'    :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {t.tienda === 'exclusivos' ? 'Exclusivos' : t.tienda === 'eventos' ? 'Eventos' : t.fecha >= '2026-05-28' ? 'General 10%' : 'General 20%'}
                        </span>
                        <p className="text-sm font-bold text-gray-800 truncate">{clean(t.destinatario) || 'Payout'}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.fecha}{t.hora ? ' · ' + t.hora : ''}{t.referencia ? ' · ' + clean(t.referencia) : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-black text-gray-900 text-base">{fmt(t.monto)}</p>
                      {t.comprobante_url && (
                        <a href={t.comprobante_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-green-200">
                          <Paperclip className="w-3 h-3" /> Ver
                        </a>
                      )}
                      <button onClick={() => setModalEditPago(t)}
                        className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm('Eliminar este payout?')) return
                        await supabase.from('cliente_transferencias').delete().eq('id', t.id)
                        toast.success('Payout eliminado'); fetchAll()
                      }} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-5 py-3 bg-orange-50 border-t flex justify-between">
              <p className="font-black text-gray-700 text-sm">Total pagado</p>
              <p className="font-black text-orange-600">{fmt(totalPagadoCot)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Solicitudes de Retiro ── */}
      {tab === 'retiros' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[['pendiente','Pendientes'],['pagado','Pagadas'],['rechazado','Rechazadas'],['all','Todas']].map(([k, l]) => (
              <button key={k} onClick={() => setFiltroEstado(k)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${filtroEstado === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {l} <span className="opacity-70">({(k === 'all' ? solicitudes : solicitudes.filter(s => s.estado === k)).length})</span>
              </button>
            ))}
          </div>
          {solFiltradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold">Sin solicitudes {filtroEstado !== 'all' ? filtroEstado + 's' : ''}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {solFiltradas.map(sol => {
                const st   = BADGE[sol.estado] || BADGE.pendiente
                const open = expandido[sol.id]
                return (
                  <Card key={sol.id} className={`border shadow-sm overflow-hidden ${sol.estado === 'pendiente' ? 'border-orange-200 bg-orange-50/20' : 'bg-white'}`}>
                    <div className="px-5 py-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-gray-800">{sol.nombre_beneficiario}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sol.clientes?.nombre}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span>{sol.banco} · <span className="font-mono">{sol.clabe_tarjeta}</span></span>
                            <span>{sol.created_at?.slice(0, 10)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400">Total a pagar</p>
                            <p className="font-black text-lg">{fmt(sol.monto_total || sol.monto_solicitado)}</p>
                            {sol.con_iva && <p className="text-[10px] text-orange-500">+IVA {sol.porcentaje_iva}%</p>}
                          </div>
                          <button onClick={() => setExpandido(p => ({ ...p, [sol.id]: !open }))}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {sol.estado === 'pendiente' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-orange-100">
                          <button onClick={() => setModalPago(sol)}
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar y Registrar Pago
                          </button>
                          <button onClick={() => rechazar(sol.id)}
                            className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs px-4 py-2 rounded-lg">
                            <XCircle className="w-3.5 h-3.5" /> Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                    {open && (
                      <div className="px-5 pb-4 border-t bg-gray-50/50">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mt-3">
                          {[['Solicitado', fmt(sol.monto_solicitado)], ['IVA', sol.con_iva ? `${sol.porcentaje_iva}%` : 'No'], ['Total', fmt(sol.monto_total || sol.monto_solicitado)], ['Telefono', sol.telefono || '—'], ['Correo', sol.correo || '—'], ['Nota admin', sol.nota_admin || '—']].map(([k, v]) => (
                            <div key={k}><p className="text-gray-400">{k}</p><p className="font-bold text-gray-700 mt-0.5">{v}</p></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Balances y Payouts ── */}
      {tab === 'clientes' && (
        <div className="space-y-4">
          {clientes.map(cli => {
            const pagosCliente = transferencias.filter(t => t.cliente_id === cli.id)
            const open = expandido['c_' + cli.id]
            return (
              <Card key={cli.id} className="border shadow-sm bg-white overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0">
                        {cli.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-gray-800">{cli.nombre}</p>
                        <p className="text-xs text-gray-400">Balance inicial: {fmt(cli.balance_inicial)} · {pagosCliente.length} pago{pagosCliente.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Saldo disponible</p>
                        <p className={`text-2xl font-black ${(cli.saldo || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(cli.saldo)}</p>
                      </div>
                      <button onClick={() => setExpandido(p => ({ ...p, ['c_' + cli.id]: !open }))}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <button onClick={() => { setClientePresel(cli); setModalSaldo(true) }}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-2 rounded-lg">
                      <TrendingUp className="w-3.5 h-3.5" /> Agregar Saldo
                    </button>
                    <button onClick={() => { setClientePresel(cli); setModalPayout(true) }}
                      className="flex items-center gap-1.5 border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs px-3 py-2 rounded-lg">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Registrar Payout
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="border-t bg-gray-50/50 px-5 py-4">
                    <p className="text-xs font-black text-gray-600 uppercase tracking-wider mb-3">Historial de pagos</p>
                    {pagosCliente.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin pagos registrados</p>
                    ) : (
                      <div className="space-y-2">
                        {pagosCliente.slice(0, 8).map(t => (
                          <div key={t.id} className="flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-gray-700">{clean(t.destinatario) || 'Pago'}</span>
                              <span className="text-gray-400 ml-2">{t.fecha}{t.hora ? ` ${t.hora}` : ''} · {t.tienda}</span>
                            </div>
                            <span className="font-black text-gray-800">{fmt(t.monto)}</span>
                          </div>
                        ))}
                        {pagosCliente.length > 8 && <p className="text-xs text-gray-400">+{pagosCliente.length - 8} mas...</p>}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── TAB: Historial de Pagos ── */}
      {tab === 'historial' && (
        <Card className="border shadow-sm bg-white">
          <div className="px-5 py-3.5 border-b flex justify-between items-center">
            <p className="font-bold text-gray-800">Todos los pagos registrados</p>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{transferencias.length} registros</span>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {transferencias.map(t => {
              const cli = clientes.find(c => c.id === t.cliente_id)
              const inputId = `file-${t.id}`

              const handleUpload = async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const ext = file.name.split('.').pop().toLowerCase()
                if (!['jpg','jpeg','png','pdf'].includes(ext)) return toast.error('Solo JPG, PNG o PDF')
                if (file.size > 5 * 1024 * 1024) return toast.error('Max 5 MB')
                const path = `comprobantes/${t.cliente_id}/${t.id}.${ext}`
                toast.loading('Subiendo...', { id: 'upload-' + t.id })
                const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, file, { upsert: true })
                if (upErr) { toast.error('Error: ' + upErr.message, { id: 'upload-' + t.id }); return }
                const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
                await supabase.from('cliente_transferencias').update({ comprobante_url: urlData.publicUrl, comprobante_nombre: file.name }).eq('id', t.id)
                toast.success('Comprobante subido', { id: 'upload-' + t.id })
                fetchAll()
              }

              return (
                <div key={t.id} className="px-4 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{clean(t.destinatario) || 'Pago'}</p>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{cli?.nombre}</span>
                        <span className="text-[10px] text-gray-400">{t.tienda}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.fecha}{t.hora ? ' · ' + t.hora : ''}{t.referencia ? ' · ' + clean(t.referencia) : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-black text-gray-900 whitespace-nowrap">{fmt(t.monto)}</p>
                      {t.comprobante_url ? (
                        <a href={t.comprobante_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-green-200">
                          <Paperclip className="w-3.5 h-3.5" /> Ver
                        </a>
                      ) : (
                        <>
                          <label htmlFor={inputId} className="flex items-center gap-1 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 cursor-pointer">
                            <Upload className="w-3.5 h-3.5" /> Subir
                          </label>
                          <input id={inputId} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleUpload} />
                        </>
                      )}
                      <button onClick={() => setModalEditPago(t)}
                        className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm('Eliminar este pago?')) return
                        await supabase.from('cliente_transferencias').delete().eq('id', t.id)
                        toast.success('Pago eliminado'); fetchAll()
                      }} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── TAB: Ajuste Manual ── */}
      {tab === 'ajuste' && (
        <div className="space-y-5 max-w-2xl">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">Herramienta de ajuste manual</p>
              <p className="text-xs text-amber-700 mt-0.5">Usa esto cuando no tengas conexion a la base de datos o necesites corregir numeros directamente. Todos los cambios quedan registrados con nota de ajuste.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-orange-500" /> Registrar Ajuste — La Cotorrisa
            </h3>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-2">Tipo de ajuste *</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: 'payout_manual',   label: 'Payout manual',        desc: 'Registra un pago que ya se realizo fuera del sistema (descuenta del saldo)' },
                  { key: 'corte_neto',      label: 'Agregar corte neto',   desc: 'Agrega ventas/neto directamente (suma al saldo disponible)' },
                  { key: 'balance_inicial', label: 'Ajustar saldo inicial', desc: 'Modifica el balance inicial (saldo arrastre de Marzo 2026)' },
                ].map(op => (
                  <button key={op.key} onClick={() => setAjuste(p => ({ ...p, campo: op.key }))}
                    className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${ajuste.campo === op.key ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="font-bold text-gray-800 text-sm">{op.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{op.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {ajuste.campo && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Fecha</label>
                    <input type="date" value={ajuste.fecha} onChange={e => setAjuste(p => ({ ...p, fecha: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      {ajuste.campo === 'balance_inicial' ? 'Nuevo saldo inicial (MXN)' : 'Monto (MXN)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input type="number" value={ajuste.valor} onChange={e => setAjuste(p => ({ ...p, valor: e.target.value }))} placeholder="0.00" className="w-full border rounded-xl pl-7 pr-3 py-2.5 text-sm font-bold" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Nota explicativa *</label>
                  <input type="text" value={ajuste.nota} onChange={e => setAjuste(p => ({ ...p, nota: e.target.value }))} placeholder="Ej: Pago realizado por SPEI sin acceso al sistema..." className="w-full border rounded-xl px-3 py-2.5 text-sm" />
                </div>
                {ajuste.valor && (
                  <div className={`rounded-xl p-4 border-2 ${parseFloat(ajuste.valor) > 0 ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-xs text-gray-500">Efecto en saldo La Cotorrisa</p>
                    <p className={`text-2xl font-black mt-1 ${ajuste.campo === 'payout_manual' ? 'text-red-600' : 'text-green-700'}`}>
                      {ajuste.campo === 'payout_manual' ? '-' : '+'}{fmt(Math.abs(parseFloat(ajuste.valor || 0)))}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Saldo despues del ajuste: {fmt(saldoTotal + (ajuste.campo === 'payout_manual' ? -Math.abs(parseFloat(ajuste.valor || 0)) : Math.abs(parseFloat(ajuste.valor || 0))))}
                    </p>
                  </div>
                )}
                <button onClick={handleAjuste} disabled={ajustando || !ajuste.valor || !ajuste.nota}
                  className="w-full py-3 font-black text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                  {ajustando ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Aplicando...</> : <><Save className="w-4 h-4" />Aplicar Ajuste</>}
                </button>
              </>
            )}
          </div>

          {/* Historial de ajustes */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h3 className="font-bold text-gray-700 text-sm">Historial de ajustes manuales</h3>
            </div>
            <div className="divide-y max-h-64 overflow-y-auto">
              {cotorrisaTrans.filter(t => (t.referencia || '').includes('[AJUSTE MANUAL]')).length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">Sin ajustes manuales registrados</p>
              ) : (
                cotorrisaTrans.filter(t => (t.referencia || '').includes('[AJUSTE MANUAL]')).map(t => (
                  <div key={t.id} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-gray-700">{(t.referencia || '').replace('[AJUSTE MANUAL] ', '')}</p>
                      <p className="text-xs text-gray-400">{t.fecha} · {t.destinatario}</p>
                    </div>
                    <p className="font-black text-red-600">{fmt(t.monto)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      {modalPago && (
        <ModalPago solicitud={modalPago} onClose={() => setModalPago(null)}
          onSuccess={() => { setModalPago(null); fetchAll() }} />
      )}
      {modalPayout && (
        <ModalPayoutManual clientes={clientes} clientePresel={clientePresel}
          onClose={() => { setModalPayout(false); setClientePresel(null) }}
          onSuccess={() => { setModalPayout(false); setClientePresel(null); fetchAll() }} />
      )}
      {modalSaldo && (
        <ModalAgregarSaldo clientes={clientes} clientePresel={clientePresel}
          onClose={() => { setModalSaldo(false); setClientePresel(null) }}
          onSuccess={() => { setModalSaldo(false); setClientePresel(null); fetchAll() }} />
      )}
      {modalEditPago && (
        <ModalEditarPayout pago={modalEditPago} onClose={() => setModalEditPago(null)}
          onSuccess={() => { setModalEditPago(null); fetchAll() }} />
      )}
    </div>
  )
}
