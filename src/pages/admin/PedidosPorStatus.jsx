import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'
import { Button } from '../../components/ui/button'

const STATUS_LABELS = {
  pendiente:        { label: 'Pendientes',            emoji: '⏳', color: 'text-yellow-700',  bg: 'bg-yellow-50' },
  en_espera_guia:   { label: 'En Espera de Guía',     emoji: '📋', color: 'text-orange-700',  bg: 'bg-orange-50' },
  en_espera_prenda: { label: 'Falta Prenda',          emoji: '📦', color: 'text-purple-700',  bg: 'bg-purple-50' },
  en_transito:      { label: 'En Tránsito',           emoji: '🚚', color: 'text-blue-700',    bg: 'bg-blue-50'   },
  entregado:        { label: 'Entregados',            emoji: '✅', color: 'text-green-700',   bg: 'bg-green-50'  },
  con_retraso:      { label: 'Con Retraso',           emoji: '⚠️', color: 'text-red-700',     bg: 'bg-red-50'    },
  problema:         { label: 'Con Problema',          emoji: '❌', color: 'text-red-900',     bg: 'bg-red-100'   },
  todos:            { label: 'Todos los Pedidos',     emoji: '📊', color: 'text-gray-700',    bg: 'bg-gray-50'   },
}

export const PedidosPorStatus = () => {
  const { status } = useParams()
  const navigate = useNavigate()
  const { clienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [loading, setLoading] = useState(true)

  const info = STATUS_LABELS[status] || STATUS_LABELS['todos']

  const fetchPedidos = async () => {
    if (!clienteSeleccionado) return
    setLoading(true)

    let query = supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_id', clienteSeleccionado.id)
      .order('fecha_pedido', { ascending: false })
      .order('created_at',   { ascending: false })

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    const { data } = await query
    if (data) setPedidos(data)
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('paqueterias').select('*').eq('activo', true).then(({ data }) => {
      if (data) setPaqueterias(data)
    })
  }, [])

  useEffect(() => {
    fetchPedidos()
  }, [clienteSeleccionado, status])

  return (
    <div className="space-y-6">
      <div className={`${info.bg} rounded-lg px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="h-8 gap-1">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <div>
            <h2 className={`text-2xl font-bold ${info.color}`}>
              {info.emoji} {info.label}
            </h2>
            <p className="text-sm text-gray-500">{clienteSeleccionado?.nombre}</p>
          </div>
        </div>
        <div className={`text-4xl font-black ${info.color}`}>
          {loading ? '…' : pedidos.length}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">Cargando pedidos…</div>
      ) : (
        <TablaPedidos
          pedidos={pedidos}
          paqueterias={paqueterias}
          onRefresh={fetchPedidos}
          onViewDetails={setSelectedPedido}
        />
      )}

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
