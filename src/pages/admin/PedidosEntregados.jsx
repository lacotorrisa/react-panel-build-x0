import React, { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'
import { toast } from 'sonner'
import { enviarEmailEntregado } from '../../lib/email'

export const PedidosEntregados = () => {
  const { clienteSeleccionado, setClienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
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

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').eq('activo', true)
    if (data) setClientes(data)
  }

  useEffect(() => {
    fetchClientes()
    fetchPaqueterias()
  }, [])

  useEffect(() => {
    if (clienteSeleccionado) {
      fetchPedidos()
    }
  }, [clienteSeleccionado])

  const handleVerificar = async (pedido) => {
    if (pedido.link_seguimiento) {
      window.open(pedido.link_seguimiento, '_blank')
    }
    
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

  const SelectorCliente = () => (
    <div className="w-full sm:w-72">
      <Select 
        value={clienteSeleccionado?.id?.toString() || ''} 
        onValueChange={(val) => {
          const cl = clientes.find(c => c.id.toString() === val)
          setClienteSeleccionado(cl)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar Cliente" />
        </SelectTrigger>
        <SelectContent>
          {clientes.map(cliente => (
            <SelectItem key={cliente.id} value={cliente.id.toString()}>
              {cliente.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (!clienteSeleccionado) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center">
        <h2 className="text-xl font-semibold text-gray-700">Selecciona un cliente para ver sus pedidos entregados</h2>
        <SelectorCliente />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Pedidos Entregados</h2>
          <SelectorCliente />
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
