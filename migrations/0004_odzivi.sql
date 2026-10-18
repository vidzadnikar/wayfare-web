-- Odzivi testerjev: obrazec na strani (/odziv/) in okno Pošlji odziv v
-- aplikaciji. Pošlje ga lahko kdorkoli, tudi brez prijave; e-naslov je
-- neobvezen (za odgovor). Prijavljenemu se zapiše še član.
-- Uporabi: npx wrangler d1 migrations apply wayfare-clani --local (doma) / --remote
CREATE TABLE odzivi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vrsta TEXT NOT NULL CHECK (vrsta IN ('napaka', 'predlog', 'pohvala')),
  besedilo TEXT NOT NULL,
  email TEXT,
  clan_id INTEGER REFERENCES clani (id) ON DELETE SET NULL,
  vir TEXT NOT NULL CHECK (vir IN ('stran', 'app')),
  razlicica TEXT,
  sistem TEXT,
  jezik TEXT NOT NULL DEFAULT 'en',
  resen_at TEXT,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX odzivi_cas ON odzivi (ustvarjeno_at);
