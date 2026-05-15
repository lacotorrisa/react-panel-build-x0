import React, { useState, useEffect } from 'react'
import { Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'

export const GestionUsuarios = () => {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = crear nuevo
  const [loading, setLoading] = useState(false)
  const [edgeFunctionAvailable, setEdgeFunctionAvailable] = useState(true)

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

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditingUser(null)
    setFormData({ email: '', password: '', nombre: '', rol: 'paqueteria', entidad_id: '' })
    setModalOpen(true)
  }

  const openEdit = (usuario) => {
    setEditingUser(usuario)
    setFormData({
      email: usuario.email || '',
      password: '',
      nombre: usuario.nombre || '',
      rol: usuario.rol || 'paqueteria',
      entidad_id: usuario.cliente_id || usuario.paqueteria_id || ''
    })
    setModalOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.nombre || !formData.rol) {
      return toast.error('Completa todos los campos requeridos')
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          nombre: formData.nombre,
          rol: formData.rol,
          cliente_id: formData.rol === 'cliente' ? formData.entidad_id : null,
          paqueteria_id: formData.rol === 'paqueteria' ? formData.entidad_id : null,
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success(`✅ Usuario ${formData.email} creado exitosamente`)
      setModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Error al crear usuario: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!formData.nombre || !formData.rol) {
      return toast.error('Completa todos los campos requeridos')
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('profiles').update({
        nombre: formData.nombre,
        rol: formData.rol,
        cliente_id: formData.rol === 'cliente' ? formData.entidad_id : null,
        paqueteria_id: formData.rol === 'paqueteria' ? formData.entidad_id : null,
      }).eq('id', editingUser.id)

      if (error) throw error
      toast.success('Usuario actualizado')
      setModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error('Error al actualizar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const rolColors = {
    admin: 'bg-purple-100 text-purple-800',
    paqueteria: 'bg-blue-100 text-blue-800',
    cliente: 'bg-green-100 text-green-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-500">Administra los accesos al sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Actualizar</Button>
          <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Aviso si la edge function no está desplegada */}
      {!edgeFunctionAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Función de creación de usuarios no activa</p>
            <p className="text-amber-700">Para activar la creación de usuarios desde aquí, ve a <strong>Supabase → Edge Functions</strong> y despliega la función <code>create-user</code> que está en <code>supabase/functions/create-user/index.ts</code></p>
            <p className="mt-1 text-amber-600">Por ahora, puedes crear usuarios desde <strong>Supabase → Authentication → Add User</strong></p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  No hay usuarios registrados aún.
                </TableCell>
              </TableRow>
            )}
            {usuarios.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nombre}</TableCell>
                <TableCell className="text-sm text-gray-600">{u.email}</TableCell>
                <TableCell>
                  <Badge className={rolColors[u.rol] || 'bg-gray-100'} variant="secondary">{u.rol}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {u.rol === 'admin' ? 'Colivery Admin' :
                   u.rol === 'cliente' ? (clientes.find(c => c.id === u.cliente_id)?.nombre || '—') :
                   (paqueterias.find(p => p.id === u.paqueteria_id)?.nombre || '—')}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>✏️ Editar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal crear / editar */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) setEditingUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? `Editar: ${editingUser.email}` : 'Crear Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre Completo *</Label>
              <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Solin Logistics" />
            </div>
            {!editingUser && (
              <>
                <div>
                  <Label>Correo Electrónico *</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="correo@empresa.com" />
                </div>
                <div>
                  <Label>Contraseña *</Label>
                  <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mínimo 6 caracteres" />
                </div>
              </>
            )}
            <div>
              <Label>Rol *</Label>
              <Select value={formData.rol} onValueChange={val => setFormData({...formData, rol: val, entidad_id: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="paqueteria">Paquetería</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.rol === 'cliente' && (
              <div>
                <Label>Empresa Cliente</Label>
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
                <Label>Empresa Paquetería</Label>
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
              <Button className="bg-[#FF6600] hover:bg-[#e65c00]"
                onClick={editingUser ? handleUpdate : handleCreate}
                disabled={loading}>
                {loading ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
