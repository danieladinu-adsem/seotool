-- Rulează în Supabase Dashboard > SQL Editor

ALTER TABLE keywords ADD COLUMN IF NOT EXISTS position_desktop INTEGER;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS position_mobile INTEGER;
