import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Input } from '../../components/ui/input'
import { toast } from 'sonner'
import { PackageSearch, ArrowUpDown } from 'lucide-react'

export const InventarioPaqueteria = () => {
  const [inventario, setInventario] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('inventario')
        .select(`
          id, 
          producto, 
          cantidad, 
          updated_at,
          clientes(nombre)
        `)
        .order('producto', { ascending: true })

      if (error) throw error
      setInventario(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredInventory = inventario.filter(item => 
    item.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.clientes?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mi Inventario de Bodega</h1>
          <p className="text-gray-500">Consulta las existencias actuales de prendas en tu almacén</p>
        </div>
        <div className="relative w-full md:w-72">
          <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input 
            placeholder="Buscar prenda o cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Contando stock...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
            <PackageSearch className="w-12 h-12 text-gray-300 mb-2" />
            <p>Tu inventario está vacío o no coincide con la búsqueda.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="w-[150px]">Cliente (Dueño)</TableHead>
                <TableHead>Producto / Descripción</TableHead>
                <TableHead className="text-right">Stock Disponible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.id} className="hover:bg-orange-50/30 transition-colors">
                  <TableCell className="font-medium text-gray-600">
                    {item.clientes?.nombre || 'N/A'}
                  </TableCell>
                  <TableCell className="font-bold text-gray-800">
                    {item.producto}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800">
                      <ArrowUpDown className="w-3 h-3 mr-1 text-gray-500" />
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
