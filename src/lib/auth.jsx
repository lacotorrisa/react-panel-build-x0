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

  const loadProfile = async (sessionUser) => {
    // Aplicar rol inmediato por email como fallback (no bloquea el render)
    const rolInmediato = getRolByEmail(sessionUser.email)
    setRol(rolInmediato)
    setPerfil({ id: sessionUser.id, email: sessionUser.email, rol: rolInmediato })

    // Intentar cargar el perfil real de la BD en background (sin bloquear)
    try {
      const { data } = await Promise.race([
        supabase.from('profiles').select('*').eq('id', sessionUser.id).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
      if (data) {
        setPerfil(data)
        setRol(data.rol)
      }
    } catch {
      // Si falla o timeout, ya tenemos el rol por email aplicado arriba
      console.warn('profiles no respondió a tiempo, usando rol por email')
    }
  }

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ])

        if (session?.user && isMounted) {
          setUser(session.user)
          await loadProfile(session.user)
        }
      } catch (err) {
        console.warn('Error al inicializar auth:', err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (event === 'SIGNED_IN') {
        // Login activo: mostrar spinner brevemente y cargar perfil
        setLoading(true)
        setUser(session.user)
        await loadProfile(session.user)
        if (isMounted) setLoading(false)

      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Refresh de token: NO bloquear con loading, solo actualizar en background
        if (session?.user && isMounted) {
          setUser(session.user)
          loadProfile(session.user) // sin await, no bloquea
        }

      } else if (event === 'SIGNED_OUT') {
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

