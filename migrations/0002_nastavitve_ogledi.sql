-- Nastavitve nadzora, želje članov, zadržana obvestila, ogledi vlogov,
-- vlogi z YouTuba, ki jih doda stran sama, in dnevna statistika obiskov.
-- Uporabi: npx wrangler d1 migrations apply wayfare-clani --local (doma) / --remote

-- Nastavitve, ki jih admin spreminja v nadzoru (ključ → vrednost kot besedilo).
-- Manjkajoč ključ pomeni privzeto vrednost iz zaledje/nastavitve.js.
CREATE TABLE nastavitve (
  kljuc TEXT PRIMARY KEY,
  vrednost TEXT NOT NULL,
  spremenjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Želje člana: jezik pošte, ki ga je izbral sam (prijava ga potem ne
-- spreminja), in katera obvestila hoče.
ALTER TABLE clani ADD COLUMN jezik_rocno INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clani ADD COLUMN zeli_vlogi INTEGER NOT NULL DEFAULT 1;
ALTER TABLE clani ADD COLUMN zeli_izdaje INTEGER NOT NULL DEFAULT 1;
ALTER TABLE clani ADD COLUMN zeli_novice INTEGER NOT NULL DEFAULT 1;

-- Zadržano obvestilo čaka, da ga admin pošlje (1) ali zavrže (2), kadar so
-- samodejna obvestila za to vrsto izklopljena.
ALTER TABLE poslano ADD COLUMN zadrzano INTEGER NOT NULL DEFAULT 0;

-- Ogledi vlogov: kdo (prijavljen član) ali koliko (gost, brez člana) je
-- začel predvajati film. Član se šteje enkrat na film na dan.
CREATE TABLE ogledi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oznaka TEXT NOT NULL,
  clan_id INTEGER REFERENCES clani (id) ON DELETE CASCADE,
  dan TEXT NOT NULL,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX ogledi_clan_dan ON ogledi (oznaka, clan_id, dan) WHERE clan_id IS NOT NULL;
CREATE INDEX ogledi_oznaka ON ogledi (oznaka);
CREATE INDEX ogledi_clan ON ogledi (clan_id);

-- Vlogi z YouTuba, ki jih stran doda sama (GitHub Actions, vlogi/samodejno.py):
-- caka → v_delu → dodan (ali napaka). Vnese jih admin v nadzoru ali jih
-- najde vir javnih videov kanala.
CREATE TABLE youtube (
  id TEXT PRIMARY KEY,
  naslov_sl TEXT NOT NULL,
  naslov_en TEXT NOT NULL,
  kraj_sl TEXT NOT NULL,
  kraj_en TEXT NOT NULL,
  lon REAL,
  lat REAL,
  datum TEXT,
  oznaka TEXT,
  vir TEXT NOT NULL DEFAULT 'nadzor' CHECK (vir IN ('nadzor', 'kanal')),
  stanje TEXT NOT NULL DEFAULT 'caka' CHECK (stanje IN ('caka', 'v_delu', 'dodan', 'napaka')),
  napaka TEXT,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  obdelano_at TEXT
);

-- Dnevna števila brez podatkov o osebah: obiski gostov in članov.
CREATE TABLE statistika (
  dan TEXT NOT NULL,
  kljuc TEXT NOT NULL,
  stevilo INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dan, kljuc)
);

-- Rim in Budimpešta sta bila dodana po prvi migraciji: obvestila so že šla.
INSERT OR IGNORE INTO poslano (kljuc, vrsta, naslov_sl, naslov_en, poslano_at) VALUES
  ('vlog:budimpesta-1', 'vlog', 'Budimpešta — 1. dan', 'Budapest — Day 1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
