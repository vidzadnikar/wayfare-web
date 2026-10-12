"""Razbije 3D znak Wayfare na kose za učinek na spletni strani.

Zagon (po zgradi_logo.py, ki naredi wayfare-logo.blend):
    "/Applications/Blender 5.2.app/Contents/MacOS/Blender" -b wayfare-logo.blend \
        --python razbij_znak.py

Izdela wayfare-znak-kosi.glb:
    Razbitje/Znak       cel znak (prikazan, dokler je znak sestavljen)
    Razbitje/Kosi/kos_* kosi; izhodišče vsakega je v njegovem središču, prostor
                        skupine Kosi je poravnan z zaslonom (x desno, y gor, z k gledalcu)

Kosi so Voronojeve celice: semena ležijo v ravnini znaka, rahlo zamaknjena v
globino, zato so rezi skoraj pravokotni na obraz in malo nagnjeni. Vsak rez se
zapre s ploskvijo notranjosti (material Notranjost_<barva>). Zunanje ploskve
dobijo normale celega znaka, zato se sestavljeni kosi ne ločijo od celote.
"""

import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

TU = os.path.dirname(os.path.abspath(__file__))
IZHOD = os.path.join(TU, "wayfare-znak-kosi.glb")
KOSOV = 90            # približno število celic
GLOBINA_SEMEN = 0.05  # zamik semen v globino (m), nagne reze
SEME = 7              # ponovljivo razbitje
ZASUK = Matrix.Rotation(math.radians(90), 4, "X")
ZASUK3 = ZASUK.to_3x3()


