import React, { useState, useEffect } from 'react'
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'

const clienteSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  email_remitente: z.string().email('Email inválido'),
  nombre_remitente: z.string().min(2, 'Nombre de remitente requerido'),
  logo_url: z.string().optional()
})

export const GestionClientes = () => {
  const [clientes, setClientes] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clienteSchema)
  })

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (data) setClientes(data)
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  const onSubmit = async (data) => {
    const payload = {
      ...data
    }

    try {
      if (editingCliente) {
        await supabase.from('clientes').update(payload).eq('id', editingCliente.id)
        toast.success('Cliente actualizado')
      } else {
        await supabase.from('clientes').insert(payload)
        toast.success('Cliente creado')
      }
      setModalOpen(false)
      fetchClientes()
    } catch (error) {
      toast.error('Error al guardar cliente')
    }
  }

  const handleEdit = (cliente) => {
    setEditingCliente(cliente)
    setValue('nombre', cliente.nombre)
    setValue('email_remitente', cliente.email_remitente)
    setValue('nombre_remitente', cliente.nombre_remitente)
    setValue('logo_url', cliente.logo_url || '')
    setModalOpen(true)
  }

  const handleOpenNew = () => {
    setEditingCliente(null)
    reset({ nombre: '', email_remitente: '', nombre_remitente: '', logo_url: '' })
    setModalOpen(true)
  }

  const toggleStatus = async (cliente) => {
    try {
      await supabase.from('clientes').update({ activo: !cliente.activo }).eq('id', cliente.id)
      fetchClientes()
      toast.success(`Cliente ${!cliente.activo ? 'activado' : 'desactivado'}`)
    } catch (error) {
      toast.error('Error al actualizar status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Clientes</h2>
          <p className="text-sm text-gray-500">Administra las empresas que envían pedidos</p>
        </div>
        <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Remitente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map(cliente => (
              <TableRow key={cliente.id}>
                <TableCell className="font-medium">
                  {cliente.nombre}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>{cliente.nombre_remitente}</p>
                    <p className="text-gray-500">{cliente.email_remitente}</p>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge className={cliente.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(cliente)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(cliente)}>
                      {cliente.activo ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Nombre de la Empresa</Label>
              <Input {...register('nombre')} />
              {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre Remitente</Label>
                <Input {...register('nombre_remitente')} />
                {errors.nombre_remitente && <p className="text-red-500 text-xs mt-1">{errors.nombre_remitente.message}</p>}
              </div>
              <div>
                <Label>Email Remitente</Label>
                <Input type="email" {...register('email_remitente')} />
                {errors.email_remitente && <p className="text-red-500 text-xs mt-1">{errors.email_remitente.message}</p>}
              </div>
            </div>

            <div>
              <Label>URL Logo (Opcional)</Label>
              <Input {...register('logo_url')} />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#FF6600] hover:bg-[#e65c00]">
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
