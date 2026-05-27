import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, nombre, rol, logistica_id, cliente_id } = req.body

  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Faltan campos requeridos: email, password, nombre, rol' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel' })
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Crear usuario confirmado directamente (sin email de verificación)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Confirmado automáticamente
    })

    if (userError) throw userError

    const userId = userData.user.id

    // Crear / actualizar el perfil en la tabla profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      nombre,
      rol,
      logistica_id: logistica_id || null,
      cliente_id: cliente_id || null,
    })

    if (profileError) throw profileError

    return res.status(200).json({ success: true, user_id: userId })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
