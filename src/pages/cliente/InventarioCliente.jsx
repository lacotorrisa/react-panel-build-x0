import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { PackageSearch, Building2, ArrowUpDown, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { toast } from 'sonner'

export const InventarioCliente = () => {
  const { perfil } = useAuth()
  const [inventario, setInventario] = useState([])
  const [empresasLogisticas, setEmpresasLogisticas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [logisticaFilter, setLogisticaFilter] = useState('all')
  const [dbError, setDbError] = useState(null)

  const fetchData = async () => {
    if (!perfil?.cliente_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setDbError(null)
    try {
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
      if (logRes.error) throw logRes.error

      setInventario(invRes.data || [])
      setEmpresasLogisticas(logRes.data || [])
    } catch (err) {
      console.error('Error fetching inventory:', err)
      setDbError(err.message || 'Error al conectar con la base de datos')
      toast.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (perfil) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [perfil])

  // Mensaje de diagnóstico si no hay cliente_id o hay cargando
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!perfil?.cliente_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-xl border max-w-2xl mx-auto shadow-lg space-y-4 my-8">
        <AlertCircle className="h-16 w-16 text-orange-500 animate-pulse" />
        <h3 className="text-xl font-black text-gray-800">⚠️ Cuenta de Cliente Sin Vincular</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Tu usuario de correo <strong className="text-gray-800">{perfil?.email}</strong> tiene el rol de cliente, pero no está vinculado a ninguna marca en la base de datos de producción de Supabase.
        </p>
        <div className="bg-orange-50 p-5 rounded-xl text-left text-xs text-orange-900 border border-orange-200 space-y-3 w-full">
          <p className="font-bold text-sm">🛠️ Para solucionarlo en 10 segundos:</p>
          <p>Copia y ejecuta la siguiente consulta SQL en tu <strong>Supabase Dashboard → SQL Editor → New Query</strong>:</p>
          <pre className="bg-[#1a1a2e] text-orange-200 p-4 rounded-lg font-mono overflow-x-auto text-[11px] leading-relaxed border border-orange-300/30">
{`UPDATE profiles 
SET rol = 'cliente', 
    cliente_id = (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1),
    nombre = 'La Cotorrisa Admin'
WHERE email = 'lacotorrisa@colivery.mx';`}
          </pre>
          <p className="text-[10px] text-orange-700 font-medium">💡 Nota: Si aún no existe el cliente 'La Cotorrisa' en la tabla clientes, primero ejecuta el archivo <code>ACTUALIZACION_PRODUCCION_COMPLETA.sql</code> que creamos en el proyecto.</p>
        </div>
      </div>
    )
  }

  if (dbError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-8 bg-white rounded-xl border max-w-3xl mx-auto shadow-lg space-y-4 my-8">
        <AlertCircle className="h-16 w-16 text-red-500 animate-bounce" />
        <h3 className="text-xl font-black text-red-600">⚠️ Error de Base de Datos Detectado</h3>
        <p className="text-sm text-gray-500 max-w-lg">
          No pudimos consultar tu inventario debido a que algunas tablas o permisos RLS faltan en la base de datos de producción de Supabase.
        </p>
        <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-xs text-red-700 font-mono text-left w-full">
          <strong>Detalle Técnico:</strong> {dbError}
        </div>
        <div className="bg-orange-50 p-5 rounded-xl text-left text-xs text-orange-900 border border-orange-200 space-y-3 w-full">
          <p className="font-bold text-sm">🚀 Solución en 1 Paso:</p>
          <p>
            Hemos preparado un script maestro unificado que crea todas las tablas de balance, corrige los roles de los usuarios y abre todos los permisos RLS.
          </p>
          <p className="font-semibold text-gray-700">Abre tu Supabase SQL Editor y ejecuta el contenido completo del archivo:</p>
          <div className="bg-[#1a1a2e] text-white p-3.5 rounded-lg font-mono text-[11px] font-bold border border-gray-800">
            📁 supabase / ACTUALIZACION_PRODUCCION_COMPLETA.sql
          </div>
          <p className="text-[10px] text-orange-700">
            Una vez ejecutado ese script, vuelve a cargar esta página. Todo se sincronizará automáticamente.
          </p>
        </div>
      </div>
    )
  }

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
