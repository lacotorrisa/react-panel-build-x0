import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, AlertCircle, Clock, Info, Package, Pencil, Flag, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { verificarYEnviarNotificaciones } from '../../lib/email'

const STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'en_proceso', label: 'En Proceso', color: 'bg-blue-100 text-blue-800' },
  { value: 'enviado', label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
  { value: 'entregado', label: 'Entregado', color: 'bg-green-100 text-green-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
]

export const ModalDetallePedidoLogistica = ({ open, onOpenChange, pedido, paqueterias = [], onRefresh }) => {
  const { user, rol } = useAuth()
  const [eventos, setEventos] = useState([])
  const [tab, setTab] = useState('detalles') // 'detalles' | 'reporte'

  // Edición
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  // Reporte
  const [tipoEvento, setTipoEvento] = useState('nota')
  const [observacion, setObservacion] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open && pedido) {
      fetchEventos()
      setEditData({
        paqueteria_id: pedido.paqueteria_id || '',
        guia: pedido.guia || '',
        link_seguimiento: pedido.link_seguimiento || '',
        status: pedido.status || 'pendiente',
      })
      setEditMode(false)
      setTab('detalles')
    }
  }, [open, pedido])

  const fetchEventos = async () => {
    const { data } = await supabase
      .from('pedido_eventos')
      .select('*, profiles(nombre, rol)')
      .eq('pedido_id', pedido.id)
      .order('created_at', { ascending: false })
    if (data) setEventos(data)
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('pedidos').update({
        paqueteria_id: editData.paqueteria_id || null,
        guia: editData.guia || null,
        link_seguimiento: editData.link_seguimiento || null,
        status: editData.status,
      }).eq('id', pedido.id)

      if (error) throw error

      // Registrar en historial
      await supabase.from('pedido_eventos').insert({
        pedido_id: pedido.id,
        tipo: 'actualizacion',
        descripcion: `Actualizado por logística: Paquetería, Guía, Status → ${editData.status.toUpperCase()}`,
        usuario_id: user.id,
      })

      toast.success('Pedido actualizado correctamente')
      setEditMode(false)
      fetchEventos()
      if (onRefresh) onRefresh()

      // Verificar y disparar notificaciones de correo automáticamente si aplica
      verificarYEnviarNotificaciones(pedido.id, editData.status)
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddReporte = async () => {
    if (!observacion.trim()) return toast.error('Escribe un detalle para el reporte')
    setUploading(true)
    let archivoUrl = null

    try {
      if (archivo) {
        const fileExt = archivo.name.split('.').pop()
        const fileName = `${pedido.id}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('evidencias').upload(fileName, archivo)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(fileName)
        archivoUrl = publicUrl
      }

      const { error } = await supabase.from('pedido_eventos').insert({
        pedido_id: pedido.id,
        tipo: tipoEvento,
        descripcion: observacion.trim(),
        usuario_id: user.id,
        archivo_url: archivoUrl,
      })
      if (error) throw error

      toast.success('Reporte registrado en el historial')
      setObservacion('')
      setArchivo(null)
      setTipoEvento('nota')
      fetchEventos()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const renderIcon = (tipo) => {
    switch (tipo) {
      case 'entregado': return <CheckCircle className="text-green-500 w-4 h-4" />
      case 'problema': return <AlertCircle className="text-red-500 w-4 h-4" />
      case 'retraso': return <Clock className="text-yellow-500 w-4 h-4" />
      case 'guia_asignada': return <Package className="text-blue-500 w-4 h-4" />
      case 'actualizacion': return <Pencil className="text-purple-500 w-4 h-4" />
      case 'reporte': return <Flag className="text-orange-500 w-4 h-4" />
      default: return <Info className="text-gray-400 w-4 h-4" />
    }
  }

  const statusColor = STATUS_OPTIONS.find(s => s.value === pedido?.status)?.color || 'bg-gray-100 text-gray-700'

  if (!pedido) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold">Pedido — {pedido.nombre_comprador}</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Fecha: {format(new Date(pedido.fecha_pedido || pedido.created_at), 'dd/MM/yyyy')} ·{' '}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                {pedido.status?.toUpperCase()}
              </span>
            </p>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setTab('detalles')} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${tab === 'detalles' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              Detalles
            </button>
            <button onClick={() => setTab('reporte')} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all flex items-center gap-1 ${tab === 'reporte' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Flag className="w-3.5 h-3.5" /> Reportes
              {eventos.filter(e => e.tipo === 'problema' || e.tipo === 'retraso' || e.tipo === 'reporte').length > 0 && (
                <span className="bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 ml-0.5">
                  {eventos.filter(e => e.tipo === 'problema' || e.tipo === 'retraso' || e.tipo === 'reporte').length}
                </span>
              )}
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'detalles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* IZQUIERDA: Info cliente + productos */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente / Comprador</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
                    <p><span className="font-medium text-gray-600">Nombre:</span> {pedido.nombre_comprador}</p>
                    <p><span className="font-medium text-gray-600">Correo:</span> {pedido.correo_comprador}</p>
                    <p><span className="font-medium text-gray-600">Teléfono:</span> {pedido.telefono || '—'}</p>
                    <p><span className="font-medium text-gray-600">Dirección:</span> {pedido.direccion}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos</h4>
                  <div className="border rounded-lg divide-y text-sm">
                    {(pedido.productos || []).map((prod, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div>
                          <span className="font-medium">{prod.nombre}</span>
                          {prod.talla && <span className="text-gray-400 ml-2 text-xs">Talla: {prod.talla}</span>}
                        </div>
                        <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold text-xs">x{prod.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DERECHA: Envío editable */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos de Envío</h4>
                  {!editMode ? (
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancelar</Button>
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSaveEdit} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Status</Label>
                    {editMode ? (
                      <Select value={editData.status} onValueChange={v => setEditData({...editData, status: v})}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 text-sm font-semibold">{pedido.status?.toUpperCase()}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Paquetería</Label>
                    {editMode ? (
                      <Select value={editData.paqueteria_id} onValueChange={v => setEditData({...editData, paqueteria_id: v})}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                        <SelectContent>
                          {paqueterias.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 text-sm">{paqueterias.find(p => p.id === pedido.paqueteria_id)?.nombre || 'Sin asignar'}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Número de Guía</Label>
                    {editMode ? (
                      <Input className="mt-1" value={editData.guia} onChange={e => setEditData({...editData, guia: e.target.value})} placeholder="Ej: 123456789" />
                    ) : (
                      <p className="mt-1 text-sm font-mono">{pedido.guia || 'Sin guía'}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Link de Seguimiento</Label>
                    {editMode ? (
                      <Input className="mt-1" value={editData.link_seguimiento} onChange={e => setEditData({...editData, link_seguimiento: e.target.value})} placeholder="https://..." />
                    ) : (
                      pedido.link_seguimiento ? (
                        <a href={pedido.link_seguimiento} target="_blank" rel="noreferrer" className="mt-1 text-sm text-blue-500 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Ver seguimiento
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">Sin link</p>
                      )
                    )}
                  </div>
                </div>

                {/* Historial compacto */}
                <div className="border-t pt-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Historial de Cambios</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {eventos.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Sin cambios registrados</p>
                    ) : eventos.map(ev => (
                      <div key={ev.id} className="flex gap-2 items-start text-xs">
                        <div className="mt-0.5 flex-shrink-0">{renderIcon(ev.tipo)}</div>
                        <div className="flex-1 bg-gray-50 rounded-md p-2 border">
                          <p className="text-gray-700">{ev.descripcion}</p>
                          {ev.archivo_url && (
                            <a href={ev.archivo_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline mt-1 flex items-center gap-1">
                              <Package className="w-3 h-3" /> Ver adjunto
                            </a>
                          )}
                          <p className="text-gray-400 mt-1">
                            {ev.profiles?.nombre || 'Sistema'} · {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'reporte' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nuevo reporte */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-orange-500" /> Levantar Nuevo Reporte
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Tipo de Reporte</Label>
                    <Select value={tipoEvento} onValueChange={setTipoEvento}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nota">📋 Nota General</SelectItem>
                        <SelectItem value="reporte">🚩 Reporte de Incidencia</SelectItem>
                        <SelectItem value="problema">⚠️ Problema con el Pedido</SelectItem>
                        <SelectItem value="retraso">⏰ Retraso en Entrega</SelectItem>
                        <SelectItem value="entregado">✅ Confirmación de Entrega</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Descripción Detallada *</Label>
                    <Textarea
                      className="mt-1 min-h-[120px]"
                      placeholder="Describe con detalle el incidente, retraso, o novedad del pedido..."
                      value={observacion}
                      onChange={e => setObservacion(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Evidencia / Foto (Opcional)</Label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => setArchivo(e.target.files[0])}
                      className="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                    />
                  </div>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={handleAddReporte} disabled={uploading}>
                    {uploading ? 'Registrando...' : '🚩 Registrar Reporte'}
                  </Button>
                </div>
              </div>

              {/* Historial de reportes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Flujo de Reportes del Pedido</h4>
                <div className="space-y-3 max-h-[450px] overflow-y-auto">
                  {eventos.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No hay reportes para este pedido.</p>
                  ) : eventos.map(ev => (
                    <div key={ev.id} className="flex gap-3 items-start">
                      <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        {renderIcon(ev.tipo)}
                      </div>
                      <div className="flex-1 border rounded-lg p-3 shadow-sm bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{ev.tipo}</span>
                          <span className="text-xs text-gray-400">{format(new Date(ev.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                        </div>
                        <p className="text-sm text-gray-800">{ev.descripcion}</p>
                        {ev.archivo_url && (
                          <div className="mt-2">
                            <a href={ev.archivo_url} target="_blank" rel="noreferrer" className="text-blue-500 text-xs hover:underline flex items-center gap-1">
                              <Package className="w-3 h-3" /> Ver evidencia adjunta
                            </a>
                            {ev.archivo_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) && (
                              <img src={ev.archivo_url} alt="Evidencia" className="mt-2 max-h-32 rounded-md border w-full object-cover" />
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <div className="w-4 h-4 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-xs">
                            {(ev.profiles?.nombre || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{ev.profiles?.nombre || 'Sistema'}</span>
                          <span className="text-gray-300">·</span>
                          <span className="capitalize text-gray-400">{ev.profiles?.rol || 'sistema'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
