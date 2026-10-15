-- ============================================================
-- HEIMR CONCIERGE – komplett skjema (ny database)
-- For eksisterende database: kjør bare filene i migrations/.
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT,
  folder      TEXT,
  source      TEXT,          -- filnavn, 'chat' eller 'spørsmålskø'
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Resten (hoteller, stemme, logg, spørsmålskø, RLS): se migrations/001_concierge.sql
