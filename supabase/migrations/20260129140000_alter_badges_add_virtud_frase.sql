-- ============================================
-- Modificar tabla badges: Virtud, Frase, image_url opcional
-- ============================================

-- Hacer image_url opcional (nullable)
ALTER TABLE public.badges
  ALTER COLUMN image_url DROP NOT NULL;

-- Agregar columna virtud (máx 100 caracteres)
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS virtud text CHECK (char_length(virtud) <= 100);

-- Agregar columna frase (máx 500 caracteres)
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS frase text CHECK (char_length(frase) <= 500);
