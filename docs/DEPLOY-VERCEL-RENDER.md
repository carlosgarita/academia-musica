# Guía paso a paso: Desplegar en Vercel y Render

Esta guía te lleva a publicar la aplicación **musica-saas** (Next.js + Supabase) en **Vercel** y en **Render** para que tu cliente pueda probarla.

---

## Antes de desplegar

### 1. Código en Git

- Asegúrate de que todos los cambios están guardados y el proyecto está en un repositorio Git (GitHub, GitLab o Bitbucket).
- Si aún no lo has subido:
  ```bash
  git add .
  git commit -m "Preparar despliegue"
  git push origin main
  ```

### 2. Supabase en la nube

- La app usa **Supabase** (auth + base de datos). Para producción debes usar un proyecto de Supabase en la nube (no solo local).
- En [Supabase Dashboard](https://supabase.com/dashboard): crea un proyecto o usa uno existente.
- Anota:
  - **URL del proyecto** (ej: `https://xxxxx.supabase.co`)
  - **Clave anónima (anon key)** — en Project Settings → API
  - **Clave service_role** — en Project Settings → API (solo para el servidor, no la expongas en el front)

### 3. Variables de entorno que necesitas

| Variable | Dónde se usa | Dónde configurarla |
|----------|--------------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor | Vercel y Render |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente y servidor | Vercel y Render |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (APIs, server components) | Vercel y Render (como secreto) |

---

## Parte A: Desplegar en Vercel

Vercel es la opción más directa para Next.js (mismo equipo que creó el framework).

### Paso 1: Conectar el repositorio

1. Entra en [vercel.com](https://vercel.com) e inicia sesión.
2. Clic en **Add New…** → **Project**.
3. Importa el repositorio de **musica-saas** (conectar GitHub/GitLab/Bitbucket si no está conectado).
4. Selecciona el repo y clic en **Import**.

### Paso 2: Configurar el proyecto

1. **Framework Preset**: debe detectarse como **Next.js**. No cambies esto.
2. **Root Directory**: deja en blanco si el código está en la raíz del repo.
3. **Build Command**: `npm run build` (por defecto).
4. **Output Directory**: lo deja Vercel (`.next`).
5. **Install Command**: `npm install` (por defecto).

### Paso 3: Añadir variables de entorno

1. En la misma pantalla, abre la sección **Environment Variables**.
2. Añade una por una:

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu anon key de Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | tu service_role key de Supabase |

3. Marca **Production**, **Preview** y **Development** si quieres que apliquen en todos los entornos.
4. Clic en **Deploy**.

### Paso 4: Esperar el build

- Vercel ejecuta `npm install` y `npm run build`.
- Si hay errores, revisa el **Build Log** en la pestaña Deployments.
- Cuando termine, tendrás una URL como: `https://musica-saas-xxx.vercel.app`.

### Paso 5: Configurar Supabase (URL de redirección)

Para que el login funcione en la URL de Vercel:

1. En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **Authentication** → **URL Configuration**.
2. En **Redirect URLs**, añade:
   - `https://tu-dominio.vercel.app/**`
   - Si usas dominio propio más adelante, añádelo también.
3. En **Site URL** puedes poner temporalmente la URL de Vercel (ej: `https://musica-saas-xxx.vercel.app`).

Guarda los cambios. Prueba iniciar sesión en la app desplegada en Vercel.

---

## Parte B: Desplegar en Render

En Render puedes hospedar la misma app Next.js como **Web Service**. El free tier puede poner la app en “sleep” tras inactividad; al entrar de nuevo tarda unos segundos en despertar.

### Paso 1: Crear el servicio

1. Entra en [render.com](https://render.com) e inicia sesión.
2. **Dashboard** → **New +** → **Web Service**.
3. Conecta tu cuenta de GitHub/GitLab/Bitbucket si no está conectada.
4. Selecciona el repositorio **musica-saas**.

### Paso 2: Configuración del Web Service

Rellena algo como:

| Campo | Valor |
|-------|--------|
| **Name** | `musica-saas` (o el nombre que quieras) |
| **Region** | El más cercano a tu cliente (ej: Oregon, Frankfurt) |
| **Branch** | `main` (o la rama que uses) |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

### Paso 3: Plan y recursos

- Para pruebas: **Free** (suficiente; la app puede dormir tras ~15 min sin tráfico).
- Si quieres que no duerma: **Starter** (de pago).

### Paso 4: Variables de entorno en Render

1. En la misma pantalla, sección **Environment Variables** → **Add Environment Variable**.
2. Añade:

   | Key | Value |
   |-----|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | tu service_role key |

3. Marca **Sensitive** para `SUPABASE_SERVICE_ROLE_KEY`.

### Paso 5: Crear el Web Service

- Clic en **Create Web Service**.
- Render hará el primer deploy (build + start). Puede tardar varios minutos.
- Al terminar, la URL será algo como: `https://musica-saas-xxxx.onrender.com`.

### Paso 6: Redirect URLs en Supabase (para Render)

1. En Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**.
2. Añade:
   - `https://musica-saas-xxxx.onrender.com/**`
   - (y cualquier dominio propio si lo usas).
3. Si quieres que el “Site URL” sea la de Render para pruebas, cámbiala temporalmente; si ya usas Vercel como principal, puedes dejar la de Vercel y solo asegurar que las Redirect URLs incluyan tanto Vercel como Render.

Prueba login en la URL de Render.

---

## Resumen rápido

| Paso | Vercel | Render |
|------|--------|--------|
| 1 | Import repo → Project | New → Web Service → conectar repo |
| 2 | Framework Next.js, root correcto | Build: `npm install && npm run build` |
| 3 | Env: 3 variables Supabase | Start: `npm start` |
| 4 | Deploy | Env: mismas 3 variables |
| 5 | Añadir URL en Supabase Redirect | Crear servicio → añadir URL en Supabase Redirect |

---

## Problemas frecuentes

- **Build falla**: Revisa el log (Vercel: Deployments → log; Render: Logs). Suele ser falta de una variable de entorno o error de TypeScript/ESLint.
- **Login no redirige bien**: Añade exactamente la URL de producción (con `/**`) en Supabase → Authentication → Redirect URLs.
- **Error 500 o “Internal Server Error”**: Comprueba que `SUPABASE_SERVICE_ROLE_KEY` está definida en el entorno de producción (Vercel/Render) y que no tiene espacios de más al copiar/pegar.
- **Render “Application failed to respond”**: En free tier, la primera petición tras un tiempo inactivo puede tardar 30–60 s mientras el servicio despierta.

---

## Enviar al cliente

Cuando ambos despliegues estén verdes:

1. **Vercel**: comparte la URL del proyecto (ej: `https://musica-saas-xxx.vercel.app`).
2. **Render**: comparte la URL del Web Service (ej: `https://musica-saas-xxxx.onrender.com`).

Ambas usan el mismo Supabase, así que los datos y usuarios son los mismos. El cliente puede probar con cualquiera de las dos URLs; solo recuerda que en Render (free) la primera carga tras inactividad puede ser lenta.

Si quieres, en un siguiente paso podemos añadir un dominio propio (ej: `app.tuacademia.com`) en Vercel o Render y configurarlo también en Supabase.