def linearno(hex_barva):
    c = [int(hex_barva[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def material_notranjost(ime, hex_barva):
    m = bpy.data.materials.get(ime) or bpy.data.materials.new(ime)
    if m.node_tree is None:
        m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    lin = linearno(hex_barva)
    bsdf.inputs["Base Color"].default_value = (*lin, 1)
    bsdf.inputs["Roughness"].default_value = 0.55
    return m


def ploskev_v_odtisu(bvh, x, y):
    zad, *_ = bvh.ray_cast(Vector((x, y, 5.0)), Vector((0, 0, -1)))
    return zad is not None


def semena(bvh, xmin, xmax, ymin, ymax, ploscina):
    """Poissonovo vzorčenje v odtisu znaka (enakomerni, a naključni kosi)."""
    rnd = random.Random(SEME)
    r = math.sqrt(ploscina / (KOSOV * 1.05))
    tocke = []
    poskusi = 0
    while poskusi < 60000 and len(tocke) < KOSOV * 1.4:
        poskusi += 1
        x, y = rnd.uniform(xmin, xmax), rnd.uniform(ymin, ymax)
        if not ploskev_v_odtisu(bvh, x, y):
            continue
        if all((x - p.x) ** 2 + (y - p.y) ** 2 >= r * r for p in tocke):
            tocke.append(Vector((x, y, rnd.uniform(-GLOBINA_SEMEN, GLOBINA_SEMEN))))
    return tocke, r


def odtis_ploscina(bvh, xmin, xmax, ymin, ymax, n=220):
    dx, dy = (xmax - xmin) / n, (ymax - ymin) / n
    zadetki = sum(1 for i in range(n) for j in range(n)
                  if ploskev_v_odtisu(bvh, xmin + (i + 0.5) * dx, ymin + (j + 0.5) * dy))
    return zadetki * dx * dy


def otoki(bm):
    """Povezani deli mreže kot seznami ploskev."""
    ostale = set(bm.faces)
    deli = []
    while ostale:
        zacetek = ostale.pop()
        del_ = [zacetek]
        sklad = [zacetek]
        while sklad:
            f = sklad.pop()
            for e in f.edges:
                for g in e.link_faces:
                    if g in ostale:
                        ostale.remove(g)
                        del_.append(g)
                        sklad.append(g)
        deli.append(del_)
    return deli


def main():
    znak = bpy.data.objects["Znak"]
    for ob in list(bpy.data.objects):
        if ob is not znak:
            bpy.data.objects.remove(ob)
    znak.rotation_euler = (0, 0, 0)
    me = znak.data
    ime_mat = [m.name for m in me.materials]  # ["Vijolicna", "Turkizna"]
    barva_hex = {"Vijolicna": "#766bfb", "Turkizna": "#64e2d6"}
    notranji = [material_notranjost(f"Notranjost_{ime}", barva_hex[ime]) for ime in ime_mat]
    vsi_mat = list(me.materials) + notranji
    zunanji_n = len(ime_mat)

    # normale celega znaka za zunanje ploskve kosov
    me.calc_loop_triangles()
    tri_vert = [tuple(t.vertices) for t in me.loop_triangles]
    tri_norm = [[Vector(n) for n in t.split_normals] for t in me.loop_triangles]
    oglisca = [v.co.copy() for v in me.vertices]
    bvh_celota = BVHTree.FromPolygons(oglisca, tri_vert)

    xs = [v.x for v in oglisca]
    ys = [v.y for v in oglisca]
    xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    ploscina = odtis_ploscina(bvh_celota, xmin, xmax, ymin, ymax)
    seme, r = semena(bvh_celota, xmin, xmax, ymin, ymax, ploscina)
    print(f"odtis {ploscina:.3f} m², razmik semen {r:.3f} m, {len(seme)} semen")

    izvor = bmesh.new()
    izvor.from_mesh(me)

    def normala_celote(p):
        loc, _, idx, _ = bvh_celota.find_nearest(p)
        a, b, c = (oglisca[i] for i in tri_vert[idx])
        # baricentrične uteži točke na trikotniku
        v0, v1, v2 = b - a, c - a, loc - a
        d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
        d20, d21 = v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        wv = (d11 * d20 - d01 * d21) / den
        ww = (d00 * d21 - d01 * d20) / den
        wu = 1 - wv - ww
        n0, n1, n2 = tri_norm[idx]
        return (n0 * wu + n1 * wv + n2 * ww).normalized()

    koren = bpy.data.objects.new("Razbitje", None)
    bpy.context.scene.collection.objects.link(koren)
    kosi_skupina = bpy.data.objects.new("Kosi", None)
    bpy.context.scene.collection.objects.link(kosi_skupina)
    kosi_skupina.parent = koren
    znak.parent = koren

    st = 0
    for i, si in enumerate(seme):
        bm = izvor.copy()
        drugi = sorted((s for k, s in enumerate(seme) if k != i), key=lambda s: (s - si).length)
        for sj in drugi:
            if not bm.verts:
                break
            polmer = max((v.co - si).length for v in bm.verts)
            if (sj - si).length / 2 > polmer:
                break  # dlje od tega ravnina ne more več rezati
            n = (sj - si).normalized()
            ret = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                                         plane_co=(si + sj) / 2, plane_no=n, dist=1e-7,
                                         clear_outer=True)
            rob = [e for e in ret["geom_cut"] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary]
            if rob:
                nove = bmesh.ops.holes_fill(bm, edges=rob, sides=0)["faces"]
                for f in nove:
                    # barva notranjosti po zunanjih ploskvah ob rezu
                    glasovi = [0] * zunanji_n
                    for e in f.edges:
                        for g in e.link_faces:
                            if g is not f:
                                glasovi[g.material_index % zunanji_n] += 1
                    f.material_index = zunanji_n + max(range(zunanji_n), key=lambda k: glasovi[k])
        if not bm.faces:
            bm.free()
            continue
        for del_ in otoki(bm):
            nov = bmesh.new()
            preslikava = {}
            for f in del_:
                vs = []
                for v in f.verts:
                    if v not in preslikava:
                        preslikava[v] = nov.verts.new(v.co)
                    vs.append(preslikava[v])
                nf = nov.faces.new(vs)
                nf.material_index = f.material_index
            sredisce = sum((v.co for v in nov.verts), Vector()) / len(nov.verts)
            for v in nov.verts:
                v.co -= sredisce
            kme = bpy.data.meshes.new(f"kos_{st:03d}")
            nov.to_mesh(kme)
            nov.free()
            for m in vsi_mat:
                kme.materials.append(m)
            # normale: notranjost ravna, zunanjost kot cel znak
            normale = []
            for p in kme.polygons:
                notranja = p.material_index >= zunanji_n
                for li in p.loop_indices:
                    if notranja:
                        normale.append(p.normal.copy())
                    else:
                        v = kme.vertices[kme.loops[li].vertex_index].co + sredisce
                        normale.append(normala_celote(v))
            # obraz proti -Y (Blenderjev pogled od spredaj), v glTF proti +Z;
            # zasuk gre v mrežo, da je prostor skupine Kosi poravnan z zaslonom
            kme.transform(ZASUK)
            kme.normals_split_custom_set([ZASUK3 @ n for n in normale])
            kob = bpy.data.objects.new(f"kos_{st:03d}", kme)
            kob.location = ZASUK3 @ sredisce
            bpy.context.scene.collection.objects.link(kob)
            kob.parent = kosi_skupina
            st += 1
        bm.free()
    izvor.free()

    znak.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    ploskev = sum(len(o.data.polygons) for o in kosi_skupina.children)
    print(f"{st} kosov, {ploskev} ploskev skupaj")

    bpy.ops.object.select_all(action="DESELECT")
    for ob in [koren, kosi_skupina, znak, *kosi_skupina.children]:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=IZHOD,
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
    print(f"wayfare-znak-kosi.glb {os.path.getsize(IZHOD) / 1024:.0f} kB")


main()
