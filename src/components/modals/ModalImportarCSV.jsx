import React, { useState, useRef } from 'react'
import { UploadCloud, File, AlertCircle, X, Check, Download, Link as LinkIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'

const requiredColumns = ['fecha_pedido', 'tipo_compra', 'nombre_comprador', 'productos', 'Talla', 'Cantidad', 'correo_comprador', 'telefono', 'direccion']
const optionalColumns = ['Paqueteria', 'guia', 'link_seguimiento', 'status']
const allColumns = ['fecha_pedido', 'tipo_compra', 'nombre_comprador', 'productos', 'Talla', 'Cantidad', 'Paqueteria', 'guia', 'link_seguimiento', 'status', 'correo_comprador', 'telefono', 'direccion']

// Mapeo de valores del CSV/Sheet a los valores internos del sistema
const normalizarStatus = (rawStatus) => {
  if (!rawStatus) return 'pendiente'
  const s = rawStatus.trim().toUpperCase()
  if (s.includes('ENTREGADO') || s === 'DELIVERED') return 'entregado'
  if (s.includes('PENDIENTE') || s.includes('ENVIO PENDIENTE') || s === 'PENDING') return 'pendiente'
  if (s.includes('FALTA PRENDA') || s.includes('PRENDA')) return 'en_espera_prenda'
  if (s.includes('PROCESO DE ENTREGA') || s.includes('TRANSITO') || s.includes('TRÁNSITO') || s.includes('EN CAMINO')) return 'en_transito'
  if (s.includes('RETORNO') || s.includes('DEVOLUCION') || s.includes('DEVOLUCIÓN')) return 'problema'
  if (s.includes('RETRASO') || s.includes('TARDE')) return 'con_retraso'
  if (s.includes('GUIA') || s.includes('GUÍA') || s.includes('ESPERA_GUIA')) return 'en_espera_guia'
  const valoresInternos = ['pendiente', 'en_espera_guia', 'en_espera_prenda', 'en_transito', 'entregado', 'con_retraso', 'problema']
  const interno = rawStatus.trim().toLowerCase()
  if (valoresInternos.includes(interno)) return interno
  return 'pendiente'
}

// Parser de fechas robusto — soporta TODOS los formatos posibles de Google Sheets
const MESES_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}

