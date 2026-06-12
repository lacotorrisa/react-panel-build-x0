import { useEffect, useRef, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

const POLLING_INTERVAL_MS = 20_000   // 20 segundos
const LS_KEY  = 'colivery_mongo_last_check'
const LS_TIME = 'colivery_mongo_last_sync_time'

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
  const [syncing,   setSyncing]   = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(() => localStorage.getItem(LS_TIME) || null)

  // ── 1. POLLING / SINCRONIZACIÓN ────────────────────────────
  const poll = useCallback(async (manual = false) => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    setSyncing(true)
    const toastId = manual ? toast.loading('🔄 Sincronizando con MongoDB...') : null

    try {
      const lastCheck = localStorage.getItem(LS_KEY)
      const params    = lastCheck ? `?desde=${encodeURIComponent(lastCheck)}` : ''

      const res = await fetch(`/api/mongo-pedidos${params}`, {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' },
        signal:  AbortSignal.timeout(15000),  // 15s timeout
      })

      const contentType = res.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!res.ok) {
        const errBody = isJson ? (await res.json()) : { error: `HTTP ${res.status}` }
        throw new Error(errBody.error || errBody.message || `Error HTTP ${res.status}`)
      }

      if (isJson) {
        const data = await res.json()
        const ahora = new Date().toISOString()
        localStorage.setItem(LS_KEY, ahora)
        localStorage.setItem(LS_TIME, ahora)
        setLastSyncAt(ahora)

        if (data.importados > 0 && data.pedidos?.length > 0) {
          if (data.importados === 1) {
            const p        = data.pedidos[0]
            const nombre   = p.nombre_comprador || 'Cliente'
            const producto = p.productos?.[0]?.nombre || 'Producto'
            const precio   = p.productos?.[0]?.precio
            const precioStr = precio ? ` — $${precio.toLocaleString('es-MX')} MXN` : ''
            toast.success(`🛍️ ¡Nueva venta!`, {
              id: toastId,
              description: `${nombre} · ${producto}${precioStr}`,
              duration: 10000,
            })
          } else {
            toast.success(`🛍️ ${data.importados} nuevas ventas importadas`, {
              id: toastId,
              description: 'La tabla se actualizó automáticamente',
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
        } else if (manual) {
          toast.success('✅ Al día — sin pedidos nuevos', { id: toastId, duration: 3000 })
        } else if (toastId) {
          toast.dismiss(toastId)
        }
      }

      if (onNuevosPedidos) onNuevosPedidos()

    } catch (err) {
      console.warn('[useMongoPolling] Error:', err.message)
      if (manual) {
        toast.error(`Error al sincronizar: ${err.message}`, { id: toastId, duration: 6000 })
      } else if (toastId) {
        toast.dismiss(toastId)
      }
      if (onNuevosPedidos) onNuevosPedidos()
    } finally {
      isRunningRef.current = false
      setSyncing(false)
    }
  }, [onNuevosPedidos])

  // Solicitar permiso de notificaciones del sistema al montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Ciclo de polling automático cada 20s
  useEffect(() => {
    if (!activo) return
    poll(false)  // primer poll silencioso
    timerRef.current = setInterval(() => poll(false), POLLING_INTERVAL_MS)
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

  // Manual: resetea el timer para que la próxima auto-sync sea en 20s desde ahora
  const checkAhora = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    poll(true)  // poll manual con feedback de toast
    timerRef.current = setInterval(() => poll(false), POLLING_INTERVAL_MS)
  }, [poll])

  return { checkAhora, syncing, lastSyncAt }
}
