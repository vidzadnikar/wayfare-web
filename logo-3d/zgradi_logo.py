"""3D logotip Wayfare iz logo.svg.

Zagon (brez okna):
    "/Applications/Blender 5.2.app/Contents/MacOS/Blender" -b --factory-startup \
        --python zgradi_logo.py

Izdela:
    wayfare-logo.glb   vozlišče "Znak" — samo znak brez ploščice, za spletno stran
                       (Vid 5. 10. 2026: brez kvadrata, da razbitje bolje deluje)
    wayfare-logo.blend izvorna scena z obema različicama, "Znak" in "Ploscica"
    primerjava.png     pogled od spredaj ob Vidovem izvirniku (merilo zvestobe)

Oblike pridejo iz izočrt v logo.svg (glej Wayfare/docs/videz.md#logotip).
Ploščica je narisana točno (zaobljen kvadrat), luknja v oznaki kraja je krog,
organski obliki se zgladita, da odsevi na zaobljenih robovih tečejo mirno.
"""

import math
import os
import re
import sys

import bmesh
import bpy
import numpy as np

TU = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(TU, "..", "..", "Wayfare", "wayfare", "static", "logo", "logo.svg")
IZVIRNIK = os.path.join(TU, "..", "..", "Wayfare", "wayfare", "static", "logo", "izvirnik.png")

# viewBox ploščice: 101.78 101.71 1050.87 1050.87 — ploščica je široka 2 m
VB_X, VB_Y, VB_W = 101.78, 101.71, 1050.87
S = 2.0 / VB_W
CX, CY = VB_X + VB_W / 2, VB_Y + VB_W / 2

# Mere v pikah izvirnika (ploščica = 1050.87 px).
PLOSCICA_DEBELINA = 120.0   # 11 % širine, kot pri 3D ikonah aplikacij
PLOSCICA_ROB = 40.0         # polmer zaobljenega roba ploščice
VIJOLICNA_VISINA = 72.0     # nad ploščico
VIJOLICNA_ROB = 36.0        # poteza je široka ~100 px, vrh ostane ozek trak
TURKIZNA_VISINA = 50.0      # nižja od vijolične, da leži pod njo
TURKIZNA_ROB = 24.0         # obroč okoli luknje je na vrhu širok le 59 px
LOK_DELI = 10               # razdelki četrtine kroga na robu

# Barve Svinčnik od 21. 10. 2026 (prej #10182b, #64e2d6, #766bfb). Ključa
# »turkizna« (oznaka kraja) in »vijolicna« (V) sta ostala kot imeni oblik.
BARVE = {
    "ploscica": "#f3f1ec",
    "turkizna": "#ff453a",
    "vijolicna": "#1a1a1c",
}


# ---------------------------------------------------------------- SVG

def preberi_poti(pot):
    besedilo = open(pot, encoding="utf-8").read()
    poti = []
    for m in re.finditer(r'<path fill="(#[0-9a-fA-F]{6})"[^>]*?\sd="([^"]+)"', besedilo):
        barva, d = m.group(1).lower(), m.group(2)
        zanke = []
        for kos in re.findall(r"M([^MZ]+)Z?", d):
            st = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", kos)]
            zanke.append(np.array(st, dtype=float).reshape(-1, 2))
        poti.append((barva, zanke))
    return poti


# ---------------------------------------------------------------- 2D geometrija

