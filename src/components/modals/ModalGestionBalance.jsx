import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { 
  Plus, Trash2, Calendar, FileText, Upload, Check, 
  DollarSign, ArrowUpRight, ArrowDownCircle, RefreshCw 
} from 'lucide-react'
import { toast } from 'sonner'

export const ModalGestionBalance = ({ open, onOpenChange, cliente, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('payout') // 'payout' | 'corte' | 'historial'
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Listas de datos
  const [cortes, setCortes] = useState([])
  const [transferencias, setTransferencias] = useState([])

  // Formulario de Corte de Balance
  const [corteForm, setCorteForm] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    ventas_general: 0,
    ventas_exclusivos: 0,
    comision_colivery: 0,
    pasarela_pagos: 0,
    costo_administracion: 0,
    costo_software: 0,
    gastos_adicionales: 0,
    referencia: '',
    observaciones: ''
  })

  // Formulario de Payout / Transferencia
  const [payoutForm, setPayoutForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    referencia: '',
    observaciones: ''
  })
  const [archivo, setArchivo] = useState(null)

  const fetchData = async () => {
    if (!cliente) return
    setLoading(true)
    try {
      const [cortesRes, transRes] = await Promise.all([
        supabase
          .from('cliente_cortes_balance')
          .select('*')
          .eq('cliente_id', cliente.id)
          .order('fecha_fin', { ascending: false }),
        supabase
          .from('cliente_transferencias')
          .select('*')
          .eq('cliente_id', cliente.id)
          .order('fecha', { ascending: false })
      ])
      if (cortesRes.data) setCortes(cortesRes.data)
      if (transRes.data) setTransferencias(transRes.data)
    } catch (e) {
      toast.error('Error al cargar historial contable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && cliente) {
      fetchData()
      resetForms()
    }
  }, [open, cliente])

  const resetForms = () => {
    setCorteForm({
      fecha_inicio: '',
      fecha_fin: '',
      ventas_general: 0,
      ventas_exclusivos: 0,
      comision_colivery: 0,
      pasarela_pagos: 0,
      costo_administracion: 0,
      costo_software: 0,
      gastos_adicionales: 0,
      referencia: '',
      observaciones: ''
    })
    setPayoutForm({
      fecha: new Date().toISOString().split('T')[0],
      monto: 0,
      referencia: '',
      observaciones: ''
    })
    setArchivo(null)
    const fileEl = document.getElementById('comprobante-file')
    if (fileEl) fileEl.value = ''
  }

  // Auto-calcular comisión del 20% cuando cambian las ventas
  const handleVentasChange = (key, val) => {
    const nextForm = { ...corteForm, [key]: val }
    const total = parseFloat(nextForm.ventas_general || 0) + parseFloat(nextForm.ventas_exclusivos || 0)
    // Comisión sugerida del 20%
    nextForm.comision_colivery = parseFloat((total * 0.2).toFixed(2))
    setCorteForm(nextForm)
  }

  // Guardar nuevo corte de balance
  const handleGuardarCorte = async () => {
    if (!corteForm.fecha_inicio || !corteForm.fecha_fin) {
      return toast.error('Debes seleccionar las fechas de inicio y fin')
    }
    const general = parseFloat(corteForm.ventas_general) || 0
    const exclusivos = parseFloat(corteForm.ventas_exclusivos) || 0
    const comision = parseFloat(corteForm.comision_colivery) || 0
    const pasarela = parseFloat(corteForm.pasarela_pagos) || 0
    const admin = parseFloat(corteForm.costo_administracion) || 0
    const software = parseFloat(corteForm.costo_software) || 0
    const adicionales = parseFloat(corteForm.gastos_adicionales) || 0

    const netoFavor = (general + exclusivos) - (comision + pasarela + admin + software + adicionales)

    setSaving(true)
    try {
      const { error } = await supabase.from('cliente_cortes_balance').insert({
        cliente_id: cliente.id,
        fecha_inicio: corteForm.fecha_inicio,
        fecha_fin: corteForm.fecha_fin,
        ventas_general: general,
        ventas_exclusivos: exclusivos,
        comision_colivery: comision,
        pasarela_pagos: pasarela,
        costo_administracion: admin,
        costo_software: software,
        gastos_adicionales: adicionales,
        neto_favor: netoFavor,
        referencia: corteForm.referencia.trim() || null,
        observaciones: corteForm.observaciones.trim() || null
      })
      if (error) throw error

      toast.success('Corte de balance registrado')
      fetchData()
      resetForms()
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error('Error al guardar corte: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Guardar nueva transferencia / payout con subida de archivo
  const handleGuardarPayout = async () => {
    const monto = parseFloat(payoutForm.monto) || 0
    if (monto <= 0) return toast.error('El monto debe ser mayor a 0')

    setSaving(true)
    let comprobanteUrl = null

    try {
      // Subir archivo al bucket 'comprobantes' de Supabase Storage
      if (archivo) {
        const fileExt = archivo.name.split('.').pop()
        const fileName = `${cliente.id}_payout_${Date.now()}.${fileExt}`

        // Nota: Asegúrate de tener el bucket 'comprobantes' creado en Supabase
        const { error: uploadError } = await supabase.storage
          .from('comprobantes')
          .upload(fileName, archivo)

        if (uploadError) {
          throw new Error('Error subiendo comprobante: ' + uploadError.message)
        }

        const { data } = supabase.storage
          .from('comprobantes')
          .getPublicUrl(fileName)

        comprobanteUrl = data?.publicUrl
      }

      const { error } = await supabase.from('cliente_transferencias').insert({
        cliente_id: cliente.id,
        fecha: payoutForm.fecha,
        monto: monto,
        referencia: payoutForm.referencia.trim() || null,
        comprobante_url: comprobanteUrl,
        observaciones: payoutForm.observaciones.trim() || null
      })

      if (error) throw error

      toast.success('Transferencia registrada exitosamente')
      fetchData()
      resetForms()
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error('Error al guardar transferencia: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Eliminar un corte de balance
  const handleDeleteCorte = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este corte? Se recalculará el saldo automáticamente.')) return
    try {
      const { error } = await supabase.from('cliente_cortes_balance').delete().eq('id', id)
      if (error) throw error
      toast.success('Corte de balance eliminado')
      fetchData()
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Eliminar una transferencia / payout
  const handleDeletePayout = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta transferencia? Se sumará de vuelta al saldo.')) return
    try {
      const { error } = await supabase.from('cliente_transferencias').delete().eq('id', id)
      if (error) throw error
      toast.success('Transferencia eliminada')
      fetchData()
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Formateador
  const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)

  if (!cliente) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold">Balance y Transacciones Contables</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">Cliente: <strong className="text-gray-800">{cliente.nombre}</strong> · Saldo actual: <strong className="text-orange-600">{fmt(cliente.saldo)}</strong></p>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('payout')} 
              className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${activeTab === 'payout' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Registrar Payout
            </button>
            <button 
              onClick={() => setActiveTab('corte')} 
              className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${activeTab === 'corte' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Corte Balance
            </button>
            <button 
              onClick={() => setActiveTab('historial')} 
              className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${activeTab === 'historial' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Ver Historial
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: REGISTRAR PAYOUT (TRANSFERENCIA) */}
          {activeTab === 'payout' && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-bold text-gray-700 text-sm border-b pb-2 flex items-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-green-600" /> Nueva Transferencia Realizada (Payout)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fecha Depósito *</Label>
                    <Input 
                      type="date" 
                      value={payoutForm.fecha} 
                      onChange={e => setPayoutForm({...payoutForm, fecha: e.target.value})} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Monto Depositado *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input 
                        type="number" 
                        min="0" 
                        placeholder="0.00" 
                        value={payoutForm.monto || ''} 
                        onChange={e => setPayoutForm({...payoutForm, monto: parseFloat(e.target.value) || 0})} 
                        className="pl-8" 
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Referencia / Código de Rastreo</Label>
                  <Input 
                    placeholder="Ej. SPEI Bancomer 23412" 
                    value={payoutForm.referencia} 
                    onChange={e => setPayoutForm({...payoutForm, referencia: e.target.value})} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Comprobante Adjunto (PDF o Imagen)</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Input 
                      id="comprobante-file"
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={e => setArchivo(e.target.files[0])}
                      className="text-xs block w-full text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Observaciones</Label>
                  <Textarea 
                    placeholder="Detalles opcionales sobre la transferencia contable..." 
                    value={payoutForm.observaciones} 
                    onChange={e => setPayoutForm({...payoutForm, observaciones: e.target.value})}
                    className="min-h-[80px]"
                  />
                </div>
                <Button 
                  className="w-full bg-[#FF6600] hover:bg-[#e65c00]" 
                  onClick={handleGuardarPayout}
                  disabled={saving}
                >
                  {saving ? 'Registrando...' : '✓ Registrar Pago al Cliente'}
                </Button>
              </div>

              {/* Payouts Recientes */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Últimos Payouts Realizados</h4>
                <div className="border rounded-lg max-h-[360px] overflow-y-auto bg-white">
                  {transferencias.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-4 text-center">No hay transferencias registradas</p>
                  ) : (
                    <div className="divide-y text-xs">
                      {transferencias.slice(0, 5).map(t => (
                        <div key={t.id} className="p-3 flex justify-between items-center hover:bg-gray-50/50">
                          <div>
                            <p className="font-bold text-gray-800">{fmt(t.monto)}</p>
                            <p className="text-gray-400 mt-0.5">{t.fecha} · Ref: {t.referencia || 'SPEI'}</p>
                          </div>
                          <div className="flex gap-2">
                            {t.comprobante_url && (
                              <a href={t.comprobante_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                                Ver PDF/Foto
                              </a>
                            )}
                            <button onClick={() => handleDeletePayout(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTRAR CORTE DE BALANCE (INGRESOS & GASTOS) */}
          {activeTab === 'corte' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-700 text-sm border-b pb-2 flex items-center gap-1.5"><ArrowDownCircle className="w-4 h-4 text-orange-600" /> Registrar Declaración / Corte de Balance</h3>
              
              <div className="grid gap-4 md:grid-cols-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                {/* Fechas */}
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Fecha Inicio Periodo *</Label>
                  <Input 
                    type="date" 
                    value={corteForm.fecha_inicio} 
                    onChange={e => setCorteForm({...corteForm, fecha_inicio: e.target.value})} 
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Fecha Fin Periodo *</Label>
                  <Input 
                    type="date" 
                    value={corteForm.fecha_fin} 
                    onChange={e => setCorteForm({...corteForm, fecha_fin: e.target.value})} 
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Referencia / Código de Corte</Label>
                  <Input 
                    placeholder="Ej. Semana 21 - La Cotorrisa" 
                    value={corteForm.referencia} 
                    onChange={e => setCorteForm({...corteForm, referencia: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* INGRESOS (VENTAS) */}
                <div className="space-y-3 bg-green-50/20 p-4 rounded-xl border border-green-100/40">
                  <h4 className="text-xs font-bold text-green-700 uppercase tracking-widest border-b pb-1">🛒 Ventas (Ingresos)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-green-800">Tienda General</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={corteForm.ventas_general || ''} 
                        onChange={e => handleVentasChange('ventas_general', parseFloat(e.target.value) || 0)} 
                        className="bg-white border-green-200 focus:border-green-400"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-green-800">Tienda Exclusivos</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={corteForm.ventas_exclusivos || ''} 
                        onChange={e => handleVentasChange('ventas_exclusivos', parseFloat(e.target.value) || 0)} 
                        className="bg-white border-green-200 focus:border-green-400"
                      />
                    </div>
                  </div>
                  <div className="pt-2 text-xs font-bold text-green-800 flex justify-between">
                    <span>Total Ventas Brutas:</span>
                    <span>{fmt((parseFloat(corteForm.ventas_general) || 0) + (parseFloat(corteForm.ventas_exclusivos) || 0))}</span>
                  </div>
                </div>

                {/* OPERACIÓN (DEDUCCIONES) */}
                <div className="space-y-3 bg-red-50/25 p-4 rounded-xl border border-red-100/30">
                  <h4 className="text-xs font-bold text-red-700 uppercase tracking-widest border-b pb-1">📉 Deducciones y Comisiones</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <Label className="text-[10px] text-red-800">Colivery (20%)</Label>
                      <Input 
                        type="number" 
                        value={corteForm.comision_colivery || ''} 
                        onChange={e => setCorteForm({...corteForm, comision_colivery: parseFloat(e.target.value) || 0})} 
                        className="bg-white text-xs" 
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-red-800">Pasarela Pago</Label>
                      <Input 
                        type="number" 
                        value={corteForm.pasarela_pagos || ''} 
                        onChange={e => setCorteForm({...corteForm, pasarela_pagos: parseFloat(e.target.value) || 0})} 
                        className="bg-white text-xs" 
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-red-800">Administración</Label>
                      <Input 
                        type="number" 
                        value={corteForm.costo_administracion || ''} 
                        onChange={e => setCorteForm({...corteForm, costo_administracion: parseFloat(e.target.value) || 0})} 
                        className="bg-white text-xs" 
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-red-800">Software / Soft</Label>
                      <Input 
                        type="number" 
                        value={corteForm.costo_software || ''} 
                        onChange={e => setCorteForm({...corteForm, costo_software: parseFloat(e.target.value) || 0})} 
                        className="bg-white text-xs" 
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] text-red-800">Cargos Adicionales</Label>
                      <Input 
                        type="number" 
                        value={corteForm.gastos_adicionales || ''} 
                        onChange={e => setCorteForm({...corteForm, gastos_adicionales: parseFloat(e.target.value) || 0})} 
                        className="bg-white text-xs" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Observaciones del Periodo</Label>
                <Textarea 
                  placeholder="Detalles sobre devoluciones restadas, cargos extraordinarios, etc." 
                  value={corteForm.observaciones} 
                  onChange={e => setCorteForm({...corteForm, observaciones: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>

              {/* Resumen Final en vivo */}
              <div className="bg-[#1a1a2e] text-white p-4 rounded-xl flex items-center justify-between shadow-md">
                <div>
                  <p className="text-xs text-orange-400 font-bold uppercase tracking-wider">Monto Neto a Favor Asignado</p>
                  <p className="text-2xl font-black mt-0.5">
                    {fmt(
                      ((parseFloat(corteForm.ventas_general) || 0) + (parseFloat(corteForm.ventas_exclusivos) || 0)) -
                      ((parseFloat(corteForm.comision_colivery) || 0) + 
                       (parseFloat(corteForm.pasarela_pagos) || 0) + 
                       (parseFloat(corteForm.costo_administracion) || 0) + 
                       (parseFloat(corteForm.costo_software) || 0) + 
                       (parseFloat(corteForm.gastos_adicionales) || 0))
                    )}
                  </p>
                </div>
                <Button 
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold" 
                  onClick={handleGuardarCorte}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : '✓ Guardar Corte'}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: VER HISTORIAL COMPLETO */}
          {activeTab === 'historial' && (
            <div className="space-y-6">
              
              {/* HISTORIAL CORTES */}
              <div>
                <h4 className="font-bold text-gray-700 text-sm border-b pb-2 mb-3">Cortes de Balance Declarados</h4>
                {cortes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">No hay cortes declarados.</p>
                ) : (
                  <div className="border rounded-md overflow-x-auto bg-white">
                    <Table className="text-xs">
                      <TableHeader className="bg-gray-50/50">
                        <TableRow>
                          <TableHead>Periodo</TableHead>
                          <TableHead className="text-right">General</TableHead>
                          <TableHead className="text-right">Exclusivos</TableHead>
                          <TableHead className="text-right">Deducciones</TableHead>
                          <TableHead className="text-right font-bold text-green-700">Neto Asignado</TableHead>
                          <TableHead className="text-right">Eliminar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cortes.map(c => {
                          const totalDeds = 
                            (c.comision_colivery || 0) + 
                            (c.pasarela_pagos || 0) + 
                            (c.costo_administracion || 0) + 
                            (c.costo_software || 0) + 
                            (c.gastos_adicionales || 0)
                          return (
                            <TableRow key={c.id} className="hover:bg-gray-50/30">
                              <TableCell className="font-medium whitespace-nowrap">{c.fecha_inicio} al {c.fecha_fin}</TableCell>
                              <TableCell className="text-right">{fmt(c.ventas_general)}</TableCell>
                              <TableCell className="text-right">{fmt(c.ventas_exclusivos)}</TableCell>
                              <TableCell className="text-right text-red-500 font-medium">-{fmt(totalDeds)}</TableCell>
                              <TableCell className="text-right font-bold text-green-700">{fmt(c.neto_favor)}</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteCorte(c.id)} 
                                  className="text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* HISTORIAL TRANSFERENCIAS */}
              <div>
                <h4 className="font-bold text-gray-700 text-sm border-b pb-2 mb-3">Transferencias Registradas (Payouts)</h4>
                {transferencias.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">No hay transferencias registradas.</p>
                ) : (
                  <div className="border rounded-md overflow-x-auto bg-white">
                    <Table className="text-xs">
                      <TableHeader className="bg-gray-50/50">
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead className="text-right font-bold text-gray-800">Monto</TableHead>
                          <TableHead className="text-center">Comprobante</TableHead>
                          <TableHead className="text-right">Eliminar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferencias.map(t => (
                          <TableRow key={t.id} className="hover:bg-gray-50/30">
                            <TableCell className="font-medium whitespace-nowrap">{t.fecha}</TableCell>
                            <TableCell className="text-gray-500 max-w-[150px] truncate" title={t.referencia}>
                              {t.referencia || 'Abono'}
                            </TableCell>
                            <TableCell className="text-right font-bold">{fmt(t.monto)}</TableCell>
                            <TableCell className="text-center">
                              {t.comprobante_url ? (
                                <a 
                                  href={t.comprobante_url} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 font-bold py-0.5 px-2 rounded hover:bg-orange-100"
                                >
                                  <FileText className="w-3 h-3" /> Ver adjunto
                                </a>
                              ) : (
                                <span className="text-gray-400 italic">No disponible</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeletePayout(t.id)} 
                                className="text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
