-- ============================================
-- Migration: Enhance Professors Table
-- Add additional fields and professor-subjects relationship
-- ============================================

-- ============================================
-- 1. Add additional fields to professors table
-- ============================================

-- Add additional_info field to professors
alter table public.professors
  add column if not exists additional_info text check (char_length(additional_info) <= 500);

-- ============================================
-- 2. Create professor_subjects junction table
-- ============================================

create table if not exists public.professor_subjects (
  id uuid default gen_random_uuid() primary key,
  professor_id uuid references public.professors on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(professor_id, subject_id)
);

-- Create index for faster queries
create index if not exists idx_professor_subjects_professor 
  on public.professor_subjects(professor_id);

create index if not exists idx_professor_subjects_subject 
  on public.professor_subjects(subject_id);

-- ============================================
-- 3. Create updated_at trigger for professor_subjects
-- ============================================

create trigger handle_updated_at
  before update on public.professor_subjects
  for each row
  execute function public.handle_updated_at();

-- ============================================
-- 4. Enable RLS on professor_subjects
-- ============================================

alter table public.professor_subjects enable row level security;

-- ============================================
-- 5. Create RLS policies for professor_subjects
-- ============================================

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
    inner join public.professors on professors.user_id = profiles.id
    where profiles.id = auth.uid()
    and profiles.academy_id = (
      select academy_id from public.professors where id = professor_subjects.professor_id
    )
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
-- 2. Created professor_subjects junction table for many-to-many relationship
-- 3. Added RLS policies for professor_subjects
-- ============================================
