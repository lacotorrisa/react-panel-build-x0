import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { toast } from 'sonner'
import { CheckCircle2, Clock, UploadCloud, Camera } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { format } from 'date-fns'

export const RecepcionesPaqueteria = () => {
  const [recepciones, setRecepciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('recepciones')
        .select(`*, clientes(nombre)`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecepciones(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar recepciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleConfirmar = async () => {
    if (!file) {
      return toast.error('Debes subir una foto como evidencia de recepción.')
    }

    try {
      setUploading(true)
      
      // 1. Subir archivo a Supabase Storage (bucket evidencias)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `recepciones/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('evidencias')
        .getPublicUrl(filePath)

      // 2. Actualizar status en la base de datos (Esto dispara el Trigger para el Inventario)
      const { error: updateError } = await supabase
        .from('recepciones')
        .update({
          status: 'recibido',
          evidencia_url: publicUrl
        })
        .eq('id', selectedReq.id)

      if (updateError) throw updateError

      toast.success('¡Recepción confirmada exitosamente! El inventario se ha actualizado.')
      setModalOpen(false)
      setSelectedReq(null)
      setFile(null)
      fetchData()

    } catch (err) {
      console.error(err)
      toast.error('Error al confirmar recepción: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Recepción de Mercancía</h1>
        <p className="text-gray-500">Confirma la llegada de stock y actualiza tu inventario</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando manifiestos...</div>
        ) : recepciones.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No tienes recepciones pendientes o en historial.</div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Fecha Asignación</TableHead>
                <TableHead>Cliente (Dueño)</TableHead>
                <TableHead>Prendas a Recibir</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recepciones.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{format(new Date(req.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>{req.clientes?.nombre || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {req.productos.map((p, i) => (
                        <div key={i}>• <span className="font-bold text-gray-700">{p.cantidad}x</span> {p.descripcion}</div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {req.status === 'recibido' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Recibido
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 animate-pulse">
                        <Clock className="w-3 h-3 mr-1" /> Pendiente de Recibir
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {req.status === 'pendiente' ? (
                      <Button 
                        size="sm" 
                        onClick={() => { setSelectedReq(req); setModalOpen(true); }}
                        className="bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      >
                        Confirmar Llegada
                      </Button>
                    ) : (
                      <a href={req.evidencia_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm font-medium">
                        Ver Evidencia
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* MODAL CONFIRMAR RECEPCION */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg z-50">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Camera className="w-5 h-5 mr-2 text-orange-500" />
              Confirmar Recepción de Stock
            </Dialog.Title>

            {selectedReq && (
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <p className="text-sm font-medium text-orange-800 mb-2">Por favor, confirma que recibiste físicamente:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedReq.productos.map((p, i) => (
                      <li key={i}>• <b>{p.cantidad}</b> piezas de "{p.descripcion}"</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">Del cliente: {selectedReq.clientes?.nombre}</p>
                </div>

                <div>
                  <Label>Foto de Evidencia *</Label>
                  <p className="text-xs text-gray-500 mb-2">Sube una foto de las cajas, manifiesto firmado o prendas recibidas.</p>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                    <Input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="cursor-pointer file:cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => { setModalOpen(false); setFile(null); }} disabled={uploading}>
                    Cancelar
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    onClick={handleConfirmar}
                    disabled={uploading || !file}
                  >
                    {uploading ? 'Procesando...' : 'Sí, Recibí Todo Correctamente'}
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}
