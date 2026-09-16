-- Run once in the Supabase SQL editor.
-- Adds an optional short Title and a longer Details field to Questions/Support Needed
-- and Next Steps. The main list on Weekly Reports shows just the title (falling back
-- to the existing question_text/text when no title is set); the fuller context lives
-- in Details, shown only when you click through to an item — same Title / Main /
-- Details pattern already used for Insights (012/019_insight_title_and_richtext.sql),
-- kept plain text here rather than rich HTML since these are short manual notes.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS details text;

ALTER TABLE next_steps ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE next_steps ADD COLUMN IF NOT EXISTS details text;
