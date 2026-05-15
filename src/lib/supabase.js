import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseInstance;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'tu_url_de_supabase') {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn("USANDO MOCK DE SUPABASE EN MEMORIA PORQUE NO HAY .ENV")

  let mockDb = {
    clientes: [
      { id: 1, nombre: 'La Cotorrisa', logo_url: null, email_remitente: 'tienda@lacotorrisa.com', nombre_remitente: 'La Cotorrisa Store', activo: true },
      { id: 2, nombre: 'Nike Mx', logo_url: null, email_remitente: 'envios@nike.mx', nombre_remitente: 'Nike Mexico', activo: true }
    ],
    paqueterias: [
      { id: 1, nombre: 'IMILE', activo: true },
      { id: 2, nombre: 'FedEx', activo: true },
      { id: 3, nombre: 'DHL', activo: true },
      { id: 4, nombre: 'Estafeta', activo: true }
    ],
    pedidos: [
      { id: 1, cliente_id: 1, tipo_compra: 'Exclusivo', nombre_comprador: 'Slobotzky', correo_comprador: 'slobo@gmail.com', telefono: '555555555', direccion: 'CDMX, Centro', status: 'pendiente', productos: [{nombre: 'Playera Cotorrisa', cantidad: 1}], fecha_pedido: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 2, cliente_id: 1, tipo_compra: 'General', nombre_comprador: 'Ricardo Perez', correo_comprador: 'ricardo@gmail.com', telefono: '555555555', direccion: 'CDMX, Sur', status: 'en_transito', guia: 'FDX-123456', paqueteria_id: 2, productos: [{nombre: 'Hoodie Cotorrisa', cantidad: 2}], fecha_pedido: new Date().toISOString() },
      { id: 3, cliente_id: 2, tipo_compra: 'General', nombre_comprador: 'Juan Perez', correo_comprador: 'juan@gmail.com', telefono: '123123', direccion: 'MTY', status: 'entregado', guia: 'DHL-9876', paqueteria_id: 3, productos: [{nombre: 'Tenis Air', cantidad: 1}], fecha_pedido: new Date(Date.now() - 86400000 * 5).toISOString() }
    ],
    pedido_eventos: [],
    profiles: [
      { id: 'mock-admin-id', email: 'admin@colivery.mx', nombre: 'Administrador Maestro', rol: 'admin' },
      { id: 'mock-solin-id', email: 'solin@colivery.mx', nombre: 'Solin Logistics', rol: 'paqueteria' }
    ]
  }

  const createQueryBuilder = (table) => {
    let result = [...(mockDb[table] || [])]

    const builder = {
      select: () => builder,
      eq: (col, val) => {
        result = result.filter(r => r[col] === val)
        return builder
      },
      lt: (col, val) => {
        result = result.filter(r => r[col] < val)
        return builder
      },
      order: (col, { ascending } = { ascending: true }) => {
        result.sort((a, b) => ascending ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1))
        return builder
      },
      single: async () => ({ data: result[0] || null, error: null }),
      then: (resolve) => resolve({ data: result, error: null, count: result.length })
    }
    return builder
  }

  // Credenciales mock válidas
  const MOCK_USERS = {
    'admin@colivery.mx': { id: 'mock-admin-id', password: 'admin123' },
    'solin@colivery.mx': { id: 'mock-solin-id', password: 'solin123' },
  }

  // Sistema de callbacks de auth
  let authCallbacks = []
  let currentMockSession = null

  supabaseInstance = {
    auth: {
      getSession: async () => ({ data: { session: currentMockSession }, error: null }),
      getUser: async () => ({ data: { user: currentMockSession ? currentMockSession.user : null }, error: null }),

      // CRÍTICO: notifica inmediatamente con sesión null para que loading=false
      onAuthStateChange: (cb) => {
        authCallbacks.push(cb)
        setTimeout(() => cb('INITIAL_SESSION', currentMockSession), 0)
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authCallbacks = authCallbacks.filter(x => x !== cb)
              }
            }
          }
        }
      },

      signInWithPassword: async ({ email, password }) => {
        const mockUser = MOCK_USERS[email]
        if (!mockUser || mockUser.password !== password) {
          return { data: {}, error: { message: 'Credenciales incorrectas. Usa admin@colivery.mx / admin123' } }
        }
        const session = { user: { id: mockUser.id, email } }
        currentMockSession = session
        // Notificar a todos los listeners
        authCallbacks.forEach(cb => cb('SIGNED_IN', session))
        return { data: { session, user: session.user }, error: null }
      },

      signUp: async () => ({ data: { user: { id: 'new-mock-id' } }, error: null }),

      signOut: async () => {
        currentMockSession = null
        authCallbacks.forEach(cb => cb('SIGNED_OUT', null))
        return { error: null }
      }
    },

    from: (table) => ({
      select: () => createQueryBuilder(table).select(),

      insert: (data) => {
        const toInsert = Array.isArray(data) ? data : [data]
        const inserted = toInsert.map(d => ({
          ...d,
          id: d.id || (Date.now() + Math.random()),
          created_at: new Date().toISOString()
        }))
        if (mockDb[table]) {
          inserted.forEach(d => mockDb[table].push(d))
        }
        // Soporta .insert(data).select().single()
        const insertBuilder = {
          select: () => insertBuilder,
          single: async () => ({ data: inserted[0] || null, error: null }),
          then: (resolve) => resolve({ data: inserted, error: null })
        }
        return insertBuilder
      },

      update: (data) => ({
        eq: async (col, val) => {
          if (mockDb[table]) {
            mockDb[table] = mockDb[table].map(r => r[col] === val ? { ...r, ...data } : r)
          }
          return { data: null, error: null }
        }
      })
    })
  }
}

export const supabase = supabaseInstance
