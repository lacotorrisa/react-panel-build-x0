import React, { useState, useEffect } from 'react'
import { Upload, Plus } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalImportarCSV } from '../../components/modals/ModalImportarCSV'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'
import * as Dialog from '@radix-ui/react-dialog'

const STATUS_OPTIONS = [
  { value: 'pendiente', label: '⏳ Pendiente' },
  { value: 'en_espera_guia', label: '📋 En espera de guía' },
  { value: 'en_espera_prenda', label: '📦 Falta prenda' },
  { value: 'en_transito', label: '🚚 En tránsito' },
  { value: 'entregado', label: '✅ Entregado' },
  { value: 'con_retraso', label: '⚠️ Con retraso' },
  { value: 'problema', label: '❌ Problema/Retorno' },
]

const BLANK = {
  nombre_comprador: '', correo_comprador: '', telefono: '', direccion: '',
  tipo_compra: 'GENERAL', fecha_pedido: new Date().toISOString().split('T')[0],
  status: 'pendiente', guia: '', link_seguimiento: '',
  producto: '', talla: '', cantidad: 1,
}

export const CargarPedidos = () => {
  const { clienteSeleccionado, setClienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [modalCsvOpen, setModalCsvOpen] = useState(false)
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(BLANK)

  const fetchPedidos = async () => {
    if (!clienteSeleccionado) return
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_id', clienteSeleccionado.id)
      .order('fecha_pedido', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setPedidos(data)
  }

  const fetchPaqueterias = async () => {
    const { data } = await supabase.from('paqueterias').select('*').eq('activo', true)
    if (data) setPaqueterias(data)
  }

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').eq('activo', true)
    if (data) setClientes(data)
  }

  useEffect(() => { fetchClientes(); fetchPaqueterias() }, [])
  useEffect(() => { if (clienteSeleccionado) fetchPedidos() }, [clienteSeleccionado])

  const handleGuardarNuevo = async () => {
    if (!form.nombre_comprador.trim()) return toast.error('El nombre del comprador es requerido')
    if (!form.producto.trim()) return toast.error('El producto es requerido')
    if (!form.direccion.trim()) return toast.error('La dirección es requerida')
    setSaving(true)
    try {
      const { error } = await supabase.from('pedidos').insert({
        cliente_id: clienteSeleccionado.id,
        nombre_comprador: form.nombre_comprador.trim(),
        correo_comprador: form.correo_comprador.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim(),
        tipo_compra: form.tipo_compra,
        fecha_pedido: form.fecha_pedido,
        status: form.status,
        guia: form.guia.trim() || null,
        link_seguimiento: form.link_seguimiento.trim() || null,
        productos: [{ nombre: form.producto.trim(), talla: form.talla || null, cantidad: parseInt(form.cantidad) || 1 }],
      })
      if (error) throw error
      toast.success('✅ Venta registrada correctamente')
      setModalNuevoOpen(false)
      setForm(BLANK)
      fetchPedidos()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const SelectorCliente = () => (
    <div className="w-full sm:w-72">
      <Select
        value={clienteSeleccionado?.id?.toString() || ''}
        onValueChange={(val) => {
          const cl = clientes.find(c => c.id.toString() === val)
          setClienteSeleccionado(cl)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar Cliente" />
        </SelectTrigger>
        <SelectContent>
          {clientes.map(cliente => (
            <SelectItem key={cliente.id} value={cliente.id.toString()}>
              {cliente.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (!clienteSeleccionado) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center">
        <h2 className="text-xl font-semibold text-gray-700">Selecciona un cliente para ver y cargar sus pedidos</h2>
        <SelectorCliente />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Cargar Pedidos</h2>
          <SelectorCliente />
        </div>
        <div className="flex space-x-2">
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => { setForm(BLANK); setModalNuevoOpen(true) }}
          >
            <Plus className="mr-2 h-4 w-4" /> Registrar Nueva Venta
          </Button>
          <Button variant="outline" onClick={() => setModalCsvOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
        </div>
      </div>

      <TablaPedidos
        pedidos={pedidos}
        paqueterias={paqueterias}
        onRefresh={fetchPedidos}
        onViewDetails={setSelectedPedido}
      />

      <ModalImportarCSV
        open={modalCsvOpen}
        onOpenChange={setModalCsvOpen}
        cliente={clienteSeleccionado}
        onSuccess={() => { setModalCsvOpen(false); fetchPedidos() }}
      />

      {selectedPedido && (
        <ModalDetallePedido
          open={!!selectedPedido}
          onOpenChange={(open) => !open && setSelectedPedido(null)}
          pedido={selectedPedido}
        />
      )}

      {/* Modal Nueva Venta */}
      <Dialog.Root open={modalNuevoOpen} onOpenChange={setModalNuevoOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-500" /> Registrar Nueva Venta
            </Dialog.Title>

            <div className="space-y-4">
              {/* Datos del comprador */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">👤 Datos del Comprador</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Nombre Completo *</Label>
                    <Input placeholder="Ej: Juan Pérez García" value={form.nombre_comprador} onChange={e => f('nombre_comprador', e.target.value)} />
                  </div>
                  <div>
                    <Label>Correo Electrónico</Label>
                    <Input type="email" placeholder="correo@ejemplo.com" value={form.correo_comprador} onChange={e => f('correo_comprador', e.target.value)} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input placeholder="+52 33 1234 5678" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Dirección de Entrega *</Label>
                    <Input placeholder="Calle, número, colonia, ciudad, CP" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Producto */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <p className="text-sm font-semibold text-orange-800 mb-3">📦 Producto</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Nombre del Producto *</Label>
                    <Input placeholder="Ej: Playera Acid Wash" value={form.producto} onChange={e => f('producto', e.target.value)} />
                  </div>
                  <div>
                    <Label>Talla</Label>
                    <Input placeholder="Ej: M, L, XL" value={form.talla} onChange={e => f('talla', e.target.value)} />
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" min="1" value={form.cantidad} onChange={e => f('cantidad', e.target.value)} />
                  </div>
                  <div>
                    <Label>Tipo de Compra</Label>
                    <Select value={form.tipo_compra} onValueChange={v => f('tipo_compra', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">GENERAL</SelectItem>
                        <SelectItem value="EXCLUSIVOS">EXCLUSIVOS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fecha del Pedido</Label>
                    <Input type="date" value={form.fecha_pedido} onChange={e => f('fecha_pedido', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Envío */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-3">🚚 Datos de Envío (Opcional)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => f('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Número de Guía</Label>
                    <Input placeholder="Ej: 1234567890" value={form.guia} onChange={e => f('guia', e.target.value)} />
                  </div>
                  <div>
                    <Label>Link de Seguimiento</Label>
                    <Input placeholder="https://..." value={form.link_seguimiento} onChange={e => f('link_seguimiento', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <Button variant="outline" onClick={() => setModalNuevoOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleGuardarNuevo} disabled={saving}>
                  {saving ? 'Guardando...' : '✅ Guardar Venta'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
