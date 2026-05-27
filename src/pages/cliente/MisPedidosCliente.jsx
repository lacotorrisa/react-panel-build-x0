import React, { useState, useEffect } from 'react'
import { Package, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'
import { Card, CardContent } from '../../components/ui/card'

export const MisPedidosCliente = () => {
  const { perfil } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchPedidos = async () => {
    if (!perfil?.cliente_id) return
    setLoading(true)
    try {
      const [pedRes, paqRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('*')
          .eq('cliente_id', perfil.cliente_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('paqueterias')
          .select('*')
          .eq('activo', true)
      ])
      
      if (pedRes.data) setPedidos(pedRes.data)
      if (paqRes.data) setPaqueterias(paqRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (perfil?.cliente_id) {
      fetchPedidos()
    }
  }, [perfil])

  // KPIs calculados
  const total = pedidos.length
  const enTransito = pedidos.filter(p => p.status === 'en_transito').length
  const entregados = pedidos.filter(p => p.status === 'entregado').length
  const pendientes = pedidos.filter(p => ['pendiente', 'en_espera_guia', 'en_espera_prenda'].includes(p.status)).length
  const alertas = pedidos.filter(p => ['con_retraso', 'problema'].includes(p.status)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mis Pedidos</h2>
        <p className="text-sm text-gray-500">Historial completo, guías de rastreo y estatus en tiempo real.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total</p>
              <p className="text-xl font-bold text-gray-800">{total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Pendientes</p>
              <p className="text-xl font-bold text-yellow-700">{pendientes}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">En Tránsito</p>
              <p className="text-xl font-bold text-blue-700">{enTransito}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-600 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Entregados</p>
              <p className="text-xl font-bold text-green-700">{entregados}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Retraso/Alerta</p>
              <p className="text-xl font-bold text-red-700">{alertas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
          Cargando pedidos...
        </div>
      ) : (
        <TablaPedidos
          mode="cliente"
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
