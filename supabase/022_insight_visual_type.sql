-- Run once in the Supabase SQL editor.
-- Adds a small "what kind of visual is this" tag to Visual/Evidence: Figure, Chart,
-- Table or Diagram. Lives alongside image_path (021) — the Add/Edit Insight form now
-- asks for this first and only reveals the upload/drag-and-drop area once one is
-- picked. Meaningless without an image, so the app only ever sets it together with
-- image_path (both null when there's no visual).
ALTER TABLE figures ADD COLUMN IF NOT EXISTS visual_type text;
