"""Exportación documental en ZIP por plataforma de destino (H-20, H-29).

La promesa del módulo es que la vista previa (`/exportar/arbol`) y el ZIP
(`/exportar/zip`) salen del mismo constructor, así que se prueba que el árbol
anunciado sea exactamente el contenido del archivo, además de la estructura por
sección, el filtro de vigencia, el acotamiento por contrato y los errores.
"""
from __future__ import annotations

import io
import uuid
import zipfile
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.database import worker_session
from app.models import Documento
from tests.conftest import (API, crear_contract_admin, patente_valida,
                            rut_valido, subir_archivo)


def _pdf(texto: str) -> bytes:
    """PDF de una página, para probar la unión real."""
    fitz = pytest.importorskip("fitz")
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), texto)
    datos = doc.tobytes()
    doc.close()
    return datos


def _doc_ids(company_id: str, limite: int, **filtros) -> list[str]:
    with worker_session(is_admin=True) as db:
        docs = db.scalars(select(Documento).filter_by(
            company_id=uuid.UUID(company_id), **filtros
        ).order_by(Documento.titulo).limit(limite)).all()
        assert len(docs) == limite, f"faltan documentos para {filtros}"
        return [str(d.id) for d in docs]


def _doc_id(company_id: str, **filtros) -> str:
    return _doc_ids(company_id, 1, **filtros)[0]


