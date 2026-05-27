import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { PackageSearch, Building2, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { toast } from 'sonner'

export const InventarioCliente = () => {
  const { perfil } = useAuth()
  const [inventario, setInventario] = useState([])
  const [empresasLogisticas, setEmpresasLogisticas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [logisticaFilter, setLogisticaFilter] = useState('all')

  const fetchData = async () => {
    if (!perfil?.cliente_id) return
    try {
      setLoading(true)
      const [invRes, logRes] = await Promise.all([
        supabase
          .from('inventario')
          .select('*, empresas_logisticas(nombre)')
          .eq('cliente_id', perfil.cliente_id)
          .order('producto'),
        supabase
          .from('empresas_logisticas')
          .select('id, nombre')
          .eq('activo', true)
      ])
      
      if (invRes.error) throw invRes.error
      setInventario(invRes.data || [])
      setEmpresasLogisticas(logRes.data || [])
    } catch (err) {
      toast.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (perfil?.cliente_id) {
      fetchData()
    }
  }, [perfil])

  const filtered = inventario.filter(item => {
    const matchS = item.producto.toLowerCase().includes(searchTerm.toLowerCase())
    const matchL = logisticaFilter === 'all' || item.logistica_id === logisticaFilter
    return matchS && matchL
  })

  // KPIs
  const totalModelos = [...new Set(inventario.map(i => i.producto))].length
  const totalPiezas = inventario.reduce((acc, curr) => acc + (curr.cantidad || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mi Inventario</h2>
        <p className="text-sm text-gray-500">Consulta en tiempo real la disponibilidad de stock en cada bodega logística.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Artículos Diferentes</CardTitle>
            <PackageSearch className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-gray-800">{loading ? '…' : totalModelos} modelos</div>
            <p className="text-xs text-gray-400 mt-1">Variantes de producto registradas</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-gradient-to-br from-orange-50 to-white">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Stock Total Disponible</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-black text-orange-600">{loading ? '…' : totalPiezas} piezas</div>
            <p className="text-xs text-orange-500/80 mt-1">Suma total de prendas listas para envío</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1 min-w-[200px]">
          <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input 
            placeholder="Buscar por nombre de prenda..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <Select value={logisticaFilter} onValueChange={setLogisticaFilter}>
          <SelectTrigger className="w-[240px] bg-white"><SelectValue placeholder="Todas las Bodegas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Bodegas (Logísticas)</SelectItem>
            {empresasLogisticas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid/Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando existencias...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
            <PackageSearch className="w-12 h-12 text-gray-300 mb-2" />
            <p>No se encontraron prendas con los filtros aplicados.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Bodega Logística</TableHead>
                <TableHead>Producto / Variación</TableHead>
                <TableHead className="text-right">Unidades Disponibles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id} className="hover:bg-orange-50/20">
                  <TableCell className="font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      {item.empresas_logisticas?.nombre || 'General Warehouse'}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-gray-800">{item.producto}</TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      item.cantidad > 10 
                        ? 'bg-green-100 text-green-800' 
                        : item.cantidad > 0 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.cantidad} piezas
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
