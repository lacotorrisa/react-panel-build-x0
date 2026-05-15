import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'

export const MisPedidos = () => {
  const { perfil } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [retrasos, setRetrasos] = useState(0)

  const fetchPedidos = async () => {
    // Solin Logistics maneja todas las paqueterías
    let query = supabase.from('pedidos').select('*').order('created_at', { ascending: false })
    
    // Si tuviera un ID específico, filtraríamos, pero Solin maneja todo:
    // if (perfil.paqueteria_id) query = query.eq('paqueteria_id', perfil.paqueteria_id)
    
    const { data } = await query
    
    if (data) {
      setPedidos(data)
      
      // Calculate retrasos
      const ayer = new Date()
      ayer.setDate(ayer.getDate() - 1)
      const rts = data.filter(p => p.status === 'pendiente' && new Date(p.created_at) < ayer)
      setRetrasos(rts.length)
    }
  }

  const fetchPaqueterias = async () => {
    const { data } = await supabase.from('paqueterias').select('*').eq('activo', true)
    if (data) setPaqueterias(data)
  }

  useEffect(() => {
    fetchPedidos()
    fetchPaqueterias()
  }, [perfil])

  return (
    <div className="space-y-6">
      {retrasos > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Alerta de Retrasos</h3>
            <p className="mt-1 text-sm text-red-700">
              Tienes {retrasos} pedidos urgentes sin guía asignada.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mis Pedidos</h2>
          <p className="text-sm text-gray-500">Asigna guías y notifica a los compradores.</p>
        </div>
      </div>

      <TablaPedidos 
        mode="paqueteria"
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
