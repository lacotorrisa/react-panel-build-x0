import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from 'sonner'
import { Plus, Trash, CheckCircle2, Clock } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { format } from 'date-fns'

export const GestionRecepciones = () => {
  const [recepciones, setRecepciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  
  // Opciones para el formulario
  const [empresasLogisticas, setEmpresasLogisticas] = useState([])
  const [clientes, setClientes] = useState([])

  // Estado del formulario
  const [logisticaId, setLogisticaId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [fechaEnvio, setFechaEnvio] = useState(new Date().toISOString().split('T')[0])
  const [productos, setProductos] = useState([{ descripcion: '', cantidad: 1 }])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [recepRes, logRes, cliRes] = await Promise.all([
        supabase.from('recepciones').select(`*, empresas_logisticas(nombre), clientes(nombre)`).order('created_at', { ascending: false }),
        supabase.from('empresas_logisticas').select('*').eq('activo', true),
        supabase.from('clientes').select('*').eq('activo', true)
      ])

      if (recepRes.error) throw recepRes.error
      if (logRes.error) throw logRes.error
      if (cliRes.error) throw cliRes.error

      setRecepciones(recepRes.data || [])
      setEmpresasLogisticas(logRes.data || [])
      setClientes(cliRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddProducto = () => {
    setProductos([...productos, { descripcion: '', cantidad: 1 }])
  }

  const handleRemoveProducto = (index) => {
    const newProds = [...productos]
    newProds.splice(index, 1)
    setProductos(newProds)
  }

  const handleProductoChange = (index, field, value) => {
    const newProds = [...productos]
    newProds[index][field] = value
    setProductos(newProds)
  }

  const handleCreate = async () => {
    if (!logisticaId || !clienteId) {
      return toast.error('Selecciona empresa logística y cliente')
    }
    const validProducts = productos.filter(p => p.descripcion.trim() && p.cantidad > 0)
    if (validProducts.length === 0) {
      return toast.error('Añade al menos un producto válido')
    }

    try {
      const { error } = await supabase.from('recepciones').insert({
        logistica_id: logisticaId,
        cliente_id: clienteId,
        productos: validProducts,
        observaciones: observaciones || null,
        fecha: fechaEnvio,
        status: 'pendiente'
      })

      if (error) throw error

      toast.success('Manifiesto de recepción creado exitosamente')
      setModalOpen(false)
      setLogisticaId('')
      setClienteId('')
      setObservaciones('')
      setFechaEnvio(new Date().toISOString().split('T')[0])
      setProductos([{ descripcion: '', cantidad: 1 }])
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Error al crear manifiesto: ' + err.message)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manifiestos de Recepción</h1>
          <p className="text-gray-500">Asigna mercancía/stock a las Empresas Logísticas</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Manifiesto
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : recepciones.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay manifiestos creados</div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Fecha Envío</TableHead>
                <TableHead>Fecha Recepción</TableHead>
                <TableHead>Empresa Logística</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Prendas / Cantidad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Evidencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recepciones.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{format(new Date(req.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell className="font-medium text-gray-500">
                    {req.status === 'recibido' && req.updated_at 
                      ? format(new Date(req.updated_at), 'dd/MM/yyyy HH:mm') 
                      : '---'}
                  </TableCell>
                  <TableCell>{req.empresas_logisticas?.nombre || 'N/A'}</TableCell>
                  <TableCell>{req.clientes?.nombre || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {req.productos.map((p, i) => (
                        <div key={i}>• {p.cantidad}x {p.descripcion}</div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {req.status === 'recibido' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" /> Pendiente
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {req.evidencia_url ? (
                      <a href={req.evidencia_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm">
                        Ver Foto
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">Sin evidencia</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* MODAL CREAR MANIFIESTO */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4">
              Nuevo Manifiesto de Entrega
            </Dialog.Title>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Empresa Logística Destino *</Label>
                  <Select value={logisticaId} onValueChange={setLogisticaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {empresasLogisticas.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cliente Origen (Dueño del Stock) *</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha de Envío *</Label>
                  <Input type="date" value={fechaEnvio} onChange={e => setFechaEnvio(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Productos / Prendas a entregar</Label>
                <div className="space-y-2 mt-2">
                  {productos.map((prod, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input 
                        placeholder="Descripción (ej. Playera Negra L)" 
                        value={prod.descripcion}
                        onChange={(e) => handleProductoChange(index, 'descripcion', e.target.value)}
                        className="flex-1"
                      />
                      <Input 
                        type="number" 
                        min="1"
                        value={prod.cantidad}
                        onChange={(e) => handleProductoChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveProducto(index)} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddProducto} className="mt-2 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Añadir otro producto
                  </Button>
                </div>
              </div>

              <div>
                <Label>Observaciones (Opcional)</Label>
                <Input 
                  placeholder="Ej: Entregado en caja sellada, incluye etiquetas..." 
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleCreate}>
                  Generar Manifiesto
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}
