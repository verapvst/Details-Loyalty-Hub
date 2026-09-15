-- Run once in the Supabase SQL editor.
-- The old Figures columns (data_type, topic, market, statistic, value) were NOT NULL
-- under the previous "market stat" model. The new Insight rows (012_insights.sql)
-- don't populate them, so every insert was failing. Same fix pattern as
-- 008_fix_likes_feature_text_nullable.sql — no real data depends on these being
-- required any more.

ALTER TABLE figures ALTER COLUMN data_type DROP NOT NULL;
ALTER TABLE figures ALTER COLUMN topic DROP NOT NULL;
ALTER TABLE figures ALTER COLUMN market DROP NOT NULL;
ALTER TABLE figures ALTER COLUMN statistic DROP NOT NULL;
ALTER TABLE figures ALTER COLUMN value DROP NOT NULL;
