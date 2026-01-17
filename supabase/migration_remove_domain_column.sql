-- Migration: Remove 'domain' column from academies table
-- This column was replaced by 'website'

-- Drop the domain column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'academies' 
      AND column_name = 'domain'
  ) THEN
    ALTER TABLE public.academies DROP COLUMN domain;
    RAISE NOTICE 'Column "domain" has been dropped from academies table';
  ELSE
    RAISE NOTICE 'Column "domain" does not exist in academies table';
  END IF;
END $$;
