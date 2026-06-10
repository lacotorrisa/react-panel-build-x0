import React, { useState, useEffect, useCallback } from 'react'
import { Upload, Plus, Zap, Truck, RefreshCw } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { TablaPedidos } from '../../components/tables/TablaPedidos'
import { ModalImportarCSV } from '../../components/modals/ModalImportarCSV'
import { ModalDetallePedido } from '../../components/modals/ModalDetallePedido'
import * as Dialog from '@radix-ui/react-dialog'
import { useMongoPolling } from '../../hooks/useMongoPolling'

const STATUS_OPTIONS = [
  { value: 'pendiente', label: '⏳ Pendiente' },
  { value: 'en_espera_guia', label: '📋 En espera de guía' },
  { value: 'en_espera_prenda', label: '📦 Falta prenda' },
  { value: 'en_transito', label: '🚚 En tránsito' },
  { value: 'entregado', label: '✅ Entregado' },
  { value: 'con_retraso', label: '⚠️ Con retraso' },
  { value: 'problema', label: '❌ Problema/Retorno' },
]

const BLANK = {
  nombre_comprador: '', correo_comprador: '', telefono: '', direccion: '',
  tipo_compra: 'GENERAL', fecha_pedido: new Date().toISOString().split('T')[0],
  status: 'pendiente', guia: '', link_seguimiento: '',
  producto: '', talla: '', cantidad: 1,
}

const generateMonthsOptions = () => {
  const options = [{ value: 'todos', label: '📅 Todos los meses' }]
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed (0 = Ene, 11 = Dic)

  let year = currentYear
  let month = currentMonth

  while (true) {
    // Detenerse si retrocedemos antes de Diciembre 2025 (año 2025, mes 11)
    if (year < 2025 || (year === 2025 && month < 11)) {
      break
    }
    const value = `${year}-${String(month + 1).padStart(2, '0')}`
    const d = new Date(year, month, 1)
    const label = d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })

    month--
    if (month < 0) {
      month = 11
      year--
    }
  }
  return options
}