def _arbol(app_cliente, empresa, **params):
    q = "&".join(f"{k}={v}" for k, v in params.items())
    r = app_cliente.get(f"{API}/exportar/arbol?{q}",
                        headers=empresa["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _zip(app_cliente, empresa, **params) -> tuple[zipfile.ZipFile, str]:
    q = "&".join(f"{k}={v}" for k, v in params.items())
    r = app_cliente.get(f"{API}/exportar/zip?{q}", headers=empresa["headers"])
    assert r.status_code == 200, r.text[:300]
    assert r.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(r.content)), r.headers["content-disposition"]


@pytest.fixture
def escenario(app_cliente, empresa_a, contrato_a) -> dict:
    """Un archivo de empresa, uno de un trabajador y dos de un equipo."""
    h = empresa_a["headers"]
    r = app_cliente.post(f"{API}/personal", headers=h, json={
        "contrato_id": contrato_a["id"], "nombre": "Juan Soto",
        "rut": rut_valido(131), "cargo": "Conductor", "es_conductor": True})
    assert r.status_code == 201, r.text
    trabajador = r.json()["id"]
    r = app_cliente.post(f"{API}/equipos", headers=h, json={
        "contrato_id": contrato_a["id"], "patente": patente_valida(51),
        "tipo_equipo": "Camión", "marca": "Volvo"})
    assert r.status_code == 201, r.text
    equipo = r.json()["id"]

    cid = empresa_a["company_id"]
    empresa_doc = _doc_id(cid, contrato_id=uuid.UUID(contrato_a["id"]),
                          sujeto_id=None)
    personal_doc = _doc_id(cid, sujeto_id=uuid.UUID(trabajador),
                           es_emsipor=False)
    equipo_doc = _doc_id(cid, sujeto_id=uuid.UUID(equipo))

    subir_archivo(app_cliente, empresa_a, empresa_doc,
                  filename="acta constitutiva.pdf")
    subir_archivo(app_cliente, empresa_a, personal_doc,
                  filename="cedula juan soto.pdf")
    for i, pagina in enumerate(("revision tecnica", "permiso de circulacion")):
        subir_archivo(app_cliente, empresa_a, equipo_doc,
                      filename=f"documento {i + 1}.pdf",
                      contenido=_pdf(pagina))
    return {"empresa_doc": empresa_doc, "personal_doc": personal_doc,
            "equipo_doc": equipo_doc, "trabajador": trabajador,
            "equipo": equipo}


# ============================================================================
# Árbol y ZIP coinciden
# ============================================================================
def test_el_zip_contiene_exactamente_lo_que_anuncia_el_arbol(
        app_cliente, empresa_a, contrato_a, escenario):
    params = {"contrato_id": contrato_a["id"], "plataforma": "SIGA",
              "incluir": "empresa,personal,equipos",
              "estructura": "empresa:sueltos,personal:carpetas,equipos:pdf"}
    arbol = _arbol(app_cliente, empresa_a, **params)

    assert arbol["nombre_zip"].endswith("_SIGA.zip"), arbol["nombre_zip"]
    assert arbol["secciones"] == [
        {"clave": "empresa", "titulo": "Empresa", "archivos": 1},
        {"clave": "personal", "titulo": "Personal", "archivos": 1},
        {"clave": "equipos", "titulo": "Equipos", "archivos": 1},
    ], arbol["secciones"]
    assert arbol["total_archivos"] == 3
    assert arbol["total_carpetas"] == 4, "Empresa + Personal + su carpeta + Equipos"
    assert arbol["truncado"] is False

    rutas = arbol["rutas"]
    assert rutas[0] == "01_Empresa/acta constitutiva.pdf"
    assert rutas[1].startswith("02_Personal/") and "Juan" in rutas[1]
    assert rutas[2].startswith("03_Equipos/") and rutas[2].endswith(".pdf")

    z, disposicion = _zip(app_cliente, empresa_a, **params)
    assert f'filename="{arbol["nombre_zip"]}"' in disposicion
    assert sorted(z.namelist()) == sorted(rutas), "el ZIP y la vista previa divergen"


def test_la_plataforma_solo_nombra_el_archivo(app_cliente, empresa_a,
                                              contrato_a, escenario):
    params = {"contrato_id": contrato_a["id"], "incluir": "personal"}
    for plataforma in ("SIGA", "DIRECTIC", "SGES", "EMSIPOR"):
        arbol = _arbol(app_cliente, empresa_a, plataforma=plataforma, **params)
        assert arbol["nombre_zip"].endswith(f"_{plataforma}.zip")
        assert arbol["total_archivos"] == 1
    arbol = _arbol(app_cliente, empresa_a, plataforma="Academia MLP", **params)
    assert arbol["nombre_zip"].endswith("_Academia-MLP.zip"), (
        "sin espacios en el nombre del archivo")


# ============================================================================
# Estructuras por sección
# ============================================================================
def test_estructura_sueltos_y_carpetas(app_cliente, empresa_a, contrato_a,
                                       escenario):
    base = {"contrato_id": contrato_a["id"], "incluir": "personal"}
    carpetas = _arbol(app_cliente, empresa_a, estructura="personal:carpetas",
                      **base)["rutas"]
    sueltos = _arbol(app_cliente, empresa_a, estructura="personal:sueltos",
                     **base)["rutas"]

    assert len(carpetas) == len(sueltos) == 1
    assert carpetas[0].count("/") == 2, "carpeta por ficha"
    assert sueltos[0].count("/") == 1, "todo directo en 02_Personal"
    assert "__" in sueltos[0], "el nombre prefija la ficha para no colisionar"


def test_modo_pdf_une_los_pdfs_de_la_ficha(app_cliente, empresa_a, contrato_a,
                                           escenario):
    params = {"contrato_id": contrato_a["id"], "incluir": "equipos",
              "estructura": "equipos:pdf"}
    arbol = _arbol(app_cliente, empresa_a, **params)
    assert arbol["total_archivos"] == 1, arbol["rutas"]

    z, _ = _zip(app_cliente, empresa_a, **params)
    assert z.namelist() == arbol["rutas"]
    fitz = pytest.importorskip("fitz")
    with fitz.open(stream=z.read(arbol["rutas"][0]), filetype="pdf") as doc:
        assert doc.page_count == 2, "se conservan las dos páginas de la ficha"


# ============================================================================
# Filtro de vigencia
# ============================================================================
def test_solo_vigentes_excluye_los_vencidos(app_cliente, empresa_a, contrato_a):
    cid = empresa_a["company_id"]
    vencido, vigente = _doc_ids(cid, 2, contrato_id=uuid.UUID(contrato_a["id"]),
                                sujeto_id=None)
    for doc_id, filename in ((vencido, "vencido.pdf"), (vigente, "vigente.pdf")):
        subir_archivo(app_cliente, empresa_a, doc_id, filename=filename)

    r = app_cliente.patch(f"{API}/documentos/{vencido}",
                          headers=empresa_a["headers"], json={
                              "estado": "ok",
                              "vence": (date.today() - timedelta(days=1)).isoformat()})
    assert r.status_code == 200, r.text
    assert r.json()["estado_calc"] == "venc"

    base = {"contrato_id": contrato_a["id"], "incluir": "empresa"}
    filtrado = _arbol(app_cliente, empresa_a, solo_vigentes="true", **base)
    completo = _arbol(app_cliente, empresa_a, solo_vigentes="false", **base)

    assert filtrado["excluidos"]["vencidos"] == 1
    assert completo["excluidos"]["vencidos"] == 0
    assert [r.endswith("vigente.pdf") for r in filtrado["rutas"]] == [True]
    assert len(completo["rutas"]) == 2


# ============================================================================
# Ámbito: contrato y empresa
# ============================================================================
def test_sin_contrato_exporta_toda_la_empresa(app_cliente, empresa_a,
                                              contrato_a, escenario):
    arbol = _arbol(app_cliente, empresa_a, incluir="personal")
    assert arbol["nombre_zip"] == "EMPRESA_SIGA.zip"
    assert arbol["total_archivos"] >= 1


def test_el_contract_admin_solo_exporta_su_contrato(app_cliente, empresa_a,
                                                    contrato_a, contrato_b,
                                                    empresa_b, escenario):
    jefe = crear_contract_admin(app_cliente, empresa_a, contrato_a["id"])
    subir_archivo(app_cliente, empresa_b, _doc_id(
        empresa_b["company_id"], contrato_id=uuid.UUID(contrato_b["id"]),
        sujeto_id=None), filename="ajeno.pdf")

    arbol = app_cliente.get(f"{API}/exportar/arbol?incluir=empresa",
                            headers=jefe["headers"])
    assert arbol.status_code == 200, arbol.text
    assert all("ajeno" not in ruta for ruta in arbol.json()["rutas"])

    r = app_cliente.get(f"{API}/exportar/zip?contrato_id={contrato_b['id']}",
                        headers=jefe["headers"])
    assert r.status_code == 404, "un contrato ajeno no existe para este rol"


# ============================================================================
# Errores documentados
# ============================================================================
@pytest.mark.parametrize("query, codigo", [
    ("incluir=empresa,inventada", "SECCION_INVALIDA"),
    ("estructura=personal:inventada", "ESTRUCTURA_INVALIDA"),
    ("estructura=inventada:carpetas", "ESTRUCTURA_INVALIDA"),
])
def test_parametros_invalidos(app_cliente, empresa_a, query, codigo):
    r = app_cliente.get(f"{API}/exportar/arbol?{query}",
                        headers=empresa_a["headers"])
    assert r.status_code == 400, r.text
    assert r.json()["error"]["code"] == codigo


def test_zip_sin_documentos_da_404(app_cliente, empresa_a, contrato_a):
    r = app_cliente.get(f"{API}/exportar/zip?contrato_id={contrato_a['id']}",
                        headers=empresa_a["headers"])
    assert r.status_code == 404, r.text[:300]
    assert r.json()["error"]["code"] == "SIN_DOCUMENTOS"
