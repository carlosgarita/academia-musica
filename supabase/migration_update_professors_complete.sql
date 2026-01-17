-- ============================================
-- Migration: Complete Professors Table Update
-- Execute this in Supabase SQL Editor
-- This script ensures all professor fields are available
-- ============================================

-- ============================================
-- 1. Remove name field from professors (use profiles.first_name + last_name instead)
-- ============================================

-- Drop name column if it exists (we'll use profiles.first_name and last_name)
alter table public.professors
  drop column if exists name;

-- ============================================
-- 2. Ensure academy_id exists in professors (required for security/multitenancy)
-- ============================================

alter table public.professors
  add column if not exists academy_id uuid references public.academies on delete cascade;

-- Update existing records to have academy_id from profiles (if null)
do $$
begin
  update public.professors
  set academy_id = (
    select academy_id from public.profiles where profiles.id = professors.user_id
  )
  where academy_id is null;
end $$;

-- Make academy_id NOT NULL after populating
alter table public.professors
  alter column academy_id set not null;

-- Ensure unique constraint includes academy_id
alter table public.professors
  drop constraint if exists professors_user_id_unique;

alter table public.professors
  drop constraint if exists professors_user_id_academy_id_key;

alter table public.professors
  add constraint professors_user_id_academy_id_key unique(user_id, academy_id);

-- ============================================
-- 3. Add additional_info to professors if it doesn't exist
-- ============================================

alter table public.professors
  add column if not exists additional_info text check (char_length(additional_info) <= 500);

-- ============================================
-- 2. Create professor_subjects table if it doesn't exist
-- ============================================

create table if not exists public.professor_subjects (
  id uuid default gen_random_uuid() primary key,
  professor_id uuid references public.professors on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(professor_id, subject_id)
);

-- Create indexes for faster queries
create index if not exists idx_professor_subjects_professor 
  on public.professor_subjects(professor_id);

create index if not exists idx_professor_subjects_subject 
  on public.professor_subjects(subject_id);

-- ============================================
-- 3. Create updated_at trigger for professor_subjects
-- ============================================

drop trigger if exists handle_updated_at on public.professor_subjects;
create trigger handle_updated_at
  before update on public.professor_subjects
  for each row
  execute function public.handle_updated_at();

-- ============================================
-- 4. Enable RLS on professor_subjects
-- ============================================

alter table public.professor_subjects enable row level security;

-- ============================================
-- 5. Create RLS policies for professor_subjects (idempotent)
-- ============================================

-- Drop existing policies if they exist
drop policy if exists "Super admins can do everything with professor_subjects" on public.professor_subjects;
drop policy if exists "Directors can manage professor_subjects in their academy" on public.professor_subjects;
drop policy if exists "Professors can view their own subjects" on public.professor_subjects;

-- Super admins can do everything
create policy "Super admins can do everything with professor_subjects"
  on public.professor_subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

-- Directors can manage professor_subjects in their academy
create policy "Directors can manage professor_subjects in their academy"
  on public.professor_subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.professors on professors.id = professor_subjects.professor_id
    where profiles.id = auth.uid()
    and profiles.academy_id = professors.academy_id
    and profiles.role = 'director'
  ));

-- Professors can view their own subjects
create policy "Professors can view their own subjects"
  on public.professor_subjects
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.professors on professors.user_id = profiles.id
    where profiles.id = auth.uid()
    and profiles.role = 'professor'
    and professors.id = professor_subjects.professor_id
  ));

-- ============================================
-- Migration completed!
-- ============================================
-- 
-- Summary:
-- 1. Added additional_info field to professors table
-- 2. Created professor_subjects junction table
-- 3. Added indexes for performance
-- 4. Added triggers and RLS policies
-- ============================================
