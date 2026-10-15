// Wayfare Spremljevalec: oznake trenutkov in glasovni zapiski z izleta.
// Vse ostane na telefonu (IndexedDB), dokler uporabnik datoteke .wayfare ne
// poslje na Mac; tam jo uvozi Wayfare Studio (wayfare/telefon.py).
'use strict';

const BESEDILA = {
  sl: {naslov: 'Spremljevalec', oznaci: 'Označi trenutek',
    oznaci_opis: 'Kar je bilo dobro. Studio ga najde v posnetkih.',
    zapisek: 'Glasovni zapisek', zapisek_opis: 'Povej, kaj se je zgodilo. Doma je za pripoved.',
    snemam: 'Snemam … tapni za konec', opomba_ph: 'Opomba (neobvezno)', shrani: 'Shrani',
    danes: 'Danes', starejse: 'Še ni poslano', prazno: 'Še nič. Med potjo tapni zvezdico, ko se zgodi kaj dobrega.',
    poslji: 'Pošlji na Mac', kako: 'Pošlje datoteko (AirDrop, Datoteke). Na Macu jo povleci v projekt dneva v Wayfare Studiu. Nič ne gre na splet.',
    gps: 'Shrani kraj (GPS)', pocisti: 'Pobriši poslane', oznaceno: 'Označeno ob {u}',
    shranjeno: 'Zapisek shranjen ({s} s)', brez_mikrofona: 'Mikrofon ni dovoljen. Dovoli ga v nastavitvah brskalnika.',
    nic: 'Ni ničesar za pošiljanje.', poslano: 'Poslano: {n}', izbrisi: 'Izbrišem to oznako?',
    pobrisi: 'Pobrišem vse poslane oznake?', zapisek_kratko: 'zapisek', brez_opombe: 'brez opombe',
    predvajaj: 'Predvajaj', uredi: 'Opomba', odstrani: 'Izbriši', prenos: 'Datoteka je v Prenosih. Pošlji jo na Mac.'},
  en: {naslov: 'Companion', oznaci: 'Mark the moment',
    oznaci_opis: 'Something good just happened. The Studio finds it in your clips.',
    zapisek: 'Voice note', zapisek_opis: 'Say what happened. At home it is ready for voice-over.',
    snemam: 'Recording … tap to stop', opomba_ph: 'Note (optional)', shrani: 'Save',
    danes: 'Today', starejse: 'Not sent yet', prazno: 'Nothing yet. Tap the star when something good happens.',
    poslji: 'Send to Mac', kako: 'Sends a file (AirDrop, Files). On the Mac drop it into the day’s project in Wayfare Studio. Nothing goes online.',
    gps: 'Save the place (GPS)', pocisti: 'Delete sent', oznaceno: 'Marked at {u}',
    shranjeno: 'Voice note saved ({s} s)', brez_mikrofona: 'Microphone not allowed. Allow it in the browser settings.',
    nic: 'Nothing to send.', poslano: 'Sent: {n}', izbrisi: 'Delete this mark?',
    pobrisi: 'Delete all sent marks?', zapisek_kratko: 'voice note', brez_opombe: 'no note',
    predvajaj: 'Play', uredi: 'Note', odstrani: 'Delete', prenos: 'The file is in Downloads. Send it to the Mac.'},
};
const JEZIK = (navigator.language || 'en').toLowerCase().startsWith('sl') ? 'sl' : 'en';
const T = (k, p) => (BESEDILA[JEZIK][k] || k).replace(/\{(\w+)\}/g, (_, x) => (p || {})[x] ?? '');
const $ = s => document.querySelector(s);
document.documentElement.lang = JEZIK;
document.querySelectorAll('[data-t]').forEach(e => { e.textContent = T(e.dataset.t); });
document.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = T(e.dataset.tp); });
const datum = new Date();
$('#dan').textContent = datum.toLocaleDateString(JEZIK === 'sl' ? 'sl-SI' : 'en-GB',
  {weekday: 'long', day: 'numeric', month: 'long'});

// ---------- shramba ----------
let baza;
function odpriBazo() {
  return new Promise((ok, ne) => {
    const z = indexedDB.open('wayfare-spremljevalec', 1);
    z.onupgradeneeded = () => z.result.createObjectStore('oznake', {keyPath: 'id', autoIncrement: true});
    z.onsuccess = () => ok(z.result);
    z.onerror = () => ne(z.error);
  });
}
function shramba(nacin) { return baza.transaction('oznake', nacin).objectStore('oznake'); }
const zahtevaj = z => new Promise((ok, ne) => { z.onsuccess = () => ok(z.result); z.onerror = () => ne(z.error); });
const vse = () => zahtevaj(shramba('readonly').getAll());
const shrani = o => zahtevaj(shramba('readwrite').put(o));
const izbrisi = id => zahtevaj(shramba('readwrite').delete(id));

