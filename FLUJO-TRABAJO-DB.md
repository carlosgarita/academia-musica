# 🔄 Flujo de Trabajo: Cambios en Base de Datos

## 📋 Situación Actual

**Tu setup:** Una sola base de datos de Supabase (sin separación desarrollo/producción)

**Antes trabajabas así:**
1. Yo creaba código
2. Te daba SQL para aplicar manualmente en SQL Editor
3. Aplicabas y probabas
4. Si funcionaba, seguías adelante

**Ahora:** Similar, pero con versionado en Git

## 🆕 Nuevo Flujo con Migraciones

### ⚠️ Tu Situación: Base de Datos Única

Tienes **una sola base de datos** de Supabase que usas para todo (desarrollo y producción).

**Flujo Simplificado:**

---

## ✅ Flujo Recomendado para Base de Datos Única

### Pasos:

1. **Yo creo la migración** en `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`
   - Con SQL seguro (usa `IF NOT EXISTS`, `IF EXISTS`)
   - Con comentarios explicativos

2. **Tú aplicas y pruebas:**
   - Abres el archivo de migración
   - Copias el contenido SQL
   - Lo aplicas en SQL Editor de Supabase
   - Pruebas la aplicación inmediatamente

3. **Si funciona:**
   ```bash
   git add supabase/migrations/
   git commit -m "feat(db): descripción del cambio"
   git push
   ```

4. **Si hay errores:**
   - Corriges la migración
   - Vuelves a aplicar
   - Repites hasta que funcione

**Ventajas:**
- ✅ Simple y directo
- ✅ Pruebas inmediatas
- ✅ Todo queda versionado en Git
- ✅ Puedes revertir si es necesario

---

## 🔄 Otras Opciones (Para el Futuro)

### Opción 1: Desarrollo Local con Supabase CLI ⭐ (Recomendado a largo plazo)

**Requisitos:** Tener Supabase CLI instalado y configurado

### Pasos:

1. **Crear migración:**
   ```bash
   supabase migration new nombre_del_cambio
   # O yo la creo directamente en supabase/migrations/
   ```

2. **Aplicar localmente para probar:**
   ```bash
   # Si tienes Supabase corriendo localmente
   supabase start
   supabase migration up
   
   # O resetear todo y aplicar todas las migraciones
   supabase db reset
   ```

3. **Probar la aplicación** (conectada a tu DB local)

4. **Si funciona:**
   ```bash
   # Commitear y push a Git
   git add supabase/migrations/
   git commit -m "feat(db): descripción del cambio"
   git push
   
   # Aplicar a producción
   supabase db push
   ```

**Ventajas:** 
- ✅ Pruebas sin afectar producción
- ✅ Puedes resetear y empezar de cero fácilmente
- ✅ Todo versionado

---

## Opción 2: Aplicar Manualmente para Probar (Mientras aprendes CLI)

**Para cuando:** No tienes CLI configurado o prefieres probar rápido

### Pasos:

1. **Crear migración:**
   - Yo creo el archivo en `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`
   - Contiene todo el SQL necesario

2. **Copiar y aplicar manualmente:**
   - Abre el archivo de migración
   - Copia todo el contenido SQL
   - Ve a Supabase Dashboard → SQL Editor
   - Pega y ejecuta (en un proyecto de desarrollo/staging, NO producción)

3. **Probar la aplicación**

4. **Si funciona:**
   ```bash
   # Commitear y push a Git
   git add supabase/migrations/
   git commit -m "feat(db): descripción del cambio"
   git push
   
   # Aplicar a producción (puedes usar CLI o manualmente)
   supabase db push
   # O copiar el mismo SQL y aplicarlo en producción
   ```

**Ventajas:**
- ✅ Familiar (como antes)
- ✅ Rápido para probar
- ✅ Las migraciones quedan versionadas

**Importante:** 
- ⚠️ Asegúrate de aplicar en desarrollo/staging primero
- ⚠️ La migración debe estar en Git antes de aplicar a producción

