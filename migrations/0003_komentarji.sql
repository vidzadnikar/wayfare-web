-- Komentarji pod vlogi: piše jih le prijavljen član, odgovori so en nivo
-- globoko (odgovor_na kaže na komentar brez starša), všečki enkrat na člana.
-- Uporabi: npx wrangler d1 migrations apply wayfare-clani --local (doma) / --remote
CREATE TABLE komentarji (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oznaka TEXT NOT NULL,
  clan_id INTEGER NOT NULL REFERENCES clani (id) ON DELETE CASCADE,
  odgovor_na INTEGER REFERENCES komentarji (id) ON DELETE CASCADE,
  besedilo TEXT NOT NULL,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  urejeno_at TEXT
);
CREATE INDEX komentarji_oznaka ON komentarji (oznaka, ustvarjeno_at);
CREATE INDEX komentarji_odgovor ON komentarji (odgovor_na);
CREATE INDEX komentarji_clan ON komentarji (clan_id);

CREATE TABLE komentarji_vsecki (
  komentar_id INTEGER NOT NULL REFERENCES komentarji (id) ON DELETE CASCADE,
  clan_id INTEGER NOT NULL REFERENCES clani (id) ON DELETE CASCADE,
  ustvarjeno_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (komentar_id, clan_id)
);
