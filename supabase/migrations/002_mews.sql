-- HEIMR CONCIERGE – migrasjon 002
-- Kobler hvert hotell til sin Mews-enterprise (for portefølje-token).
ALTER TABLE concierge_hotels ADD COLUMN IF NOT EXISTS mews_enterprise_id TEXT;
