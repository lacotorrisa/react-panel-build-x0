import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart2, Upload, Plus, RefreshCw, X, AlertCircle,
  TrendingUp, TrendingDown, DollarSign, Package, Truck,
  ChevronDown, ChevronUp, Check, FileText, Trash2, Save
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Card, CardContent } from '../../components/ui/card'

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
const fmtPct = v => `${Number(v || 0).toFixed(1)}%`
const today = () => new Date().toISOString().split('T')[0]

const calcRow = (row, isDuplicateOrder, mode = '20') => {
  const pt  = parseFloat(row.precio_tienda  || 0)
  
  // Rule: shipping was only charged from April 1st, 2026.
  // Before April 1st, 2026, shipping is $0.
  // On/after April 1st, 2026, shipping is $99 for the first item of the order, and $0 for subsequent items of the same order.
  let pe = parseFloat(row.precio_envio || 99)
  if (row.fecha_compra && row.fecha_compra < '2026-04-01') {
    pe = 0
  } else if (isDuplicateOrder) {
    pe = 0
  }

  const comisionPct = mode === '10' ? 0.10 : 0.20
  const comision = pt * comisionPct // 10% or 20% commission (Colivery)
  const utilidad = pt * (1 - comisionPct) // 90% or 80% Utility (Cotorrisa libres)
  const almacenaje = mode === '10' ? 0 : pt * 0.03 // 3% Almacenaje (0% for 10% mode since Cotorrisa stores in their office)

  const cg  = parseFloat(row.costo_guia     || 0)
  const margen   = pe - cg
  
  // Pasarela de pago: 3.6% of (precio_tienda + precio_envio) + 3 MXN
  const pasarela = (pt + pe) * 0.036 + 3
  
  const totalColivery = comision
  const netColivery = comision - pasarela - almacenaje

  return { 
    ...row, 
    precio_envio: pe, 
    _comision: comision, 
    _utilidad: utilidad, 
    _almacenaje: almacenaje,
    _margen: margen,
    _pasarela: pasarela,
    _totalColivery: totalColivery,
    _netColivery: netColivery
  }
}

