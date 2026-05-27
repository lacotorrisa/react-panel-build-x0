import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Plus, Trash2, RefreshCw, ArrowUp, ArrowDown, Save, PackageCheck, PackageX } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

const TALLAS = ['Ch', 'M', 'G', 'XL', 'XXL']

// Data inicial del sheet actualizado
const DATA_INICIAL = [
  { producto: 'Player Acid Wash', tallas: [ { talla:'Ch', entregado:5, vendido:3 }, { talla:'M', entregado:17, vendido:14 }, { talla:'G', entregado:19, vendido:14 }, { talla:'XL', entregado:10, vendido:17 }, { talla:'XXL', entregado:0, vendido:0 } ] },
  { producto: 'Hoodie', tallas: [ { talla:'Ch', entregado:5, vendido:5 }, { talla:'M', entregado:22, vendido:23 }, { talla:'G', entregado:25, vendido:32 }, { talla:'XL', entregado:24, vendido:34 }, { talla:'XXL', entregado:10, vendido:23 } ] },
  { producto: 'Playera Negra', tallas: [ { talla:'Ch', entregado:8, vendido:1 }, { talla:'M', entregado:8, vendido:1 }, { talla:'G', entregado:10, vendido:4 }, { talla:'XL', entregado:7, vendido:3 }, { talla:'XXL', entregado:0, vendido:0 } ] },
  { producto: 'Playera Blanca', tallas: [ { talla:'Ch', entregado:15, vendido:14 }, { talla:'M', entregado:17, vendido:15 }, { talla:'G', entregado:25, vendido:21 }, { talla:'XL', entregado:24, vendido:19 }, { talla:'XXL', entregado:0, vendido:0 } ] },
]

