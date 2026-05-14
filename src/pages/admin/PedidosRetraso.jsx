import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'

export const PedidosRetraso = () => {
  const { clienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [selectedPedido, setSelectedPedido] = useState(null)

  const fetchPedidos = async () => {
    if (!clienteSeleccionado) return
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)

    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('status', 'pendiente')
      .lt('created_at', ayer.toISOString())
      .order('created_at', { ascending: true })
    
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
        <h2 className="text-xl font-semibold text-gray-700">Selecciona un cliente en el Dashboard</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-red-600 flex items-center">
            <AlertCircle className="mr-2" /> Pedidos con Retraso
          </h2>
          <p className="text-sm text-gray-500">Pedidos pendientes de asignación por más de 24 hrs.</p>
        </div>
      </div>

      <TablaPedidos 
        mode="retrasos"
        pedidos={pedidos} 
        paqueterias={paqueterias}
        onRefresh={fetchPedidos}
        onViewDetails={setSelectedPedido}
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
