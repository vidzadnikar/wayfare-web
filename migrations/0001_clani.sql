-- Člani strani Wayfare Studio, žetoni za prijavo z e-pošto, omejitve, obvestila,
-- vrsta za pošiljanje in dnevnik poslane pošte. Časi so ISO 8601 v UTC.
-- Uporabi: npx wrangler d1 migrations apply wayfare-clani --local (doma) / --remote

CREATE TABLE clani (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  ime TEXT,
  slika_url TEXT,
  vir TEXT NOT NULL CHECK (vir IN ('google', 'eposta')),
  jezik TEXT NOT NULL DEFAULT 'sl' CHECK (jezik IN ('sl', 'en')),
  potrjen_at TEXT,
  odjavljen_at TEXT,
  blokiran INTEGER NOT NULL DEFAULT 0,
  ustvarjen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  zadnji_obisk_at TEXT,
  obiskov INTEGER NOT NULL DEFAULT 0
);

-- Povezave za potrditev e-naslova (in ponovno prijavo z e-pošto). Hrani se le
-- zgoščena vrednost žetona; povezava velja en dan in se porabi enkrat.
CREATE TABLE zetoni (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  namen TEXT NOT NULL CHECK (namen IN ('potrditev')),
  jezik TEXT NOT NULL DEFAULT 'sl',
  nazaj TEXT,
  ustvarjen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  potece_at TEXT NOT NULL,
  porabljen_at TEXT
);
CREATE INDEX zetoni_potece ON zetoni (potece_at);

-- Omejitev prijav: število zahtev na ključ (ip:…, email:…) v urnem oknu.
CREATE TABLE omejitve (
  kljuc TEXT NOT NULL,
  okno TEXT NOT NULL,
  stevilo INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kljuc, okno)
);

-- Obvestila: vsak ključ (vlog:<oznaka>, izdaja:<oznaka>, novica:<čas>) gre ven
-- največ enkrat. Besedilo ostane tu, ker se del pošte lahko pošlje šele
-- naslednje dni (dnevna meja).
CREATE TABLE poslano (
  kljuc TEXT PRIMARY KEY,
  vrsta TEXT NOT NULL CHECK (vrsta IN ('vlog', 'izdaja', 'novica')),
  naslov_sl TEXT NOT NULL,
  naslov_en TEXT NOT NULL,
  besedilo_sl TEXT,
  besedilo_en TEXT,
  url_sl TEXT,
  url_en TEXT,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  poslano_at TEXT,
  prejemnikov INTEGER NOT NULL DEFAULT 0
);

-- Vrsta: en zapis na člana in obvestilo. v_teku označi zasedene zapise med
-- pošiljanjem, da vzporeden klic ne pošlje istih.
CREATE TABLE vrsta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kljuc TEXT NOT NULL REFERENCES poslano (kljuc) ON DELETE CASCADE,
  clan_id INTEGER NOT NULL REFERENCES clani (id) ON DELETE CASCADE,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  v_teku TEXT,
  v_teku_at TEXT,
  poslano_at TEXT,
  napaka TEXT,
  UNIQUE (kljuc, clan_id)
);
CREATE INDEX vrsta_cakajoce ON vrsta (poslano_at, id);

-- Dnevnik vse poslane pošte (tudi potrditvene): po njem se šteje dnevna meja.
CREATE TABLE posta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prejemnik TEXT NOT NULL,
  vrsta TEXT NOT NULL,
  kljuc TEXT,
  nacin TEXT NOT NULL,
  odgovor_id TEXT,
  poslano_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX posta_poslano ON posta (poslano_at);

-- Vlogi, ki so na strani že ob zagonu, so označeni kot poslani, da ob prvem
-- samodejnem obvestilu ne gredo ven za nazaj.
INSERT INTO poslano (kljuc, vrsta, naslov_sl, naslov_en, poslano_at) VALUES
  ('vlog:milano-4', 'vlog', 'Milano — 4. dan', 'Milan — Day 4', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:milano-3', 'vlog', 'Milano — 3. dan', 'Milan — Day 3', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:milano-2', 'vlog', 'Milano — 2. dan', 'Milan — Day 2', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:milano-1', 'vlog', 'Milano — 1. dan', 'Milan — Day 1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:madrid-recap', 'vlog', 'Madrid — povzetek', 'Madrid — Recap', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:madrid-4', 'vlog', 'Madrid — 4. dan', 'Madrid — Day 4', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:madrid-3', 'vlog', 'Madrid — 3. dan', 'Madrid — Day 3', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:madrid-2', 'vlog', 'Madrid — 2. dan', 'Madrid — Day 2', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:madrid-1', 'vlog', 'Madrid — 1. dan', 'Madrid — Day 1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:malta-6', 'vlog', 'Malta — 6. dan', 'Malta — Day 6', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:malta-5', 'vlog', 'Malta — 5. dan', 'Malta — Day 5', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:malta-4', 'vlog', 'Malta — 4. dan', 'Malta — Day 4', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:malta-3', 'vlog', 'Malta — 3. dan', 'Malta — Day 3', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:malta-2', 'vlog', 'Malta — 2. dan', 'Malta — Day 2', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('vlog:malta-1', 'vlog', 'Malta — 1. dan', 'Malta — Day 1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
