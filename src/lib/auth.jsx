import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

export const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (sessionUser) => {
    try {
      // 1. Intentar cargar el perfil existente
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single()

      if (data) {
        setPerfil(data)
        setRol(data.rol)
        return
      }

      // 2. Si no existe perfil, lo autogeneramos basado en el email
      const email = sessionUser.email
      let rolAsignado = 'cliente'
      let nombreAsignado = email.split('@')[0]

      if (email === 'admin@colivery.mx') {
        rolAsignado = 'admin'
        nombreAsignado = 'Administrador Maestro'
      } else if (email === 'solin@colivery.mx') {
        rolAsignado = 'paqueteria'
        nombreAsignado = 'Solin Logistics'
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: sessionUser.id, email, nombre: nombreAsignado, rol: rolAsignado })
        .select()
        .single()

      if (newProfile && !insertError) {
        setPerfil(newProfile)
        setRol(newProfile.rol)
      } else {
        // Fallback en memoria si el insert falla por RLS
        setPerfil({ id: sessionUser.id, email, rol: rolAsignado, nombre: nombreAsignado })
        setRol(rolAsignado)
      }
    } catch (err) {
      console.error('Error loading profile:', err)
      // Fallback seguro en memoria
      if (sessionUser.email === 'admin@colivery.mx') setRol('admin')
      else if (sessionUser.email === 'solin@colivery.mx') setRol('paqueteria')
      else setRol('cliente')
    }
  }

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && isMounted) {
          setUser(session.user)
          await loadProfile(session.user)
        }
      } catch (error) {
        console.error("Error inicializando sesión:", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user)
      } else {
        setUser(null)
        setPerfil(null)
        setRol(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }
    
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
