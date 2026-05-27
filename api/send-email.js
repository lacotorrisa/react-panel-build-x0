export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { from, to, subject, html } = req.body

  if (!from || !to || !subject || !html) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: from, to, subject, html' })
  }

  // Clave privada oculta en el backend
  const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY

  if (!resendApiKey) {
    return res.status(500).json({ error: 'La clave RESEND_API_KEY no está configurada en el servidor' })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Error de la API de Resend')
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('Error enviando correo en backend:', err)
    return res.status(400).json({ error: err.message })
  }
}
