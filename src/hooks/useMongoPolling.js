import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

const POLLING_INTERVAL_MS = 20_000   // 20 segundos (más frecuente)
const LS_KEY = 'colivery_mongo_last_check'

const CLIENTE_COTORRISA_ID = '1882e9a0-4dc0-4a03-96e4-ffa5712cda09'

/**
 * Hook de sincronización en tiempo real para La Cotorrisa:
 *
 * 1. POLLING MONGO → cada 20s llama al endpoint que importa pedidos nuevos.
 * 2. SUPABASE REALTIME → escucha INSERT en pedidos (nuevos pedidos en cualquier cliente)
 *    y UPDATE en pedidos (cambios de guía, status, etc.) y notifica en tiempo real.
 *
 * @param {object} options
 * @param {function} options.onNuevosPedidos  - callback cuando llegan pedidos nuevos de Mongo
 * @param {function} options.onActualizado    - callback cuando se actualiza un pedido (guía, status)
 * @param {boolean}  options.activo           - si false, el polling Mongo se pausa
 * @param {string}   options.clienteId        - UUID del cliente activo (para filtrar Realtime)
 */
export function useMongoPolling({
  onNuevosPedidos,
  onActualizado,
  activo = true,
  clienteId = null,
} = {}) {
  const timerRef      = useRef(null)
  const isRunningRef  = useRef(false)
  const channelRef    = useRef(null)

  // ── 1. POLLING / SINCRONIZACIÓN ────────────────────────────
  const poll = useCallback(async () => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    try {
      const lastCheck = localStorage.getItem(LS_KEY)
      const params    = lastCheck ? `?desde=${encodeURIComponent(lastCheck)}` : ''

      const res = await fetch(`/api/mongo-pedidos${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      // Verificar que la respuesta sea JSON (la ruta /api/ solo existe en Vercel)
      const contentType = res.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (res.ok && isJson) {
        // ── Producción (Vercel) ──────────────────────────────
        const data = await res.json()
        localStorage.setItem(LS_KEY, new Date().toISOString())

        if (data.importados > 0 && data.pedidos?.length > 0) {
          if (data.importados === 1) {
            const p        = data.pedidos[0]
            const nombre   = p.nombre_comprador || 'Cliente'
            const producto = p.productos?.[0]?.nombre || 'Producto'
            const precio   = p.productos?.[0]?.precio
            const precioStr = precio ? ` — $${precio.toLocaleString('es-MX')} MXN` : ''
            toast.success(`🛍️ ¡Nueva venta La Cotorrisa!`, {
              description: `${nombre} · ${producto}${precioStr}`,
              duration: 10000,
            })
          } else {
            toast.success(`🛍️ ${data.importados} nuevas ventas de La Cotorrisa`, {
              description: 'Se reflejaron automáticamente en la tabla',
              duration: 8000,
            })
          }

          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            const p = data.pedidos[0]
            new Notification('🛍️ Nueva venta La Cotorrisa', {
              body: `${p.nombre_comprador} — ${p.productos?.[0]?.nombre || 'Producto'}`,
              icon: '/favicon.ico',
            })
          }
        }
      }

      // Siempre refrescar la tabla desde Supabase (en local y producción)
      if (onNuevosPedidos) onNuevosPedidos()

    } catch (err) {
      // Error de red — aún así refrescar datos locales
      if (onNuevosPedidos) onNuevosPedidos()
      console.warn('[useMongoPolling] API no disponible, refrescando desde Supabase:', err.message)
    } finally {
      isRunningRef.current = false
    }
  }, [onNuevosPedidos])

  // Solicitar permiso de notificaciones del sistema al montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Ciclo de polling
  useEffect(() => {
    if (!activo) return
    poll()
    timerRef.current = setInterval(poll, POLLING_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activo, poll])

  // ── 2. SUPABASE REALTIME ───────────────────────────────────
  // Escucha cualquier INSERT o UPDATE en la tabla pedidos.
  // Esto captura cambios hechos por otros usuarios (o por el propio sistema)
  // como: asignar guía, cambiar status, etc.
  useEffect(() => {
    // Limpiar canal anterior si cambia el clienteId
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel('pedidos-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
          filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
        },
        (payload) => {
          const p       = payload.new
          const nombre  = p.nombre_comprador || 'Cliente'
          const prod    = p.productos?.[0]?.nombre || 'Producto'
          const precio  = p.productos?.[0]?.precio
          const precioStr = precio ? ` — $${precio.toLocaleString('es-MX')}` : ''

          // Solo notificar si NO viene del polling de Mongo (para evitar doble toast)
          const esMongo = p.observaciones?.includes('[mongo:')
          if (!esMongo) {
            toast.info(`📦 Nuevo pedido registrado`, {
              description: `${nombre} · ${prod}${precioStr}`,
              duration: 6000,
            })
          }
          if (onNuevosPedidos) onNuevosPedidos([p])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
        },
        (payload) => {
          const prev = payload.old
          const next = payload.new

          // Detectar qué cambió
          if (next.guia && next.guia !== prev.guia) {
            toast.info(`🚚 Guía asignada`, {
              description: `${next.nombre_comprador} → ${next.guia}`,
              duration: 5000,
            })
          } else if (next.status !== prev.status) {
            const emojis = {
              en_transito: '🚚', entregado: '✅', pendiente: '⏳',
              en_espera_guia: '📋', problema: '❌', con_retraso: '⚠️',
            }
            const emoji = emojis[next.status] || '🔄'
            toast.info(`${emoji} Status actualizado`, {
              description: `${next.nombre_comprador}: ${next.status?.replace(/_/g, ' ')}`,
              duration: 5000,
            })
          }

          if (onActualizado) onActualizado(next)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [clienteId, onNuevosPedidos, onActualizado])

  const checkAhora = useCallback(() => { poll() }, [poll])

  return { checkAhora }
}
