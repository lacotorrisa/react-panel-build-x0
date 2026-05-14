import React, { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'
import { toast } from 'sonner'
import { enviarEmailEntregado } from '../../lib/email'

export const PedidosEntregados = () => {
  const { clienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [selectedPedido, setSelectedPedido] = useState(null)

  const fetchPedidos = async () => {
    if (!clienteSeleccionado) return
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('status', 'entregado')
      .order('updated_at', { ascending: false })
    
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

  const handleVerificar = async (pedido) => {
    if (pedido.link_seguimiento) {
      window.open(pedido.link_seguimiento, '_blank')
    }
    
    // The prompt requested a confirmation modal for "Verificar", but since this page only shows
    // already 'entregado' status items according to the prompt initially, or maybe we show 'en_transito' to verify?
    // Let's assume the user meant to verify 'en_transito' items and mark them 'entregado'.
    // The prompt says: "- TablaPedidos filtrada por status = 'entregado' - Botón "Verificar" ... Al confirmar: cambia status a 'entregado'"
    // This is a slight contradiction, usually you verify 'en_transito' to become 'entregado'.
    // I will fetch both or just 'en_transito' and 'entregado'. 
    // For now I'll just follow the prompt directly, but also allow checking status.
    const confirm = window.confirm('¿Confirmas que el paquete fue entregado?')
    if (confirm) {
      try {
        await supabase.from('pedidos').update({ status: 'entregado' }).eq('id', pedido.id)
        
        await supabase.from('pedido_eventos').insert({
          pedido_id: pedido.id,
          tipo: 'entregado',
          descripcion: 'Paquete marcado como entregado',
          usuario_id: (await supabase.auth.getUser()).data.user?.id
        })

        const { data: cliente } = await supabase.from('clientes').select('*').eq('id', pedido.cliente_id).single()
        await enviarEmailEntregado({ pedido, cliente })

        toast.success('Pedido marcado como entregado')
        fetchPedidos()
      } catch (error) {
        toast.error('Error al actualizar el pedido')
      }
    }
  }

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
          <h2 className="text-2xl font-bold tracking-tight">Pedidos Entregados</h2>
          <p className="text-sm text-gray-500">Mostrando historial de entregas de: {clienteSeleccionado.nombre}</p>
        </div>
      </div>

      <TablaPedidos 
        mode="entregados"
        pedidos={pedidos} 
        paqueterias={paqueterias}
        onRefresh={fetchPedidos}
        onViewDetails={setSelectedPedido}
        onVerify={handleVerificar}
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
