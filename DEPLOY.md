# Cómo desplegar Colivery Admin

## Requisitos previos
- Node.js 18+ instalado
- Cuenta en GitHub (ya creada)
- Cuenta en Supabase (supabase.com) — gratis
- Cuenta en Resend (resend.com) — gratis
- Cuenta en Vercel (vercel.com) — gratis

## Paso 1 — Configurar Supabase
1. Ir a supabase.com → New Project
2. Nombre: colivery-admin | Contraseña: (anotar) | Región: US East
3. Ir a SQL Editor → New Query
4. Copiar y pegar TODO el contenido del archivo supabase/schema.sql
5. Click en RUN
6. Ir a Settings → API → copiar:
   - Project URL → es tu VITE_SUPABASE_URL
   - anon public → es tu VITE_SUPABASE_ANON_KEY

## Paso 2 — Configurar Resend
1. Ir a resend.com → Create Account
2. API Keys → Create API Key → copiar
   - Esa es tu VITE_RESEND_API_KEY

## Paso 3 — Crear archivo .env
En la carpeta del proyecto, crear archivo llamado .env (sin extensión) con:
VITE_SUPABASE_URL=pegar_aqui_tu_url
VITE_SUPABASE_ANON_KEY=pegar_aqui_tu_key
VITE_RESEND_API_KEY=pegar_aqui_tu_key
VITE_APP_URL=https://colivery.mx

## Paso 4 — Probar localmente (opcional)
npm install
npm run dev
Abrir http://localhost:5173

## Paso 5 — Subir a GitHub
(Reemplazar TU_USUARIO y TU_REPOSITORIO con los datos reales)
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git branch -M main
git push -u origin main

## Paso 6 — Desplegar en Vercel
1. Ir a vercel.com → Add New Project
2. Import desde GitHub → seleccionar el repositorio
3. En "Environment Variables" agregar las 4 variables del .env
4. Click en Deploy
5. Esperar ~2 minutos → listo

## Paso 7 — Crear usuario administrador
1. Ir a Supabase → Authentication → Users → Add User
2. Email: tu correo | Password: tu contraseña
3. Copiar el UUID del usuario creado
4. Ir a SQL Editor → ejecutar:
   INSERT INTO profiles (id, email, nombre, rol)
   VALUES ('PEGAR_UUID_AQUI', 'tu@email.com', 'Miguel', 'admin');
5. Entrar a la plataforma con esas credenciales
