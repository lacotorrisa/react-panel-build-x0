import React, { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { MoreHorizontal, ExternalLink, Download, Search, X } from 'lucide-react'
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
import { enviarEmailEnCamino } from '../../lib/email'

const statusColors = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  en_transito: 'bg-blue-100 text-blue-800',
  entregado: 'bg-green-100 text-green-800',
  con_retraso: 'bg-red-100 text-red-800',
  problema: 'bg-red-100 text-red-800',
}

export const TablaPedidos = ({ pedidos, paqueterias, onRefresh, onViewDetails, onVerify, mode = 'admin' }) => {
  const { rol, user } = useAuth()
  const [globalFilter, setGlobalFilter] = useState('')
  const [editedRows, setEditedRows] = useState({})

  const handleEdit = (id, field, value) => {
    setEditedRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }))
  }

  const handleSaveAndNotify = async (pedido) => {
    const edits = editedRows[pedido.id]
    if (!edits || !edits.guia || !edits.link_seguimiento) {
      toast.error('Por favor completa la guía y el link de seguimiento')
      return
    }

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          guia: edits.guia,
          link_seguimiento: edits.link_seguimiento,
          tiempo_estimado_entrega: edits.tiempo_estimado_entrega || pedido.tiempo_estimado_entrega,
          status: 'en_transito'
        })
        .eq('id', pedido.id)

      if (error) throw error

      await supabase.from('pedido_eventos').insert({
        pedido_id: pedido.id,
        tipo: 'guia_asignada',
        descripcion: `Guía asignada: ${edits.guia}`,
        usuario_id: user.id
      })

      // Get client info to send email
      const { data: cliente } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', pedido.cliente_id)
        .single()

      if (cliente) {
        await enviarEmailEnCamino({
          pedido: { ...pedido, ...edits },
          cliente
        })
      }

      toast.success('✅ Guía guardada y comprador notificado')
      const newEdited = {...editedRows}
      delete newEdited[pedido.id]
      setEditedRows(newEdited)
      onRefresh()

    } catch (error) {
      console.error(error)
      toast.error('Error al guardar y notificar')
    }
  }

  const columns = [
    {
      accessorKey: 'fecha_pedido',
      header: 'Fecha',
      cell: ({ row }) => format(new Date(row.original.fecha_pedido), 'dd/MM/yyyy'),
    },
    {
      accessorKey: 'tipo_compra',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge variant={row.original.tipo_compra === 'Exclusivo' ? 'default' : 'secondary'}>
          {row.original.tipo_compra}
        </Badge>
      )
    },
    {
      accessorKey: 'nombre_comprador',
      header: 'Comprador',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.nombre_comprador}</span>
          <span className="text-xs text-gray-500">{row.original.correo_comprador}</span>
          <span className="text-xs text-gray-500">{row.original.telefono || 'Sin teléfono'}</span>
        </div>
      )
    },
    {
      accessorKey: 'direccion',
      header: 'Dirección',
      cell: ({ row }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="max-w-[150px] truncate text-left">
              {row.original.direccion}
            </TooltipTrigger>
            <TooltipContent>
              <p>{row.original.direccion}</p>
              {row.original.referencias && <p className="text-gray-400 mt-1">Ref: {row.original.referencias}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
    {
      accessorKey: 'productos',
      header: 'Productos',
      cell: ({ row }) => {
        const prods = row.original.productos || []
        const texto = prods.map(p => `${p.cantidad}x ${p.nombre} ${p.talla ? `(${p.talla})` : ''}`.trim()).join(', ')
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[200px] truncate text-xs cursor-help">{texto || '-'}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs break-words">{texto}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
    },
    {
      accessorKey: 'paqueteria_id',
      header: 'Paquetería',
      cell: ({ row }) => {
        const isEditable = rol === 'admin' || (rol === 'paqueteria' && row.original.status === 'pendiente')
        const currentId = editedRows[row.original.id]?.paqueteria_id || row.original.paqueteria_id
        
        if (isEditable) {
          return (
            <Select 
              value={currentId || ''} 
              onValueChange={(val) => {
                const updated = { paqueteria_id: val }
                handleEdit(row.original.id, 'paqueteria_id', val)
                supabase.from('pedidos').update(updated).eq('id', row.original.id).then(() => onRefresh())
              }}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Asignar" />
              </SelectTrigger>
              <SelectContent>
                {paqueterias?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        return paqueterias?.find(p => p.id === currentId)?.nombre || 'Sin asignar'
      }
    },
    {
      accessorKey: 'guia',
      header: 'Guía',
      cell: ({ row }) => {
        const isEditable = rol === 'admin' || (rol === 'paqueteria' && row.original.status === 'pendiente')
        const value = editedRows[row.original.id]?.guia !== undefined ? editedRows[row.original.id].guia : (row.original.guia || '')
        
        if (isEditable) {
          return <Input className="h-8 text-xs w-[120px]" value={value} onChange={e => handleEdit(row.original.id, 'guia', e.target.value)} />
        }
        return value || '-'
      }
    },
    {
      accessorKey: 'link_seguimiento',
      header: 'Link',
      cell: ({ row }) => {
        const isEditable = rol === 'admin' || (rol === 'paqueteria' && row.original.status === 'pendiente')
        const value = editedRows[row.original.id]?.link_seguimiento !== undefined ? editedRows[row.original.id].link_seguimiento : (row.original.link_seguimiento || '')
        
        if (isEditable) {
          return <Input className="h-8 text-xs w-[150px]" value={value} onChange={e => handleEdit(row.original.id, 'link_seguimiento', e.target.value)} />
        }
        return value ? <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center"><ExternalLink size={14} className="mr-1" /> Ver</a> : '-'
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status
        const isEditable = rol === 'admin' || rol === 'paqueteria'
        
        if (isEditable) {
          return (
            <Select 
              value={status} 
              onValueChange={(val) => {
                supabase.from('pedidos').update({ status: val }).eq('id', row.original.id).then(() => onRefresh())
              }}
            >
              <SelectTrigger className={`w-[130px] h-8 text-xs border-0 ${statusColors[status] || 'bg-gray-100'}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_transito">En Tránsito</SelectItem>
                <SelectItem value="entregado">Entregado</SelectItem>
                <SelectItem value="con_retraso">Con Retraso</SelectItem>
                <SelectItem value="problema">Problema</SelectItem>
              </SelectContent>
            </Select>
          )
        }
        
        return <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>{status.replace('_', ' ').toUpperCase()}</Badge>
      }
    },
    {
      id: 'acciones',
      cell: ({ row }) => {
        const isEditableRole = rol === 'admin' || (rol === 'paqueteria' && row.original.status === 'pendiente')
        const hasEdits = editedRows[row.original.id] && (editedRows[row.original.id].guia || editedRows[row.original.id].link_seguimiento)

        if (isEditableRole && hasEdits) {
          return (
            <Button size="sm" className="bg-[#009B5B] hover:bg-[#00804b] text-white text-xs h-8" onClick={() => handleSaveAndNotify(row.original)}>
              GUARDAR Y NOTIFICAR
            </Button>
          )
        }

        if (mode === 'entregados' && row.original.status !== 'entregado') {
           return (
             <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => onVerify(row.original)}>
               Verificar
             </Button>
           )
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onViewDetails(row.original)}>
                Ver detalle / Historial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: pedidos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Buscar..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No hay resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
