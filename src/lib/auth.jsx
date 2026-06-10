import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

export const AuthContext = createContext({})

// Determina el rol por email sin necesitar la base de datos
const getRolByEmail = (email) => {
  if (!email) return 'cliente'
  if (email === 'admin@colivery.mx' || email === 'irigoyen@colivery.mx') return 'admin'
  if (email === 'solin@colivery.mx') return 'paqueteria'
  return 'cliente'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(true)

  const authStateRef = React.useRef({ user: null, perfil: null, rol: null })

  // Mantener la referencia del estado de autenticación al día para evitar stale closures
  useEffect(() => {
    authStateRef.current = { user, perfil, rol }
  }, [user, perfil, rol])

  const loadProfile = async (sessionUser) => {
    console.log('[Colivery Auth] loadProfile iniciado para:', sessionUser.email)
    const currentCached = authStateRef.current
    const rolInmediato = getRolByEmail(sessionUser.email)

    // Solo aplicar perfil inmediato de fallback si no coincide con el guardado
    if (!currentCached.perfil || currentCached.perfil.id !== sessionUser.id) {
      setRol(rolInmediato)
      setPerfil({ id: sessionUser.id, email: sessionUser.email, rol: rolInmediato })
    }

    try {
      const { data } = await Promise.race([
        supabase.from('profiles').select('*').eq('id', sessionUser.id).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
      if (data) {
        // Solo actualizar el estado si realmente ha cambiado
        if (authStateRef.current.rol !== data.rol) {
          setRol(data.rol)
        }
        if (JSON.stringify(authStateRef.current.perfil) !== JSON.stringify(data)) {
          setPerfil(data)
        }
      }
    } catch {
      console.warn('profiles no respondió a tiempo, usando rol por email')
    }
  }

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      console.log('[Colivery Auth] Inicializando sesión inicial...')
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ])

        if (session?.user && isMounted) {
          console.log('[Colivery Auth] Sesión inicial encontrada para:', session.user.email)
          setUser(session.user)
          await loadProfile(session.user)
        } else {
          console.log('[Colivery Auth] No hay sesión inicial activa.')
        }
      } catch (err) {
        console.warn('Error al inicializar auth:', err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentCached = authStateRef.current
      const sessionUser = session?.user
      console.log(`[Colivery Auth] Evento onAuthStateChange: ${event}`, {
        hasSession: !!session,
        sessionEmail: sessionUser?.email,
        cachedEmail: currentCached.user?.email,
        hasPerfil: !!currentCached.perfil
      })

      if (!isMounted) return

      if (event === 'SIGNED_IN') {
        // Si ya hay usuario y es el mismo, y ya cargamos el perfil, ignoramos
        if (currentCached.user && sessionUser && currentCached.user.id === sessionUser.id) {
          console.log('[Colivery Auth] SIGNED_IN ignorado (mismo usuario).')
          setUser(sessionUser)
          if (!currentCached.perfil) {
            console.log('[Colivery Auth] Perfil faltante en caché, cargándolo...')
            loadProfile(sessionUser)
          }
          return
        }

        console.log('[Colivery Auth] Procesando SIGNED_IN (nuevo login o cambio)...')
        setLoading(true)
        setUser(sessionUser)
        await loadProfile(sessionUser)
        if (isMounted) setLoading(false)

      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        console.log('[Colivery Auth] Procesando refresco de token o actualización de usuario...')
        if (sessionUser && isMounted) {
          setUser(sessionUser)
          if (!currentCached.perfil) {
            loadProfile(sessionUser)
          }
        }

      } else if (event === 'SIGNED_OUT') {
        console.log('[Colivery Auth] Procesando SIGNED_OUT...')
        setUser(null)
        setPerfil(null)
        setRol(null)
        if (isMounted) setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return data
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, perfil, rol, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

