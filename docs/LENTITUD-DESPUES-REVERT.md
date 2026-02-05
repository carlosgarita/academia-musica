# Lentitud después del revert (Vercel / cambios)

## Causas identificadas

### 1. **Middleware en cada request**
- El middleware se ejecutaba en **todas** las peticiones (páginas y APIs).
- Usaba `cookies()` de `next/headers` (entorno Node) y hacía:
  - `getUser()` → 1 llamada a Supabase
  - `profiles` (role) → 1 llamada más en rutas protegidas
- Cada llamada a una API sumaba 2 round-trips a Supabase solo por el middleware.

**Qué se hizo:**  
- Middleware pasado a cliente Supabase compatible con Edge (request/response cookies, sin `cookies()`).  
- Para rutas `/api/*` el middleware solo refresca la sesión y devuelve; **no** consulta `profiles`. Las APIs siguen validando auth y rol por su cuenta.

### 2. **`next dev --webpack`**
- Se añadió `--webpack` al script `dev` para evitar el crash de Turbopack cuando la ruta del proyecto tiene caracteres como **"í"** (ej. "Academias de Música").
- Webpack en dev es **más lento** que Turbopack (compilación incremental).

**Opciones si la compilación en dev se siente lenta:**  
- **Recomendado:** Mover el proyecto a una carpeta sin acentos, por ejemplo:
  - `~/musica-saas`
  - `~/academias-musica`
  Luego en `package.json` quitar `--webpack` del script `dev`:
  ```json
  "dev": "next dev"
  ```
  Así vuelves a usar Turbopack y el arranque y recargas serán más rápidos.  
- **Alternativa:** Dejar el proyecto donde está y seguir usando `next dev --webpack`; la app funcionará igual, solo será más lenta la compilación en desarrollo.

### 3. **Supabase remoto vs local**
- Si en `.env.local` usas **Supabase en la nube**, cada `getUser()` y cada query a `profiles` o a la BD tiene latencia de red (decenas o cientos de ms).
- En **desarrollo**, usar Supabase local (`supabase start`) reduce esa latencia a casi cero.

**Recomendación:** Para desarrollo diario, usar Supabase local y en `.env.local` apuntar a la URL y anon key locales.

---

## Resumen de cambios aplicados

| Cambio | Efecto |
|--------|--------|
| Middleware con cliente Edge (request cookies) | Menos trabajo por request y uso correcto en Edge. |
| No consultar `profiles` en middleware para `/api/*` | Una llamada menos a Supabase por cada petición a una API. |
| Documentar causa de `--webpack` y opción de mover carpeta | Permite recuperar Turbopack y dev más rápido si lo deseas. |

Si tras estos cambios la app sigue lenta, conviene revisar:
- Que `.env.local` use Supabase local en desarrollo.
- Que no haya páginas que hagan muchas peticiones en cascada (una detrás de otra).