export const CargarPedidos = () => {
  const { clienteSeleccionado, setClienteSeleccionado } = useAppStore()
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [paqueterias, setPaqueterias] = useState([])
  const [modalCsvOpen, setModalCsvOpen] = useState(false)
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [trackingLoading, setTrackingLoading] = useState(false)

  // Estados de paginación, búsqueda y mes
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const pageSize = 50

  // ── MONGO TIEMPO REAL ──────────────────────────────────────
  const handleNuevosPedidosMongo = useCallback(() => {
    fetchPedidos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado, currentPage, selectedMonth, debouncedSearch])

  // También refrescar cuando hay una actualización (guía, status) en cualquier pedido
  const handleActualizado = useCallback(() => {
    fetchPedidos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado, currentPage, selectedMonth, debouncedSearch])

  const esLaCotorrisa = clienteSeleccionado?.nombre?.toLowerCase().includes('cotorrisa')
  const { checkAhora } = useMongoPolling({
    onNuevosPedidos: handleNuevosPedidosMongo,
    onActualizado:   handleActualizado,
    activo:          esLaCotorrisa,
    clienteId:       clienteSeleccionado?.id || null,
  })

  // ── VERIFICAR ENTREGAS (Tracking Bot) ─────────────────────────
  const runTrackingCheck = async () => {
    if (!clienteSeleccionado) return
    setTrackingLoading(true)
    toast.info('🔍 Verificando entregas en tránsito...')
    try {
      // Traer todos los pedidos en_transito con guía
      const { data: enTransito } = await supabase
        .from('pedidos')
        .select('id, guia, paqueteria_id, nombre_comprador')
        .eq('cliente_id', clienteSeleccionado.id)
        .eq('status', 'en_transito')
        .not('guia', 'is', null)

      const { data: paqueteriasList } = await supabase.from('paqueterias').select('id, nombre')
      const paqMap = new Map((paqueteriasList || []).map(p => [p.id, p.nombre.toLowerCase()]))

      let entregados  = 0
      let problemas   = 0
      let retrasos    = 0
      let revisados   = 0
      let actualizados = false

      for (const pedido of (enTransito || [])) {
        const carrier = paqMap.get(pedido.paqueteria_id) || ''
        const guia    = pedido.guia?.trim()
        if (!guia || !carrier) continue
        revisados++

        try {
          const res = await fetch(
            `/api/check-tracking?carrier=${encodeURIComponent(carrier)}&guia=${encodeURIComponent(guia)}`
          )
          if (res.ok) {
            const json = await res.json()
            const nuevoStatus = json.status // 'entregado' | 'problema' | 'con_retraso' | 'en_transito'

            if (nuevoStatus === 'entregado') {
              await supabase.from('pedidos').update({ status: 'entregado' }).eq('id', pedido.id)
              toast.success(`✅ ENTREGADO: ${pedido.nombre_comprador} — Guía ${guia}`)
              entregados++
              actualizados = true

            } else if (nuevoStatus === 'problema') {
              await supabase.from('pedidos').update({ status: 'problema' }).eq('id', pedido.id)
              toast.warning(`❌ INCIDENCIA: ${pedido.nombre_comprador} — Guía ${guia} (${carrier.toUpperCase()})`)
              problemas++
              actualizados = true

            } else if (nuevoStatus === 'con_retraso') {
              await supabase.from('pedidos').update({ status: 'con_retraso' }).eq('id', pedido.id)
              toast.warning(`⚠️ RETRASO: ${pedido.nombre_comprador} — Guía ${guia}`)
              retrasos++
              actualizados = true
            }
            // si sigue en_transito → no actualizar, está correcto
          }
        } catch (_) {
          // silenciar errores individuales de red
        }
        // pausa entre requests para no saturar los servidores
        await new Promise(r => setTimeout(r, 900))
      }

      // Resumen final
      const partes = []
      if (entregados)  partes.push(`✅ ${entregados} entregados`)
      if (problemas)   partes.push(`❌ ${problemas} con incidencia`)
      if (retrasos)    partes.push(`⚠️ ${retrasos} con retraso`)
      const sinCambios = revisados - entregados - problemas - retrasos
      if (sinCambios > 0) partes.push(`📦 ${sinCambios} aún en tránsito`)

      toast.success(`🎉 Barrido completado — ${partes.join(' · ')} (${revisados} revisados)`)
      if (actualizados) fetchPedidos()

    } catch (e) {
      toast.error('Error en verificación: ' + e.message)
    } finally {
      setTrackingLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(0)
  }, [clienteSeleccionado, selectedMonth])

  const fetchPedidos = async () => {
    if (!clienteSeleccionado) return
    
    const from = currentPage * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('pedidos')
      .select('*', { count: 'exact' })
      .eq('cliente_id', clienteSeleccionado.id)

    // Filtro por mes
    if (selectedMonth !== 'todos') {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('fecha_pedido', startDate).lte('fecha_pedido', endDate)
    }

    // Filtro por búsqueda (incluye número de pedido en observaciones)
    if (debouncedSearch.trim()) {
      const s = `%${debouncedSearch.trim()}%`
      query = query.or(
        `nombre_comprador.ilike.${s},guia.ilike.${s},status.ilike.${s},correo_comprador.ilike.${s},observaciones.ilike.${s}`
      )
    }

    query = query
      .order('fecha_pedido', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data, count, error } = await query
    
    if (error) {
      toast.error('Error cargando pedidos: ' + error.message)
    } else {
      // Ordenar por FechaISO (fecha+hora real de MongoDB) si está disponible
      const sorted = (data || []).slice().sort((a, b) => {
        const getISO = (p) => {
          const m = (p.observaciones || '').match(/\[FechaISO:\s*([^\]]+)\]/)
          if (m) return new Date(m[1].trim())
          // Fallback: fecha_pedido + hora del tag [Hora: HH:MM]
          const h = (p.observaciones || '').match(/\[Hora:\s*(\d{2}:\d{2})\]/)
          const fecha = p.fecha_pedido || '2000-01-01'
          const hora  = h ? h[1] : '00:00'
          return new Date(`${fecha}T${hora}:00`)
        }
        return getISO(b) - getISO(a) // DESC: más reciente primero
      })
      setPedidos(sorted)
      setTotalCount(count || 0)
    }
  }

  const fetchPaqueterias = async () => {
    const { data } = await supabase.from('paqueterias').select('*').eq('activo', true)
    if (data) setPaqueterias(data)
  }

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').eq('activo', true)
    if (data) setClientes(data)
  }

  useEffect(() => { fetchClientes(); fetchPaqueterias() }, [])
  useEffect(() => {
    if (clienteSeleccionado) fetchPedidos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado, currentPage, selectedMonth, debouncedSearch])

  const handleGuardarNuevo = async () => {
    if (!form.nombre_comprador.trim()) return toast.error('El nombre del comprador es requerido')
    if (!form.producto.trim()) return toast.error('El producto es requerido')
    if (!form.direccion.trim()) return toast.error('La dirección es requerida')
    setSaving(true)
    try {
      const { error } = await supabase.from('pedidos').insert({
        cliente_id: clienteSeleccionado.id,
        nombre_comprador: form.nombre_comprador.trim(),
        correo_comprador: form.correo_comprador.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim(),
        tipo_compra: form.tipo_compra,
        fecha_pedido: form.fecha_pedido,
        status: form.status,
        guia: form.guia.trim() || null,
        link_seguimiento: form.link_seguimiento.trim() || null,
        productos: [{ nombre: form.producto.trim(), talla: form.talla || null, cantidad: parseInt(form.cantidad) || 1 }],
      })
      if (error) throw error
      toast.success('✅ Venta registrada correctamente')
      setModalNuevoOpen(false)
      setForm(BLANK)
      fetchPedidos()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

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

  const SelectorMes = () => {
    const options = generateMonthsOptions()
    return (
      <div className="w-full sm:w-56">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por Mes" />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (!clienteSeleccionado) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center">
        <h2 className="text-xl font-semibold text-gray-700">Selecciona un cliente para ver y cargar sus pedidos</h2>
        <SelectorCliente />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── BANNER TIEMPO REAL MONGO ──────────────────────── */}
      {esLaCotorrisa && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.06))',
          border: '1px solid rgba(34,197,94,0.25)',
          fontSize: 13,
          color: '#15803d',
          fontWeight: 500,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
            animation: 'mongo-pulse 2s ease infinite',
          }} />
          <style>{`
            @keyframes mongo-pulse {
              0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
              50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.05); }
            }
          `}</style>
          <Zap size={14} style={{ color: '#16a34a' }} />
          <span>Sincronización en tiempo real activa — los pedidos de La Cotorrisa desde MongoDB se importan automáticamente</span>
          <button
            onClick={checkAhora}
            style={{
              marginLeft: 'auto',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 12,
              color: '#15803d',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ↻ Sincronizar ahora
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          <h2 className="text-2xl font-bold tracking-tight">Cargar Pedidos</h2>
          <SelectorCliente />
          <SelectorMes />
        </div>
        <div className="flex flex-wrap gap-2 self-end md:self-auto">
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => { setForm(BLANK); setModalNuevoOpen(true) }}
          >
            <Plus className="mr-2 h-4 w-4" /> Registrar Nueva Venta
          </Button>
          <Button variant="outline" onClick={() => setModalCsvOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
          {esLaCotorrisa && (
            <Button
              variant="outline"
              onClick={runTrackingCheck}
              disabled={trackingLoading}
              className="border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              {trackingLoading
                ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                : <Truck className="mr-2 h-4 w-4" />}
              {trackingLoading ? 'Verificando...' : 'Verificar Entregas'}
            </Button>
          )}
        </div>
      </div>

      <TablaPedidos
        pedidos={pedidos}
        paqueterias={paqueterias}
        onRefresh={fetchPedidos}
        onViewDetails={setSelectedPedido}
        serverSidePagination={true}
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
      />

      <ModalImportarCSV
        open={modalCsvOpen}
        onOpenChange={setModalCsvOpen}
        cliente={clienteSeleccionado}
        onSuccess={() => { setModalCsvOpen(false); fetchPedidos() }}
      />

      {selectedPedido && (
        <ModalDetallePedido
          open={!!selectedPedido}
          onOpenChange={(open) => !open && setSelectedPedido(null)}
          pedido={selectedPedido}
        />
      )}

      {/* Modal Nueva Venta */}
      <Dialog.Root open={modalNuevoOpen} onOpenChange={setModalNuevoOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-500" /> Registrar Nueva Venta
            </Dialog.Title>

            <div className="space-y-4">
              {/* Datos del comprador */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">👤 Datos del Comprador</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Nombre Completo *</Label>
                    <Input placeholder="Ej: Juan Pérez García" value={form.nombre_comprador} onChange={e => f('nombre_comprador', e.target.value)} />
                  </div>
                  <div>
                    <Label>Correo Electrónico</Label>
                    <Input type="email" placeholder="correo@ejemplo.com" value={form.correo_comprador} onChange={e => f('correo_comprador', e.target.value)} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input placeholder="+52 33 1234 5678" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Dirección de Entrega *</Label>
                    <Input placeholder="Calle, número, colonia, ciudad, CP" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Producto */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <p className="text-sm font-semibold text-orange-800 mb-3">📦 Producto</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Nombre del Producto *</Label>
                    <Input placeholder="Ej: Playera Acid Wash" value={form.producto} onChange={e => f('producto', e.target.value)} />
                  </div>
                  <div>
                    <Label>Talla</Label>
                    <Input placeholder="Ej: M, L, XL" value={form.talla} onChange={e => f('talla', e.target.value)} />
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" min="1" value={form.cantidad} onChange={e => f('cantidad', e.target.value)} />
                  </div>
                  <div>
                    <Label>Tipo de Compra</Label>
                    <Select value={form.tipo_compra} onValueChange={v => f('tipo_compra', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">GENERAL</SelectItem>
                        <SelectItem value="EXCLUSIVOS">EXCLUSIVOS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fecha del Pedido</Label>
                    <Input type="date" value={form.fecha_pedido} onChange={e => f('fecha_pedido', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Envío */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-3">🚚 Datos de Envío (Opcional)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => f('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Número de Guía</Label>
                    <Input placeholder="Ej: 1234567890" value={form.guia} onChange={e => f('guia', e.target.value)} />
                  </div>
                  <div>
                    <Label>Link de Seguimiento</Label>
                    <Input placeholder="https://..." value={form.link_seguimiento} onChange={e => f('link_seguimiento', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <Button variant="outline" onClick={() => setModalNuevoOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleGuardarNuevo} disabled={saving}>
                  {saving ? 'Guardando...' : '✅ Guardar Venta'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