const parseFecha = (raw) => {
  const hoy = new Date().toISOString().split('T')[0]
  if (!raw || raw.trim() === '') return hoy
  const f = raw.trim()

  // 1. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const d = new Date(f + 'T12:00:00')
    if (!isNaN(d)) return f
  }

  // 2. DD/MM/YYYY o D/M/YYYY (formato Mexico)
  const dmy = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const [, day, month, year] = dmy
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
  }

  // 3. MM/DD/YYYY (formato USA)
  const mdy = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdy) {
    const [, month, day, year] = mdy
    const yr = year.length === 2 ? '20' + year : year
    const d = new Date(`${yr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
  }

  // 4. "13 de mayo de 2026" o "13 DE MAYO 2026" (texto en español)
  const esMatch = f.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/)
  if (esMatch) {
    const [, day, mesStr, year] = esMatch
    const month = MESES_ES[mesStr.toLowerCase()]
    if (month) {
      const d = new Date(`${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`)
      if (!isNaN(d)) return d.toISOString().split('T')[0]
    }
  }

  // 5. "mayo 13, 2026" o "May 13 2026"
  const enMatch = f.toLowerCase().match(/([a-záéíóú]+)\s+(\d{1,2})[,\s]+(\d{4})/)
  if (enMatch) {
    const [, mesStr, day, year] = enMatch
    const month = MESES_ES[mesStr.toLowerCase()]
    if (month) {
      const d = new Date(`${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`)
      if (!isNaN(d)) return d.toISOString().split('T')[0]
    }
  }

  // 6. Número serial de Excel (Google Sheets a veces exporta así)
  if (/^\d{5}$/.test(f)) {
    const serial = parseInt(f)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(excelEpoch.getTime() + serial * 86400000)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
  }

  // 7. Intento genérico como último recurso
  const d = new Date(f)
  if (!isNaN(d)) return d.toISOString().split('T')[0]

  // Si nada funciona, usar hoy
  return hoy
}

export const ModalImportarCSV = ({ open, onOpenChange, cliente, onSuccess }) => {
  const [file, setFile] = useState(null)
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const fileInputRef = useRef(null)

  // Google Sheets Integration
  const [sheetUrl, setSheetUrl] = useState('')
  const [fetchingSheet, setFetchingSheet] = useState(false)

  React.useEffect(() => {
    if (open) {
      const fetchPaqueterias = async () => {
        const { data } = await supabase.from('paqueterias').select('id, nombre')
        if (data) setPaqueterias(data)
      }
      fetchPaqueterias()
    }
  }, [open])

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected && selected.type === 'text/csv') {
      parseCSV(selected)
    } else {
      toast.error('Por favor, selecciona un archivo CSV válido.')
    }
  }

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + allColumns.join(',') + "\n2023-10-15,GENERAL,Juan Perez,Playera,M,2,FedEx,1234567890,https://rastreo.com/123,pendiente,juan@email.com,555555555,CDMX Centro"
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "plantilla_pedidos.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const processCSVText = (text, fileName) => {
    // Función robusta para parsear todo el CSV respetando comillas y saltos de línea
    const parseCSVData = (text) => {
      const result = [];
      let currentRow = [];
      let currentCell = '';
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentCell += '"';
            i++; // omitir comilla escapada
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
          if (char === '\r') i++; // saltar \n de \r\n
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c !== '')) result.push(currentRow);
          currentRow = [];
          currentCell = '';
        } else if (char === '\r' && !inQuotes) {
          // Ignorar carriage return fuera de comillas
        } else {
          currentCell += char;
        }
      }
      if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) result.push(currentRow);
      }
      return result;
    }

    const rows = parseCSVData(text)
    if (rows.length < 2) {
      toast.error('El documento está vacío o no tiene encabezados')
      return
    }

    const csvHeaders = rows[0]
    setHeaders(csvHeaders)

    const parsedData = rows.slice(1).map(rowValues => {
      const obj = {}
      csvHeaders.forEach((header, i) => {
        let val = rowValues[i] !== undefined ? rowValues[i] : ''
        val = val.replace(/\n|\r/g, ' ').trim()
        // Google Sheets exporta #ERROR! cuando un campo empieza con + (ej: +52 en teléfonos)
        // Lo limpiamos para que no rompa la importación
        if (val === '#ERROR!' || val === '#ERROR') val = ''
        obj[header] = val
      })
      return obj
    })

    setData(parsedData)
    setFile({ name: fileName }) // Mock file object

    // Auto-mapping: primero match exacto (case-insensitive), luego parcial como fallback
    const initialMapping = {}
    allColumns.forEach(col => {
      // 1. Match exacto
      const exactMatch = csvHeaders.find(h => h.trim().toLowerCase() === col.trim().toLowerCase())
      if (exactMatch) { initialMapping[col] = exactMatch; return }
      // 2. Match parcial solo si la columna tiene guión bajo
      if (col.includes('_')) {
        const prefix = col.split('_')[0].toLowerCase()
        const partialMatch = csvHeaders.find(h => h.trim().toLowerCase().startsWith(prefix))
        if (partialMatch) initialMapping[col] = partialMatch
      }
    })
    setMapping(initialMapping)
  }

  const handleFetchSheet = async () => {
    try {
      if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
        return toast.error('Enlace inválido. Asegúrate de que sea un enlace de Google Sheets.')
      }

      setFetchingSheet(true)

      const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
      const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/)

      if (!idMatch) {
        setFetchingSheet(false)
        return toast.error('No se pudo extraer el ID del documento.')
      }

      const docId = idMatch[1]
      const gid = gidMatch ? gidMatch[1] : '0'

      const pubUrl = `https://docs.google.com/spreadsheets/d/${docId}/pub?output=csv&gid=${gid}&single=true`
      const exportUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`

      let text = null

      // Intento 1: pub URL directa
      try {
        const r = await fetch(pubUrl)
        if (r.ok) {
          const t = await r.text()
          if (!t.trim().startsWith('<!DOCTYPE')) text = t
        }
      } catch (_) { }

      // Intento 2: export URL directa
      if (!text) {
        try {
          const r = await fetch(exportUrl)
          if (r.ok) {
            const t = await r.text()
            if (!t.trim().startsWith('<!DOCTYPE')) text = t
          }
        } catch (_) { }
      }

      // Intento 3: proxy CORS (allorigins.win)
      if (!text) {
        try {
          const r = await fetch(proxyUrl)
          if (r.ok) {
            const t = await r.text()
            if (!t.trim().startsWith('<!DOCTYPE')) text = t
          }
        } catch (_) { }
      }

      if (!text) {
        throw new Error('No se pudo leer el documento. En Google Sheets ve a Archivo → Descargar → CSV y sube el archivo directamente.')
      }

      processCSVText(text, `Google_Sheet_${docId.substring(0, 5)}.csv`)
      toast.success('¡Hoja de cálculo extraída exitosamente!')
    } catch (err) {
      toast.error('Error al descargar la hoja', { description: err.message })
    } finally {
      setFetchingSheet(false)
    }
  }

  const parseCSV = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      processCSVText(text, file.name)
    }
    reader.readAsText(file)
  }

  const resetState = () => {
    setFile(null)
    setData([])
    setHeaders([])
    setMapping({})
    setErrors([])
    setSheetUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    const missingMaps = requiredColumns.filter(col => !mapping[col])
    if (missingMaps.length > 0) {
      return toast.error(`Faltan mapear columnas obligatorias: ${missingMaps.join(', ')}`)
    }



    setLoading(true)
    setErrors([])
    let successCount = 0
    let errs = []

    // Sin agrupación: cada fila del CSV = un pedido independiente
    const arrayPedidos = data.map((row, index) => ({
      rowOriginal: row,
      productos: [{
        nombre: row[mapping.productos] || 'Producto',
        talla: mapping.Talla && row[mapping.Talla] ? row[mapping.Talla] : null,
        cantidad: mapping.Cantidad && row[mapping.Cantidad] ? parseInt(row[mapping.Cantidad], 10) || 1 : 1
      }],
      indices: [index + 2]
    }))

    for (let i = 0; i < arrayPedidos.length; i++) {
      const { rowOriginal: row, productos, indices } = arrayPedidos[i]
      try {
        let paqId = null
        if (mapping.Paqueteria && row[mapping.Paqueteria]) {
          const paqName = row[mapping.Paqueteria].trim().toLowerCase()
          const foundPaq = paqueterias.find(p => p.nombre.toLowerCase() === paqName)
          if (foundPaq) paqId = foundPaq.id
        }

        // Validar y parsear fecha — soporta DD/MM/YYYY, YYYY-MM-DD, texto en español, etc.
        const rawFecha = row[mapping.fecha_pedido]
        const parsedFecha = parseFecha(rawFecha)

        const rawTipo = (row[mapping.tipo_compra] || '').trim().toUpperCase()
        const tipoNormalizado = rawTipo.includes('EXCLU') ? 'EXCLUSIVOS' : 'GENERAL'

        const pedidoData = {
          cliente_id: cliente.id,
          tipo_compra: tipoNormalizado,
          fecha_pedido: parsedFecha,
          nombre_comprador: row[mapping.nombre_comprador] || 'Por asignar',
          correo_comprador: row[mapping.correo_comprador]?.trim() || '-',
          telefono: row[mapping.telefono] || '',
          direccion: row[mapping.direccion] || 'Sin dirección',
          productos: productos,
          paqueteria_id: paqId,
          guia: mapping.guia && row[mapping.guia] ? row[mapping.guia] : null,
          link_seguimiento: mapping.link_seguimiento && row[mapping.link_seguimiento] ? row[mapping.link_seguimiento] : null,
          status: (() => {
            const rawSt = (mapping.status && row[mapping.status]) ? row[mapping.status] : ''
            console.log('[STATUS RAW]', rawSt) // debug
            const normalizado = normalizarStatus(rawSt)
            const validos = ['pendiente', 'en_espera_guia', 'en_espera_prenda', 'en_transito', 'entregado', 'con_retraso', 'problema']
            return validos.includes(normalizado) ? normalizado : 'pendiente'
          })()
        }

        const { error } = await supabase.from('pedidos').insert(pedidoData)
        if (error) throw error
        successCount++
      } catch (err) {
        errs.push(`Fila(s) ${indices.join(', ')}: ${err.message}`)
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

            <div className="flex items-center gap-4 py-2">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="text-sm text-gray-500 font-medium text-center">O extraer desde Google Sheets (Público)</span>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Pega el enlace de Google Sheets aquí..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="flex-1"
                disabled={fetchingSheet}
              />
              <Button
                onClick={handleFetchSheet}
                disabled={!sheetUrl || fetchingSheet}
                className="bg-[#10b981] hover:bg-[#059669] text-white"
              >
                {fetchingSheet ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Extraer
              </Button>
            </div>

            <div className="flex justify-center pt-2">
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
                {allColumns.map(col => (
                  <div key={col}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                      {col.replace('_', ' ')} {optionalColumns.includes(col) ? '(Opcional)' : '*'}
                    </label>
                    <Select
                      value={mapping[col] || ''}
                      onValueChange={(val) => setMapping(prev => ({ ...prev, [col]: val }))}
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
                      {allColumns.map(col => (
                        <TableHead key={col} className="text-xs">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {allColumns.map(col => (
                          <TableCell key={col} className="text-xs max-w-[150px] truncate">
                            {mapping[col] && row[mapping[col]] ? row[mapping[col]] : <span className="text-gray-400">-</span>}
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
