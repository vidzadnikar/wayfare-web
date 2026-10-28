// Filmi po kosih: GET /media/**/*.mp4 z glavo Range. Pages statične datoteke
// vedno vrne cele (200), Safari (tudi na iPhonu) pa film predvaja le, če strežnik
// na Range odgovori s kosom (206). Ta funkcija vzame datoteko od Pages in vrne le
// zahtevani kos; vse drugo gre naprej nespremenjeno. Katere poti sploh pridejo
// sem, določa _routes.json (zgradi.py: le filmi, slike gredo mimo funkcije).
// Filmi iz R2 za člane imajo svoj Range v functions/api/video/.

const OBSEG = /^bytes=(\d*)-(\d*)$/;

export async function onRequestGet({ request, next }) {
  const odgovor = await next();
  if (!new URL(request.url).pathname.endsWith(".mp4") || odgovor.status !== 200) {
    return odgovor;
  }
  const glave = new Headers(odgovor.headers);
  glave.set("Accept-Ranges", "bytes");
  const obseg = OBSEG.exec((request.headers.get("Range") || "").trim());
  // If-Range: kos le, če ima brskalnik isto različico datoteke, sicer cela
  const ifRange = request.headers.get("If-Range");
  if (!obseg || (ifRange && ifRange !== odgovor.headers.get("ETag"))) {
    return new Response(odgovor.body, { status: 200, headers: glave });
  }
  const vse = await odgovor.arrayBuffer();
  const velikost = vse.byteLength;
  let [, od, do_] = obseg;
  if (od === "" && do_ === "") return new Response(vse, { status: 200, headers: glave });
  if (od === "") {
    // bytes=-N: zadnjih N bajtov
    od = Math.max(velikost - Number(do_), 0);
    do_ = velikost - 1;
  } else {
    od = Number(od);
    do_ = do_ === "" ? velikost - 1 : Math.min(Number(do_), velikost - 1);
  }
  if (od >= velikost || od > do_) {
    glave.set("Content-Range", `bytes */${velikost}`);
    glave.delete("Content-Length");
    return new Response(null, { status: 416, headers: glave });
  }
  glave.set("Content-Range", `bytes ${od}-${do_}/${velikost}`);
  glave.set("Content-Length", String(do_ - od + 1));
  return new Response(vse.slice(od, do_ + 1), { status: 206, headers: glave });
}
