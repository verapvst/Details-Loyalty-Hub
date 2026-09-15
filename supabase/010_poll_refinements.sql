-- Run once in the Supabase SQL editor.
-- Meeting Polls refactor: a poll is only a scheduling aid (availability data). It never
-- auto-creates a Meeting. These columns let a poll be edited later (the date/time/slot
-- params weren't persisted before — only used once at creation to generate poll_slots)
-- and let a poll record which real Meeting it eventually produced.

ALTER TABLE meeting_polls ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE meeting_polls ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE meeting_polls ADD COLUMN IF NOT EXISTS from_time time;
ALTER TABLE meeting_polls ADD COLUMN IF NOT EXISTS to_time time;
ALTER TABLE meeting_polls ADD COLUMN IF NOT EXISTS slot_minutes integer;

-- Records the Meeting a poll's "Schedule Meeting" action produced. status becomes
-- 'scheduled' at that point so the poll drops out of the active Polls list.
ALTER TABLE meeting_polls ADD COLUMN IF NOT EXISTS scheduled_meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL;
