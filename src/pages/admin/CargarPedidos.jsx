import React, { useState, useEffect } from 'react'
import { Plus, Upload } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalNuevoPedido } from '../../components/modals/ModalNuevoPedido'
import { ModalImportarCSV } from '../../components/modals/ModalImportarCSV'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'

export const CargarPedidos = () => {
  const { clienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false)
  const [modalCsvOpen, setModalCsvOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState(null)

  const fetchPedidos = async () => {
    if (!clienteSeleccionado) return
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_id', clienteSeleccionado.id)
      .order('created_at', { ascending: false })
    
    if (data) setPedidos(data)
  }

  const fetchPaqueterias = async () => {
    const { data } = await supabase.from('paqueterias').select('*').eq('activo', true)
    if (data) setPaqueterias(data)
  }

  useEffect(() => {
    fetchPedidos()
    fetchPaqueterias()
  }, [clienteSeleccionado])

  if (!clienteSeleccionado) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700">Selecciona un cliente en el Dashboard para ver sus pedidos</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cargar Pedidos</h2>
          <p className="text-sm text-gray-500">Gestionando pedidos de: {clienteSeleccionado.nombre}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setModalCsvOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
          <Button className="bg-[#FF6600] hover:bg-[#e65c00]" onClick={() => setModalNuevoOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
          </Button>
        </div>
      </div>

      <TablaPedidos 
        pedidos={pedidos} 
        paqueterias={paqueterias}
        onRefresh={fetchPedidos}
        onViewDetails={setSelectedPedido}
      />

      <ModalNuevoPedido 
        open={modalNuevoOpen} 
        onOpenChange={setModalNuevoOpen} 
        cliente={clienteSeleccionado}
        onSuccess={() => {
          setModalNuevoOpen(false)
          fetchPedidos()
        }}
      />

      <ModalImportarCSV
        open={modalCsvOpen}
        onOpenChange={setModalCsvOpen}
        cliente={clienteSeleccionado}
        onSuccess={() => {
          setModalCsvOpen(false)
          fetchPedidos()
        }}
      />

      {selectedPedido && (
        <ModalDetallePedido
          open={!!selectedPedido}
          onOpenChange={(open) => !open && setSelectedPedido(null)}
          pedido={selectedPedido}
        />
      )}
    </div>
  )
}
