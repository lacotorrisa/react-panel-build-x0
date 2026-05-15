import React, { useState, useRef } from 'react'
import { UploadCloud, File, AlertCircle, X, Check, Download } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Badge } from '../ui/badge'

const requiredColumns = ['tipo_compra', 'fecha_pedido', 'nombre_comprador', 'correo_comprador', 'telefono', 'direccion', 'productos']

export const ModalImportarCSV = ({ open, onOpenChange, cliente, onSuccess }) => {
  const [file, setFile] = useState(null)
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected && selected.type === 'text/csv') {
      setFile(selected)
      parseCSV(selected)
    } else {
      toast.error('Por favor, selecciona un archivo CSV válido.')
    }
  }

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + requiredColumns.join(',') + "\nGeneral,2023-10-15,Juan Perez,juan@email.com,555555555,CDMX Centro,2x Playera M"
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "plantilla_pedidos.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const parseCSV = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const rows = text.split('\n').filter(row => row.trim() !== '')
      if (rows.length < 2) {
        toast.error('El CSV está vacío o no tiene encabezados')
        return
      }

      const csvHeaders = rows[0].split(',').map(h => h.trim().replace(/"/g, ''))
      setHeaders(csvHeaders)
      
      const parsedData = rows.slice(1).map(row => {
        const values = row.split(',').map(v => v.trim().replace(/"/g, ''))
        const obj = {}
        csvHeaders.forEach((header, i) => {
          obj[header] = values[i]
        })
        return obj
      })

      setData(parsedData)
      
      // Auto-mapping simple
      const initialMapping = {}
      requiredColumns.forEach(reqCol => {
        const match = csvHeaders.find(h => h.toLowerCase() === reqCol.toLowerCase() || h.toLowerCase().includes(reqCol.split('_')[0]))
        if (match) initialMapping[reqCol] = match
      })
      setMapping(initialMapping)
    }
    reader.readAsText(file)
  }

  const resetState = () => {
    setFile(null)
    setData([])
    setHeaders([])
    setMapping({})
    setErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const parseProductos = (prodString) => {
    // Basic parser for "Playera M x2, Hoodie L x1"
    if (!prodString) return [{ nombre: 'Producto Desconocido', cantidad: 1 }]
    
    const items = prodString.split(',')
    return items.map(item => {
      let nombre = item.trim()
      let cantidad = 1
      let talla = null
      
      const qtyMatch = item.match(/x(\d+)$/i)
      if (qtyMatch) {
        cantidad = parseInt(qtyMatch[1], 10)
        nombre = nombre.replace(qtyMatch[0], '').trim()
      }
      
      const sizeMatch = nombre.match(/ (XS|S|M|L|XL|XXL)$/i)
      if (sizeMatch) {
        talla = sizeMatch[1]
        nombre = nombre.replace(sizeMatch[0], '').trim()
      }
      
      return { nombre, cantidad, talla }
    })
  }

  const handleImport = async () => {
    const missingMaps = requiredColumns.filter(col => !mapping[col])
    if (missingMaps.length > 0) {
      return toast.error(`Faltan mapear columnas: ${missingMaps.join(', ')}`)
    }



    setLoading(true)
    setErrors([])
    let successCount = 0
    let errs = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      try {
        const pedidoData = {
          cliente_id: cliente.id,
          tipo_compra: row[mapping.tipo_compra] || 'General',
          fecha_pedido: new Date(row[mapping.fecha_pedido]).toISOString().split('T')[0],
          nombre_comprador: row[mapping.nombre_comprador],
          correo_comprador: row[mapping.correo_comprador],
          telefono: row[mapping.telefono] || '',
          direccion: row[mapping.direccion],
          productos: parseProductos(row[mapping.productos]),
          status: 'pendiente'
        }

        if (!pedidoData.nombre_comprador) {
          throw new Error('Faltan datos obligatorios')
        }

        const { error } = await supabase.from('pedidos').insert(pedidoData)
        if (error) throw error
        successCount++
      } catch (err) {
        errs.push(`Fila ${i + 2}: ${err.message}`)
      }
    }

    setLoading(false)
    if (errs.length > 0) {
      setErrors(errs)
      toast.warning(`Se importaron ${successCount} pedidos con ${errs.length} errores.`)
    } else {
      toast.success(`Se importaron ${successCount} pedidos exitosamente`)
      onOpenChange(false)
      resetState()
      onSuccess()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val)
      if (!val) resetState()
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Pedidos (CSV)</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV y mapea las columnas para importar pedidos masivamente para {cliente?.nombre}.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv"
                onChange={handleFileChange}
              />
              <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700">Haz clic para subir un archivo CSV</p>
              <p className="text-sm text-gray-500 mt-2">Sólo archivos .csv delimitados por comas</p>
            </div>
            
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={downloadTemplate} className="text-[#FF6600] border-[#FF6600] hover:bg-[#FFF0E6]">
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center">
                <File className="h-6 w-6 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium text-blue-900">{file.name}</p>
                  <p className="text-sm text-blue-700">{data.length} filas detectadas</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={resetState}>
                <X className="h-4 w-4 mr-2" /> Cambiar
              </Button>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Mapeo de Columnas</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
                {requiredColumns.map(reqCol => (
                  <div key={reqCol}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                      {reqCol.replace('_', ' ')}
                    </label>
                    <Select 
                      value={mapping[reqCol] || ''} 
                      onValueChange={(val) => setMapping(prev => ({...prev, [reqCol]: val}))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center text-red-800 font-medium mb-2">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Errores durante la importación
                </div>
                <ul className="list-disc pl-5 text-sm text-red-700 max-h-32 overflow-y-auto">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Vista Previa (5 filas)</h4>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {requiredColumns.map(col => (
                        <TableHead key={col} className="text-xs">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {requiredColumns.map(col => (
                          <TableCell key={col} className="text-xs max-w-[150px] truncate">
                            {mapping[col] ? row[mapping[col]] : <span className="text-gray-400">-</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleImport} disabled={loading} className="bg-[#009B5B] hover:bg-[#00804b]">
                {loading ? 'Importando...' : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Importar {data.length} Pedidos
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
