-- HEIMR CONCIERGE – migrasjon 004
-- Beskrivelse (til gjest/kollega) og bilde for partnere.
ALTER TABLE concierge_partners ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE concierge_partners ADD COLUMN IF NOT EXISTS image_url TEXT;