export const ReconciliacionStock = () => {
  const [items, setItems] = useState([])
  const [clientes, setClientes] = useState([])
  const [clienteFilter, setClienteFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editVals, setEditVals] = useState({ entregado: 0, vendido: 0 })

  // Nuevo item
  const [newProducto, setNewProducto] = useState('')
  const [newTalla, setNewTalla] = useState('Ch')
  const [newEntregado, setNewEntregado] = useState(0)
  const [newVendido, setNewVendido] = useState(0)
  const [newCliente, setNewCliente] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [recRes, cliRes] = await Promise.all([
        supabase.from('reconciliacion_stock').select('*, clientes(nombre)').order('producto').order('talla'),
        supabase.from('clientes').select('id, nombre').eq('activo', true)
      ])
      if (recRes.error) throw recRes.error
      setItems(recRes.data || [])
      setClientes(cliRes.data || [])
      if (cliRes.data?.length > 0) {
        if (!newCliente) setNewCliente(cliRes.data[0].id)
        // Autoseleccionar el primer cliente si no hay filtro activo
        setClienteFilter(prev => prev === '' ? cliRes.data[0].id : prev)
      }
    } catch (err) {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Importar datos iniciales del sheet
  const handleImportarInicial = async () => {
    if (!newCliente && clientes.length === 0) return toast.error('No hay clientes disponibles')
    const clienteId = newCliente || clientes[0]?.id
    if (!clienteId) return toast.error('Selecciona un cliente')
    if (!confirm('¿Importar los datos del sheet de La Cotorrisa? Esto reemplazará los datos existentes.')) return
    setSaving(true)
    try {
      // Borrar existentes del cliente
      await supabase.from('reconciliacion_stock').delete().eq('cliente_id', clienteId)
      // Insertar todos
      const rows = []
      DATA_INICIAL.forEach(prod => {
        prod.tallas.forEach(t => {
          rows.push({ cliente_id: clienteId, producto: prod.producto, talla: t.talla, entregado_logistica: t.entregado, vendido_cliente: t.vendido })
        })
      })
      const { error } = await supabase.from('reconciliacion_stock').insert(rows)
      if (error) throw error
      toast.success('Datos importados correctamente')
      fetchData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!newProducto.trim() || !newCliente) return toast.error('Completa producto y cliente')
    const { error } = await supabase.from('reconciliacion_stock').insert({
      cliente_id: newCliente,
      producto: newProducto.trim(),
      talla: newTalla,
      entregado_logistica: newEntregado,
      vendido_cliente: newVendido,
    })
    if (error) return toast.error(error.message)
    toast.success('Registro añadido')
    setModalOpen(false)
    setNewProducto('')
    setNewTalla('Ch')
    setNewEntregado(0)
    setNewVendido(0)
    fetchData()
  }

  const handleSaveEdit = async (id) => {
    const { error } = await supabase.from('reconciliacion_stock').update({
      entregado_logistica: editVals.entregado,
      vendido_cliente: editVals.vendido,
    }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Actualizado')
    setEditingId(null)
    fetchData()
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('reconciliacion_stock').delete().eq('id', id)
    fetchData()
  }

  const filtered = items.filter(i => !clienteFilter || i.cliente_id === clienteFilter)

  // Agrupar por producto para resumen
  const productos = [...new Set(filtered.map(i => i.producto))]

  // Calcular totales por producto
  const resumenProductos = productos.map(prod => {
    const rows = filtered.filter(i => i.producto === prod)
    const totalEntregado = rows.reduce((s, r) => s + (r.entregado_logistica || 0), 0)
    const totalVendido = rows.reduce((s, r) => s + (r.vendido_cliente || 0), 0)
    const pendiente = totalEntregado - totalVendido
    // Separar sobran vs faltan por talla
    const sobran = rows.reduce((s, r) => { const p = (r.entregado_logistica||0)-(r.vendido_cliente||0); return s + (p > 0 ? p : 0) }, 0)
    const faltan = rows.reduce((s, r) => { const p = (r.entregado_logistica||0)-(r.vendido_cliente||0); return s + (p < 0 ? Math.abs(p) : 0) }, 0)
    return { prod, totalEntregado, totalVendido, pendiente, sobran, faltan }
  })

  const totalSobran = resumenProductos.reduce((s, r) => s + r.sobran, 0)
  const totalFaltan = resumenProductos.reduce((s, r) => s + r.faltan, 0)

  return (
    <div className="p-8 space-y-6">
      {/* Cabecera */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reconciliación de Stock</h1>
          <p className="text-gray-500">Control de prendas: qué entregó logística vs. qué se vendió al cliente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-1" /> Actualizar</Button>
          <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={handleImportarInicial} disabled={saving}>
            📥 Importar Datos La Cotorrisa
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Añadir Registro
          </Button>
        </div>
      </div>

      {/* Filtro cliente + Totales globales */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <Label className="text-sm text-gray-500 shrink-0">Cliente:</Label>
          <Select value={clienteFilter} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los Clientes</SelectItem>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {totalSobran > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <PackageCheck className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-green-700 font-medium">Falta por devolver al cliente</p>
                <p className="text-xl font-bold text-green-700">+{totalSobran} piezas</p>
              </div>
            </div>
          )}
          {totalFaltan > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <PackageX className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-xs text-red-600 font-medium">Falta por recibir del cliente</p>
                <p className="text-xl font-bold text-red-600">-{totalFaltan} piezas</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cards resumen por producto */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {resumenProductos.map(({ prod, totalEntregado, totalVendido, pendiente, sobran, faltan }) => (
          <div key={prod} className="bg-white rounded-xl border-2 border-gray-100 p-4 shadow-sm">
            <p className="font-bold text-gray-800 text-sm mb-3">{prod}</p>
            <div className="space-y-1.5 text-xs text-gray-600 mb-3">
              <div className="flex justify-between"><span>Entregado a Logística</span><span className="font-semibold">{totalEntregado}</span></div>
              <div className="flex justify-between"><span>Vendido al Cliente</span><span className="font-semibold">{totalVendido}</span></div>
            </div>
            <div className="space-y-1.5 border-t pt-2">
              {sobran > 0 && (
                <div className="flex items-center justify-between bg-green-50 rounded-md px-2 py-1">
                  <span className="text-xs text-green-700 flex items-center gap-1"><ArrowUp className="w-3 h-3" /> Sobran — devolver</span>
                  <span className="font-bold text-green-700 text-sm">+{sobran}</span>
                </div>
              )}
              {faltan > 0 && (
                <div className="flex items-center justify-between bg-red-50 rounded-md px-2 py-1">
                  <span className="text-xs text-red-600 flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Faltan — cliente debe</span>
                  <span className="font-bold text-red-600 text-sm">-{faltan}</span>
                </div>
              )}
              {sobran === 0 && faltan === 0 && (
                <div className="text-xs text-gray-400 text-center py-1">✅ Todo cuadrado</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabla detallada por talla */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          <p>No hay datos. Usa el botón <strong>"Importar Datos La Cotorrisa"</strong> para cargar el inventario inicial.</p>
        </div>
      ) : (
        productos.map(prod => {
          const rows = filtered.filter(i => i.producto === prod)
          const totEnt = rows.reduce((s, r) => s + (r.entregado_logistica || 0), 0)
          const totVen = rows.reduce((s, r) => s + (r.vendido_cliente || 0), 0)
          const totPend = totEnt - totVen
          return (
            <div key={prod} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{prod}</h3>
                <span className={`text-sm font-semibold ${totPend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Balance: {totPend > 0 ? `+${totPend}` : totPend} piezas
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead>Talla</TableHead>
                    <TableHead className="text-center">📦 Entregado a Logística</TableHead>
                    <TableHead className="text-center">🛍️ Vendido al Cliente</TableHead>
                    <TableHead className="text-center font-bold">⚖️ Pendiente</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const pend = (row.entregado_logistica || 0) - (row.vendido_cliente || 0)
                    const isEditing = editingId === row.id
                    return (
                      <TableRow key={row.id} className={pend < 0 ? 'bg-red-50/40' : pend > 0 ? 'bg-green-50/30' : ''}>
                        <TableCell className="font-semibold text-gray-700">{row.talla}</TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <Input type="number" min="0" value={editVals.entregado} onChange={e => setEditVals({...editVals, entregado: parseInt(e.target.value)||0})} className="w-20 mx-auto text-center h-8 text-sm" />
                          ) : (
                            <span className="font-medium">{row.entregado_logistica}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <Input type="number" min="0" value={editVals.vendido} onChange={e => setEditVals({...editVals, vendido: parseInt(e.target.value)||0})} className="w-20 mx-auto text-center h-8 text-sm" />
                          ) : (
                            <span className="font-medium">{row.vendido_cliente}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold text-base ${pend > 0 ? 'text-green-700' : pend < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {pend > 0 ? `+${pend}` : pend}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {pend > 0 && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Devolver</span>}
                          {pend < 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Cliente debe</span>}
                          {pend === 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Cuadrado ✓</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white mr-1" onClick={() => handleSaveEdit(row.id)}>
                              <Save className="w-3 h-3 mr-1" /> Guardar
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => { setEditingId(row.id); setEditVals({ entregado: row.entregado_logistica, vendido: row.vendido_cliente }) }} className="mr-1">
                              Editar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Fila de totales */}
                  <TableRow className="bg-gray-100 font-bold">
                    <TableCell className="text-gray-600">TOTAL</TableCell>
                    <TableCell className="text-center">{totEnt}</TableCell>
                    <TableCell className="text-center">{totVen}</TableCell>
                    <TableCell className={`text-center text-base ${totPend >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {totPend > 0 ? `+${totPend}` : totPend}
                    </TableCell>
                    <TableCell colSpan={2} className={`text-sm ${totPend >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {totPend > 0 ? `🟢 ${totPend} piezas a devolver a La Cotorrisa` : totPend < 0 ? `🔴 La Cotorrisa debe entregar ${Math.abs(totPend)} piezas` : '✅ Sin pendientes'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )
        })
      )}

      {/* Modal agregar */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4">Añadir Registro Manual</Dialog.Title>
            <div className="space-y-3">
              <div>
                <Label>Cliente</Label>
                <Select value={newCliente} onValueChange={setNewCliente}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                  <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Producto</Label>
                  <Input placeholder="Ej: Playera Negra" value={newProducto} onChange={e => setNewProducto(e.target.value)} />
                </div>
                <div>
                  <Label>Talla</Label>
                  <Select value={newTalla} onValueChange={setNewTalla}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TALLAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>📦 Entregado a Logística</Label>
                  <Input type="number" min="0" value={newEntregado} onChange={e => setNewEntregado(parseInt(e.target.value)||0)} />
                </div>
                <div>
                  <Label>🛍️ Vendido al Cliente</Label>
                  <Input type="number" min="0" value={newVendido} onChange={e => setNewVendido(parseInt(e.target.value)||0)} />
                </div>
              </div>
              <div className={`p-3 rounded-lg text-sm font-medium ${(newEntregado - newVendido) >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                Pendiente: {newEntregado - newVendido > 0 ? `+${newEntregado - newVendido} devolver a cliente` : `${newEntregado - newVendido} cliente debe entregar`}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleAdd}>Guardar</Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
