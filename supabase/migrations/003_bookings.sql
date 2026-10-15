-- HEIMR CONCIERGE – migrasjon 003
-- Partnerregister (restauranter, taxi, opplevelser …) og bestillinger.

CREATE TABLE IF NOT EXISTS concierge_partners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     TEXT REFERENCES concierge_hotels(id) ON DELETE CASCADE,  -- NULL = felles for HEIMR
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'Restaurant',  -- Restaurant | Taxi | Transport | Opplevelse | Spa | Annet
  email        TEXT,
  phone        TEXT,
  booking_url  TEXT,
  address      TEXT,
  contact_name TEXT,
  notes        TEXT,                                -- f.eks. «Spør etter Lars, si at dere kommer fra Opus»
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partners_hotel ON concierge_partners(hotel_id, category);

CREATE TABLE IF NOT EXISTS concierge_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            TEXT REFERENCES concierge_hotels(id) ON DELETE CASCADE,
  partner_id          UUID REFERENCES concierge_partners(id) ON DELETE SET NULL,
  partner_name        TEXT,
  category            TEXT,
  guest_name          TEXT NOT NULL,
  reservation_id      TEXT,                           -- Mews
  reservation_number  TEXT,
  room                TEXT,
  booking_date        DATE,
  booking_time        TEXT,                           -- 'HH:MM'
  persons             INT,
  wishes              TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | confirmed | cancelled
  email_subject       TEXT,
  email_body          TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_date ON concierge_bookings(hotel_id, booking_date);

ALTER TABLE concierge_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_bookings ENABLE ROW LEVEL SECURITY;
