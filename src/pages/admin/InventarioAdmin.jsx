import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2, PackageSearch, Building2, ArrowUpDown, Pencil, Save } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export const InventarioAdmin = () => {
  const [inventario, setInventario] = useState([])
  const [clientes, setClientes] = useState([])
  const [empresasLogisticas, setEmpresasLogisticas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [clienteFilter, setClienteFilter] = useState('all')
  const [logisticaFilter, setLogisticaFilter] = useState('all')

  // Modal Alta
  const [modalOpen, setModalOpen] = useState(false)
  const [altaLogisticaId, setAltaLogisticaId] = useState('')
  const [altaClienteId, setAltaClienteId] = useState('')
  const [altaProductos, setAltaProductos] = useState([{ descripcion: '', cantidad: 1 }])
  const [saving, setSaving] = useState(false)

  // Edición inline
  const [editingId, setEditingId] = useState(null)
  const [editingCantidad, setEditingCantidad] = useState(0)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [invRes, cliRes, logRes] = await Promise.all([
        supabase.from('inventario').select('*, clientes(nombre), empresas_logisticas(nombre)').order('producto'),
        supabase.from('clientes').select('id, nombre').eq('activo', true),
        supabase.from('empresas_logisticas').select('id, nombre').eq('activo', true)
      ])
      if (invRes.error) throw invRes.error
      setInventario(invRes.data || [])
      setClientes(cliRes.data || [])
      setEmpresasLogisticas(logRes.data || [])
    } catch (err) {
      toast.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAddAltaProducto = () => setAltaProductos([...altaProductos, { descripcion: '', cantidad: 1 }])
  const handleRemoveAltaProducto = (i) => setAltaProductos(altaProductos.filter((_, idx) => idx !== i))
  const handleAltaChange = (i, field, val) => {
    const arr = [...altaProductos]
    arr[i][field] = val
    setAltaProductos(arr)
  }

  const handleAltaGuardar = async () => {
    if (!altaLogisticaId || !altaClienteId) return toast.error('Selecciona empresa logística y cliente')
    const valid = altaProductos.filter(p => p.descripcion.trim() && p.cantidad > 0)
    if (!valid.length) return toast.error('Añade al menos un producto')
    setSaving(true)
    try {
      for (const p of valid) {
        const { error } = await supabase.from('inventario').upsert({
          logistica_id: altaLogisticaId,
          cliente_id: altaClienteId,
          producto: p.descripcion.trim(),
          cantidad: p.cantidad
        }, { onConflict: 'logistica_id,cliente_id,producto', ignoreDuplicates: false })
        if (error) throw error
      }
      toast.success('Inventario actualizado correctamente')
      setModalOpen(false)
      setAltaLogisticaId(''); setAltaClienteId(''); setAltaProductos([{ descripcion: '', cantidad: 1 }])
      fetchData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async (id) => {
    const { error } = await supabase.from('inventario').update({ cantidad: editingCantidad }).eq('id', id)
    if (error) return toast.error('Error al actualizar')
    toast.success('Cantidad actualizada')
    setEditingId(null)
    fetchData()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta prenda del inventario?')) return
    const { error } = await supabase.from('inventario').delete().eq('id', id)
    if (error) return toast.error('Error al eliminar')
    toast.success('Eliminado del inventario')
    fetchData()
  }

  const filtered = inventario.filter(item => {
    const matchS = item.producto.toLowerCase().includes(searchTerm.toLowerCase()) || (item.clientes?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchC = clienteFilter === 'all' || item.cliente_id === clienteFilter
    const matchL = logisticaFilter === 'all' || item.logistica_id === logisticaFilter
    return matchS && matchC && matchL
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Control Global de Inventario</h1>
          <p className="text-gray-500">Consulta y gestiona el stock en todas las empresas logísticas</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Alta de Stock
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Buscar prenda..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos los Clientes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Clientes</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={logisticaFilter} onValueChange={setLogisticaFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas las Logísticas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Logísticas</SelectItem>
            {empresasLogisticas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando inventario...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <PackageSearch className="w-12 h-12 text-gray-300 mb-2" />
            <p>No hay resultados para los filtros seleccionados.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Empresa Logística</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto / Descripción</TableHead>
                <TableHead className="text-right">Stock Disponible</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id} className="hover:bg-orange-50/30">
                  <TableCell className="font-medium text-gray-700">
                    <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" />{item.empresas_logisticas?.nombre || 'N/A'}</div>
                  </TableCell>
                  <TableCell className="text-gray-600">{item.clientes?.nombre || 'N/A'}</TableCell>
                  <TableCell className="font-bold text-gray-800">{item.producto}</TableCell>
                  <TableCell className="text-right">
                    {editingId === item.id ? (
                      <Input type="number" value={editingCantidad} onChange={e => setEditingCantidad(parseInt(e.target.value) || 0)} className="w-24 ml-auto text-right" />
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800">
                        <ArrowUpDown className="w-3 h-3 mr-1 text-gray-500" />{item.cantidad} piezas
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === item.id ? (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSaveEdit(item.id)}>
                          <Save className="w-3 h-3 mr-1" /> Guardar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(item.id); setEditingCantidad(item.cantidad) }}>
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal Alta de Stock */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4">Alta Manual de Stock</Dialog.Title>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Empresa Logística *</Label>
                  <Select value={altaLogisticaId} onValueChange={setAltaLogisticaId}>
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {empresasLogisticas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cliente (Dueño del Stock) *</Label>
                  <Select value={altaClienteId} onValueChange={setAltaClienteId}>
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Prendas / Artículos</Label>
                <div className="space-y-2 mt-2">
                  {altaProductos.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Descripción (ej. Playera Negra M)" value={p.descripcion} onChange={e => handleAltaChange(i, 'descripcion', e.target.value)} className="flex-1" />
                      <Input type="number" min="0" value={p.cantidad} onChange={e => handleAltaChange(i, 'cantidad', parseInt(e.target.value) || 0)} className="w-24" />
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleRemoveAltaProducto(i)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddAltaProducto} className="text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Añadir prenda
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleAltaGuardar} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar en Inventario'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
