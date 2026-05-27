import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'

export const PedidosRetraso = () => {
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
      .neq('status', 'entregado')
      .order('fecha_pedido', { ascending: true })
    
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
        <h2 className="text-xl font-semibold text-gray-700">Selecciona un cliente para ver sus pedidos con retraso</h2>
        <SelectorCliente />
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
        <SelectorCliente />
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