def ploscina(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def v_smer(p, ccw):
    """Zanka v smeri: ccw v koordinatah z osjo y navzgor (po zrcaljenju)."""
    # V SVG gre y navzdol, zato je predznak obrnjen.
    je_ccw = ploscina(p) < 0
    return p if je_ccw == ccw else p[::-1].copy()


def catmull_rom(p, na_odsek=8, alpha=0.5):
    """Zaprta centripetalna Catmull-Rom krivulja skozi točke (brez prenihajev)."""
    n = len(p)
    izhod = []
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-6) ** alpha
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-6) ** alpha
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-6) ** alpha
        for t in np.linspace(t1, t2, na_odsek, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            izhod.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    return np.array(izhod)


def enakomerno(p, korak):
    zaprta = np.vstack([p, p[:1]])
    dolzine = np.linalg.norm(np.diff(zaprta, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(dolzine)])
    n = max(int(s[-1] / korak), 16)
    cilj = np.linspace(0, s[-1], n, endpoint=False)
    return np.column_stack([np.interp(cilj, s, zaprta[:, 0]), np.interp(cilj, s, zaprta[:, 1])])


def gauss(p, sigma):
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    izhod = np.zeros_like(p)
    for j, w in zip(range(-r, r + 1), k):
        izhod += w * np.roll(p, -j, axis=0)
    return izhod


def rdp_zaprta(p, eps):
    """Ramer–Douglas–Peucker na zaprti zanki (brez rekurzije)."""
    n = len(p)
    a = 0
    b = int(np.argmax(np.linalg.norm(p - p[a], axis=1)))
    obdrzi = np.zeros(n, dtype=bool)
    obdrzi[a] = obdrzi[b] = True
    sklad = [(a, b), (b, a + n)]
    pp = np.vstack([p, p])
    while sklad:
        i, j = sklad.pop()
        if j - i < 2:
            continue
        seg = pp[i + 1:j]
        d = pp[j] - pp[i]
        dl = np.linalg.norm(d)
        if dl < 1e-9:
            razd = np.linalg.norm(seg - pp[i], axis=1)
        else:
            razd = np.abs(d[0] * (seg[:, 1] - pp[i][1]) - d[1] * (seg[:, 0] - pp[i][0])) / dl
        k = int(np.argmax(razd))
        if razd[k] > eps:
            m = i + 1 + k
            obdrzi[m % n] = True
            sklad += [(i, m), (m, j)]
    return p[obdrzi]


def zgladi(p, korak=1.0, sigma=2.0, eps=0.12):
    gosta = enakomerno(catmull_rom(p), korak)
    return rdp_zaprta(gauss(gosta, sigma / korak), eps)


def v_poligonu(t, p):
    x, y = t
    xs, ys = p[:, 0], p[:, 1]
    x2, y2 = np.roll(xs, -1), np.roll(ys, -1)
    sek = ((ys > y) != (y2 > y)) & (x < (x2 - xs) * (y - ys) / (y2 - ys + 1e-12) + xs)
    return bool(np.count_nonzero(sek) % 2)


def razdalja_do_roba(t, p):
    a, b = p, np.roll(p, -1, axis=0)
    ab = b - a
    u = np.clip(np.einsum("ij,ij->i", t - a, ab) / np.maximum(np.einsum("ij,ij->i", ab, ab), 1e-12), 0, 1)
    return float(np.min(np.linalg.norm(a + ab * u[:, None] - t, axis=1)))


def krog_iz_tock(p):
    """Krog po najmanjših kvadratih (Kåsa)."""
    x, y = p[:, 0], p[:, 1]
    A = np.column_stack([x, y, np.ones_like(x)])
    c = np.linalg.lstsq(A, x * x + y * y, rcond=None)[0]
    cx, cy = c[0] / 2, c[1] / 2
    return cx, cy, math.sqrt(c[2] + cx * cx + cy * cy)


def krog(cx, cy, r, n=160):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    return np.column_stack([cx + r * np.cos(a), cy + r * np.sin(a)])


def zaobljen_kvadrat(x0, y0, w, r, na_vogal=72):
    tocke = []
    for (vx, vy, a0) in [(x0 + w - r, y0 + r, -90), (x0 + w - r, y0 + w - r, 0),
                         (x0 + r, y0 + w - r, 90), (x0 + r, y0 + r, 180)]:
        for a in np.linspace(a0, a0 + 90, na_vogal + 1):
            tocke.append((vx + r * math.cos(math.radians(a)), vy + r * math.sin(math.radians(a))))
    return np.array(tocke)


def polmer_vogala(p):
    """Polmer, pri katerem se zaobljen kvadrat najbolje prilega izočrti ploščice."""
    najbolje = None
    for r in np.arange(200, 280, 0.5):
        q = zaobljen_kvadrat(VB_X, VB_Y, VB_W, r, 90)
        napaka = np.sqrt(np.mean([razdalja_do_roba(t, q) ** 2 for t in p]))
        if najbolje is None or napaka < najbolje[1]:
            najbolje = (r, napaka)
    return najbolje


def turkizna_pod_vijolicno(t, v):
    """Turkizno oznako podaljša globoko pod vijolično potezo.

    V izočrti sega turkizna pod vijolično le 10 px, z ostrima konicama ob robu
    vijolične. Zaobljen rob bi ti konici prevrnil in skozi vijolično bi pogledal
    turkizni drobir. Del pod vijolično se zato nadomesti z mehkim lokom, ki leži
    globoko pod potezo — od zunaj se oblika ne spremeni.
    """
    notri = np.array([v_poligonu(q, v) and razdalja_do_roba(q, v) > 3.0 for q in t])
    if not notri.any():
        return t
    n = len(t)
    zacetki = [i for i in range(n) if notri[i] and not notri[i - 1]]
    if len(zacetki) != 1:
        raise SystemExit(f"turkizna seže pod vijolično v {len(zacetki)} kosih, pričakoval sem 1")
    i = zacetki[0]
    j = i
    while notri[j % n]:
        j += 1
    L, R = t[(i - 1) % n], t[j % n]
    tL = L - t[(i - 2) % n]
    tR = t[(j + 1) % n] - R
    tL /= np.linalg.norm(tL)
    tR /= np.linalg.norm(tR)
    k = 70.0
    c1, c2 = L + tL * k, R - tR * k
    s = np.linspace(0, 1, 48)[1:-1, None]
    lok = (1 - s) ** 3 * L + 3 * (1 - s) ** 2 * s * c1 + 3 * (1 - s) * s ** 2 * c2 + s ** 3 * R
    for q in lok[8:-8]:
        if not v_poligonu(q, v) or razdalja_do_roba(q, v) < 12:
            raise SystemExit(f"lok pod vijolično pride preblizu roba pri {q}")
    obdrzane = [t[(j + m) % n] for m in range(n - (j - i))]
    return np.vstack([np.array(obdrzane), lok])


# ---------------------------------------------------------------- Blender

def linearno(hex_barva):
    c = [int(hex_barva[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def material(ime, hex_barva, hrapavost, plast, plast_hrapavost):
    m = bpy.data.materials.new(ime)
    if m.node_tree is None:  # Blender 4.x; od 5.0 ima material vozlišča vedno
        m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    lin = linearno(hex_barva)
    bsdf.inputs["Base Color"].default_value = (*lin, 1)
    bsdf.inputs["Roughness"].default_value = hrapavost
    bsdf.inputs["Coat Weight"].default_value = plast
    bsdf.inputs["Coat Roughness"].default_value = plast_hrapavost
    m.diffuse_color = (*lin, 1)
    return m


def krivulja(ime, zanke, visina_nad, rob, z_sredina):
    """Ploska oblika z zaobljenim robom: navpična stena, nato četrt kroga do vrha.

    Krivulja je simetrična okoli z_sredina (visina_nad nad njo in enako pod njo),
    rob ostane točno na izočrti, ker odmik (offset) izniči razširitev roba.
    """
    cu = bpy.data.curves.new(ime, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    for i, zanka in enumerate(zanke):
        sp = cu.splines.new("POLY")
        sp.points.add(len(zanka) - 1)
        for k, (x, y) in enumerate(zanka):
            sp.points[k].co = ((x - CX) * S, -(y - CY) * S, 0, 1)
        sp.use_cyclic_u = True
    cu.extrude = (visina_nad - rob) * S
    cu.bevel_depth = rob * S
    cu.bevel_resolution = LOK_DELI
    cu.offset = -rob * S
    ob = bpy.data.objects.new(ime, cu)
    ob.location.z = z_sredina
    bpy.context.scene.collection.objects.link(ob)
    return ob


def v_mrezo(ob, mat):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    nemnogoterni = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    me.materials.clear()
    me.materials.append(mat)
    nov = bpy.data.objects.new(ob.name, me)
    nov.location = ob.location
    bpy.context.scene.collection.objects.link(nov)
    bpy.data.objects.remove(ob)
    if nemnogoterni:
        print(f"OPOZORILO {nov.name}: {nemnogoterni} robov ni zaprtih")
    return nov


def zdruzi(ime, deli):
    """Unija (Exact) več teles v eno zaprto mrežo; materiali ostanejo po ploskvah."""
    glavni = deli[0].copy()
    glavni.data = deli[0].data.copy()
    bpy.context.scene.collection.objects.link(glavni)
    for d in deli[1:]:
        m = glavni.modifiers.new("unija", "BOOLEAN")
        m.operation = "UNION"
        m.solver = "EXACT"
        m.material_mode = "TRANSFER"
        m.object = d
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(glavni.evaluated_get(dg))
    bpy.data.objects.remove(glavni)
    ob = bpy.data.objects.new(ime, me)
    bpy.context.scene.collection.objects.link(ob)
    # mehko senčenje, ostri le pravi koti (stik znaka s ploščico)
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(30))
    wn = ob.modifiers.new("normale", "WEIGHTED_NORMAL")
    wn.mode = "FACE_AREA"
    wn.weight = 50
    wn.keep_sharp = True
    dg = bpy.context.evaluated_depsgraph_get()
    koncna = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = koncna
    bm = bmesh.new()
    bm.from_mesh(koncna)
    odprti = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    print(f"{ime}: {len(koncna.polygons)} ploskev, {len(koncna.vertices)} oglišč, "
          f"materiali {[m.name for m in koncna.materials]}, odprtih robov {odprti}")
    return ob


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    poti = {barva: zanke for barva, zanke in preberi_poti(SVG)}
    ploscica_tocke = poti[BARVE["ploscica"]][0]
    turkizna_zanke = poti[BARVE["turkizna"]]
    vijolicna_tocke = poti[BARVE["vijolicna"]][0]

    r, napaka = polmer_vogala(ploscica_tocke)
    print(f"ploščica: polmer vogala {r:.1f} px, odstopanje od izočrte {napaka:.2f} px")
    ploscica = zaobljen_kvadrat(VB_X, VB_Y, VB_W, r)

    # luknja v oznaki kraja je krog
    zun, luknja = sorted(turkizna_zanke, key=lambda z: -abs(ploscina(z)))
    lcx, lcy, lr = krog_iz_tock(luknja)
    odst = max(abs(np.linalg.norm(luknja - [lcx, lcy], axis=1) - lr))
    print(f"luknja: krog ({lcx:.1f}, {lcy:.1f}) r {lr:.1f} px, največje odstopanje {odst:.2f} px")

    vijolicna = zgladi(vijolicna_tocke)
    turkizna = zgladi(turkizna_pod_vijolicno(zun, vijolicna_tocke))
    print(f"točk po glajenju: vijolična {len(vijolicna)}, turkizna {len(turkizna)}")

    mat_p = material("Ploscica", BARVE["ploscica"], 0.34, 1.0, 0.06)
    mat_t = material("Rdeca", BARVE["turkizna"], 0.30, 0.6, 0.10)
    mat_v = material("Grafit", BARVE["vijolicna"], 0.30, 0.6, 0.10)

    pol = PLOSCICA_DEBELINA / 2 * S
    vrh = pol  # zgornja ploskev ploščice; ploščica je središčena v z = 0

    def telo_ploscice():
        return v_mrezo(krivulja("ploscica", [v_smer(ploscica, True)],
                                PLOSCICA_DEBELINA / 2, PLOSCICA_ROB, 0.0), mat_p)

    def telo_turkizne(z):
        return v_mrezo(krivulja("turkizna", [v_smer(turkizna, True), v_smer(krog(lcx, lcy, lr), False)],
                                TURKIZNA_VISINA, TURKIZNA_ROB, z), mat_t)

    def telo_vijolicne(z):
        return v_mrezo(krivulja("vijolicna", [v_smer(vijolicna, True)],
                                VIJOLICNA_VISINA, VIJOLICNA_ROB, z), mat_v)

    # A: cela ikona — znak sedi na ploščici, spodnja polovica znaka je v ploščici
    t_ploscica, t_turk, t_vij = telo_ploscice(), telo_turkizne(vrh), telo_vijolicne(vrh)
    a = zdruzi("Ploscica", [t_ploscica, t_turk, t_vij])
    # B: samo znak — simetričen spredaj in zadaj
    t_turk_b, t_vij_b = telo_turkizne(0.0), telo_vijolicne(0.0)
    b = zdruzi("Znak", [t_vij_b, t_turk_b])
    for ob in (t_ploscica, t_turk, t_vij, t_turk_b, t_vij_b):
        bpy.data.objects.remove(ob)

    # Mera: širina ploščice mora ostati 2,000 m (rob na izočrti)
    xs = [v.co.x for v in a.data.vertices]
    print(f"širina ploščice {max(xs) - min(xs):.4f} m (pričakovano 2.0000)")

    # obraz logotipa gleda proti -Y (Blenderjev pogled od spredaj) → v glTF +Z
    for ob in (a, b):
        ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action="DESELECT")
    b.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(TU, "wayfare-logo.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    velikost = os.path.getsize(os.path.join(TU, "wayfare-logo.glb"))
    print(f"wayfare-logo.glb {velikost / 1024:.0f} kB")

    primerjava(a, b)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(TU, "wayfare-logo.blend"))


def primerjava(a, b):
    """Pogled od spredaj z enakomernimi barvami ob izvirniku in prekrito razliko."""
    sc = bpy.context.scene
    b.hide_render = True
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "FLAT"
    sc.display.shading.color_type = "MATERIAL"
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = sc.render.resolution_y = 1254
    sc.render.film_transparent = True
    cam = bpy.data.cameras.new("kamera")
    cam.type = "ORTHO"
    cam.ortho_scale = 2.0 * 1254 / VB_W
    ko = bpy.data.objects.new("kamera", cam)
    ko.location = (0, -10, 0)
    ko.rotation_euler = (math.radians(90), 0, 0)
    sc.collection.objects.link(ko)
    sc.camera = ko
    pot = os.path.join(TU, "_sprednji.png")
    sc.render.filepath = pot
    bpy.ops.render.render(write_still=True)
    b.hide_render = False

    def slika(p):
        im = bpy.data.images.load(p)
        w, h = im.size
        px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
        return px

    izv = slika(IZVIRNIK)
    rend = slika(pot)
    # razlika: kjer se alfa ali barva razlikujeta, rdeče
    raz = np.abs(izv[..., :3] - rend[..., :3]).max(axis=2)
    raz = np.maximum(raz, np.abs(izv[..., 3] - rend[..., 3]))
    prekrito = izv.copy()
    prekrito[..., :3] = 0.5 * izv[..., :3] + 0.5 * rend[..., :3]
    prekrito[..., 3] = 1
    rdece = raz > 0.25
    prekrito[rdece] = [1, 0.1, 0.1, 1]
    print(f"razlika od izvirnika: {100 * rdece.mean():.2f} % pik")
    ozadje = np.ones_like(izv)
    ozadje[..., :3] = 0.92

    def na_ozadje(p):
        a = p[..., 3:4]
        izhod = ozadje.copy()
        izhod[..., :3] = p[..., :3] * a + ozadje[..., :3] * (1 - a)
        return izhod

    vrsta = np.concatenate([na_ozadje(izv), na_ozadje(rend), prekrito], axis=1)
    h, w = vrsta.shape[:2]
    out = bpy.data.images.new("primerjava", w, h, alpha=True)
    out.pixels = vrsta.ravel()
    out.filepath_raw = os.path.join(TU, "primerjava.png")
    out.file_format = "PNG"
    out.save()
    os.remove(pot)


main()