---

## Opción 3: Solo Producción (NO recomendado)

**Solo para:** Cambios pequeños y urgentes que ya probaste en otro lado

### Pasos:

1. **Crear migración** en `supabase/migrations/`

2. **Commitear y push a Git primero:**
   ```bash
   git add supabase/migrations/
   git commit -m "feat(db): descripción"
   git push
   ```

3. **Aplicar a producción:**
   ```bash
   supabase db push
   # O manualmente copiando el SQL
   ```

**⚠️ Advertencia:** 
- No pruebes directamente en producción
- Siempre prueba primero en desarrollo/staging

---

## 🎯 Recomendación para Tu Situación

Con una sola base de datos, usa el **Flujo Simplificado** arriba:

### **Flujo Simplificado:**

1. Yo creo la migración en `supabase/migrations/` (con SQL seguro)
2. Tú copias el SQL y lo aplicas en SQL Editor
3. Pruebas la aplicación inmediatamente
4. Si funciona: commit a Git → push
5. Si hay errores: corriges la migración y vuelves a aplicar

**Ventajas:**
- ✅ Familiar (como antes)
- ✅ Las migraciones quedan versionadas en Git
- ✅ Pruebas inmediatas
- ✅ SQL seguro evita errores si se aplica dos veces

---

## 📝 Ejemplo Práctico

**Escenario:** Necesitas agregar una columna `middle_name` a la tabla `students`

### Lo que yo haré:
1. Crear: `supabase/migrations/20240115143000_add_middle_name_to_students.sql`
2. Escribir el SQL:
   ```sql
   ALTER TABLE public.students
     ADD COLUMN IF NOT EXISTS middle_name TEXT;
   ```

### Lo que tú harás:
1. **Abrir el archivo** `supabase/migrations/20240115143000_add_middle_name_to_students.sql`
2. **Copiar el SQL**
3. **Ir a Supabase Dashboard → SQL Editor**
4. **Pegar y ejecutar**
5. **Probar inmediatamente** que la aplicación funciona con el cambio
6. **Si funciona:**
   ```bash
   git add supabase/migrations/
   git commit -m "feat(db): agregar middle_name a students"
   git push
   ```
7. **Si hay errores:**
   - Me avisas y corrijo la migración
   - Vuelves a aplicar
   - Repites hasta que funcione

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo seguir aplicando manualmente?**
R: Sí, es el flujo recomendado para tu situación. Solo asegúrate de que la migración esté en `supabase/migrations/` antes de aplicar.

**P: ¿Qué pasa si olvido crear la migración primero?**
R: Puedes crear una migración después con el SQL que aplicaste, pero es mejor crearla antes.

**P: ¿Qué pasa si aplico una migración dos veces?**
R: Por eso uso comandos seguros como `IF NOT EXISTS` y `IF EXISTS` para evitar errores.

**P: ¿Cómo sé qué migraciones ya apliqué?**
R: Puedes revisar el historial en Git o usar `supabase migration list` si configuras CLI.

**P: ¿Debería crear una base de datos separada para desarrollo?**
R: Es recomendado pero no necesario. Puedes seguir con una sola DB mientras trabajas solo o en equipo pequeño.

---

## 🚀 Próximos Pasos

1. **Ahora:** Usa el Flujo Simplificado (aplicar manualmente, versionar en Git)
2. **Cuando crezca el proyecto:** Considera crear un proyecto separado de Supabase para desarrollo
3. **A largo plazo:** Configura Supabase CLI con base de datos local para pruebas
4. **Beneficio actual:** Ya tienes historial completo de cambios en Git

## 💡 Consejo Extra

Si quieres separar desarrollo y producción en el futuro:
- Crea un segundo proyecto en Supabase (gratis)
- Usa variables de entorno para cambiar entre proyectos
- Aplica migraciones primero en desarrollo, luego en producción
