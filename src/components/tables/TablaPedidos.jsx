import React, { useState, useMemo, useCallback } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { MoreHorizontal, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Clock } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { useAuth } from '../../lib/auth'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { enviarEmailEnCamino, verificarYEnviarNotificaciones } from '../../lib/email'

const STATUS_COLORS = {
  pendiente:        'bg-yellow-100 text-yellow-800',
  en_espera_guia:   'bg-orange-100 text-orange-800',
  en_espera_prenda: 'bg-purple-100 text-purple-800',
  en_transito:      'bg-blue-100 text-blue-800',
  entregado:        'bg-green-100 text-green-800',
  con_retraso:      'bg-red-100 text-red-800',
  problema:         'bg-red-200 text-red-900',
}

const STATUS_ROW_COLORS = {
  pendiente:        'bg-yellow-100/40 hover:bg-yellow-200/60',
  en_espera_guia:   'bg-orange-100/40 hover:bg-orange-200/60',
  en_espera_prenda: 'bg-purple-100/40 hover:bg-purple-200/60',
  en_transito:      'bg-blue-100/40 hover:bg-blue-200/60',
  entregado:        'bg-green-100/35 hover:bg-green-200/55',
  con_retraso:      'bg-red-100/35 hover:bg-red-200/55',
  problema:         'bg-rose-200/40 hover:bg-rose-300/60',
}

const LABELS = {
  fecha_pedido:'Fecha', tipo_compra:'Tipo', pago_status:'Pago', nombre_comprador:'Nombre',
  correo_comprador:'Correo', telefono:'Teléfono', direccion:'Dirección',
  status:'Status', guia:'Guía', link_seguimiento:'Link', paqueteria_id:'Paquetería',
  nombre:'Producto', talla:'Talla', cantidad:'Cantidad',
}

