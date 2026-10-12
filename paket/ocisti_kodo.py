"""Iz kode za javni paket odstrani komentarje in opise (docstringe).

    python3 ocisti_kodo.py <mapa>

Komentarji in opisi v Wayfare so razvojni zapiski: imena, projekti, datumi,
meritve. Za delovanje niso potrebni, zato v paket ne gredo. Koda se prepiše prek
ast (ast.unparse), ki ohrani pomen in zavrže komentarje; opis na začetku modula,
razreda ali funkcije se odstrani (prazno telo dobi `pass`).

Poganjaj z Pythonom, s katerim bo koda tekla (vgrajeni 3.12), da razčlenjevalnik
pozna vso skladnjo.
"""

import ast
import sys
from pathlib import Path


def brez_opisa(telo):
    if telo and isinstance(telo[0], ast.Expr) and isinstance(getattr(telo[0], "value", None), ast.Constant) \
            and isinstance(telo[0].value.value, str):
        telo = telo[1:]
    return telo or [ast.Pass()]


class Cistilec(ast.NodeTransformer):
    def _telo(self, vozel):
        self.generic_visit(vozel)
        vozel.body = brez_opisa(vozel.body)
        return vozel

    visit_FunctionDef = visit_AsyncFunctionDef = visit_ClassDef = _telo


def ocisti(pot: Path):
    izvor = pot.read_text(encoding="utf-8")
    drevo = ast.parse(izvor, filename=str(pot))
    drevo = Cistilec().visit(drevo)
    drevo.body = brez_opisa(drevo.body) if drevo.body else []
    ast.fix_missing_locations(drevo)
    nova = ast.unparse(drevo) + "\n"
    compile(nova, str(pot), "exec")  # mora se prevesti
    glava = izvor.split("\n", 1)[0] if izvor.startswith("#!") else None
    pot.write_text((glava + "\n" if glava else "") + nova, encoding="utf-8")


def main():
    koren = Path(sys.argv[1])
    datoteke = sorted(koren.rglob("*.py")) if koren.is_dir() else [koren]
    for p in datoteke:
        ocisti(p)
    print(f"očiščenih datotek: {len(datoteke)}")


main()
