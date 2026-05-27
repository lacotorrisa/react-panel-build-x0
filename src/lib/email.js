import { supabase } from './supabase'

export async function enviarEmailEnCamino({ pedido, cliente }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #FF6600; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">${cliente.nombre_remitente || cliente.nombre}</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2>¡Hola, ${pedido.nombre_comprador}!</h2>
        <p>Tu pedido está en camino 🚀</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número de guía:</strong> ${pedido.guia || 'Pendiente'}</p>
          <p><strong>Paquetería:</strong> ${pedido.paqueteria_nombre || 'Asignada'}</p>
          <p><strong>Tiempo estimado de entrega:</strong> ${pedido.tiempo_estimado_entrega || 'Pronto'}</p>
        </div>
        ${pedido.link_seguimiento ? `
        <div style="margin: 20px 0; text-align: center;">
          <a href="${pedido.link_seguimiento}" 
             style="background: #FF6600; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-family: sans-serif;">
            Rastrear mi pedido
          </a>
        </div>
        ` : ''}
        <p style="color: #999; margin-top: 30px; font-size: 12px;">
          ${cliente.nombre_remitente || cliente.nombre} | Powered by Colivery
        </p>
      </div>
    </body>
    </html>
  `
  
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${cliente.nombre_remitente || cliente.nombre} <alertas@colivery.mx>`, // Dominio verificado de Resend
        to: pedido.correo_comprador,
        subject: `Tu pedido está en camino — ${cliente.nombre_remitente || cliente.nombre}`,
        html
      })
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al enviar correo')
    console.log('Correo "En Camino" enviado con éxito', data)
    return true
  } catch (err) {
    console.error('Error enviando correo "En Camino":', err.message)
    return false
  }
}

export async function enviarEmailEntregado({ pedido, cliente }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #009B5B; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">${cliente.nombre_remitente || cliente.nombre}</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2>¡Hola, ${pedido.nombre_comprador}!</h2>
        <p>Tu pedido ha sido entregado exitosamente ✅</p>
        <p>Esperamos que disfrutes tu compra. Gracias por confiar en nosotros.</p>
        <p style="color: #999; margin-top: 30px; font-size: 12px;">
          ${cliente.nombre_remitente || cliente.nombre} | Powered by Colivery
        </p>
      </div>
    </body>
    </html>
  `
  
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${cliente.nombre_remitente || cliente.nombre} <alertas@colivery.mx>`,
        to: pedido.correo_comprador,
        subject: `Tu pedido ha sido entregado — ${cliente.nombre_remitente || cliente.nombre}`,
        html
      })
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al enviar correo')
    console.log('Correo "Entregado" enviado con éxito', data)
    return true
  } catch (err) {
    console.error('Error enviando correo "Entregado":', err.message)
    return false
  }
}

// Función orquestadora automática para verificar y disparar notificaciones
export async function verificarYEnviarNotificaciones(pedidoId, nuevoStatus) {
  if (!['en_transito', 'entregado'].includes(nuevoStatus)) return

  try {
    // 1. Obtener pedido completo con datos del cliente y de la paquetería
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*, clientes(*), paqueterias(*)')
      .eq('id', pedidoId)
      .single()
    
    if (error || !pedido) throw error || new Error('Pedido no encontrado')
    if (!pedido.clientes) return // Sin cliente asociado

    const clientData = pedido.clientes
    const isClientEmailValid = pedido.correo_comprador && pedido.correo_comprador.includes('@') && pedido.correo_comprador !== '-'

    if (!isClientEmailValid) {
      console.log('Correo del comprador ausente o inválido para notificaciones:', pedido.correo_comprador)
      return
    }

    const pedidoFmt = {
      ...pedido,
      paqueteria_nombre: pedido.paqueterias?.nombre || 'Asignada'
    }

    // 2. Disparar según el nuevo estado y marcar como enviado para prevenir duplicación
    if (nuevoStatus === 'en_transito' && !pedido.notificado_en_camino) {
      const success = await enviarEmailEnCamino({ pedido: pedidoFmt, cliente: clientData })
      if (success) {
        await supabase.from('pedidos').update({ 
          notificado_en_camino: true, 
          correo_enviado_at: new Date().toISOString() 
        }).eq('id', pedidoId)

        // Crear evento en el historial
        await supabase.from('pedido_eventos').insert({
          pedido_id: pedidoId,
          tipo: 'guia_asignada',
          descripcion: `📧 Correo de notificación enviado: Pedido en tránsito (Guía: ${pedido.guia || 'Pendiente'})`
        })
      }
    } else if (nuevoStatus === 'entregado' && !pedido.notificado_entregado) {
      const success = await enviarEmailEntregado({ pedido: pedidoFmt, cliente: clientData })
      if (success) {
        await supabase.from('pedidos').update({ 
          notificado_entregado: true 
        }).eq('id', pedidoId)

        await supabase.from('pedido_eventos').insert({
          pedido_id: pedidoId,
          tipo: 'entregado',
          descripcion: `📧 Correo de notificación enviado: Pedido entregado`
        })
      }
    }
  } catch (err) {
    console.error('Error al verificar/enviar notificaciones:', err.message)
  }
}
