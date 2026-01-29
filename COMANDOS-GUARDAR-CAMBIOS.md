# ✅ Lista Definitiva: Guardar Cambios

## 📋 Checklist Rápida

Cuando estés satisfecho con tu progreso y quieras guardar:

- [ ] ¿Hay cambios en el código? → Seguir "Solo Código"
- [ ] ¿Hay cambios en la base de datos? → Seguir "Código + Base de Datos"
- [ ] ¿Hay ambos? → Seguir "Código + Base de Datos"

---

## 🔵 Escenario 1: Solo Cambios de Código

**Cuando:** Modificaste archivos `.tsx`, `.ts`, `.css`, etc. (sin cambios en DB)

### Pasos:

1. **Ver qué cambió:**

   ```bash
   git status
   ```

2. **Agregar archivos al staging:**

   ```bash
   git add .
   # O específicamente:
   git add app/ components/ lib/
   ```

3. **Crear commit:**

   ```bash
   git commit -m "feat: descripción breve del cambio"
   # Ejemplos:
   # git commit -m "feat: agregar ordenamiento por apellido en listas"
   # git commit -m "fix: corregir error en formulario de estudiantes"
   # git commit -m "style: mejorar diseño de tarjetas"
   ```

4. **Enviar a Git (GitHub/GitLab/etc):**
   ```bash
   git push
   ```

**✅ Listo!** Tus cambios están guardados y versionados.

---

## 🟢 Escenario 2: Código + Cambios en Base de Datos

**Cuando:** Modificaste código Y necesitas cambiar el esquema de la DB (tablas, columnas, RLS, etc.)

### Pasos:

#### Paso 1: Crear Migración (Yo lo hago)

- Yo creo el archivo en `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`
- Con SQL seguro y comentarios

#### Paso 2: Aplicar Migración a la Base de Datos

**Opción A: Manualmente (Recomendado ahora)**

1. Abre el archivo de migración: `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`
2. Copia todo el contenido SQL
3. Ve a Supabase Dashboard → SQL Editor
4. Pega y ejecuta el SQL
5. Verifica que no haya errores

**Opción B: Con Supabase CLI (Si lo tienes configurado)**

```bash
supabase db push
```

#### Paso 3: Probar la Aplicación

- Abre tu aplicación
- Prueba la funcionalidad relacionada al cambio
- Verifica que todo funcione correctamente

#### Paso 4: Si Funciona - Guardar en Git

1. **Ver qué cambió:**

   ```bash
   git status
   ```

2. **Agregar TODO (código + migración):**

   ```bash
   git add .
   # Esto incluye:
   # - Cambios de código (app/, components/, etc.)
   # - Migración (supabase/migrations/)
   ```

3. **Crear commit:**

   ```bash
   git commit -m "feat(db): descripción del cambio de DB y código"
   # Ejemplos:
   # git commit -m "feat(db): agregar columna middle_name a students"
   # git commit -m "feat(db): crear tabla nueva y actualizar formularios"
   ```

4. **Enviar a Git:**
   ```bash
   git push
   ```

**✅ Listo!** Código y migración están guardados y versionados.

---

## 🟡 Escenario 3: Si Algo Sale Mal

### Si la migración falla al aplicarla:

1. **Lee el error** en Supabase SQL Editor
2. **Avísame** qué error apareció
3. **Yo corrijo** la migración
4. **Vuelve al Paso 2** y aplica la migración corregida

### Si la aplicación no funciona después de aplicar migración:

1. **Revisa la consola** del navegador (F12)
2. **Revisa los logs** del servidor
3. **Avísame** qué error aparece
4. **Yo corrijo** el código o la migración según corresponda

### Si quieres revertir un cambio:

**Para código:**

```bash
git log                    # Ver commits recientes
git revert <commit-hash>   # Revertir commit específico
git push                   # Enviar reversión
```

**Para base de datos:**

- Aplica manualmente el SQL de rollback (si está en comentarios en la migración)
- O avísame y creo una migración de rollback

---

## 📝 Convenciones de Commits

### Formato:

```
tipo(scope): descripción breve

Ejemplos:
- feat(db): agregar columna middle_name a students
- fix: corregir error en validación de formulario
- style: mejorar diseño de lista de estudiantes
- refactor: reorganizar componentes de director
```

### Tipos comunes:

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `style`: Cambios de diseño/estilo
- `refactor`: Refactorización de código
- `docs`: Cambios en documentación
- `feat(db)`: Cambio que incluye migración de DB

---

## 🚀 Comandos Rápidos (Copy-Paste)

### Solo código:

```bash
git add . && git commit -m "feat: descripción" && git push
```

### Código + DB (después de aplicar migración):

```bash
git add . && git commit -m "feat(db): descripción" && git push
```

### Ver estado antes de commitear:

```bash
git status
git diff  # Ver cambios en detalle
```

### Ver historial:

```bash
git log --oneline -10  # Últimos 10 commits
```

---

## ⚠️ Reglas de Oro

1. **SIEMPRE probar** antes de hacer commit
2. **SIEMPRE aplicar migración** antes de commitear (si hay cambios de DB)
3. **SIEMPRE incluir migración** en el commit si hay cambios de DB
4. **NUNCA commitear** código que no funciona
5. **NUNCA aplicar migraciones** a producción sin probar primero (cuando tengas clientes)

---

## 📋 Checklist Final Antes de Cerrar Sesión

Antes de terminar tu sesión de trabajo:

- [ ] ¿Apliqué todas las migraciones necesarias?
- [ ] ¿Probé que la aplicación funciona?
- [ ] ¿Hice commit de todos los cambios?
- [ ] ¿Hice push a Git?
- [ ] ¿Todo está guardado y versionado?

**Si todas las respuestas son SÍ → ✅ Puedes cerrar tranquilo**

---

## 🆘 Ayuda Rápida

**¿No recuerdas qué hacer?**

1. Ejecuta: `git status`
2. Si ves archivos en rojo → `git add .`
3. Si ves archivos en verde → `git commit -m "mensaje"`
4. Si ya hiciste commit → `git push`

**¿Quieres ver qué cambió?**

```bash
git diff                    # Ver cambios sin agregar
git diff --staged          # Ver cambios ya agregados
```

**¿Quieres deshacer algo?**

```bash
git restore <archivo>      # Deshacer cambios en archivo específico
git restore --staged <archivo>  # Quitar del staging
```

---

## 📚 Resumen Visual

```
┌─────────────────────────────────────┐
│  ¿Hay cambios en la DB?             │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
      SÍ               NO
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│ 1. Aplicar   │  │ 1. git add  │
│    migración │  │ 2. git      │
│ 2. Probar    │  │    commit   │
│ 3. git add   │  │ 3. git push │
│ 4. git       │  └──────────────┘
│    commit    │
│ 5. git push  │
└──────────────┘
```

---

**💡 Tip:** Guarda este archivo como referencia rápida. Puedes consultarlo cada vez que necesites guardar cambios.