// ---------- obvestilo ----------
let casObvestila = 0;
function obvesti(b) {
  const e = $('#obvestilo');
  e.textContent = b; e.classList.add('vidno');
  clearTimeout(casObvestila); casObvestila = setTimeout(() => e.classList.remove('vidno'), 2600);
}
const ura = ms => new Date(ms).toLocaleTimeString(JEZIK === 'sl' ? 'sl-SI' : 'en-GB', {hour: '2-digit', minute: '2-digit'});

// ---------- GPS ----------
const GPS_KLJUC = 'wayfare.gps';
let gpsVklopljen = false;
try { gpsVklopljen = localStorage.getItem(GPS_KLJUC) === '1'; } catch (e) {}
$('#gps').checked = gpsVklopljen;
$('#gps').onchange = e => {
  gpsVklopljen = e.target.checked;
  try { localStorage.setItem(GPS_KLJUC, gpsVklopljen ? '1' : '0'); } catch (x) {}
  if (gpsVklopljen) kraj().catch(() => {});
};
function kraj() {
  return new Promise((ok, ne) => {
    if (!gpsVklopljen || !navigator.geolocation) return ne(new Error('gps'));
    navigator.geolocation.getCurrentPosition(
      p => ok({lat: p.coords.latitude, lon: p.coords.longitude, natancnost: Math.round(p.coords.accuracy)}),
      ne, {enableHighAccuracy: true, timeout: 8000, maximumAge: 60000});
  });
}
async function dodajKraj(o) {
  try { Object.assign(o, await kraj()); await shrani(o); } catch (e) {}
}

// ---------- oznaka ----------
let zadnja = null;
$('#oznaci').onclick = async () => {
  const o = {cas_ms: Date.now(), zvezdica: true, opomba: '', poslano: false};
  o.id = await shrani(o);
  zadnja = o;
  if (navigator.vibrate) navigator.vibrate(25);
  obvesti(T('oznaceno', {u: ura(o.cas_ms)}));
  $('#opombaVrsta').hidden = false;
  $('#opomba').value = '';
  risi();
  dodajKraj(o);
};
async function shraniOpombo() {
  if (!zadnja) return;
  zadnja.opomba = $('#opomba').value.trim();
  await shrani(zadnja);
  $('#opombaVrsta').hidden = true;
  $('#opomba').blur();
  zadnja = null;
  risi();
}
$('#opombaOk').onclick = shraniOpombo;
$('#opomba').onkeydown = e => { if (e.key === 'Enter') shraniOpombo(); };

// ---------- glasovni zapisek ----------
let snemalnik = null, kosi = [], zacetek = 0, casovnik = 0;
function vrstaZapiska() {
  for (const v of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'])
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(v)) return v;
  return '';
}
$('#snemaj').onclick = async () => {
  if (snemalnik) { snemalnik.stop(); return; }
  let tok;
  try { tok = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch (e) { obvesti(T('brez_mikrofona')); return; }
  const vrsta = vrstaZapiska();
  snemalnik = new MediaRecorder(tok, vrsta ? {mimeType: vrsta} : {});
  kosi = []; zacetek = Date.now();
  snemalnik.ondataavailable = e => { if (e.data.size) kosi.push(e.data); };
  snemalnik.onstop = async () => {
    tok.getTracks().forEach(t => t.stop());
    clearInterval(casovnik);
    const mime = snemalnik.mimeType || vrsta || 'audio/webm';
    const blob = new Blob(kosi, {type: mime});
    const trajanje = Math.round((Date.now() - zacetek) / 1000);
    snemalnik = null;
    $('#snemaj').classList.remove('tece');
    $('#snemajNaslov').textContent = T('zapisek');
    $('#snemajOpis').textContent = T('zapisek_opis');
    if (!blob.size) return;
    const o = {cas_ms: zacetek, zvezdica: true, opomba: '', poslano: false, zapisek: blob, mime, trajanje};
    o.id = await shrani(o);
    obvesti(T('shranjeno', {s: trajanje}));
    risi();
    dodajKraj(o);
  };
  snemalnik.start(1000);
  $('#snemaj').classList.add('tece');
  $('#snemajNaslov').textContent = T('snemam');
  casovnik = setInterval(() => {
    const s = Math.round((Date.now() - zacetek) / 1000);
    $('#snemajOpis').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= 300) snemalnik && snemalnik.stop();
  }, 250);
};

