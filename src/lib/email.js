export async function enviarEmailEnCamino({ pedido, cliente }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #FF6600; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">${cliente.nombre_remitente}</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2>¡Hola, ${pedido.nombre_comprador}!</h2>
        <p>Tu pedido está en camino 🚀</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de guía:</strong> ${pedido.guia}</p>
          <p><strong>Paquetería:</strong> ${pedido.paqueteria_nombre || 'Asignada'}</p>
          <p><strong>Tiempo estimado de entrega:</strong> ${pedido.tiempo_estimado_entrega || 'Pronto'}</p>
        </div>
        <a href="${pedido.link_seguimiento}" 
           style="background: #FF6600; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 8px; display: inline-block;">
          Rastrear mi pedido
        </a>
        <p style="color: #999; margin-top: 30px; font-size: 12px;">
          ${cliente.nombre_remitente} | Powered by Colivery
        </p>
      </div>
    </body>
    </html>
  `
  
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${cliente.nombre_remitente} <${cliente.email_remitente}>`,
      to: pedido.correo_comprador,
      subject: `Tu pedido está en camino — ${cliente.nombre_remitente}`,
      html
    })
  })
}

export async function enviarEmailEntregado({ pedido, cliente }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #009B5B; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">${cliente.nombre_remitente}</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2>¡Hola, ${pedido.nombre_comprador}!</h2>
        <p>Tu pedido ha sido entregado exitosamente ✅</p>
        <p>Esperamos que disfrutes tu compra. Gracias por confiar en nosotros.</p>
        <p style="color: #999; margin-top: 30px; font-size: 12px;">
          ${cliente.nombre_remitente} | Powered by Colivery
        </p>
      </div>
    </body>
    </html>
  `
  
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${cliente.nombre_remitente} <${cliente.email_remitente}>`,
      to: pedido.correo_comprador,
      subject: `Tu pedido ha sido entregado — ${cliente.nombre_remitente}`,
      html
    })
  })
}
