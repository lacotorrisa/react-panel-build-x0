import React, { useState, useMemo, useCallback } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { MoreHorizontal, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
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

const LABELS = {
  fecha_pedido:'Fecha', tipo_compra:'Tipo', nombre_comprador:'Nombre',
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

export const TablaPedidos = ({ pedidos, paqueterias, onRefresh, onViewDetails, onVerify, mode = 'admin' }) => {
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
      const { error } = await supabase.from('pedidos').update({ [field]: newValue }).eq('id', pedidoId)
      if (error) throw error
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
    {
      accessorKey: 'fecha_pedido',
      header: 'Fecha',
      cell: ({ row: { original: p } }) => {
        const fmt = (() => { try { return format(new Date(p.fecha_pedido+'T12:00:00'),'dd/MM/yyyy') } catch { return p.fecha_pedido } })()
        if (rol === 'admin') return (
          <input type="date"
            className="w-[130px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.fecha_pedido?.substring(0,10) ?? ''}
            onBlur={(e) => { const v = e.target.value; setTimeout(() => saveField(p.id,'fecha_pedido',p.fecha_pedido,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-xs whitespace-nowrap">{fmt}</span>
      },
    },
    {
      accessorKey: 'tipo_compra',
      header: 'Tipo',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <Select defaultValue={p.tipo_compra||'GENERAL'} onValueChange={(v) => setTimeout(()=>saveSelect(p.id,'tipo_compra',p.tipo_compra,v),0)}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">GENERAL</SelectItem>
              <SelectItem value="EXCLUSIVOS">EXCLUSIVOS</SelectItem>
            </SelectContent>
          </Select>
        )
        return <Badge variant={p.tipo_compra==='EXCLUSIVOS'?'default':'secondary'}>{p.tipo_compra}</Badge>
      }
    },
    {
      accessorKey: 'nombre_comprador',
      header: 'Nombre Comprador',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[190px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.nombre_comprador??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'nombre_comprador',p.nombre_comprador,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="font-medium text-sm whitespace-nowrap">{p.nombre_comprador}</span>
      }
    },
    {
      accessorKey: 'productos',
      header: 'Producto',
      cell: ({ row: { original: p } }) => {
        const texto = (p.productos||[]).map(x=>x.nombre).join(', ')
        if (rol === 'admin') return (
          <input className="w-[180px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.productos?.[0]?.nombre??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveProductoField(p,'nombre',v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <TruncCell text={texto} w="max-w-[180px]" />
      }
    },
    {
      id: 'talla',
      header: 'Talla',
      cell: ({ row: { original: p } }) => {
        const t = (p.productos||[]).map(x=>x.talla||'-').join(', ')
        if (rol === 'admin') return (
          <input className="w-[70px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.productos?.[0]?.talla??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveProductoField(p,'talla',v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-xs">{t}</span>
      }
    },
    {
      id: 'cantidad',
      header: 'Cant.',
      cell: ({ row: { original: p } }) => {
        const c = (p.productos||[]).map(x=>x.cantidad||1).join(', ')
        if (rol === 'admin') return (
          <input type="number" min="1"
            className="w-[60px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.productos?.[0]?.cantidad??1}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveProductoField(p,'cantidad',v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-xs">{c}</span>
      }
    },
    {
      accessorKey: 'paqueteria_id',
      header: 'Paquetería',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || (rol==='paqueteria' && p.status==='pendiente')
        if (isEditable) return (
          <Select defaultValue={p.paqueteria_id||''} onValueChange={(v)=>setTimeout(()=>saveSelect(p.id,'paqueteria_id',p.paqueteria_id,v),0)}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Asignar"/></SelectTrigger>
            <SelectContent>{paqueterias?.map(x=><SelectItem key={x.id} value={x.id}>{x.nombre}</SelectItem>)}</SelectContent>
          </Select>
        )
        return <span className="text-xs">{paqueterias?.find(x=>x.id===p.paqueteria_id)?.nombre||'Sin asignar'}</span>
      }
    },
    {
      accessorKey: 'guia',
      header: 'Guía',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || (rol==='paqueteria' && p.status==='pendiente')
        if (isEditable) return (
          <input className="w-[150px] h-8 text-xs border border-gray-200 rounded px-2 font-mono focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.guia??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'guia',p.guia,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-xs font-mono whitespace-nowrap">{p.guia||'-'}</span>
      }
    },
    {
      accessorKey: 'link_seguimiento',
      header: 'Link',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || (rol==='paqueteria' && p.status==='pendiente')
        if (isEditable) return (
          <input className="w-[150px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.link_seguimiento??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'link_seguimiento',p.link_seguimiento,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return p.link_seguimiento
          ? <a href={p.link_seguimiento} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={12}/> Ver</a>
          : <span className="text-gray-400 text-xs">-</span>
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row: { original: p } }) => {
        const isEditable = rol==='admin' || rol==='logistica' || rol==='paqueteria'
        if (isEditable) return (
          <Select defaultValue={p.status} onValueChange={(v)=>setTimeout(()=>saveSelect(p.id,'status',p.status,v),0)}>
            <SelectTrigger className={`w-[155px] h-8 text-xs border-0 ${STATUS_COLORS[p.status]||'bg-gray-100'}`}><SelectValue/></SelectTrigger>
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
        )
        return <Badge className={`${STATUS_COLORS[p.status]||'bg-gray-100 text-gray-800'} whitespace-nowrap`}>{p.status?.replace(/_/g,' ').toUpperCase()}</Badge>
      }
    },
    {
      accessorKey: 'correo_comprador',
      header: 'Correo',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[190px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.correo_comprador??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'correo_comprador',p.correo_comprador,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <TruncCell text={p.correo_comprador} w="max-w-[180px]" />
      }
    },
    {
      accessorKey: 'telefono',
      header: 'Teléfono',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[120px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.telefono??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'telefono',p.telefono,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <span className="text-xs whitespace-nowrap">{p.telefono||'-'}</span>
      }
    },
    {
      accessorKey: 'direccion',
      header: 'Dirección',
      cell: ({ row: { original: p } }) => {
        if (rol === 'admin') return (
          <input className="w-[220px] h-8 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
            defaultValue={p.direccion??''}
            onBlur={(e) => { const v=e.target.value; setTimeout(()=>saveField(p.id,'direccion',p.direccion,v),0) }}
            onKeyDown={(e) => { if (e.key==='Enter') e.target.blur() }}
          />
        )
        return <TruncCell text={p.direccion} w="max-w-[220px]" />
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="space-y-4">
      {/* Totales */}
      <div className="flex flex-wrap gap-2 items-center bg-white border rounded-lg px-4 py-3">
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
      </div>

      {/* Búsqueda */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar por nombre, guía, status..." value={globalFilter??''} onChange={e=>setGlobalFilter(e.target.value)} className="w-72"/>
          {globalFilter && <button onClick={()=>setGlobalFilter('')} className="text-gray-400 hover:text-gray-600 text-xs">✕ Limpiar</button>}
        </div>
        {sorting.length>0 && <button onClick={()=>setSorting([])} className="text-xs text-orange-500 hover:underline">↺ Quitar orden</button>}
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
                    <TableHead key={header.id} className={canSort?'select-none':''}>
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
            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row,idx)=>(
              <TableRow key={row.id} className={`${idx%2===0?'bg-white':'bg-gray-50/60'} hover:bg-orange-50/30 transition-colors`}>
                {row.getVisibleCells().map(cell=>(
                  <TableCell key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell,cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">No hay resultados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between py-2">
        <p className="text-sm text-gray-500">
          Mostrando <b>{table.getState().pagination.pageIndex*table.getState().pagination.pageSize+1}</b>–<b>{Math.min((table.getState().pagination.pageIndex+1)*table.getState().pagination.pageSize,filteredCount)}</b> de <b>{filteredCount}</b>
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={()=>table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</Button>
          <Button variant="outline" size="sm" onClick={()=>table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
          {Array.from({length:table.getPageCount()},(_,i)=>i)
            .filter(i=>{const c=table.getState().pagination.pageIndex;return i===0||i===table.getPageCount()-1||Math.abs(i-c)<=2})
            .reduce((acc,i,idx,arr)=>{if(idx>0&&arr[idx-1]!==i-1)acc.push('...');acc.push(i);return acc},[])
            .map((item,idx)=>item==='...'
              ?<span key={`e${idx}`} className="px-2 text-gray-400 text-sm">...</span>
              :<Button key={item} variant={table.getState().pagination.pageIndex===item?'default':'outline'} size="sm"
                  className={`min-w-[36px] ${table.getState().pagination.pageIndex===item?'bg-[#FF6600] text-white border-[#FF6600]':''}`}
                  onClick={()=>table.setPageIndex(item)}>{item+1}</Button>
            )}
          <Button variant="outline" size="sm" onClick={()=>table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
          <Button variant="outline" size="sm" onClick={()=>table.setPageIndex(table.getPageCount()-1)} disabled={!table.getCanNextPage()}>»</Button>
        </div>
      </div>
    </div>
  )
}