// ---------- seznam ----------
async function risi() {
  const vsi = (await vse()).sort((a, b) => b.cas_ms - a.cas_ms);
  const danes = new Date(); danes.setHours(0, 0, 0, 0);
  const prikaz = vsi.filter(o => o.cas_ms >= danes.getTime() || !o.poslano);
  $('#naslovSeznama').textContent = prikaz.some(o => o.cas_ms < danes.getTime()) ? T('starejse') : T('danes');
  $('#prazno').hidden = prikaz.length > 0;
  $('#poslji').disabled = !vsi.some(o => !o.poslano);
  $('#pocisti').hidden = !vsi.some(o => o.poslano);
  const ul = $('#seznam');
  ul.textContent = '';
  for (const o of prikaz) {
    const li = document.createElement('li');
    if (o.poslano) li.className = 'poslano';
    const u = document.createElement('span'); u.className = 'ura'; u.textContent = ura(o.cas_ms);
    const v = document.createElement('span'); v.className = 'vrsta'; v.textContent = o.zapisek ? '●' : '★';
    v.style.color = o.zapisek ? 'var(--rdeca)' : 'var(--zvezda)';
    const op = document.createElement('span');
    op.className = 'opomba' + (o.opomba ? '' : ' prazna');
    op.textContent = o.opomba || (o.zapisek ? `${T('zapisek_kratko')} · ${o.trajanje || 0} s` : T('brez_opombe'));
    li.append(u, v, op);
    if (o.zapisek) {
      const p = document.createElement('button'); p.textContent = '▶'; p.setAttribute('aria-label', T('predvajaj'));
      p.onclick = () => { const a = new Audio(URL.createObjectURL(o.zapisek)); a.play().catch(() => {}); };
      li.append(p);
    }
    const ur = document.createElement('button'); ur.textContent = '✎'; ur.setAttribute('aria-label', T('uredi'));
    ur.onclick = async () => {
      const nova = prompt(T('opomba_ph'), o.opomba || '');
      if (nova === null) return;
      o.opomba = nova.trim().slice(0, 300); await shrani(o); risi();
    };
    const x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label', T('odstrani'));
    x.onclick = async () => { if (confirm(T('izbrisi'))) { await izbrisi(o.id); risi(); } };
    li.append(ur, x);
    ul.append(li);
  }
}

// ---------- posiljanje ----------
const vBase64 = blob => new Promise((ok, ne) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => ne(r.error);
  r.readAsDataURL(blob);
});
$('#poslji').onclick = async () => {
  const neposlane = (await vse()).filter(o => !o.poslano).sort((a, b) => a.cas_ms - b.cas_ms);
  if (!neposlane.length) { obvesti(T('nic')); return; }
  const oznake = [];
  for (const o of neposlane) {
    const z = {cas_ms: o.cas_ms, zvezdica: o.zvezdica !== false, opomba: o.opomba || ''};
    if (o.lat != null) Object.assign(z, {lat: o.lat, lon: o.lon, natancnost: o.natancnost});
    if (o.zapisek) z.zapisek = {mime: o.mime, trajanje: o.trajanje, podatki: await vBase64(o.zapisek)};
    oznake.push(z);
  }
  const vsebina = JSON.stringify({wayfare: 'spremljevalec', verzija: 1,
    ustvarjeno: new Date().toISOString(), oznake});
  const d = new Date(neposlane[0].cas_ms), z = n => String(n).padStart(2, '0');
  const ime = `wayfare-oznake-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.wayfare`;
  const datoteka = new File([vsebina], ime, {type: 'application/json'});
  let poslano = false;
  if (navigator.canShare && navigator.canShare({files: [datoteka]})) {
    try { await navigator.share({files: [datoteka], title: 'Wayfare'}); poslano = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!poslano) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(datoteka); a.download = ime;
    document.body.append(a); a.click(); a.remove();
    obvesti(T('prenos'));
    poslano = true;
  }
  for (const o of neposlane) { o.poslano = true; await shrani(o); }
  obvesti(T('poslano', {n: neposlane.length}));
  risi();
};
$('#pocisti').onclick = async () => {
  if (!confirm(T('pobrisi'))) return;
  for (const o of (await vse()).filter(x => x.poslano)) await izbrisi(o.id);
  risi();
};

// ---------- zagon ----------
(async () => {
  baza = await odpriBazo();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  risi();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
