-- Plačljivi vlogi: naročnine prek Stripa, podarjen dostop iz nadzora in
-- dnevnik prejetih Stripovih dogodkov (da se noben ne obdela dvakrat).

ALTER TABLE clani ADD COLUMN dostop_vrsta TEXT;          -- 'podarjen' ali NULL
ALTER TABLE clani ADD COLUMN dostop_do TEXT;             -- ISO; NULL = brez roka
ALTER TABLE clani ADD COLUMN dostop_opomba TEXT;
ALTER TABLE clani ADD COLUMN stripe_customer_id TEXT;
CREATE UNIQUE INDEX clani_stripe ON clani (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Ena vrstica na Stripovo naročnino. stanje je Stripov status (active, trialing,
-- past_due, canceled, unpaid, incomplete, incomplete_expired, paused);
-- obdobje_do je konec plačanega obdobja; dogodek_at je čas Stripovega dogodka,
-- po katerem je vrstica nazadnje usklajena (starejši dogodki je ne povozijo).
CREATE TABLE narocnine (
  id TEXT PRIMARY KEY,
  clan_id INTEGER NOT NULL REFERENCES clani (id) ON DELETE CASCADE,
  stanje TEXT NOT NULL,
  obdobje_do TEXT,
  preklic_ob_koncu INTEGER NOT NULL DEFAULT 0,
  cena_id TEXT,
  dogodek_at INTEGER NOT NULL DEFAULT 0,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  posodobljeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX narocnine_clan ON narocnine (clan_id);

CREATE TABLE stripe_dogodki (
  id TEXT PRIMARY KEY,
  vrsta TEXT NOT NULL,
  prejeto_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
