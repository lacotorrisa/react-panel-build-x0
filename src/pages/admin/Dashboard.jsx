import React, { useEffect, useState } from 'react'
import { Package, Truck, CheckCircle, AlertCircle, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'

export const Dashboard = () => {
  const { clienteSeleccionado, setClienteSeleccionado } = useAppStore()
  const [clientes, setClientes] = useState([])
  const [metrics, setMetrics] = useState({
    hoy: 0,
    transito: 0,
    entregados: 0,
    retraso: 0
  })
  const [retrasos, setRetrasos] = useState(0)

  useEffect(() => {
    fetchClientes()
  }, [])

  useEffect(() => {
    if (clienteSeleccionado) {
      fetchMetrics()
      checkRetrasos()
    }
  }, [clienteSeleccionado])

  const fetchClientes = async () => {
    const { data, error } = await supabase.from('clientes').select('*').eq('activo', true)
    if (data) setClientes(data)
  }

  const fetchMetrics = async () => {
    const today = new Date().toISOString().split('T')[0]

    // Pedidos hoy
    const { count: hoyCount } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('fecha_pedido', today)

    // En tránsito
    const { count: transitoCount } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('status', 'en_transito')

    // Entregados
    const { count: entregadosCount } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('status', 'entregado')

    // Problemas
    const { count: retrasoCount } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteSeleccionado.id)
      .in('status', ['con_retraso', 'problema'])

    setMetrics({
      hoy: hoyCount || 0,
      transito: transitoCount || 0,
      entregados: entregadosCount || 0,
      retraso: retrasoCount || 0
    })
  }

  const checkRetrasos = async () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    
    const { count } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('status', 'pendiente')
      .lt('created_at', ayer.toISOString())

    setRetrasos(count || 0)
  }

  const MetricCard = ({ title, value, icon, color }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={color}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {retrasos > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Alerta de Retrasos</h3>
            <p className="mt-1 text-sm text-red-700">
              ⚠️ Tienes {retrasos} pedidos sin guía asignada desde hace más de 24 horas.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        
        <div className="w-full sm:w-72">
          <Select 
            value={clienteSeleccionado?.id || ''} 
            onValueChange={(val) => setClienteSeleccionado(clientes.find(c => c.id === val))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar Cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(cliente => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!clienteSeleccionado ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-gray-100 p-3 mb-4">
            <Search className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium">Selecciona un cliente</h3>
          <p className="text-sm text-gray-500 max-w-sm mt-1">
            Selecciona un cliente del menú superior para ver sus pedidos y métricas.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
              title="Total Pedidos Hoy" 
              value={metrics.hoy} 
              icon={<Package className="h-4 w-4" />} 
              color="text-gray-500"
            />
            <MetricCard 
              title="En Tránsito" 
              value={metrics.transito} 
              icon={<Truck className="h-4 w-4" />} 
              color="text-blue-500"
            />
            <MetricCard 
              title="Entregados" 
              value={metrics.entregados} 
              icon={<CheckCircle className="h-4 w-4" />} 
              color="text-[#009B5B]"
            />
            <MetricCard 
              title="Con Retraso / Problema" 
              value={metrics.retraso} 
              icon={<AlertCircle className="h-4 w-4" />} 
              color="text-red-500"
            />
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
             <Card className="col-span-1 p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
                   onClick={() => window.location.href = '/admin/pedidos'}>
               <Package className="h-8 w-8 mb-2 text-[#FF6600]" />
               <h3 className="font-semibold text-lg">Cargar Pedidos</h3>
             </Card>
             <Card className="col-span-1 p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
                   onClick={() => window.location.href = '/admin/entregados'}>
               <CheckCircle className="h-8 w-8 mb-2 text-[#009B5B]" />
               <h3 className="font-semibold text-lg">Ver Entregados</h3>
             </Card>
             <Card className="col-span-1 p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors"
                   onClick={() => window.location.href = '/admin/retrasos'}>
               <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
               <h3 className="font-semibold text-lg">Pedidos con Retraso</h3>
             </Card>
          </div>
        </>
      )}
    </div>
  )
}
