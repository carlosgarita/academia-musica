-- ============================================
-- Migration: Separate student name into first_name and last_name
-- Execute this in Supabase SQL Editor
-- This script splits the name column into first_name and last_name
-- ============================================

-- ============================================
-- 1. Add new columns for first_name and last_name
-- ============================================

alter table public.students 
add column if not exists first_name text check (char_length(first_name) <= 50);

alter table public.students 
add column if not exists last_name text check (char_length(last_name) <= 50);

-- ============================================
-- 2. Migrate existing data from name to first_name and last_name
-- ============================================

-- Split existing name into first_name and last_name
-- Assumes format: "FirstName LastName" or just "Name"
do $$
declare
  student_record record;
  name_parts text[];
  first_part text;
  last_part text;
begin
  for student_record in select id, name from public.students where first_name is null or last_name is null loop
    -- Split name by space
    name_parts := string_to_array(trim(student_record.name), ' ');
    
    if array_length(name_parts, 1) > 1 then
      -- Has multiple parts: first part is first_name, rest is last_name
      first_part := name_parts[1];
      last_part := array_to_string(name_parts[2:], ' ');
    else
      -- Single word: use as first_name, leave last_name empty
      first_part := name_parts[1];
      last_part := '';
    end if;
    
    -- Update the record
    update public.students
    set first_name = first_part,
        last_name = last_part
    where id = student_record.id;
  end loop;
end $$;

-- ============================================
-- 3. Set columns as NOT NULL after migration
-- ============================================

-- Make first_name NOT NULL
alter table public.students 
alter column first_name set not null;

-- Make last_name NOT NULL (empty string is acceptable)
alter table public.students 
alter column last_name set not null;

-- ============================================
-- 4. Drop the old name column
-- ============================================

-- Drop the name column (CASCADE will handle any dependencies)
alter table public.students drop column if exists name cascade;

-- ============================================
-- Migration completed!
-- ============================================
-- 
-- Summary:
-- 1. Added first_name and last_name columns
-- 2. Migrated existing name data (splitting by space)
-- 3. Set columns as NOT NULL
-- 4. Removed old name column
-- ============================================
