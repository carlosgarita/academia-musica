-- Fix infinite recursion in profiles policies
-- Execute this in Supabase SQL Editor

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Super admins can do everything with profiles" ON public.profiles;
DROP POLICY IF EXISTS "Directors can view and create profiles in their academy" ON public.profiles;

-- Ensure the basic policies exist (these don't cause recursion)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
