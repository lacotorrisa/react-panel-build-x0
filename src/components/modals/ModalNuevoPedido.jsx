import React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

const pedidoSchema = z.object({
  fecha_pedido: z.string().min(1, 'La fecha es requerida'),
  id_compra: z.string().min(1, 'El ID es requerido'),
  plataforma: z.string().min(1, 'Selecciona una plataforma'),
  nombre_comprador: z.string().min(2, 'Nombre muy corto'),
  direccion: z.string().min(5, 'Dirección requerida'),
  referencias: z.string().optional(),
  telefono: z.string().optional(),
  correo_comprador: z.string().email('Correo inválido'),
  productos: z.array(z.object({
    nombre: z.string().min(1, 'Nombre requerido'),
    talla: z.string().optional(),
    cantidad: z.number().min(1)
  })).min(1, 'Agrega al menos un producto')
})

export const ModalNuevoPedido = ({ open, onOpenChange, cliente, onSuccess }) => {
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(pedidoSchema),
    defaultValues: {
      fecha_pedido: new Date().toISOString().split('T')[0],
      productos: [{ nombre: '', talla: '', cantidad: 1 }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "productos"
  })

  const onSubmit = async (data) => {
    try {
      const { error } = await supabase.from('pedidos').insert({
        cliente_id: cliente.id,
        ...data,
        status: 'pendiente'
      })

      if (error) throw error

      toast.success('Pedido creado exitosamente')
      reset()
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error('Error al crear el pedido')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Pedido</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha del Pedido</Label>
              <Input type="date" {...register('fecha_pedido')} />
              {errors.fecha_pedido && <p className="text-red-500 text-xs mt-1">{errors.fecha_pedido.message}</p>}
            </div>
            <div>
              <Label>ID de Compra</Label>
              <Input {...register('id_compra')} placeholder="Ej: #10023" />
              {errors.id_compra && <p className="text-red-500 text-xs mt-1">{errors.id_compra.message}</p>}
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select onValueChange={val => setValue('plataforma', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {cliente?.plataformas?.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.plataforma && <p className="text-red-500 text-xs mt-1">{errors.plataforma.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-700 border-b pb-2">Datos del Comprador</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre completo</Label>
                <Input {...register('nombre_comprador')} />
                {errors.nombre_comprador && <p className="text-red-500 text-xs mt-1">{errors.nombre_comprador.message}</p>}
              </div>
              <div>
                <Label>Correo electrónico</Label>
                <Input type="email" {...register('correo_comprador')} />
                {errors.correo_comprador && <p className="text-red-500 text-xs mt-1">{errors.correo_comprador.message}</p>}
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input {...register('telefono')} />
              </div>
              <div className="col-span-2">
                <Label>Dirección completa</Label>
                <Input {...register('direccion')} />
                {errors.direccion && <p className="text-red-500 text-xs mt-1">{errors.direccion.message}</p>}
              </div>
              <div className="col-span-2">
                <Label>Referencias adicionales</Label>
                <Input {...register('referencias')} placeholder="Ej: Casa blanca portón negro" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-medium text-sm text-gray-700">Productos</h4>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ nombre: '', talla: '', cantidad: 1 })}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Producto
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Nombre del producto</Label>
                  <Input {...register(`productos.${index}.nombre`)} />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Talla/Var</Label>
                  <Input {...register(`productos.${index}.talla`)} />
                </div>
                <div className="w-20">
                  <Label className="text-xs">Cant.</Label>
                  <Input type="number" {...register(`productos.${index}.cantidad`, { valueAsNumber: true })} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-red-500 mb-0.5" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {errors.productos && <p className="text-red-500 text-xs">{errors.productos.message}</p>}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#FF6600] hover:bg-[#e65c00]">
              Guardar Pedido
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
