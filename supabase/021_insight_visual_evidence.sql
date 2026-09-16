-- Run once in the Supabase SQL editor.
-- Adds optional Visual/Evidence support to Data & Insights: a Figure or Table insight
-- can carry one uploaded image (screenshot, diagram, chart, strategy map...) alongside
-- its normal Title / Main Insight / Source / Scope. No new taxonomy — 'Figure' and
-- 'Table' are just two more values in the app's existing insight_type list
-- (assets/options.js), so they get the same Type chips, filtering and search as every
-- other Information Type for free.
--
-- Creates the project's first Supabase Storage bucket. Public-read (images are shown
-- inline on the Insight Detail page) with insert/delete open to the anon role — the
-- same "no auth beyond the name-picker" trust model already used for every table's
-- "allow all" RLS policy in this app.

ALTER TABLE figures ADD COLUMN IF NOT EXISTS image_path text; -- object path within the bucket, not a full URL — the public URL is derived at render time so nothing goes stale

INSERT INTO storage.buckets (id, name, public)
VALUES ('insight-images', 'insight-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "insight images: public read" ON storage.objects;
CREATE POLICY "insight images: public read" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'insight-images');

DROP POLICY IF EXISTS "insight images: anon upload" ON storage.objects;
CREATE POLICY "insight images: anon upload" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'insight-images');

DROP POLICY IF EXISTS "insight images: anon delete" ON storage.objects;
CREATE POLICY "insight images: anon delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'insight-images');
