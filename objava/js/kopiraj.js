// Gumb ob ukazu kopira ta ukaz (terminal v razdelku Claude, namestitev z enim
// ukazom, okno ob prenosu). Odložišče ima 1 s časa (v nekaterih vgrajenih
// brskalnikih obljuba nikoli ne pride); nato ukaz izbere in poskusi
// execCommand. Če ne gre ne tako, ostane ukaz izbran za ⌘C.
export async function vOdlozisce(koda) {
  try {
    await Promise.race([
      navigator.clipboard.writeText(koda.textContent.trim()),
      new Promise((_, ne) => setTimeout(() => ne(new Error("odložišče ne odgovori")), 1000)),
    ]);
    return true;
  } catch (e) {
    const izbor = getSelection();
    izbor.selectAllChildren(koda);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) {}
    if (ok) izbor.removeAllRanges();
    return ok;
  }
}

// Poveže gumbe [data-kopiraj] v korenu. `stanje` (role=status) bralniku
// zaslona pove, da je ukaz kopiran.
export function povezi(koren, stanje) {
  if (!koren) return;
  for (const gumb of koren.querySelectorAll("[data-kopiraj]")) {
    let cas;
    gumb.addEventListener("click", async () => {
      const koda = document.getElementById(gumb.dataset.za);
      if (!koda || !(await vOdlozisce(koda))) return;
      gumb.dataset.stanje = "kopirano";
      if (stanje) stanje.textContent = gumb.dataset.kopirano;
      clearTimeout(cas);
      cas = setTimeout(() => { delete gumb.dataset.stanje; if (stanje) stanje.textContent = ""; }, 2000);
    });
  }
}
