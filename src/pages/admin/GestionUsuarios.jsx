import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'

export const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    rol: 'paqueteria',
    entidad_id: ''
  })

  const fetchData = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*')
    if (profiles) setUsuarios(profiles)

    const { data: cl } = await supabase.from('clientes').select('id, nombre').eq('activo', true)
    if (cl) setClientes(cl)

    const { data: paq } = await supabase.from('paqueterias').select('id, nombre').eq('activo', true)
    if (paq) setPaqueterias(paq)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.nombre || !formData.rol) {
      return toast.error('Llenar todos los campos requeridos')
    }
    
    setLoading(true)
    try {
      // Create user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError

      if (authData.user) {
        // Insert profile
        const profileData = {
          id: authData.user.id,
          email: formData.email,
          nombre: formData.nombre,
          rol: formData.rol,
          cliente_id: formData.rol === 'cliente' ? formData.entidad_id : null,
          paqueteria_id: formData.rol === 'paqueteria' ? formData.entidad_id : null,
        }

        await supabase.from('profiles').insert(profileData)
        toast.success('Usuario creado exitosamente')
        setModalOpen(false)
        fetchData()
      }
    } catch (error) {
      console.error(error)
      toast.error('Error al crear usuario (podría requerir admin API o ya existir)')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-500">Administra accesos al sistema</p>
        </div>
        <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Entidad Asociada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nombre}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{u.rol}</Badge></TableCell>
                <TableCell>
                  {u.rol === 'admin' ? 'Colivery' : 
                   u.rol === 'cliente' ? (clientes.find(c => c.id === u.cliente_id)?.nombre || 'Desconocido') : 
                   (paqueterias.find(p => p.id === u.paqueteria_id)?.nombre || 'Desconocido')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre Completo</Label>
              <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
            </div>
            <div>
              <Label>Correo Electrónico</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={formData.rol} onValueChange={val => setFormData({...formData, rol: val, entidad_id: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="paqueteria">Paquetería</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.rol === 'cliente' && (
              <div>
                <Label>Seleccionar Cliente</Label>
                <Select value={formData.entidad_id} onValueChange={val => setFormData({...formData, entidad_id: val})}>
                  <SelectTrigger><SelectValue placeholder="Seleccione empresa" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.rol === 'paqueteria' && (
              <div>
                <Label>Seleccionar Paquetería</Label>
                <Select value={formData.entidad_id} onValueChange={val => setFormData({...formData, entidad_id: val})}>
                  <SelectTrigger><SelectValue placeholder="Seleccione paquetería" /></SelectTrigger>
                  <SelectContent>
                    {paqueterias.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={handleCreate} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Usuario'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
