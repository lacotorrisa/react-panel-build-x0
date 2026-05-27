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
  const [dbError, setDbError] = useState(null)

  const fetchPedidos = async () => {
    if (!perfil?.cliente_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setDbError(null)
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
      
      if (pedRes.error) throw pedRes.error
      if (paqRes.error) throw paqRes.error

      if (pedRes.data) setPedidos(pedRes.data)
      if (paqRes.data) setPaqueterias(paqRes.data)
    } catch (e) {
      console.error('Error fetching client orders:', e)
      setDbError(e.message || 'Error al conectar con la base de datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (perfil) {
      fetchPedidos()
    } else {
      setLoading(false)
    }
  }, [perfil])

  // Mensaje de diagnóstico si no hay cliente_id o hay cargando
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!perfil?.cliente_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-xl border max-w-2xl mx-auto shadow-lg space-y-4 my-8">
        <AlertCircle className="h-16 w-16 text-orange-500 animate-pulse" />
        <h3 className="text-xl font-black text-gray-800">⚠️ Cuenta de Cliente Sin Vincular</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Tu usuario de correo <strong className="text-gray-800">{perfil?.email}</strong> tiene el rol de cliente, pero no está vinculado a ninguna marca en la base de datos de producción de Supabase.
        </p>
        <div className="bg-orange-50 p-5 rounded-xl text-left text-xs text-orange-900 border border-orange-200 space-y-3 w-full">
          <p className="font-bold text-sm">🛠️ Para solucionarlo en 10 segundos:</p>
          <p>Copia y ejecuta la siguiente consulta SQL en tu <strong>Supabase Dashboard → SQL Editor → New Query</strong>:</p>
          <pre className="bg-[#1a1a2e] text-orange-200 p-4 rounded-lg font-mono overflow-x-auto text-[11px] leading-relaxed border border-orange-300/30">
{`UPDATE profiles 
SET rol = 'cliente', 
    cliente_id = (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1),
    nombre = 'La Cotorrisa Admin'
WHERE email = 'lacotorrisa@colivery.mx';`}
          </pre>
          <p className="text-[10px] text-orange-700 font-medium">💡 Nota: Si aún no existe el cliente 'La Cotorrisa' en la tabla clientes, primero ejecuta el archivo <code>ACTUALIZACION_PRODUCCION_COMPLETA.sql</code> que creamos en el proyecto.</p>
        </div>
      </div>
    )
  }

  if (dbError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-8 bg-white rounded-xl border max-w-3xl mx-auto shadow-lg space-y-4 my-8">
        <AlertCircle className="h-16 w-16 text-red-500 animate-bounce" />
        <h3 className="text-xl font-black text-red-600">⚠️ Error de Base de Datos Detectado</h3>
        <p className="text-sm text-gray-500 max-w-lg">
          No pudimos consultar tus pedidos debido a que algunas tablas o permisos RLS faltan en la base de datos de producción de Supabase.
        </p>
        <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-xs text-red-700 font-mono text-left w-full">
          <strong>Detalle Técnico:</strong> {dbError}
        </div>
        <div className="bg-orange-50 p-5 rounded-xl text-left text-xs text-orange-900 border border-orange-200 space-y-3 w-full">
          <p className="font-bold text-sm">🚀 Solución en 1 Paso:</p>
          <p>
            Hemos preparado un script maestro unificado que crea todas las tablas de balance, corrige los roles de los usuarios y abre todos los permisos RLS.
          </p>
          <p className="font-semibold text-gray-700">Abre tu Supabase SQL Editor y ejecuta el contenido completo del archivo:</p>
          <div className="bg-[#1a1a2e] text-white p-3.5 rounded-lg font-mono text-[11px] font-bold border border-gray-800">
            📁 supabase / ACTUALIZACION_PRODUCCION_COMPLETA.sql
          </div>
          <p className="text-[10px] text-orange-700">
            Una vez ejecutado ese script, vuelve a cargar esta página. Todo se sincronizará automáticamente.
          </p>
        </div>
      </div>
    )
  }

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