// ─── Modal: Agregar fila manual ─────────────────────────────────────────────────
const ModalAgregar = ({ clienteId, onClose, onSuccess, mode = '20' }) => {
  const [form, setForm] = useState({
    numero_pedido: '', nombre: '', telefono: '',
    fecha_compra: today(), producto: '',
    precio_tienda: '', precio_envio: '99',
    comision_pct: mode === '10' ? '10' : '20', costo_guia: '', notas: ''
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const r = calcRow(form, false, mode)

  const handleGuardar = async () => {
    if (!form.numero_pedido.trim()) return toast.error('El número de pedido es requerido')
    if (!form.precio_tienda || parseFloat(form.precio_tienda) <= 0) return toast.error('Precio tienda inválido')
    setSaving(true)
    try {
      const { error } = await supabase.from('trazabilidad_guias').insert({
        cliente_id: clienteId,
        numero_pedido: form.numero_pedido.trim(),
        nombre: form.nombre || null,
        telefono: form.telefono || null,
        fecha_compra: form.fecha_compra || null,
        producto: form.producto || null,
        precio_tienda: parseFloat(form.precio_tienda),
        precio_envio: parseFloat(form.precio_envio || 99),
        comision_pct: parseFloat(form.comision_pct || 20),
        costo_guia: parseFloat(form.costo_guia || 0),
        notas: form.notas || null,
      })
      if (error) throw error
      toast.success('✅ Registro agregado correctamente')
      onSuccess()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-500" /> Agregar Registro Manual
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4">

          {/* Datos del pedido */}
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Datos del Pedido</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Número de Pedido *</label>
              <input value={form.numero_pedido} onChange={e => set('numero_pedido', e.target.value)}
                placeholder="ORD-001" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Fecha de Compra</label>
              <input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Nombre del Cliente</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre completo" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="55 1234 5678" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Producto</label>
            <input value={form.producto} onChange={e => set('producto', e.target.value)}
              placeholder="Descripción del producto" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Datos financieros */}
          <div className="border-t pt-4">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Datos Financieros</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Precio Tienda * (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={form.precio_tienda} onChange={e => set('precio_tienda', e.target.value)}
                    placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm font-bold" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Precio Envío (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={form.precio_envio} onChange={e => set('precio_envio', e.target.value)}
                    className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Comisión Colivery (%)</label>
                <input type="number" value={form.comision_pct} onChange={e => set('comision_pct', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Costo Guía Real (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={form.costo_guia} onChange={e => set('costo_guia', e.target.value)}
                    placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Preview calculado */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border grid grid-cols-4 gap-2 text-center text-[10px]">
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Tu Utilidad (80%)</p>
              <p className="font-black text-green-700 text-sm mt-0.5">{fmt(r._utilidad)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Comisión (20%)</p>
              <p className="font-black text-orange-600 text-sm mt-0.5">{fmt(r._comision)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Almacenaje (3%)</p>
              <p className="font-black text-amber-600 text-sm mt-0.5">{fmt(r._almacenaje)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Margen Guía</p>
              <p className={`font-black text-sm mt-0.5 ${r._margen >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(r._margen)}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Notas (opcional)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-2.5 text-sm font-black text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar Registro</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Subir CSV ───────────────────────────────────────────────────────────
const ModalCSV = ({ clienteId, onClose, onSuccess, mode = '20' }) => {
  const [preview, setPreview]   = useState([])
  const [errors,  setErrors]    = useState([])
  const [saving,  setSaving]    = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef()

  const parseCSV = (text) => {
    // ── Parsear CSV respetando campos entre comillas ─────────────────────────
    const parseRow = (line) => {
      const cols = []
      let cur = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQ = !inQ; continue }
        if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue }
        cur += ch
      }
      cols.push(cur.trim())
      return cols
    }

    // Limpiar valor monetario: "$1,749.00" → 1749  /  " $-   " → 0
    const parseMXN = (v) => {
      if (!v) return null
      const cleaned = v.replace(/[$,\s]/g, '').replace('$-', '0')
      const n = parseFloat(cleaned)
      return isNaN(n) ? null : n
    }

    const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return { rows: [], errs: ['El archivo CSV está vacío o solo tiene encabezados.'] }

    const rawHeader = parseRow(lines[0])
    // Normalizar encabezados para búsqueda flexible
    const header = rawHeader.map(h => h.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))

    const rows = []
    const errs = []

    const find = (alts) => { for (const a of alts) { const i = header.indexOf(a); if (i !== -1) return i } return -1 }

    const idxNombre   = find(['cliente','nombre','nombre_cliente','name'])
    const idxProd     = find(['prenda','producto','product','articulo','descripcion'])
    const idxTalla    = find(['talla','size','medida'])
    const idxPrecio   = find(['precio_prenda','precio_tienda','precio','price','venta','monto'])
    const idxComision = find(['comision_colivery','comision','comision_pct','pct'])
    const idxEnvColi  = find(['costo_envio_colivery','precio_envio','envio_colivery','envio','shipping'])
    const idxGuia     = find(['guia_costo','costo_guia','guia','precio_guia'])
    const idxEstado   = find(['estado','ciudad','city','region'])
    const idxEnvReal  = find(['envio_real','costo_real_envio'])
    const idxPasarela = find(['pasarela_pago','pasarela'])
    const idxAlmac    = find(['almacenamiento','almacen','storage'])
    const idxPedido   = find(['numero_pedido','pedido','order','folio','num_pedido','id'])

    if (idxPrecio === -1) {
      errs.push('⚠️ No se encontró "Precio Prenda". Columnas detectadas: ' + header.join(', '))
      return { rows: [], errs }
    }

    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return
      const cols = parseRow(line)

      const precio = parseMXN(cols[idxPrecio])
      if (precio === null || precio <= 0) return  // fila de totales u otra sin precio

      const nombre  = idxNombre !== -1 ? (cols[idxNombre] || '').trim() : ''
      const prenda  = idxProd   !== -1 ? (cols[idxProd]   || '').trim() : ''
      const talla   = idxTalla  !== -1 ? (cols[idxTalla]  || '').trim() : ''
      const estado  = idxEstado !== -1 ? (cols[idxEstado] || '').trim() : ''

      const envColi   = idxEnvColi  !== -1 ? parseMXN(cols[idxEnvColi])  : null
      const costoGuia = idxGuia     !== -1 ? parseMXN(cols[idxGuia])     : null
      const envReal   = idxEnvReal  !== -1 ? parseMXN(cols[idxEnvReal])  : null
      const pasarela  = idxPasarela !== -1 ? parseMXN(cols[idxPasarela]) : null
      const almac     = idxAlmac    !== -1 ? parseMXN(cols[idxAlmac])    : null

      let comisionPct = 20
      if (idxComision !== -1) {
        const cv = parseMXN(cols[idxComision])
        if (cv !== null && precio > 0) comisionPct = Math.round((cv / precio) * 1000) / 10
      }

      const numPedido = (idxPedido !== -1 && cols[idxPedido]?.trim())
        ? cols[idxPedido].trim()
        : `CSV-${String(i + 1).padStart(3, '0')}`

      const producto = talla ? `${prenda} (${talla})` : prenda

      const notas = [
        estado           ? `Estado: ${estado}`         : '',
        pasarela != null ? `Pasarela: $${pasarela}`    : '',
        almac    != null ? `Almacenaje: $${almac}`     : '',
        envReal  != null ? `Envío real: $${envReal}`   : '',
      ].filter(Boolean).join(' | ') || null

      rows.push({
        numero_pedido: numPedido,
        nombre:        nombre   || null,
        producto:      producto || null,
        precio_tienda: precio,
        precio_envio:  envColi  ?? 99,
        comision_pct:  comisionPct,
        costo_guia:    costoGuia ?? 0,
        notas,
      })
    })

    return { rows, errs }
  }


  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) return toast.error('Solo archivos .csv')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { rows, errs } = parseCSV(ev.target.result)
      setPreview(rows.map(r => calcRow(r, false, mode)))
      setErrors(errs)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportar = async () => {
    if (!preview.length) return
    setSaving(true)
    try {
      const payload = preview.map(r => ({
        cliente_id:    clienteId,
        numero_pedido: r.numero_pedido,
        nombre:        r.nombre        || null,
        telefono:      r.telefono      || null,
        fecha_compra:  r.fecha_compra  || null,
        producto:      r.producto      || null,
        precio_tienda: r.precio_tienda || 0,
        precio_envio:  r.precio_envio  || 99,
        comision_pct:  r.comision_pct  || 20,
        costo_guia:    r.costo_guia    || 0,
        notas:         r.notas         || null,
      }))

      const BATCH = 50
      let insertados = 0
      for (let i = 0; i < payload.length; i += BATCH) {
        const chunk = payload.slice(i, i + BATCH)
        const { error } = await supabase.from('trazabilidad_guias').insert(chunk)
        if (error) throw error
        insertados += chunk.length
      }
      toast.success(`${insertados} registros importados correctamente`)
      onSuccess()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" /> Importar CSV de Guías
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-5">

          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-2">
            <p className="font-black text-sm text-blue-900 flex items-center gap-1.5"><FileText className="w-4 h-4" />Formato del CSV — Compatible con el reporte de La Cotorrisa</p>
            <div className="font-mono bg-white border border-blue-200 rounded-lg p-3 text-blue-900 text-[11px] leading-relaxed overflow-x-auto">
              Cliente, Prenda, Talla, Precio Prenda, Comision Colivery, Total La Cotorrisa,<br/>
              Pasarela pago, Almacenamiento, Costo Envio Colivery, <strong>Guia Costo</strong>, Libre Colivery, Estado, Envio Real
            </div>
            <ul className="space-y-1 text-[11px]">
              <li>✅ Soporta precios con <strong>$ y comas</strong> (ej. "$1,749.00")</li>
              <li>✅ <strong>Guia Costo</strong> y <strong>Envio Real</strong> pueden ir vacíos — los editas después</li>
              <li>✅ Si no hay columna de número de pedido, se genera automáticamente (CSV-001, CSV-002…)</li>
              <li>✅ Talla se agrega al nombre del producto para mayor claridad</li>
              <li>✅ Estado, Pasarela y Almacenaje se guardan en las notas del registro</li>
            </ul>
          </div>

          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl py-10 cursor-pointer transition-all group">
            <Upload className="w-10 h-10 text-gray-300 group-hover:text-blue-400 transition-colors" />
            <div className="text-center">
              <p className="font-bold text-gray-500 group-hover:text-blue-600">
                {fileName ? `📄 ${fileName}` : 'Haz clic para seleccionar el CSV'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Solo archivos .csv · UTF-8</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>

          {/* Errores */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{e}
                </p>
              ))}
            </div>
          )}

          {/* Preview tabla */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-gray-700">{preview.length} filas listas para importar</p>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 inline mr-1" />Válido
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Pedido','Nombre','Fecha','Producto','P.Tienda','P.Envío','Comisión','C.Guía','Margen'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-black text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-bold text-gray-800">{r.numero_pedido}</td>
                        <td className="px-3 py-2 text-gray-600">{r.nombre || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.fecha_compra || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{r.producto || '—'}</td>
                        <td className="px-3 py-2 font-bold">{fmt(r.precio_tienda)}</td>
                        <td className="px-3 py-2">{fmt(r.precio_envio)}</td>
                        <td className="px-3 py-2 text-orange-600 font-bold">{fmt(r._comision)}</td>
                        <td className="px-3 py-2 text-blue-600 font-bold">{fmt(r.costo_guia)}</td>
                        <td className={`px-3 py-2 font-black ${r._margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(r._margen)}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-2 text-center text-gray-400 italic">
                          ... y {preview.length - 10} filas más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={handleImportar} disabled={saving || !preview.length || errors.length > 0}
            className="flex-1 py-2.5 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importando...</> : <><Upload className="w-4 h-4" />Importar {preview.length} registros</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal Admin ─────────────────────────────────────────────────────
export const TrazabilidadGuias = ({ mode = '20' }) => {
  const [clientes,       setClientes]       = useState([])
  const [clienteSelId,   setClienteSelId]   = useState('')
  const [filas,          setFilas]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [modalAgregar,   setModalAgregar]   = useState(false)
  const [modalCSV,       setModalCSV]       = useState(false)
  const [filtroFechaIni, setFiltroFechaIni] = useState('')
  const [filtroFechaFin, setFiltroFechaFin] = useState('')
  const [expandedRow,    setExpandedRow]    = useState(null)
  const [editingCosto,   setEditingCosto]   = useState({})

  const clienteNombre = clientes.find(c => c.id === clienteSelId)?.nombre || 'Cliente'

  useEffect(() => {
    supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => {
      setClientes(data || [])
      if (data?.length) setClienteSelId(data[0].id)
    })
  }, [])

  const fetchFilas = useCallback(async () => {
    if (!clienteSelId) { setFilas([]); setLoading(false); return }
    setLoading(true)
    let query = supabase.from('trazabilidad_guias').select('*')
      .eq('cliente_id', clienteSelId)
    if (filtroFechaIni) query = query.gte('fecha_compra', filtroFechaIni)
    if (filtroFechaFin) query = query.lte('fecha_compra', filtroFechaFin)
    const { data, error } = await query
    if (error) toast.error(error.message)
    
    // JS Filtering: keep only records based on mode
    const filtered = (data || []).filter(r => {
      if (mode === '10') {
        return r.fecha_compra && r.fecha_compra >= '2026-05-28'
      } else {
        return !r.fecha_compra || (r.fecha_compra >= '2026-04-01' && r.fecha_compra <= '2026-05-27')
      }
    })

    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.fecha_compra || ''
      const dateB = b.fecha_compra || ''
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA)
      }
      const pedA = a.numero_pedido || ''
      const pedB = b.numero_pedido || ''
      return pedB.localeCompare(pedA)
    })

    const seenPedidos = new Set()
    const mapped = sorted.map(row => {
      const pedKey = row.numero_pedido ? row.numero_pedido.trim().toUpperCase() : null
      let isDuplicate = false
      if (pedKey) {
        if (seenPedidos.has(pedKey)) {
          isDuplicate = true
        } else {
          seenPedidos.add(pedKey)
        }
      }
      return calcRow(row, isDuplicate, mode)
    })

    setFilas(mapped)
    setLoading(false)
  }, [clienteSelId, filtroFechaIni, filtroFechaFin, mode])

  useEffect(() => { fetchFilas() }, [fetchFilas])

  const guardarCosto = async (id) => {
    const nuevo = parseFloat(editingCosto[id])
    if (isNaN(nuevo) || nuevo < 0) return toast.error('Costo inválido')
    const { error } = await supabase.from('trazabilidad_guias').update({ costo_guia: nuevo }).eq('id', id)
    if (error) return toast.error(error.message)
    setEditingCosto(p => { const n = { ...p }; delete n[id]; return n })
    toast.success('Costo de guía actualizado')
    fetchFilas()
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return
    const { error } = await supabase.from('trazabilidad_guias').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Registro eliminado')
    fetchFilas()
  }

  const totalPrendas     = filas.reduce((s, r) => s + (r.precio_tienda || 0), 0)
  const totalSaldoEnvio  = filas.reduce((s, r) => s + (r.precio_envio  || 0), 0)
  const totalVentas      = totalPrendas + totalSaldoEnvio
  const totalComision    = filas.reduce((s, r) => s + (r._comision     || 0), 0)
  const totalUtilidadCli = filas.reduce((s, r) => s + (r._utilidad     || 0), 0)
  const totalAlmacenaje  = filas.reduce((s, r) => s + (r._almacenaje   || 0), 0)
  const totalCostoGuias  = filas.reduce((s, r) => s + (r.costo_guia    || 0), 0)
  const totalMargenGuias = totalSaldoEnvio - totalCostoGuias
  const totalPasarela    = filas.reduce((s, r) => s + (r._pasarela     || 0), 0)
  const totalColivery    = totalComision
  const totalNeto        = totalComision - totalPasarela - totalAlmacenaje

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const comisionPctText = mode === '10' ? '10%' : '20%'
  const utilidadPctText = mode === '10' ? '90%' : '80%'

  const kpis = [
    {
      label: 'Total Ventas Brutas',
      value: fmt(totalVentas),
      sub: `${fmt(totalPrendas)} prendas + ${fmt(totalSaldoEnvio)} envíos · ${filas.length} productos`,
      gradient: 'from-indigo-600 to-blue-700',
      icon: Package,
    },
    {
      label: `Utilidad ${clienteNombre} (Libres ${utilidadPctText})`,
      value: fmt(totalUtilidadCli),
      sub: `Prendas − ${mode === '10' ? '10.0%' : '20.0%'} comisión Colivery`,
      gradient: 'from-green-600 to-emerald-700',
      icon: TrendingUp,
    },
    {
      label: 'Total Colivery (NET)',
      value: fmt(totalNeto),
      sub: `${fmt(totalComision)} comisión − ${fmt(totalPasarela)} pasarela − ${fmt(totalAlmacenaje)} almac.`,
      gradient: totalNeto >= 0 ? 'from-orange-500 to-amber-600' : 'from-red-500 to-rose-600',
      icon: DollarSign,
    },
    {
      label: 'Margen en Guías',
      value: fmt(totalMargenGuias),
      sub: `${fmt(totalSaldoEnvio)} cobrado − ${fmt(totalCostoGuias)} real`,
      gradient: totalMargenGuias >= 0 ? 'from-teal-500 to-cyan-600' : 'from-red-500 to-rose-700',
      icon: totalMargenGuias >= 0 ? TrendingUp : TrendingDown,
    },
  ]

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-orange-500" /> Trazabilidad de Guías
            {mode === '10'
              ? <span className="bg-blue-100 text-blue-800 text-xs font-black px-2 py-1 rounded-full">10% Colivery — May 28 en adelante</span>
              : <span className="bg-orange-100 text-orange-800 text-xs font-black px-2 py-1 rounded-full">20% Colivery — Abr 1 al 27 May</span>}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === '10'
              ? 'Transparencia financiera por pedido — Admin · Comisión 10% (desde 28 de Mayo 2026 en adelante)'
              : 'Transparencia financiera por pedido — Admin · Comisión 20% (del 1ro de Abril al 27 de Mayo 2026)'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchFilas} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-3 py-2 rounded-xl">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button onClick={() => setModalCSV(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-md">
            <Upload className="w-4 h-4" /> Subir CSV
          </button>
          <button onClick={() => setModalAgregar(true)}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-md">
            <Plus className="w-4 h-4" /> Agregar Manual
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end bg-white border rounded-xl p-4">
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Cliente</label>
          <select value={clienteSelId} onChange={e => setClienteSelId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm font-bold min-w-[200px]">
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Fecha desde</label>
          <input type="date" value={filtroFechaIni} onChange={e => setFiltroFechaIni(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Fecha hasta</label>
          <input type="date" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        {(filtroFechaIni || filtroFechaFin) && (
          <button onClick={() => { setFiltroFechaIni(''); setFiltroFechaFin('') }}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-500 border rounded-lg px-3 py-2 mt-5">
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <Card key={k.label} className={`border-0 shadow-md bg-gradient-to-br ${k.gradient} text-white overflow-hidden`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{k.label}</p>
                    <p className="text-2xl font-black mt-1 leading-tight">{k.value}</p>
                    <p className="text-[11px] opacity-70 mt-1">{k.sub}</p>
                  </div>
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Sub-totales financieros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Almacenaje Total ({mode === '10' ? '0%' : '3%'})</p>
          <p className="text-xl font-black text-amber-600 mt-1">{fmt(totalAlmacenaje)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{mode === '10' ? 'Sin costo — Mercancía en oficina Cotorrisa' : '3% del precio de la prenda'}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pasarela de Pago (Stripe)</p>
          <p className="text-xl font-black text-red-600 mt-1">{fmt(totalPasarela)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">3.6% + $3 MXN por transacción</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Envíos Cobrados</p>
          <p className="text-xl font-black text-blue-600 mt-1">{fmt(totalSaldoEnvio)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">$99 por pedido (desde 1-Abr)</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Costo Real de Guías</p>
          <p className="text-xl font-black text-purple-600 mt-1">{fmt(totalCostoGuias)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Margen neto: {fmt(totalMargenGuias)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <p className="font-black text-gray-800 text-sm">
            Detalle por Pedido
            <span className="ml-2 bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filas.length} registros
            </span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filas.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-bold">Sin registros</p>
            <p className="text-sm mt-1">Sube un CSV o agrega registros manualmente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Pedido</th>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Fecha</th>
                  <th className="px-4 py-3 text-left font-black text-gray-600">Producto</th>
                  <th className="px-4 py-3 text-right font-black text-gray-600">P. Tienda</th>
                  <th className="px-4 py-3 text-right font-black text-orange-600">Comisión ({comisionPctText})</th>
                  <th className="px-4 py-3 text-right font-black text-green-700">Utilidad ({utilidadPctText})</th>
                  <th className="px-4 py-3 text-right font-black text-amber-700">Almacenaje ({mode === '10' ? '0%' : '3%'})</th>
                  <th className="px-4 py-3 text-right font-black text-red-600">% Pasarela</th>
                  <th className="px-4 py-3 text-right font-black text-orange-500 font-bold">NET Coli. (Prenda)</th>
                  <th className="px-4 py-3 text-right font-black text-blue-600">Saldo Envío</th>
                  <th className="px-4 py-3 text-right font-black text-purple-600">Costo Guía</th>
                  <th className="px-4 py-3 text-right font-black text-gray-600">Colchón Envío</th>
                  <th className="px-4 py-3 text-center font-black text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(row => {
                  const isEditing = row.id in editingCosto
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="border-b hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-800">{row.numero_pedido}</td>
                        <td className="px-4 py-3 text-gray-700">{row.nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{row.fecha_compra || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{row.producto || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(row.precio_tienda)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(row._comision)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(row._utilidad)}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600">{fmt(row._almacenaje)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(row._pasarela)}</td>
                        <td className="px-4 py-3 text-right font-black text-orange-600 bg-orange-50/5">{fmt(row._netColivery)}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">{fmt(row.precio_envio)}</td>
                        {/* Costo guía editable */}
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={editingCosto[row.id]}
                                onChange={e => setEditingCosto(p => ({ ...p, [row.id]: e.target.value }))}
                                className="w-20 border rounded px-2 py-1 text-xs text-right font-bold border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                autoFocus
                              />
                              <button onClick={() => guardarCosto(row.id)}
                                className="text-green-600 hover:text-green-800 p-1"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingCosto(p => { const n = { ...p }; delete n[row.id]; return n })}
                                className="text-gray-400 hover:text-gray-600 p-1"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <button
                                onClick={() => setEditingCosto(p => ({ ...p, [row.id]: row.costo_guia ?? '' }))}
                                className="font-bold text-purple-600 hover:text-purple-800 hover:underline cursor-pointer"
                                title="Clic para editar">
                                {fmt(row.costo_guia)}
                              </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-black ${row._margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row._margen >= 0 ? '+' : ''}{fmt(row._margen)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Ver detalles">
                              {expandedRow === row.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => eliminar(row.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === row.id && (
                        <tr className="bg-gray-50 border-b">
                          <td colSpan={14} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {[
                                ['Teléfono', row.telefono || '—'],
                                ['Notas', row.notas || '—'],
                                ['Comisión %', `${row.comision_pct}%`],
                                ['Registrado', row.created_at?.slice(0, 10)],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <p className="text-gray-400 font-medium">{k}</p>
                                  <p className="font-bold text-gray-700 mt-0.5">{v}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
              {/* Totales */}
              <tfoot className="bg-gray-900 text-white">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-black text-sm uppercase tracking-wide">TOTALES</td>
                  <td className="px-4 py-3 text-right font-black">{fmt(totalPrendas)}</td>
                  <td className="px-4 py-3 text-right font-black text-orange-300">{fmt(totalComision)}</td>
                  <td className="px-4 py-3 text-right font-black text-green-300">{fmt(totalUtilidadCli)}</td>
                  <td className="px-4 py-3 text-right font-black text-amber-300">{fmt(totalAlmacenaje)}</td>
                  <td className="px-4 py-3 text-right font-black text-red-300">{fmt(totalPasarela)}</td>
                  <td className="px-4 py-3 text-right font-black text-orange-300 bg-orange-950/20">{fmt(totalNeto)}</td>
                  <td className="px-4 py-3 text-right font-black text-blue-300">{fmt(totalSaldoEnvio)}</td>
                  <td className="px-4 py-3 text-right font-black text-purple-300">{fmt(totalCostoGuias)}</td>
                  <td className={`px-4 py-3 text-right font-black ${totalMargenGuias >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {totalMargenGuias >= 0 ? '+' : ''}{fmt(totalMargenGuias)}
                  </td>
                  <td />
                </tr>
                <tr className="border-t border-white/20">
                  <td colSpan={4} className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wide">Ventas Brutas (prendas + envíos)</td>
                  <td colSpan={9} className="px-4 py-2 text-right font-black text-indigo-300">{fmt(totalVentas)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalAgregar && <ModalAgregar clienteId={clienteSelId} onClose={() => setModalAgregar(false)} onSuccess={() => { setModalAgregar(false); fetchFilas() }} mode={mode} />}
      {modalCSV     && <ModalCSV     clienteId={clienteSelId} onClose={() => setModalCSV(false)}     onSuccess={() => { setModalCSV(false);     fetchFilas() }} mode={mode} />}
    </div>
  )
}
