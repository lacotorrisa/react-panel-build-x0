import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, DollarSign, User, Building2, CreditCard,
  Phone, Mail, Percent, CheckCircle2, AlertTriangle, ChevronLeft, Info
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/card'
import { toast } from 'sonner'

const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)

const Field = ({ label, icon: Icon, children, required }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
)

const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent placeholder-gray-400 transition-all"

export const RetiroSaldo = () => {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    nombre_beneficiario: '',
    banco: '',
    clabe_tarjeta: '',
    telefono: '',
    correo: '',
    monto_solicitado: '',
    con_iva: false,
    porcentaje_iva: 16,
  })

  const monto = parseFloat(form.monto_solicitado) || 0
  const conIva = form.con_iva
  const pctIva = parseFloat(form.porcentaje_iva) || 0

  // Cálculo: si con IVA, el monto ingresado incluye el IVA o es la base?
  // Interpretamos: el cliente pone el monto NETO a recibir, y el IVA se agrega encima
  const montoBase  = monto
  const montoIva   = conIva ? parseFloat((monto * pctIva / 100).toFixed(2)) : 0
  const montoTotal = montoBase + montoIva

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async () => {
    if (!form.nombre_beneficiario.trim()) return toast.error('Ingresa el nombre del beneficiario')
    if (!form.banco.trim())              return toast.error('Ingresa el banco')
    if (!form.clabe_tarjeta.trim())      return toast.error('Ingresa CLABE o número de tarjeta')
    if (monto <= 0)                      return toast.error('El monto debe ser mayor a $0')
    if (!perfil?.cliente_id)             return toast.error('No se encontró tu cuenta. Intenta recargar.')

    setSaving(true)
    try {
      const { error } = await supabase.from('solicitudes_retiro').insert({
        cliente_id: perfil.cliente_id,
        nombre_beneficiario: form.nombre_beneficiario.trim(),
        banco: form.banco.trim(),
        clabe_tarjeta: form.clabe_tarjeta.trim(),
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
        monto_solicitado: monto,
        con_iva: conIva,
        porcentaje_iva: conIva ? pctIva : 0,
        monto_base: montoBase,
        monto_iva: montoIva,
        monto_total: montoTotal,
        estado: 'pendiente'
      })
      if (error) throw error
      setSuccess(true)
    } catch (e) {
      toast.error('Error al enviar solicitud: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Pantalla de éxito ───
  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-5">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-800">¡Solicitud enviada!</h2>
          <p className="text-gray-500 text-sm mt-2">
            Tu solicitud de retiro por <strong className="text-gray-800">{fmt(montoTotal)}</strong> fue registrada.
            El equipo de Colivery la revisará y procesará a la brevedad.
          </p>
        </div>
        <div className="bg-gray-50 border rounded-xl p-4 text-xs text-left space-y-2 text-gray-600">
          <div className="flex justify-between"><span className="font-medium">Beneficiario</span><span>{form.nombre_beneficiario}</span></div>
          <div className="flex justify-between"><span className="font-medium">Banco</span><span>{form.banco}</span></div>
          <div className="flex justify-between"><span className="font-medium">CLABE / Tarjeta</span><span className="font-mono">{form.clabe_tarjeta}</span></div>
          <div className="flex justify-between font-bold text-gray-800 border-t pt-2">
            <span>Total a transferir</span><span className="text-green-700">{fmt(montoTotal)}</span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/cliente/cartera')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-5 py-2.5 rounded-xl transition-all">
            Ver Mi Cartera
          </button>
          <button onClick={() => { setSuccess(false); setForm({ nombre_beneficiario:'', banco:'', clabe_tarjeta:'', telefono:'', correo:'', monto_solicitado:'', con_iva:false, porcentaje_iva:16 }) }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all">
            Nueva Solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cliente/cartera')}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-orange-500" /> Solicitar Retiro de Saldo
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Completa el formulario para solicitar tu transferencia</p>
        </div>
      </div>

      {/* Aviso */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 font-medium">
          Al enviar tu solicitud, el equipo de Colivery la revisará y procesará la transferencia dentro de los próximos días hábiles. Recibirás confirmación una vez completada.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Datos del Beneficiario ── */}
        <Card className="border shadow-sm">
          <div className="px-5 py-3.5 border-b bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Datos del Beneficiario
            </h3>
          </div>
          <CardContent className="p-5 space-y-4">
            <Field label="Nombre completo" icon={User} required>
              <input className={inputCls} placeholder="Ej. Jesus Chavez Pérez"
                value={form.nombre_beneficiario} onChange={e => set('nombre_beneficiario', e.target.value)} />
            </Field>

            <Field label="Banco" icon={Building2} required>
              <input className={inputCls} placeholder="Ej. BBVA, Santander, HSBC..."
                value={form.banco} onChange={e => set('banco', e.target.value)} />
            </Field>

            <Field label="CLABE interbancaria o No. Tarjeta" icon={CreditCard} required>
              <input className={inputCls} placeholder="18 dígitos CLABE / 16 dígitos tarjeta"
                value={form.clabe_tarjeta} maxLength={18}
                onChange={e => set('clabe_tarjeta', e.target.value.replace(/\D/g, ''))} />
              <p className="text-[10px] text-gray-400 mt-1">
                CLABE: 18 dígitos · Tarjeta: 16 dígitos · Solo números
              </p>
            </Field>

            <Field label="Teléfono de contacto" icon={Phone}>
              <input className={inputCls} placeholder="Ej. 5512345678" type="tel"
                value={form.telefono} onChange={e => set('telefono', e.target.value)} />
            </Field>

            <Field label="Correo electrónico" icon={Mail}>
              <input className={inputCls} placeholder="ejemplo@correo.com" type="email"
                value={form.correo} onChange={e => set('correo', e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {/* ── Monto y IVA ── */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <div className="px-5 py-3.5 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" /> Monto a Retirar
              </h3>
            </div>
            <CardContent className="p-5 space-y-4">
              <Field label="Monto solicitado (MXN)" icon={DollarSign} required>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                  <input className={`${inputCls} pl-7`} type="number" min="0" step="0.01"
                    placeholder="0.00"
                    value={form.monto_solicitado}
                    onChange={e => set('monto_solicitado', e.target.value)} />
                </div>
              </Field>

              {/* Toggle IVA */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border">
                <div>
                  <p className="text-sm font-bold text-gray-700">¿Requiere IVA?</p>
                  <p className="text-xs text-gray-400">Actívalo si el pago lleva IVA incluido</p>
                </div>
                <button
                  onClick={() => set('con_iva', !conIva)}
                  className={`relative w-12 h-6 rounded-full transition-all ${conIva ? 'bg-orange-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${conIva ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Porcentaje de IVA */}
              {conIva && (
                <Field label="Porcentaje de IVA (%)" icon={Percent}>
                  <div className="relative">
                    <input className={`${inputCls} pr-10`} type="number" min="0" max="100" step="0.01"
                      value={form.porcentaje_iva}
                      onChange={e => set('porcentaje_iva', e.target.value)} />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">IVA estándar en México: 16%</p>
                </Field>
              )}
            </CardContent>
          </Card>

          {/* ── Desglose en tiempo real ── */}
          {monto > 0 && (
            <Card className="border-2 border-orange-200 shadow-sm bg-orange-50/30">
              <div className="px-5 py-3 border-b border-orange-200">
                <h4 className="font-bold text-orange-800 text-sm">Desglose del Monto</h4>
              </div>
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Monto base solicitado</span>
                  <span className="font-bold text-gray-800">{fmt(montoBase)}</span>
                </div>
                {conIva && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-orange-500" /> IVA ({pctIva}%)
                    </span>
                    <span className="font-bold text-orange-700">+ {fmt(montoIva)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-orange-200 flex justify-between items-center">
                  <span className="font-extrabold text-gray-800">Total a transferir</span>
                  <span className="text-2xl font-black text-orange-600">{fmt(montoTotal)}</span>
                </div>
                {conIva && (
                  <p className="text-[10px] text-gray-500 bg-white rounded-lg p-2.5 border">
                    <strong>Nota:</strong> El monto base es <strong>{fmt(montoBase)}</strong> más <strong>{fmt(montoIva)}</strong> de IVA ({pctIva}%), resultando en un total de <strong>{fmt(montoTotal)}</strong>.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botón de envío */}
          <button
            onClick={handleSubmit}
            disabled={saving || monto <= 0 || !form.nombre_beneficiario || !form.banco || !form.clabe_tarjeta}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-base rounded-xl transition-all shadow-md hover:shadow-orange-200 hover:shadow-lg flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
            ) : (
              <><ArrowUpRight className="w-5 h-5" /> Enviar Solicitud de Retiro {monto > 0 ? `· ${fmt(montoTotal)}` : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
