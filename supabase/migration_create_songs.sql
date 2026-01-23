-- ============================================
-- Migration: Create songs (canciones) table
-- Execute this in Supabase SQL Editor
-- This migration will create the academies table if it doesn't exist
-- ============================================

-- Create academies table if it doesn't exist
create table if not exists public.academies (
  id uuid default gen_random_uuid() primary key,
  name text not null check (char_length(name) <= 100),
  address text check (char_length(address) <= 200),
  phone text check (char_length(phone) <= 20),
  website text check (char_length(website) <= 200),
  logo_url text check (char_length(logo_url) <= 500),
  timezone text default 'UTC' check (char_length(timezone) <= 50),
  status text default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create handle_updated_at function if it doesn't exist
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger for academies if it doesn't exist
drop trigger if exists handle_updated_at on public.academies;
create trigger handle_updated_at
  before update on public.academies
  for each row
  execute function public.handle_updated_at();

-- Create songs table
create table if not exists public.songs (
  id uuid default gen_random_uuid() primary key,
  academy_id uuid references public.academies on delete cascade not null,
  name text not null check (char_length(name) <= 200),
  author text check (char_length(author) <= 200),
  difficulty_level integer not null check (difficulty_level between 1 and 5),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for academy_id for faster queries
create index if not exists idx_songs_academy_id on public.songs(academy_id);

-- Create index for difficulty_level for filtering
create index if not exists idx_songs_difficulty_level on public.songs(difficulty_level);

-- Create updated_at trigger (drop first if exists)
drop trigger if exists handle_updated_at on public.songs;
create trigger handle_updated_at
  before update on public.songs
  for each row
  execute function public.handle_updated_at();

-- Enable RLS
alter table public.songs enable row level security;

-- RLS Policies
-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Super admins can do everything with songs" on public.songs;
drop policy if exists "Directors can manage songs in their academy" on public.songs;
drop policy if exists "Professors can view songs in their academy" on public.songs;
drop policy if exists "Students can view songs in their academy" on public.songs;
drop policy if exists "Guardians can view songs in their children's academy" on public.songs;

-- Super admins can do everything
create policy "Super admins can do everything with songs"
  on public.songs
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );

-- Directors can manage songs in their academy
create policy "Directors can manage songs in their academy"
  on public.songs
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'director'
      and profiles.academy_id = songs.academy_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'director'
      and profiles.academy_id = songs.academy_id
    )
  );

-- Professors can view songs in their academy
create policy "Professors can view songs in their academy"
  on public.songs
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'professor'
      and profiles.academy_id = songs.academy_id
    )
  );

-- Students can view songs in their academy
create policy "Students can view songs in their academy"
  on public.songs
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.students on students.user_id = profiles.id
      where profiles.id = auth.uid()
      and profiles.role = 'student'
      and students.academy_id = songs.academy_id
    )
  );

-- Guardians can view songs in their children's academy
create policy "Guardians can view songs in their children's academy"
  on public.songs
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.guardian_students on guardian_students.guardian_id = profiles.id
      inner join public.students on students.id = guardian_students.student_id
      where profiles.id = auth.uid()
      and profiles.role = 'guardian'
      and students.academy_id = songs.academy_id
    )
  );

-- ============================================
-- Migration completed!
-- ============================================
