import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from 'sonner'
import { Plus, Building2, UserPlus, Eye, EyeOff, Pencil, Phone, Globe, Mail, MapPin, FileText } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

const BLANK_FORM = {
  nombre: '', email: '', password: '', confirmarPassword: '',
  direccion: '', contacto: '', telefono: '', pagina_web: '', email_contacto: '', notas: ''
}

export const GestionEmpresasLogisticas = () => {
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)

  const [formData, setFormData] = useState(BLANK_FORM)
  const [editData, setEditData] = useState({})

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('empresas_logisticas')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setEmpresas(data || [])
    } catch (err) {
      toast.error('Error al cargar empresas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!formData.nombre.trim()) return toast.error('El nombre de la empresa es requerido')
    if (!formData.email.trim()) return toast.error('El correo es requerido')
    if (formData.password.length < 6) return toast.error('La contraseña debe tener mínimo 6 caracteres')
    if (formData.password !== formData.confirmarPassword) return toast.error('Las contraseñas no coinciden')

    setSaving(true)
    try {
      // 1. Guardar sesión del admin antes de hacer signUp
      const { data: { session: adminSession } } = await supabase.auth.getSession()

      // 2. Crear empresa en la tabla con todos los campos
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas_logisticas')
        .insert({
          nombre: formData.nombre.trim(),
          direccion: formData.direccion || null,
          contacto: formData.contacto || null,
          telefono: formData.telefono || null,
          pagina_web: formData.pagina_web || null,
          email_contacto: formData.email_contacto || null,
          notas: formData.notas || null,
        })
        .select()
        .single()

      if (empresaError) throw empresaError

      // 2. Crear usuario confirmado vía Vercel Serverless Function (sin email de verificación)
      const res = await fetch(`${window.location.origin}/api/admin/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          nombre: formData.nombre.trim(),
          rol: 'logistica',
          logistica_id: empresa.id,
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al crear usuario')

      toast.success(`Empresa "${formData.nombre}" y usuario creados exitosamente`)
      setModalOpen(false)
      setFormData(BLANK_FORM)
      fetchData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (empresa) => {
    setSelectedEmpresa(empresa)
    setEditData({
      nombre: empresa.nombre || '',
      direccion: empresa.direccion || '',
      contacto: empresa.contacto || '',
      telefono: empresa.telefono || '',
      pagina_web: empresa.pagina_web || '',
      email_contacto: empresa.email_contacto || '',
      notas: empresa.notas || '',
    })
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('empresas_logisticas')
        .update({
          nombre: editData.nombre,
          direccion: editData.direccion || null,
          contacto: editData.contacto || null,
          telefono: editData.telefono || null,
          pagina_web: editData.pagina_web || null,
          email_contacto: editData.email_contacto || null,
          notas: editData.notas || null,
        })
        .eq('id', selectedEmpresa.id)

      if (error) throw error
      toast.success('Ficha actualizada correctamente')
      setEditModalOpen(false)
      fetchData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (empresa) => {
    const { error } = await supabase
      .from('empresas_logisticas')
      .update({ activo: !empresa.activo })
      .eq('id', empresa.id)
    if (error) return toast.error('Error al actualizar')
    toast.success(`Empresa ${empresa.activo ? 'desactivada' : 'activada'}`)
    fetchData()
  }

  const handleDelete = async (empresa) => {
    if (!confirm(`¿Eliminar permanentemente "${empresa.nombre}"? Esta acción no se puede deshacer.`)) return
    // Primero desvinculamos los perfiles que apuntan a esta empresa
    await supabase.from('profiles').update({ logistica_id: null }).eq('logistica_id', empresa.id)
    // Luego eliminamos la empresa
    const { error } = await supabase.from('empresas_logisticas').delete().eq('id', empresa.id)
    if (error) return toast.error('Error al eliminar: ' + error.message)
    toast.success(`Empresa "${empresa.nombre}" eliminada`)
    fetchData()
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Empresas Logísticas</h1>
          <p className="text-gray-500">Gestiona las empresas de logística, su ficha y sus accesos al sistema</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nueva Empresa
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando empresas...</div>
        ) : empresas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-2" />
            <p>No hay empresas logísticas registradas aún.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Fecha de Alta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map(empresa => (
                <TableRow key={empresa.id} className="hover:bg-orange-50/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{empresa.nombre}</p>
                        {empresa.pagina_web && (
                          <a href={empresa.pagina_web} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">{empresa.pagina_web}</a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{empresa.contacto || '—'}</TableCell>
                  <TableCell className="text-sm text-gray-600">{empresa.telefono || '—'}</TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(empresa.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${empresa.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {empresa.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(empresa)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar Ficha
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActivo(empresa)}>
                        {empresa.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleDelete(empresa)}>
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal Nueva Empresa */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-500" /> Nueva Empresa Logística
            </Dialog.Title>
            <p className="text-sm text-gray-500 mb-4">Se creará la empresa, su ficha técnica y la cuenta de acceso.</p>

            <div className="space-y-4">
              {/* Acceso */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <p className="text-sm font-semibold text-orange-800 mb-3">🔑 Datos de Acceso al Sistema</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Nombre de la Empresa *</Label>
                    <Input placeholder="Ej: Solin Logistics" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div>
                    <Label>Correo de Acceso *</Label>
                    <Input type="email" placeholder="empresa@colivery.mx" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div>
                    <Label>Contraseña *</Label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label>Confirmar Contraseña *</Label>
                    <Input type="password" placeholder="Repite la contraseña" value={formData.confirmarPassword} onChange={e => setFormData({...formData, confirmarPassword: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Ficha técnica */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">📋 Ficha Técnica (Opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label><MapPin className="w-3 h-3 inline mr-1" />Dirección</Label>
                    <Input placeholder="Calle, número, colonia, ciudad..." value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                  </div>
                  <div>
                    <Label><UserPlus className="w-3 h-3 inline mr-1" />Nombre del Contacto</Label>
                    <Input placeholder="Ej: Juan Pérez" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} />
                  </div>
                  <div>
                    <Label><Phone className="w-3 h-3 inline mr-1" />Teléfono</Label>
                    <Input placeholder="+52 33 1234 5678" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                  </div>
                  <div>
                    <Label><Mail className="w-3 h-3 inline mr-1" />Email de Contacto</Label>
                    <Input type="email" placeholder="contacto@empresa.com" value={formData.email_contacto} onChange={e => setFormData({...formData, email_contacto: e.target.value})} />
                  </div>
                  <div>
                    <Label><Globe className="w-3 h-3 inline mr-1" />Página Web</Label>
                    <Input placeholder="https://www.empresa.com" value={formData.pagina_web} onChange={e => setFormData({...formData, pagina_web: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <Label><FileText className="w-3 h-3 inline mr-1" />Notas Adicionales</Label>
                    <Input placeholder="Horarios, observaciones, acuerdos, etc." value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creando...' : 'Crear Empresa y Usuario'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Editar Ficha */}
      <Dialog.Root open={editModalOpen} onOpenChange={setEditModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-orange-500" /> Editar Ficha: {selectedEmpresa?.nombre}
            </Dialog.Title>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nombre de la Empresa *</Label>
                  <Input value={editData.nombre} onChange={e => setEditData({...editData, nombre: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label><MapPin className="w-3 h-3 inline mr-1" />Dirección</Label>
                  <Input placeholder="Calle, número, colonia, ciudad..." value={editData.direccion} onChange={e => setEditData({...editData, direccion: e.target.value})} />
                </div>
                <div>
                  <Label><UserPlus className="w-3 h-3 inline mr-1" />Nombre del Contacto</Label>
                  <Input placeholder="Ej: Juan Pérez" value={editData.contacto} onChange={e => setEditData({...editData, contacto: e.target.value})} />
                </div>
                <div>
                  <Label><Phone className="w-3 h-3 inline mr-1" />Teléfono</Label>
                  <Input placeholder="+52 33 1234 5678" value={editData.telefono} onChange={e => setEditData({...editData, telefono: e.target.value})} />
                </div>
                <div>
                  <Label><Mail className="w-3 h-3 inline mr-1" />Email de Contacto</Label>
                  <Input type="email" placeholder="contacto@empresa.com" value={editData.email_contacto} onChange={e => setEditData({...editData, email_contacto: e.target.value})} />
                </div>
                <div>
                  <Label><Globe className="w-3 h-3 inline mr-1" />Página Web</Label>
                  <Input placeholder="https://www.empresa.com" value={editData.pagina_web} onChange={e => setEditData({...editData, pagina_web: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label><FileText className="w-3 h-3 inline mr-1" />Notas Adicionales</Label>
                  <Input placeholder="Horarios, observaciones, acuerdos..." value={editData.notas} onChange={e => setEditData({...editData, notas: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
