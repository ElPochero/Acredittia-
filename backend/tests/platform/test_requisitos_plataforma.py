"""Pruebas para [Req 7]: asignación y visualización de plataforma correcta en requisitos."""
from __future__ import annotations

import uuid
import pytest

from tests.conftest import API, rut_valido


def test_requisito_custom_asigna_y_muestra_plataforma(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Crear trabajador en el contrato
    r_pers = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={
            "contrato_id": cid,
            "nombre": "Pedro Pascal",
            "rut": rut_valido(201),
            "cargo": "Mecánico",
        },
    )
    assert r_pers.status_code == 201, r_pers.text
    sujeto_id = r_pers.json()["id"]

    # 2. Crear una plataforma custom para el contrato (META CONTRATAS)
    r_plat = app_cliente.post(
        f"{API}/contratos/{cid}/plataformas",
        headers=h,
        json={"nombre": "META CONTRATAS", "descripcion": "Plataforma Minera Meta"},
    )
    assert r_plat.status_code == 201, r_plat.text
    plat_id = r_plat.json()["id"]
    assert r_plat.json()["nombre"] == "META CONTRATAS"

    # 3. Crear requisito vinculado a META CONTRATAS con aplicar_retroactivo=true
    r_req = app_cliente.post(
        f"{API}/contratos/{cid}/requisitos?aplicar_retroactivo=true",
        headers=h,
        json={
            "ambito": "personal",
            "titulo": "Certificado Inducción Meta",
            "vinculo_tipo": "plataforma",
            "vinculo_ref": plat_id,
            "obligatorio": True,
        },
    )
    assert r_req.status_code == 201, r_req.text
    req_data = r_req.json()
    assert req_data["plataforma"] == "META CONTRATAS", f"Esperado META CONTRATAS, obtuvo {req_data.get('plataforma')}"
    assert req_data["plataforma_id"] == plat_id

    # 4. Listar requisitos del contrato
    r_list = app_cliente.get(f"{API}/contratos/{cid}/requisitos?ambito=personal&page_size=100", headers=h)
    assert r_list.status_code == 200, r_list.text
    req_encontrado = next((x for x in r_list.json()["items"] if x["titulo"] == "Certificado Inducción Meta"), None)
    assert req_encontrado is not None
    assert req_encontrado["plataforma"] == "META CONTRATAS"
    assert req_encontrado["plataforma_id"] == plat_id

    # 5. Consultar ficha del trabajador: debe tener el documento con plataforma 'META CONTRATAS'
    r_doc = app_cliente.get(f"{API}/personal/{sujeto_id}/documentos", headers=h)
    assert r_doc.status_code == 200, r_doc.text
    doc_meta = next((d for d in r_doc.json()["items"] if d["titulo"] == "Certificado Inducción Meta"), None)
    assert doc_meta is not None
    assert doc_meta["plataforma"] == "META CONTRATAS"
    assert doc_meta["plataforma_id"] == plat_id

    # 6. Consultar exportar/plataformas: debe incluir META CONTRATAS
    r_exp_plat = app_cliente.get(f"{API}/exportar/plataformas?contrato_id={cid}", headers=h)
    assert r_exp_plat.status_code == 200, r_exp_plat.text
    assert "META CONTRATAS" in r_exp_plat.json()["items"]
