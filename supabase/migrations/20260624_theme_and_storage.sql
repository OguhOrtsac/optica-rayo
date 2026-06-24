-- Migration: User Theme Preference and Product Image Storage
-- Adds bg_theme to public.profiles and configures 'product-images' storage bucket with RLS policies.

-- 1. Add bg_theme to public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bg_theme TEXT DEFAULT 'dark' CHECK (bg_theme IN ('light', 'dark'));

-- 2. Configure 'product-images' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for 'product-images'
-- Drop existing policies if any to avoid errors during re-runs
DROP POLICY IF EXISTS "Permitir lectura publica de imagenes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir al staff subir imagenes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir al staff borrar o actualizar imagenes" ON storage.objects;

-- Allow public read access to product images
CREATE POLICY "Permitir lectura publica de imagenes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow staff to upload product images (owner, seller, dev)
CREATE POLICY "Permitir al staff subir imagenes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' AND
    (SELECT public.get_my_role()) IN ('owner', 'seller', 'dev')
  );

-- Allow staff to update or delete product images
CREATE POLICY "Permitir al staff borrar o actualizar imagenes"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'product-images' AND
    (SELECT public.get_my_role()) IN ('owner', 'seller', 'dev')
  );
