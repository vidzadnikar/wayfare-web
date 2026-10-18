-- Različica seje: vsaka seja nosi različico člana. Izpis jo poveča, zato
-- izpis odjavi vse naprave tega člana in ukraden piškotek takoj neha veljati.
-- Obstoječe seje (brez različice v piškotku) veljajo, dokler je različica 0.
ALTER TABLE clani ADD COLUMN seja_verzija INTEGER NOT NULL DEFAULT 0;

-- Omejitve so odslej zgoščene (zaledje/clani.js, omeji); stare vrstice z
-- e-naslovi in naslovi IP v čitljivi obliki gredo stran, prav tako potečeni
-- in porabljeni žetoni (v njih je e-naslov).
DELETE FROM omejitve;
DELETE FROM zetoni WHERE potece_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now') OR porabljen_at IS NOT NULL;
