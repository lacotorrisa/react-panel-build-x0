import React, { useState, useEffect } from 'react'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'

export const GestionPaqueterias = () => {
  const [paqueterias, setPaqueterias] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [nuevaPaqueteria, setNuevaPaqueteria] = useState({ nombre: '', logo_url: '' })

  const fetchPaqueterias = async () => {
    const { data } = await supabase.from('paqueterias').select('*').order('created_at', { ascending: false })
    if (data) setPaqueterias(data)
  }

  useEffect(() => {
    fetchPaqueterias()
  }, [])

  const handleCreate = async () => {
    if (!nuevaPaqueteria.nombre) return toast.error('El nombre es requerido')
    try {
      await supabase.from('paqueterias').insert(nuevaPaqueteria)
      toast.success('Paquetería creada')
      setModalOpen(false)
      setNuevaPaqueteria({ nombre: '', logo_url: '' })
      fetchPaqueterias()
    } catch (error) {
      toast.error('Error al crear paquetería')
    }
  }

  const toggleStatus = async (paq) => {
    try {
      await supabase.from('paqueterias').update({ activo: !paq.activo }).eq('id', paq.id)
      fetchPaqueterias()
      toast.success(`Paquetería ${!paq.activo ? 'activada' : 'desactivada'}`)
    } catch (error) {
      toast.error('Error al actualizar status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Paqueterías</h2>
          <p className="text-sm text-gray-500">Administra los proveedores de envíos</p>
        </div>
        <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Paquetería
        </Button>
      </div>

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paqueterias.map(paq => (
              <TableRow key={paq.id}>
                <TableCell className="font-medium">{paq.nombre}</TableCell>
                <TableCell>
                  <Badge className={paq.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {paq.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus(paq)}>
                    {paq.activo ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Paquetería</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre de Paquetería</Label>
              <Input 
                value={nuevaPaqueteria.nombre} 
                onChange={e => setNuevaPaqueteria({...nuevaPaqueteria, nombre: e.target.value})} 
              />
            </div>
            <div>
              <Label>URL Logo (Opcional)</Label>
              <Input 
                value={nuevaPaqueteria.logo_url} 
                onChange={e => setNuevaPaqueteria({...nuevaPaqueteria, logo_url: e.target.value})} 
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={handleCreate}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
