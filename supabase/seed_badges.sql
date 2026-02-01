-- ============================================
-- Seed: Badges por academia
-- ============================================
-- Ejecutar después de la migración 20260129140000_alter_badges_add_virtud_frase.sql
-- O usar: supabase db push / supabase migration up
--
-- Columnas: name (Nombre), virtud (Virtud), description (Descripción), frase (Frase), image_url (placeholder para pruebas)

INSERT INTO public.badges (academy_id, name, virtud, description, frase, image_url)
SELECT
  a.id,
  'Guardián del Ritmo',
  'Constancia',
  'Para el estudiante que mantiene un pulso constante en su práctica diaria, demostrando que la disciplina es el latido de la música.',
  'Tu constancia es la fuerza que hace que la música nunca se detenga. ¡Sigue así!',
  'https://picsum.photos/seed/ritmo/80/80'
FROM public.academies a
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges b WHERE b.academy_id = a.id AND b.name = 'Guardián del Ritmo' AND b.deleted_at IS NULL
);

INSERT INTO public.badges (academy_id, name, virtud, description, frase, image_url)
SELECT
  a.id,
  'Arquitecto del Sonido',
  'Atención al detalle',
  'Se otorga a quien no se rinde ante un pasaje difícil y trabaja cuidadosamente cada nota hasta que suena perfecta.',
  'Los grandes maestros se construyen detalle a detalle. Tu precisión es tu superpoder.',
  'https://picsum.photos/seed/sonido/80/80'
FROM public.academies a
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges b WHERE b.academy_id = a.id AND b.name = 'Arquitecto del Sonido' AND b.deleted_at IS NULL
);

INSERT INTO public.badges (academy_id, name, virtud, description, frase, image_url)
SELECT
  a.id,
  'Explorador Melódico',
  'Curiosidad',
  'Para aquel que siempre pregunta "¿por qué?" o busca piezas nuevas fuera del programa, mostrando una sed genuina de aprender.',
  'Tu curiosidad es la llave que abre mundos nuevos. ¡Nunca dejes de descubrir!',
  'https://picsum.photos/seed/melodico/80/80'
FROM public.academies a
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges b WHERE b.academy_id = a.id AND b.name = 'Explorador Melódico' AND b.deleted_at IS NULL
);

-- Actualizar image_url en badges existentes (si se ejecutó el seed anteriormente sin imágenes)
UPDATE public.badges SET image_url = 'https://picsum.photos/seed/ritmo/80/80' WHERE name = 'Guardián del Ritmo' AND (image_url IS NULL OR image_url = '');
UPDATE public.badges SET image_url = 'https://picsum.photos/seed/sonido/80/80' WHERE name = 'Arquitecto del Sonido' AND (image_url IS NULL OR image_url = '');
UPDATE public.badges SET image_url = 'https://picsum.photos/seed/melodico/80/80' WHERE name = 'Explorador Melódico' AND (image_url IS NULL OR image_url = '');
