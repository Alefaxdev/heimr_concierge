# HEIMR Concierge

Digital concierge-assistent for HEIMR-hotellene. Svarer i concierge sin egen stemme, bare ut fra kunnskapsbasen, og sender spørsmål den ikke kan svare på videre til concierge.

## Roller
- **Resepsjon** (`STAFF_PASSWORD`): chat. Ukjente spørsmål havner i køen til concierge.
- **Concierge** (`CONCIERGE_PASSWORD`): chat, admin, og kan si «husk at …» i chatten for å lagre kunnskap.

Ved innlogging velger man hotell og skriver navnet sitt. Navnet brukes i loggen og i spørsmålskøen.

## Sider
- `/` – chat, med hurtigvalg (e-post til gjest, svar på gjestemelding, restaurant i kveld, dagsplan)
- `/admin` – kunnskapsbase (tekst og PDF, kategorier, mapper, hotell eller felles HEIMR, utløpsdato)
- `/bestillinger` – søk opp gjest i Mews, velg partner, få ferdig e-post (Åpne i e-post / Gå til booking / Ring) og følg status: utkast, sendt, bekreftet eller avlyst
- `/admin/partnere` – partnerregister med restauranter, taxi, transport, opplevelser og spa, med e-post, telefon, bookinglenke og notater
- `/admin/sporsmal` – spørsmål assistenten ikke kunne svare på. Svar blir lagret i kunnskapsbasen.
- `/admin/stemme` (Oppsett) – concierge-navn, stemmeguide, ekte eksempler og Mews-kobling
- `/login`

## Kunnskap
- Kunnskap kan gjelde **bare ett hotell** eller **alle HEIMR-hotell**. Hotellets egen kunnskap går foran.
- Kunnskap med **«Gyldig til»** forsvinner automatisk fra assistenten etter datoen.

## Mews
Panelet til høyre i chatten viser dagens VIP-ankomster og VIP-gjester i huset (Mews-klassifisering VeryImportant, Important, TopManagement eller Media), med rom, datoer, merker og notater. Klikk «Velkomsthilsen» for å lage en hilsen. Assistenten kan også hente gjestene selv (verktøyet `get_todays_guests`).

- Tokenene hentes fra Azure Key Vault `heimr` (som Fabric-notebookene). Navnene settes med `MEWS_CLIENT_TOKEN_SECRET` og `MEWS_ACCESS_TOKEN_SECRET`. Et eget token per hotell kan ligge som `<navn>-<hotell>`, f.eks. `mews-access-token-opus`.
- Lokalt holder det med `az login`. I produksjon brukes en service principal (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`) med lesetilgang til hemmelighetene i vaulten.
- Miljøvariablene `MEWS_CLIENT_TOKEN`, `MEWS_ACCESS_TOKEN` og `MEWS_ACCESS_TOKEN_<HOTELL>` går foran Key Vault, hvis de er satt.
- Velg riktig hotell under Admin → Oppsett → «Finn i Mews».
- Dataene caches i 3 minutter, og panelet oppdateres hvert 5. minutt.

## Oppsett
1. `cp .env.example .env.local` og fyll inn verdiene.
2. Database: filene i `supabase/migrations/` (allerede kjørt i produksjonsdatabasen).
3. `npm install` og `npm run dev`.

## Teknisk
- Next.js 16 (App Router), `proxy.ts` beskytter alle sider og API-ruter.
- Sesjon: signert, httpOnly cookie (HMAC-SHA256, `AUTH_SECRET`), varer i 14 dager.
- Claude via `@anthropic-ai/sdk` med verktøyene `ask_concierge` og `save_knowledge` (bare concierge). Stemme og kunnskap caches.
- Supabase med service role kun på serveren. Concierge-tabellene har RLS skrudd på.
