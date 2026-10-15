-- ============================================================
-- HEIMR CONCIERGE – migrasjon 001
-- Hoteller + stemme, kunnskap per hotell med utløp,
-- samtalelogg og «Spør concierge»-kø.
-- All tilgang går via server-ruter med service role, så RLS
-- skrus på uten policies (anon-nøkkelen får ingen tilgang).
-- ============================================================

CREATE TABLE IF NOT EXISTS concierge_hotels (
  id              TEXT PRIMARY KEY,              -- 'opus', 'savoy', 'victoria'
  name            TEXT NOT NULL,
  concierge_name  TEXT,                          -- f.eks. 'Celine'
  voice_guide     TEXT,                          -- hvordan concierge skriver og snakker
  voice_examples  TEXT,                          -- ekte meldinger/e-poster som eksempler
  updated_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO concierge_hotels (id, name, concierge_name, voice_guide) VALUES
  ('opus', 'Opus', 'Celine',
   'Varm, personlig og effektiv. Skriver som en erfaren concierge som kjenner byen godt: konkret, aldri stiv, aldri overdrevent formell. Korte avsnitt. Bruker gjestens navn. Avslutter gjerne med et konkret tilbud om å ordne noe.'),
  ('savoy', 'Savoy', NULL, NULL),
  ('victoria', 'Victoria', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Kunnskap: hotell (NULL = felles for hele HEIMR) og utløpsdato
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS hotel_id    TEXT REFERENCES concierge_hotels(id) ON DELETE SET NULL;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_knowledge_hotel ON knowledge_base(hotel_id);

-- Samtalelogg
CREATE TABLE IF NOT EXISTS concierge_conversations (
  id          UUID PRIMARY KEY,
  hotel_id    TEXT REFERENCES concierge_hotels(id) ON DELETE SET NULL,
  user_name   TEXT,
  user_role   TEXT,                              -- 'staff' | 'concierge'
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concierge_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES concierge_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,                -- 'user' | 'assistant'
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concierge_messages_conv ON concierge_messages(conversation_id, created_at);

-- «Spør concierge»-kø
CREATE TABLE IF NOT EXISTS concierge_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         TEXT REFERENCES concierge_hotels(id) ON DELETE SET NULL,
  conversation_id  UUID REFERENCES concierge_conversations(id) ON DELETE SET NULL,
  question         TEXT NOT NULL,
  context          TEXT,
  asked_by         TEXT,
  status           TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'answered' | 'dismissed'
  answer           TEXT,
  knowledge_id     UUID REFERENCES knowledge_base(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  answered_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_concierge_questions_status ON concierge_questions(hotel_id, status);

-- RLS: kun service role (server) har tilgang
ALTER TABLE concierge_hotels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base          ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_folders       ENABLE ROW LEVEL SECURITY;