// ── Tiny read-only truncated cell (defined OUTSIDE component to avoid remounts)
const TruncCell = ({ text, w = 'max-w-[180px]' }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-xs ${w} truncate block cursor-default`}>{text || '-'}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs"><p>{text || '-'}</p></TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export const TablaPedidos = ({
  pedidos,
  paqueterias,
  onRefresh,
  onViewDetails,
  onVerify,
  mode = 'admin',
  serverSidePagination = false,
  currentPage = 0,
  totalCount = 0,
  pageSize = 50,
  onPageChange = () => {},
  onSearchChange = () => {},
  searchQuery = ''
}) => {
  const { rol, user } = useAuth()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting]           = useState([])

  // ── Save helpers (useCallback so stable references for useMemo columns) ────

  const saveField = useCallback(async (pedidoId, field, original, newValue) => {
    const orig = String(original ?? '').trim()
    const next = String(newValue ?? '').trim()
    if (orig === next) return
    const ok = window.confirm(`¿Actualizar "${LABELS[field] || field}"?\n\nAntes: "${orig || '(vacío)'}"\nAhora: "${next || '(vacío)'}"`)
    if (!ok) return
    try {
      const { error } = await supabase.from('pedidos').update({ [field]: next || null }).eq('id', pedidoId)
      if (error) throw error
      toast.success(`✅ ${LABELS[field] || field} actualizado`)
      onRefresh()
    } catch (e) { toast.error('❌ ' + e.message) }
  }, [onRefresh])

  const saveProductoField = useCallback(async (pedido, subField, newValue) => {
    const prods  = pedido.productos || []
    const orig   = subField === 'cantidad' ? String(prods[0]?.cantidad ?? 1) : String(prods[0]?.[subField] ?? '').trim()
    const next   = String(newValue ?? '').trim()
    if (orig === next) return
    const ok = window.confirm(`¿Actualizar "${LABELS[subField] || subField}"?\n\nAntes: "${orig || '(vacío)'}"\nAhora: "${next || '(vacío)'}"`)
    if (!ok) return
    try {
      const updated = prods.length > 0
        ? prods.map((p, i) => i === 0 ? { ...p, [subField]: subField === 'cantidad' ? parseInt(next)||1 : next } : p)
        : [{ nombre:'', talla:'', cantidad:1, [subField]: subField==='cantidad' ? parseInt(next)||1 : next }]
      const { error } = await supabase.from('pedidos').update({ productos: updated }).eq('id', pedido.id)
      if (error) throw error
      toast.success(`✅ ${LABELS[subField]} actualizado`)
      onRefresh()
    } catch (e) { toast.error('❌ ' + e.message) }
  }, [onRefresh])

  const saveSelect = useCallback(async (pedidoId, field, original, newValue) => {
    if (String(original ?? '') === newValue) return
    const ok = window.confirm(`¿Cambiar "${LABELS[field] || field}" de "${original||'(vacío)'}" a "${newValue}"?`)
    if (!ok) return
    try {
      const updateData = { [field]: newValue }

      // If we are updating payment status, we also update the [Pago: ...] tag in observaciones
      if (field === 'pago_status') {
        const { data: pData } = await supabase.from('pedidos').select('observaciones').eq('id', pedidoId).single()
        if (pData) {
          let obs = pData.observaciones || ''
          const tagBefore = `[Pago: ${original}]`
          const tagAfter = `[Pago: ${newValue}]`
          if (obs.includes(tagBefore)) {
            obs = obs.replace(tagBefore, tagAfter)
          } else {
            obs = `${obs} ${tagAfter}`.trim()
          }
          updateData.observaciones = obs
        }
      }

      // Try updating. If it fails due to missing pago_status column, fallback to only updating observaciones
      const { error } = await supabase.from('pedidos').update(updateData).eq('id', pedidoId)
      if (error) {
        if (field === 'pago_status' && error.message?.includes('pago_status')) {
          const { error: fbError } = await supabase.from('pedidos').update({ observaciones: updateData.observaciones }).eq('id', pedidoId)
          if (fbError) throw fbError
        } else {
          throw error
        }
      }
      toast.success(`✅ ${LABELS[field] || field} actualizado`)
      onRefresh()

      // Si el estado cambia, verificar y enviar notificaciones por correo de manera segura
      if (field === 'status') {
        verificarYEnviarNotificaciones(pedidoId, newValue)
      }
    } catch (e) { toast.error('❌ ' + e.message) }
  }, [onRefresh])

  // ── Columns — memoized so TanStack never sees new references ───────────────
  const columns = useMemo(() => [
    // ── Col 1: Número de pedido ───────────────────────────
    {
      id: 'num_pedido',
      header: '# Pedido',
      accessorFn: (p) => {
        const m = p.observaciones?.match(/\[Pedido:\s*([^\]]+)\]/);
        return m ? m[1].trim() : p.id?.split('-')[0] || '';
      },
      cell: ({ row: { original: p } }) => {
        const m       = p.observaciones?.match(/\[Pedido:\s*([^\]]+)\]/);
        const orderNo = m ? m[1].trim() : p.id?.split('-')[0] || '';
        return (
          <div className="flex flex-col gap-0.5 min-w-[110px]">
            <span className="text-[11px] font-bold font-mono text-orange-700 tracking-tight">
              {orderNo || '-'}
            </span>
            {p.tipo_compra === 'EXCLUSIVOS' && (
              <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded font-semibold w-fit">EXCL</span>
            )}
          </div>
        )
      },
    },
    // ── Col 2: Fecha + Hora ──────────────────────────────
    {
      id: 'fecha_hora',
      header: 'Fecha / Hora',
      accessorFn: (p) => p.fecha_pedido,
      cell: ({ row: { original: p } }) => {
        const fechaFmt = (() => {
          try { return format(new Date(p.fecha_pedido + 'T12:00:00'), 'dd/MM/yyyy') }
          catch { return p.fecha_pedido || '-' }
        })()
        const horaMatch = p.observaciones?.match(/\[Hora:\s*([0-9]{2}:[0-9]{2})\]/);
        const hora      = horaMatch ? horaMatch[1] : null;
        return (
          <div className="flex flex-col gap-0.5 min-w-[95px]">
            <span className="text-[11px] font-semibold whitespace-nowrap">{fechaFmt}</span>
            {hora && (
              <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">{hora} hrs</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'pago_status',
      header: 'Pago',
      cell: ({ row: { original: p } }) => {
        // Fallback to check if observations contains [Pago: pendiente]
        const val = p.pago_status || (p.observaciones?.includes('[Pago: pendiente]') ? 'pendiente' : 'pagado')
        if (rol === 'admin') return (
          <Select defaultValue={val} onValueChange={(v) => setTimeout(()=>saveSelect(p.id,'pago_status',val,v),0)}>
            <SelectTrigger className={`w-[50px] h-7 border flex items-center justify-center p-1 ${val === 'pagado' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-orange-100 border-orange-200 text-orange-600'}`}>
              {val === 'pagado' ? (
                <span className="w-3 h-3 bg-green-500 rounded-full inline-block shrink-0" title="Pagado"></span>
              ) : (
                <Clock className="w-3.5 h-3.5 shrink-0 text-orange-600" title="En espera de pago" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pagado">🟢 Pagado</SelectItem>
              <SelectItem value="pendiente">⏳ Pendiente</SelectItem>
            </SelectContent>
          </Select>
        )
        return (
          <div className="flex justify-center w-[50px]">
            {val === 'pagado' ? (
              <span className="w-3 h-3 bg-green-500 rounded-full inline-block" title="Pagado"></span>
            ) : (
              <div className="bg-orange-100 border border-orange-200 rounded p-1 flex items-center justify-center" title="En espera de pago">
                <Clock className="w-3.5 h-3.5 text-orange-600" />
              </div>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: 'nombre_comprador',
      header: 'Nombre Comprador',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[150px] h-7 text-[11px] border border-gray-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.nombre_comprador??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'nombre_comprador',p.nombre_comprador,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="font-medium text-xs whitespace-nowrap">{p.nombre_comprador}</span>
      }
    },
    // ── Status (sin precio) ──────────────────────────────
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || rol==='paqueteria'
        return (
          <div>
            {isEditable ? (
              <Select defaultValue={p.status} onValueChange={(v)=>setTimeout(()=>saveSelect(p.id,'status',p.status,v),0)}>
                <SelectTrigger className={`w-[130px] h-7 text-[11px] border-0 ${STATUS_COLORS[p.status]||'bg-gray-100'}`}><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">⏳ Pendiente</SelectItem>
                  <SelectItem value="en_espera_guia">📋 En espera de guía</SelectItem>
                  <SelectItem value="en_espera_prenda">📦 Falta prenda</SelectItem>
                  <SelectItem value="en_transito">🚚 En tránsito</SelectItem>
                  <SelectItem value="entregado">✅ Entregado</SelectItem>
                  <SelectItem value="con_retraso">⚠️ Con retraso</SelectItem>
                  <SelectItem value="problema">❌ Problema/Retorno</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`${STATUS_COLORS[p.status]||'bg-gray-100 text-gray-800'} text-[10px] px-1.5 py-0.5 whitespace-nowrap`}>{p.status?.replace(/_/g,' ').toUpperCase()}</Badge>
            )}
          </div>
        )
      }
    },
    // ── Producto ──────────────────────────────────────────────
    {
      accessorKey: 'productos',
      header: 'Producto',
      cell: ({ row: { original: p } }) => {
        const prods = p.productos || []
        const esMulti = prods.length > 1
        // Multi-producto: mostrar lista compacta (no editable inline)
        if (esMulti) return (
          <div className="flex flex-col gap-0.5 max-w-[190px]">
            {prods.map((x, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-orange-500 shrink-0">{i+1}.</span>
                <TruncCell text={x.nombre} w="max-w-[170px]" />
              </div>
            ))}
          </div>
        )
        // Un solo producto: input editable para admin
        if (rol === 'admin') return (
          <input className="w-[160px] h-7 text-[11px] border border-gray-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={prods[0]?.nombre??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveProductoField(p,'nombre',v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <TruncCell text={prods[0]?.nombre||'-'} w="max-w-[180px]" />
      }
    },
    // ── Talla ───────────────────────────────────────
    {
      id: 'talla',
      header: 'Talla',
      cell: ({ row: { original: p } }) => {
        const prods = p.productos || []
        const esMulti = prods.length > 1
        if (esMulti) return (
          <div className="flex flex-col gap-0.5">
            {prods.map((x, i) => <span key={i} className="text-[11px]">{x.talla||'-'}</span>)}
          </div>
        )
        if (rol === 'admin') return (
          <input className="w-[50px] h-7 text-[11px] border border-gray-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={prods[0]?.talla??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveProductoField(p,'talla',v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-[11px]">{prods[0]?.talla||'-'}</span>
      }
    },
    // ── Precio (columna propia) ─────────────────────────
    {
      id: 'precio_total',
      header: 'Precio',
      cell: ({ row: { original: p } }) => {
        const monto = (p.productos||[]).reduce((s, x) => s + ((x.precio||0)*(x.cantidad||1)), 0)
        if (!monto) return <span className="text-[11px] text-gray-400">-</span>
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(monto)
        return (
          <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">
            {fmt}
          </span>
        )
      }
    },
    {
      id: 'cantidad',
      header: 'Cant.',
      cell: ({ row: { original: p } }) => {
        const prods = p.productos || []
        const esMulti = prods.length > 1
        if (esMulti) return (
          <div className="flex flex-col gap-0.5">
            {prods.map((x, i) => <span key={i} className="text-[11px] font-semibold">{x.cantidad||1}</span>)}
          </div>
        )
        if (rol === 'admin') return (
          <input type="number" min="1"
            className="w-[45px] h-7 text-[11px] border border-gray-200 rounded px-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={prods[0]?.cantidad??1}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveProductoField(p,'cantidad',v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-[11px]">{prods[0]?.cantidad||1}</span>
      }
    },
    {
      accessorKey: 'paqueteria_id',
      header: 'Paquetería',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || (rol==='paqueteria' && p.status==='pendiente')
        if (isEditable) return (
          <Select defaultValue={p.paqueteria_id||''} onValueChange={(v)=>setTimeout(()=>saveSelect(p.id,'paqueteria_id',p.paqueteria_id,v),0)}>
            <SelectTrigger className="w-[110px] h-7 text-[11px]"><SelectValue placeholder="Asignar"/></SelectTrigger>
            <SelectContent>{paqueterias?.map(x=><SelectItem key={x.id} value={x.id}>{x.nombre}</SelectItem>)}</SelectContent>
          </Select>
        )
        return <span className="text-[11px]">{paqueterias?.find(x=>x.id===p.paqueteria_id)?.nombre||'Sin asignar'}</span>
      }
    },
    {
      accessorKey: 'guia',
      header: 'Guía',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || (rol==='paqueteria' && p.status==='pendiente')
        if (isEditable) return (
          <input className="w-[120px] h-7 text-[11px] border border-gray-200 rounded px-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.guia??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'guia',p.guia,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-[11px] font-mono whitespace-nowrap">{p.guia||'-'}</span>
      }
    },

    {
      accessorKey: 'correo_comprador',
      header: 'Correo',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[150px] h-7 text-[11px] border border-gray-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.correo_comprador??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'correo_comprador',p.correo_comprador,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <TruncCell text={p.correo_comprador} w="max-w-[150px]" />
      }
    },
    {
      accessorKey: 'telefono',
      header: 'Teléfono',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[100px] h-7 text-[11px] border border-gray-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.telefono??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'telefono',p.telefono,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-[11px] whitespace-nowrap">{p.telefono||'-'}</span>
      }
    },
    {
      accessorKey: 'direccion',
      header: 'Dirección',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[170px] h-7 text-[11px] border border-gray-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.direccion??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'direccion',p.direccion,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <TruncCell text={p.direccion} w="max-w-[170px]" />
      }
    },
    {
      accessorKey: 'tipo_compra',
      header: 'Tipo',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <Select defaultValue={p.tipo_compra||'GENERAL'} onValueChange={(v) => setTimeout(()=>saveSelect(p.id,'tipo_compra',p.tipo_compra,v),0)}>
            <SelectTrigger className="w-[100px] h-7 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">GENERAL</SelectItem>
              <SelectItem value="EXCLUSIVOS">EXCLUSIVOS</SelectItem>
            </SelectContent>
          </Select>
        )
        return <Badge variant={p.tipo_compra==='EXCLUSIVOS'?'default':'secondary'} className="text-[10px] px-1 py-0.5">{p.tipo_compra}</Badge>
      }
    },
    {
      id: 'acciones',
      cell: ({ row: { original: p } }) => {
        if (mode==='entregados' && p.status!=='entregado') return (
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={()=>onVerify(p)}>Verificar</Button>
        )
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={()=>onViewDetails(p)}>Ver detalle / Historial</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [rol, paqueterias, saveField, saveProductoField, saveSelect, mode])

  const table = useReactTable({
    data: pedidos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 100 } },
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const statusCounts  = pedidos.reduce((acc,p)=>{acc[p.status]=(acc[p.status]||0)+1;return acc},{})

  const isServer = serverSidePagination
  const activePageIndex = isServer ? currentPage : table.getState().pagination.pageIndex
  const activePageSize = isServer ? pageSize : table.getState().pagination.pageSize
  const activeTotalCount = isServer ? totalCount : filteredCount
  const activePageCount = isServer ? Math.ceil(totalCount / pageSize) : table.getPageCount()
  const canPrev = isServer ? activePageIndex > 0 : table.getCanPreviousPage()
  const canNext = isServer ? activePageIndex < activePageCount - 1 : table.getCanNextPage()

  const handlePageChange = (idx) => {
    if (isServer) {
      onPageChange(idx)
    } else {
      table.setPageIndex(idx)
    }
  }

  const handlePrevPage = () => {
    if (isServer) {
      onPageChange(activePageIndex - 1)
    } else {
      table.previousPage()
    }
  }

  const handleNextPage = () => {
    if (isServer) {
      onPageChange(activePageIndex + 1)
    } else {
      table.nextPage()
    }
  }

  return (
    <div className="space-y-4">
      {/* Totales */}
      <div className="flex flex-wrap gap-2 items-center bg-white border rounded-lg px-4 py-3">
        {isServer ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Total Pedidos</span>
            <span className="text-lg font-bold text-gray-900">{totalCount}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 pr-4 border-r">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-lg font-bold text-gray-900">{pedidos.length}</span>
              {globalFilter && <span className="text-xs text-orange-600 font-medium">({filteredCount} filtrados)</span>}
            </div>
            {Object.entries(statusCounts).map(([st,cnt])=>(
              <div key={st} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[st]||'bg-gray-100 text-gray-600'}`}>
                <span className="font-bold">{cnt}</span><span>{st.replace(/_/g,' ')}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Búsqueda */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isServer ? (
            <Input
              placeholder="Buscar por nombre, guía, status..."
              value={searchQuery ?? ''}
              onChange={e => onSearchChange(e.target.value)}
              className="w-72"
            />
          ) : (
            <Input
              placeholder="Buscar por nombre, guía, status..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="w-72"
            />
          )}
          {((isServer && searchQuery) || (!isServer && globalFilter)) && (
            <button
              onClick={() => isServer ? onSearchChange('') : setGlobalFilter('')}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
        {!isServer && sorting.length > 0 && (
          <button onClick={() => setSorting([])} className="text-xs text-orange-500 hover:underline">
            ↺ Quitar orden
          </button>
        )}
      </div>

      {rol==='admin' && <p className="text-xs text-gray-400 italic">✏️ Edita cualquier campo y presiona Enter o sal del campo para confirmar el cambio.</p>}

      {/* Tabla */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table className="min-w-[1800px]">
          <TableHeader>
            {table.getHeaderGroups().map(hg=>(
              <TableRow key={hg.id}>
                {hg.headers.map(header=>{
                  const canSort=header.column.getCanSort(), sorted=header.column.getIsSorted()
                  return (
                    <TableHead key={header.id} className={`h-8 py-1 px-1.5 text-[11px] font-bold text-gray-700 ${canSort ? 'select-none' : ''}`}>
                      {header.isPlaceholder?null:(
                        <div className={`flex items-center gap-1 whitespace-nowrap ${canSort?'cursor-pointer hover:text-orange-600':''}`}
                          onClick={canSort?header.column.getToggleSortingHandler():undefined}>
                          {flexRender(header.column.columnDef.header,header.getContext())}
                          {canSort&&<span className="text-gray-400">
                            {sorted==='asc'?<ChevronUp className="h-3 w-3 text-orange-500"/>:sorted==='desc'?<ChevronDown className="h-3 w-3 text-orange-500"/>:<ChevronsUpDown className="h-3 w-3"/>}
                          </span>}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row,idx)=>{
              const p = row.original;
              const isPagoPendiente = p.pago_status === 'pendiente' || p.observaciones?.includes('[Pago: pendiente]');
              const rowColor = isPagoPendiente
                ? 'bg-orange-100/70 hover:bg-orange-200/80'
                : (STATUS_ROW_COLORS[p.status] || (idx%2===0 ? 'bg-white' : 'bg-gray-50/60'));
              return (
                <TableRow key={row.id} className={`${rowColor} transition-colors`}>
                  {row.getVisibleCells().map(cell=>(
                    <TableCell key={cell.id} className="py-1 px-1.5 text-[11px]">
                      {flexRender(cell.column.columnDef.cell,cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            }) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">No hay resultados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between py-2">
        <p className="text-sm text-gray-500">
          Mostrando <b>{activePageIndex * activePageSize + 1}</b>–<b>{Math.min((activePageIndex + 1) * activePageSize, activeTotalCount)}</b> de <b>{activeTotalCount}</b>
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => handlePageChange(0)} disabled={!canPrev}>«</Button>
          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={!canPrev}>Anterior</Button>
          {Array.from({ length: activePageCount }, (_, i) => i)
            .filter(i => i === 0 || i === activePageCount - 1 || Math.abs(i - activePageIndex) <= 2)
            .reduce((acc, i, idx, arr) => {
              if (idx > 0 && arr[idx - 1] !== i - 1) acc.push('...');
              acc.push(i);
              return acc;
            }, [])
            .map((item, idx) => item === '...'
              ? <span key={`e${idx}`} className="px-2 text-gray-400 text-sm">...</span>
              : <Button key={item} variant={activePageIndex === item ? 'default' : 'outline'} size="sm"
                  className={`min-w-[36px] ${activePageIndex === item ? 'bg-[#FF6600] text-white border-[#FF6600]' : ''}`}
                  onClick={() => handlePageChange(item)}>{item + 1}</Button>
            )}
          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!canNext}>Siguiente</Button>
          <Button variant="outline" size="sm" onClick={() => handlePageChange(activePageCount - 1)} disabled={!canNext}>»</Button>
        </div>
      </div>
    </div>
  )
}
