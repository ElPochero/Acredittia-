"""Día 2, Slice 2: multi-asignación a contratos y reutilización documental.

Feedback 17-10 puntos 1 y 2: una persona (mismo RUT normalizado) puede estar
activa en varios contratos y —al importarla— los documentos obligatorios
VIGENTES que ya tiene en otros contratos quedan ligados y validados en el
nuevo registro sin volver a subir el archivo.
"""
import pytest
from datetime import date, timedelta

from tests.conftest import API, crear_contrato, subir_archivo

CONTENIDO = b"%PDF-1.4 cedula de prueba "


@pytest.fixture
def dos_contratos(app_cliente, empresa_a, faenas):
    f = next(f for f in faenas if f["nombre"] == "Los Pelambres")
    c1 = crear_contrato(app_cliente, empresa_a, f["id"], nombre="Contrato Uno")
    c2 = crear_contrato(app_cliente, empresa_a, f["id"], nombre="Contrato Dos")
    return c1, c2


def _alta(app_cliente, empresa, contrato_id, nombre="Ana Torres",
          rut="19.112.466-9") -> dict:
    r = app_cliente.post(f"{API}/personal", headers=empresa["headers"], json={
        "contrato_id": contrato_id, "nombre": nombre, "rut": rut})
    assert r.status_code == 201, r.text
    return r.json()


def _docs(app_cliente, empresa, sujeto_id) -> list[dict]:
    r = app_cliente.get(f"{API}/personal/{sujeto_id}", headers=empresa["headers"])
    assert r.status_code == 200, r.text
    return r.json()["documentos"]


def _sdc(titulo: str) -> str:
    return titulo.lower().replace("é", "e").replace("ú", "u")


def _cedula_vigente(app_cliente, empresa, sujeto_id) -> dict:
    """Sube la cédula (u otro obligatorio si no existe) y la marca vigente.

    El revisor IA simulado es determinista por (contenido, nombre) y borra el
    archivo ante `con_errores`: se iteran variantes hasta un veredicto limpio,
    igual que hacen las bases del suite para forzar veredictos.
    """
    docs = _docs(app_cliente, empresa, sujeto_id)
    ced = next((d for d in docs if "cedula" in _sdc(d["titulo"])
                and d["obligatorio"]), None)
    if ced is None:
        ced = next(d for d in docs if d["obligatorio"])

    for i in range(30):
        salida = subir_archivo(app_cliente, empresa, ced["id"],
                               filename=f"cedula-{i}.pdf",
                               contenido=CONTENIDO + bytes([i]))
        job = salida["ia_review"]["job_id"]
        review = app_cliente.get(f"{API}/ia/revisiones/{job}",
                                 headers=empresa["headers"]).json()
        if review["resultado"] != "con_errores":
            break
    else:
        pytest.fail("la IA simulada rechazó todas las variantes del archivo")

    r = app_cliente.patch(f"{API}/documentos/{ced['id']}",
                          headers=empresa["headers"],
                          json={"estado": "ok",
                                "vence": (date.today() + timedelta(days=365)).isoformat()})
    assert r.status_code == 200, r.text
    salida = r.json()
    assert salida["archivos_count"] == 1, \
        "el documento vigente debe conservar su archivo tras la revisión IA"
    return salida


def test_importar_reutiliza_la_cedula_vigente_en_el_segundo_contrato(
        app_cliente, empresa_a, dos_contratos):
    c1, c2 = dos_contratos
    s1 = _alta(app_cliente, empresa_a, c1["id"])["id"]
    ced1 = _cedula_vigente(app_cliente, empresa_a, s1)

    r = app_cliente.post(f"{API}/contratos/{c2['id']}/personal/importar",
                         headers=empresa_a["headers"],
                         json={"sujetos_ids": [s1]})
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["importados"] == 1
    assert cuerpo["documentos_reutilizados"] >= 1

    # La persona en el contrato nuevo
    r = app_cliente.get(f"{API}/contratos/{c2['id']}/personal",
                        headers=empresa_a["headers"],
                        params={"search": "1911246"})
    filas = [x for x in r.json()["items"] if _sdc(x["nombre"]).startswith("ana")]
    assert len(filas) == 1, r.text
    s2 = filas[0]["id"]

    # La cédula del contrato 2 queda ligada y validada, SIN nueva subida
    ced2 = next(d for d in _docs(app_cliente, empresa_a, s2)
                if _sdc(d["titulo"]) == _sdc(ced1["titulo"]))
    assert ced2["estado"] == "ok"
    assert ced2["estado_calc"] in ("ok", "porvenc", "venc")
    assert ced2["vence"] == ced1["vence"]
    assert ced2["archivos_count"] == 1
    assert ced2["archivos"][0]["size_bytes"] == ced1["archivos"][0]["size_bytes"]
    # El archivo vive con otro blob_path: una copia server-side, no una subida.
    assert ced2["archivos"][0]["id"] != ced1["archivos"][0]["id"]


def test_importar_esta_persona_en_dos_contratos_es_idempotente(
        app_cliente, empresa_a, dos_contratos):
    c1, c2 = dos_contratos
    s1 = _alta(app_cliente, empresa_a, c1["id"])["id"]
    _cedula_vigente(app_cliente, empresa_a, s1)

    r = app_cliente.post(f"{API}/contratos/{c2['id']}/personal/importar",
                         headers=empresa_a["headers"], json={"sujetos_ids": [s1]})
    assert r.json()["importados"] == 1

    r = app_cliente.post(f"{API}/contratos/{c2['id']}/personal/importar",
                         headers=empresa_a["headers"], json={"sujetos_ids": [s1]})
    assert r.json()["importados"] == 0
    assert r.status_code == 200, r.text
