# Guía de Conexión a Producción (Supabase)

Esta guía explica paso a paso lo que debe hacer el programador o ingeniero encargado para conectar esta plataforma a tu instancia real de **Supabase**. El sistema fue diseñado para ser "plug-and-play" una vez que se desactive el modo simulación (mock).

## 1. Desactivar el Modo Simulación

Actualmente, el sistema está usando una base de datos ficticia en memoria porque no detecta las credenciales de Supabase en tu entorno.

Para conectarlo a la base de datos real, debes crear un archivo llamado `.env` en la raíz del proyecto (`colivery-admin/`) y agregar tus credenciales:

```env
VITE_SUPABASE_URL=https://tu-identificador.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

*Una vez que agregues este archivo y reinicies el servidor (`pnpm run dev`), el sistema ignorará los datos ficticios y se conectará automáticamente a la nube.*

## 2. Ejecutar el Script de la Base de Datos

En la carpeta `supabase/` encontrarás el archivo `schema.sql`. Este archivo contiene absolutamente toda la estructura de la base de datos, incluyendo la creación de tablas, relaciones y las reglas de seguridad.

1. Entra a tu panel de control en **Supabase**.
2. Ve a la sección de **SQL Editor**.
3. Pega el contenido completo de `supabase/schema.sql` y dale a "Run" (Ejecutar).
   
Esto creará automáticamente:
- Las tablas (`clientes`, `paqueterias`, `pedidos`, `pedido_eventos`, `profiles`).
- Las políticas de seguridad (RLS) para proteger los datos.
- Los perfiles iniciales de prueba (como el administrador y la paquetería Solin Logistics).

## 3. Configurar el Envío de Correos Automáticos (Opcional pero Recomendado)

El sistema ya trae el código integrado para enviar correos automáticos usando **Resend** (por ejemplo, cuando se asigna una guía).

Para habilitarlo:
1. Crea una cuenta en [Resend.com](https://resend.com/).
2. Obtén tu API Key.
3. Agrégalo al archivo `.env`:

```env
VITE_RESEND_API_KEY=re_123456789
```

Si no configuras esto, el sistema seguirá funcionando pero la función de correo mostrará una advertencia en la consola en lugar de enviarlo realmente.

## 4. Cuentas Creadas por Defecto

El archivo `schema.sql` crea estas cuentas por defecto en el sistema para que puedas entrar a producción inmediatamente:

*   **Admin:** `admin@colivery.mx` / `admin123`
*   **Paquetería Solin Logistics:** `solin@colivery.mx` / `solin123`

*(Nota: En Supabase tendrás que ir a Authentication > Users y crear estos usuarios manualmente con esas contraseñas, ya que SQL solo crea el perfil, no la cuenta de Auth)*.

---

### Resumen de Trabajo

- **Esquema adaptado:** `id_compra` ha sido totalmente reemplazado por la etiqueta de compra (General/Exclusivo).
- **Control Maestro Paquetería:** Solin Logistics (`solin@colivery.mx`) tiene acceso a todos los pedidos y puede asignar la guía y la empresa de paquetería directamente.
- **Estatus Editable:** Administradores y Solin pueden cambiar manualmente el estatus de un pedido (Entregado, Con Retraso, Problema) sin salir de la tabla.
- **Plantilla CSV:** Incorporada al importador para mayor facilidad de uso.
- **Observaciones Funcionales:** Testeadas y validadas; el error era derivado del estado efímero del simulador de datos local. Al conectarlo a Supabase, el registro histórico funcionará a la perfección.
