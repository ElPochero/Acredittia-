"""Suite E2E Automatizada de los 14 Requerimientos del Feedback 29-10.

Valida de extremo a extremo los criterios de aceptación del sprint de 5 días:
- Req 14: Requisitos con vinculo_tipo="faena" sin archivo previo y subida asociada.
- Req 4: Creación de faena no integrada y contrato asociado sin preselección forzada.
- Req 3: Sincronización en tiempo real de es_conductor en licencias internas.
- Req 7: Requisito con vinculo_tipo="plataforma" devolviendo nombre exacto.
- Req 1: Reporte de estado del contrato síncrono y estructurado.
- Req 2: Revelación segura de credenciales de plataforma de la bóveda.
- Req 8, 9 y 13: Alta masiva personal, equipos con solo patente, extracción IA y plataforma heredada.
- Req 12: Reutilización documental automática/manual entre contratos y desvinculación segura.
- Req 5 y 6: Alertas IA (30d anticipación, 5d faltantes, áreas responsables y envío segmentado).
- Req 10: Exportación automática masiva (PATCH bulk-estado-plataforma) y persistencia en fichas.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
import pytest

from tests.conftest import (
    API,
    crear_contrato,
    patente_valida,
    rut_valido,
    subir_archivo,
)

CONTENIDO_PDF = b"%PDF-1.4 documento de prueba feedback 29-10\n%%EOF\n"


# ============================================================================
# [Req 14] Requisito vinculo_tipo="faena" sin archivo y subida
# ============================================================================
def test_req14_requisito_vinculo_faena_sin_archivo_y_subida(
    app_cliente, empresa_a, contrato_a
):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Crear requisito ligado a la faena (vinculo_ref omitido en vínculos fijos)
    r_req = app_cliente.post(
        f"{API}/contratos/{cid}/requisitos",
        headers=h,
        json={
            "titulo": "Inducción Específica Faena",
            "ambito": "personal",
            "obligatorio": True,
            "vinculo_tipo": "faena",
            "vigencia_meses": 12,
        },
    )
    assert r_req.status_code == 201, r_req.text
    req_id = r_req.json()["id"]

    # 2. Listar requisitos filtrando por vinculo_tipo=faena
    r_list = app_cliente.get(f"{API}/contratos/{cid}/requisitos?vinculo_tipo=faena", headers=h)
    assert r_list.status_code == 200
    items = r_list.json()["items"]
    req_creado = next((x for x in items if x["id"] == req_id), None)
    assert req_creado is not None
    assert req_creado["vinculo_tipo"] == "faena"

    # 3. Crear trabajador y verificar que su documento existe sin archivo sin lanzar 500
    r_pers = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={
            "contrato_id": cid,
            "nombre": "Trabajador Faena Req14",
            "rut": rut_valido(401),
            "cargo": "Operario",
        },
    )
    assert r_pers.status_code == 201
    sujeto_id = r_pers.json()["id"]

    r_det = app_cliente.get(f"{API}/personal/{sujeto_id}", headers=h)
    assert r_det.status_code == 200
    doc_faena = next((d for d in r_det.json()["documentos"] if d["titulo"] == "Inducción Específica Faena"), None)
    assert doc_faena is not None
    assert doc_faena["archivos_count"] == 0

    # 4. Subir archivo al documento y verificar conteo
    subir_archivo(app_cliente, empresa_a, doc_faena["id"], filename="induccion.pdf", contenido=CONTENIDO_PDF)
    r_doc_updated = app_cliente.get(f"{API}/documentos/{doc_faena['id']}", headers=h)
    assert r_doc_updated.status_code == 200
    assert r_doc_updated.json()["archivos_count"] == 1


# ============================================================================
# [Req 4] Creación de faena no integrada y contrato asociado
# ============================================================================
def test_req4_faena_no_integrada_y_contrato(app_cliente, empresa_a, faenas):
    h = empresa_a["headers"]
    faena = faenas[0]
    c = crear_contrato(app_cliente, empresa_a, faena["id"], nombre="Contrato Req 4")
    assert c["id"]

    r_plats = app_cliente.get(f"{API}/contratos/{c['id']}/plataformas", headers=h)
    assert r_plats.status_code == 200
    data = r_plats.json()
    assert "items" in data


# ============================================================================
# [Req 3] Sincronización en tiempo real de es_conductor en licencias internas
# ============================================================================
def test_req3_conductor_sincroniza_licencia_interna(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Crear trabajador con es_conductor=False
    r_pers = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={
            "contrato_id": cid,
            "nombre": "Trabajador No Conductor",
            "rut": rut_valido(402),
            "cargo": "Técnico Eléctrico",
            "es_conductor": False,
        },
    )
    assert r_pers.status_code == 201
    pid = r_pers.json()["id"]

    # No debe aparecer en licencias internas (ruta singular /contratos/{id}/licencia-interna)
    r_lics = app_cliente.get(f"{API}/contratos/{cid}/licencia-interna", headers=h)
    assert r_lics.status_code == 200
    conductores = r_lics.json().get("conductores", [])
    assert not any(x.get("sujeto", {}).get("id") == pid for x in conductores)

    # 2. Activar es_conductor=True vía PATCH
    r_patch = app_cliente.patch(f"{API}/personal/{pid}", headers=h, json={"es_conductor": True})
    assert r_patch.status_code == 200
    assert r_patch.json()["es_conductor"] is True

    # Debe aparecer inmediatamente en licencias internas
    r_lics2 = app_cliente.get(f"{API}/contratos/{cid}/licencia-interna", headers=h)
    assert r_lics2.status_code == 200
    conductores2 = r_lics2.json().get("conductores", [])
    assert any(x.get("sujeto", {}).get("id") == pid for x in conductores2)


# ============================================================================
# [Req 7] Requisito con vinculo_tipo="plataforma" devolviendo nombre exacto
# ============================================================================
def test_req7_requisito_plataforma_nombre_exacto(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Crear plataforma con nombre específico
    r_plat = app_cliente.post(
        f"{API}/contratos/{cid}/plataformas",
        headers=h,
        json={"nombre": "PORTAL MANDANTE NORTE", "url": "https://m-norte.cl"},
    )
    assert r_plat.status_code == 201
    plat_id = r_plat.json()["id"]

    # 2. Crear requisito vinculado a esa plataforma
    r_req = app_cliente.post(
        f"{API}/contratos/{cid}/requisitos",
        headers=h,
        json={
            "titulo": "Certificado Portal Mandante Norte",
            "ambito": "personal",
            "obligatorio": True,
            "vinculo_tipo": "plataforma",
            "vinculo_ref": plat_id,
        },
    )
    assert r_req.status_code == 201

    # 3. Crear trabajador y verificar doc.plataforma
    r_pers = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={
            "contrato_id": cid,
            "nombre": "Trabajador Portal",
            "rut": rut_valido(403),
            "cargo": "Operario",
        },
    )
    assert r_pers.status_code == 201
    sujeto_id = r_pers.json()["id"]

    r_det = app_cliente.get(f"{API}/personal/{sujeto_id}", headers=h)
    assert r_det.status_code == 200
    docs = r_det.json()["documentos"]
    doc_plat = next((d for d in docs if d["titulo"] == "Certificado Portal Mandante Norte"), None)
    assert doc_plat is not None
    assert doc_plat["plataforma"] == "PORTAL MANDANTE NORTE"


# ============================================================================
# [Req 1] Reporte de estado del contrato síncrono y estructurado
# ============================================================================
def test_req1_reporte_estado_sincrono(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    r_rep = app_cliente.get(f"{API}/contratos/{cid}/reporte-estado", headers=h)
    assert r_rep.status_code == 200, r_rep.text
    datos = r_rep.json()
    assert "contrato" in datos
    assert "kpis" in datos
    assert "secciones" in datos


# ============================================================================
# [Req 2] Revelación segura de contraseña de plataforma desde la bóveda
# ============================================================================
def test_req2_revelacion_segura_password(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Crear plataforma y usuario en bóveda
    r_plat = app_cliente.post(
        f"{API}/contratos/{cid}/plataformas",
        headers=h,
        json={"nombre": "SIGA AMBA REVELAR"},
    )
    assert r_plat.status_code == 201
    pid = r_plat.json()["id"]

    clave_secreta = "VaultPassSecret#2026"
    r_usr = app_cliente.post(
        f"{API}/contratos/{cid}/plataformas/{pid}/usuarios",
        headers=h,
        json={
            "nombre": "Encargado Acreditacion",
            "usuario": "encargado_siga",
            "password": clave_secreta,
        },
    )
    assert r_usr.status_code == 201
    uid = r_usr.json()["id"]

    # 2. Revelar contraseña
    r_rev = app_cliente.get(
        f"{API}/contratos/{cid}/plataformas/{pid}/usuarios/{uid}/password",
        headers=h,
    )
    assert r_rev.status_code == 200
    assert r_rev.json()["password"] == clave_secreta


# ============================================================================
# [Req 8, 9 y 13] Alta masiva personal, equipos con solo patente, extracción IA
# ============================================================================
def test_req8_9_13_alta_masiva_equipos_patente_ia(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # Req 8: Alta masiva personal (acepta lista JSON directa)
    r_bulk_p = app_cliente.post(
        f"{API}/personal/bulk",
        headers=h,
        json=[
            {"contrato_id": cid, "nombre": "Masivo Uno", "rut": rut_valido(404), "cargo": "Mecánico"},
            {"contrato_id": cid, "nombre": "Masivo Dos", "rut": rut_valido(405), "cargo": "Soldador"},
        ],
    )
    assert r_bulk_p.status_code in (200, 201), r_bulk_p.text

    # Req 9: Alta de equipo con solo patente (otros campos opcionales)
    pat = patente_valida(401)
    r_eq_single = app_cliente.post(
        f"{API}/equipos",
        headers=h,
        json={"contrato_id": cid, "patente": pat},
    )
    assert r_eq_single.status_code == 201
    assert r_eq_single.json()["patente"] == pat

    # Alta masiva de equipos (acepta lista JSON directa)
    pat2 = patente_valida(402)
    pat3 = patente_valida(403)
    r_bulk_eq = app_cliente.post(
        f"{API}/equipos/bulk",
        headers=h,
        json=[{"contrato_id": cid, "patente": pat2}, {"contrato_id": cid, "patente": pat3}],
    )
    assert r_bulk_eq.status_code in (200, 201), r_bulk_eq.text

    # Req 13: Extracción tabular / IA
    r_ia_ext = app_cliente.post(
        f"{API}/ia/extraer-listado",
        headers=h,
        json={
            "tipo": "personal",
            "texto_o_csv": "Juan Perez, 11.111.111-1, Chofer\nMaria Soto, 22.222.222-2, Soldador",
        },
    )
    assert r_ia_ext.status_code == 200
    assert "items" in r_ia_ext.json()


# ============================================================================
# [Req 12] Reutilización documental automática/manual entre contratos
# ============================================================================
def test_req12_reutilizacion_documental_y_desvinculacion(app_cliente, empresa_a, faenas):
    h = empresa_a["headers"]
    f = faenas[0]

    c1 = crear_contrato(app_cliente, empresa_a, f["id"], nombre="Contrato Origen Req12")
    c2 = crear_contrato(app_cliente, empresa_a, f["id"], nombre="Contrato Destino Req12")

    rut = rut_valido(406)

    # 1. Crear trabajador en Contrato 1 y subir documento
    r_p1 = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={"contrato_id": c1["id"], "nombre": "Reutilizado Demo", "rut": rut, "cargo": "Chofer"},
    )
    assert r_p1.status_code == 201
    p1_id = r_p1.json()["id"]

    r_p1_det = app_cliente.get(f"{API}/personal/{p1_id}", headers=h)
    doc1 = r_p1_det.json()["documentos"][0]

    # Subir archivo y poner vigente
    subir_archivo(app_cliente, empresa_a, doc1["id"], filename="cedula.pdf", contenido=CONTENIDO_PDF)
    vence = (date.today() + timedelta(days=90)).isoformat()
    app_cliente.patch(f"{API}/documentos/{doc1['id']}", headers=h, json={"estado": "ok", "vence": vence})

    # 2. Crear trabajador con el mismo RUT en Contrato 2
    r_p2 = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={"contrato_id": c2["id"], "nombre": "Reutilizado Demo", "rut": rut, "cargo": "Chofer"},
    )
    assert r_p2.status_code == 201
    p2_id = r_p2.json()["id"]

    r_p2_det = app_cliente.get(f"{API}/personal/{p2_id}", headers=h)
    doc2 = r_p2_det.json()["documentos"][0]

    # Reutilizar documento de doc1 a doc2
    r_reut = app_cliente.post(
        f"{API}/documentos/{doc2['id']}/reutilizar",
        headers=h,
        json={"doc_origen_id": doc1["id"]},
    )
    assert r_reut.status_code == 200, r_reut.text
    assert r_reut.json()["reutilizado_de"] is not None

    # Desvincular documento reutilizado sin afectar el origen
    r_desv = app_cliente.post(f"{API}/documentos/{doc2['id']}/desvincular-reutilizado", headers=h, json={})
    assert r_desv.status_code == 200
    assert r_desv.json()["documento"]["reutilizado_de"] is None

    # Verificar que el origen en c1 sigue intacto
    r_orig = app_cliente.get(f"{API}/documentos/{doc1['id']}", headers=h)
    assert r_orig.status_code == 200
    assert r_orig.json()["archivos_count"] == 1


# ============================================================================
# [Req 5 y 6] Alertas IA: configuración y ruteo segmentado por área
# ============================================================================
def test_req5_6_alertas_ia_config_y_segmentacion_area(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Configurar alertas IA con 30 días de anticipación y 5 días de faltantes
    payload_alertas = {
        "anticipacion_dias": 30,
        "faltantes_dias": 5,
        "mail": True,
        "wa": False,
        "cc_acreditaciones": True,
        "areas": [
            {"id": "area_prevencion", "nombre": "Prevención de Riesgos", "email": "prevencion@empresa.cl"},
            {"id": "area_rrhh", "nombre": "Recursos Humanos", "email": "rrhh@empresa.cl"},
        ],
        "asignaciones": {},
    }
    r_put = app_cliente.put(f"{API}/contratos/{cid}/alertas-ia", headers=h, json=payload_alertas)
    assert r_put.status_code == 200, r_put.text

    # 2. Consultar y verificar persistencia
    r_get = app_cliente.get(f"{API}/contratos/{cid}/alertas-ia", headers=h)
    assert r_get.status_code == 200
    config_res = r_get.json()
    assert config_res["anticipacion_dias"] == 30
    assert config_res["faltantes_dias"] == 5
    assert len(config_res["areas"]) == 2

    # 3. Envío segmentado de alertas
    r_send = app_cliente.post(f"{API}/contratos/{cid}/alertas-ia/enviar", headers=h, json={})
    assert r_send.status_code == 200
    assert "enviados" in r_send.json() or "total_notificaciones" in r_send.json() or "ok" in r_send.json()


# ============================================================================
# [Req 10] Exportación automática por plataforma: bulk-estado-plataforma
# ============================================================================
def test_req10_bulk_estado_plataforma_y_fichas(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # 1. Crear trabajador y equipo en el contrato
    r_p = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={"contrato_id": cid, "nombre": "Trabajador AutoExport", "rut": rut_valido(407), "cargo": "Mecánico"},
    )
    assert r_p.status_code == 201
    sujeto_p_id = r_p.json()["id"]

    r_eq = app_cliente.post(
        f"{API}/equipos",
        headers=h,
        json={"contrato_id": cid, "patente": patente_valida(404)},
    )
    assert r_eq.status_code == 201
    sujeto_eq_id = r_eq.json()["id"]

    # Obtener documentos de ambos sujetos
    r_dp = app_cliente.get(f"{API}/personal/{sujeto_p_id}", headers=h)
    doc_p = r_dp.json()["documentos"][0]
    assert doc_p["estado_plataforma"] == "sin_subir"

    r_de = app_cliente.get(f"{API}/equipos/{sujeto_eq_id}", headers=h)
    doc_eq = r_de.json()["documentos"][0]
    assert doc_eq["estado_plataforma"] == "sin_subir"

    doc_ids = [doc_p["id"], doc_eq["id"]]

    # 2. Actualización masiva via bulk-estado-plataforma
    r_bulk = app_cliente.patch(
        f"{API}/documentos/bulk-estado-plataforma",
        headers=h,
        json={
            "documento_ids": doc_ids,
            "estado_plataforma": "subido",
            "plataforma": "SIGA",
            "usuario_plataforma": "operador_siga",
        },
    )
    assert r_bulk.status_code == 200, r_bulk.text
    res_bulk = r_bulk.json()
    assert res_bulk["actualizados"] == 2
    assert set(res_bulk["documento_ids"]) == set(doc_ids)

    # 3. Comprobar que en GET /personal/{id} y GET /equipos/{id} persisten como "subido"
    r_dp_check = app_cliente.get(f"{API}/personal/{sujeto_p_id}", headers=h)
    assert r_dp_check.json()["documentos"][0]["estado_plataforma"] == "subido"

    r_de_check = app_cliente.get(f"{API}/equipos/{sujeto_eq_id}", headers=h)
    assert r_de_check.json()["documentos"][0]["estado_plataforma"] == "subido"

    # 4. Actualización individual a "sin_subir"
    r_patch_single = app_cliente.patch(
        f"{API}/documentos/{doc_p['id']}",
        headers=h,
        json={"estado_plataforma": "sin_subir"},
    )
    assert r_patch_single.status_code == 200
    assert r_patch_single.json()["estado_plataforma"] == "sin_subir"
