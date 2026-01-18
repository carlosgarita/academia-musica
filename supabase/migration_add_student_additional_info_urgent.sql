-- ============================================
-- Migration: Add additional_info column to students table
-- URGENT: Execute this in Supabase SQL Editor immediately
-- ============================================

-- Add additional_info column to students table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'students' 
        AND column_name = 'additional_info'
    ) THEN
        ALTER TABLE public.students 
        ADD COLUMN additional_info text;
        
        -- Add check constraint
        ALTER TABLE public.students 
        ADD CONSTRAINT students_additional_info_check 
        CHECK (char_length(additional_info) <= 500);
        
        RAISE NOTICE 'Column additional_info added to students table';
    ELSE
        RAISE NOTICE 'Column additional_info already exists in students table';
    END IF;
END $$;

-- ============================================
-- Migration completed!
-- ============================================
