import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle, AlertCircle, Clock, Info, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'

export const ModalDetallePedido = ({ open, onOpenChange, pedido }) => {
  const { user, rol } = useAuth()
  const [eventos, setEventos] = useState([])
  const [observacion, setObservacion] = useState('')
  const [tipoEvento, setTipoEvento] = useState('nota')

  useEffect(() => {
    if (open && pedido) {
      fetchEventos()
    }
  }, [open, pedido])

  const fetchEventos = async () => {
    try {
      const { data, error } = await supabase
        .from('pedido_eventos')
        .select('*, profiles(nombre, rol)')
        .eq('pedido_id', pedido.id)
        .order('created_at', { ascending: false })
      
      if (error) console.error('Error al cargar eventos:', error)
      if (data) setEventos(data)
    } catch (err) {
      console.error('fetchEventos error:', err)
    }
  }

  const handleAddObservacion = async () => {
    if (!observacion.trim() || !tipoEvento) return
    if (!user?.id) {
      toast.error('Error de sesión. Por favor recarga la página.')
      return
    }
    try {
      const { error } = await supabase.from('pedido_eventos').insert({
        pedido_id: pedido.id,
        tipo: tipoEvento,
        descripcion: observacion.trim(),
        usuario_id: user.id
      })
      if (error) throw error
      toast.success('Observación agregada')
      setObservacion('')
      fetchEventos()
    } catch (error) {
      console.error('handleAddObservacion error:', error)
      toast.error('Error al agregar observación: ' + error.message)
    }
  }

  const renderIcon = (tipo) => {
    switch(tipo) {
      case 'entregado': return <CheckCircle className="text-green-500 w-5 h-5" />
      case 'problema': return <AlertCircle className="text-red-500 w-5 h-5" />
      case 'retraso': return <Clock className="text-yellow-500 w-5 h-5" />
      case 'guia_asignada': return <Package className="text-blue-500 w-5 h-5" />
      default: return <Info className="text-gray-500 w-5 h-5" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-xl">Detalle de Pedido ({pedido.tipo_compra})</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* IZQUIERDA: Detalles */}
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Información del Cliente</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <p><span className="font-medium text-gray-700">Comprador:</span> {pedido.nombre_comprador}</p>
                  <p><span className="font-medium text-gray-700">Correo:</span> {pedido.correo_comprador}</p>
                  <p><span className="font-medium text-gray-700">Teléfono:</span> {pedido.telefono || '-'}</p>
                  <p><span className="font-medium text-gray-700">Dirección:</span> {pedido.direccion}</p>
                  {pedido.referencias && <p><span className="font-medium text-gray-700">Referencias:</span> {pedido.referencias}</p>}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Detalles de Envío</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <p><span className="font-medium text-gray-700">Status:</span> <Badge variant="outline" className="ml-2">{pedido.status.toUpperCase()}</Badge></p>
                  <p><span className="font-medium text-gray-700">Guía:</span> {pedido.guia || 'Sin asignar'}</p>

                  <p><span className="font-medium text-gray-700">Fecha Pedido:</span> {format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy')}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Productos</h4>
                <div className="border rounded-lg divide-y">
                  {pedido.productos.map((prod, idx) => (
                    <div key={idx} className="p-3 text-sm flex justify-between">
                      <div>
                        <span className="font-medium">{prod.nombre}</span>
                        {prod.talla && <span className="text-gray-500 ml-2">Talla: {prod.talla}</span>}
                      </div>
                      <span className="bg-gray-100 px-2 rounded-md font-medium">x{prod.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DERECHA: Historial / Observaciones */}
            <div className="space-y-6 flex flex-col">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Historial</h4>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {eventos.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No hay eventos registrados</p>
                  ) : (
                    eventos.map((ev) => (
                      <div key={ev.id} className="flex gap-3">
                        <div className="mt-0.5">{renderIcon(ev.tipo)}</div>
                        <div className="bg-white border rounded-md p-3 flex-1 shadow-sm">
                          <p className="text-sm text-gray-800">{ev.descripcion}</p>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                            <span>{ev.profiles?.nombre || 'Sistema'} ({ev.profiles?.rol || 'system'})</span>
                            <span>{format(new Date(ev.created_at), 'dd/MM/yyyy HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Agregar Observación</h4>
                <div className="space-y-3">
                  <Select value={tipoEvento} onValueChange={setTipoEvento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota">Nota General</SelectItem>
                      <SelectItem value="problema">Problema</SelectItem>
                      <SelectItem value="retraso">Retraso</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea 
                    placeholder="Escribe los detalles aquí..." 
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                  />
                  <Button className="w-full bg-[#FF6600] hover:bg-[#e65c00]" onClick={handleAddObservacion}>
                    Agregar Observación
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
