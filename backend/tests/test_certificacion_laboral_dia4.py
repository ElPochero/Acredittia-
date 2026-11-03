"""Pruebas Día 4: Circuito RR.HH. ↔ ADC, Versionado, Revisión ADC y Cierre de Período."""
import uuid

def test_versionado_entregas_subida_y_correccion(client, user_token, session):
    """
    [CA 9] El perfil RR.HH. puede subir archivos por requisito, ver observaciones del ADC
    y enviar una nueva versión corregida (v2) sin sobrescribir la versión observada anterior.
    """
    # 1. Obtener contrato y período
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_cts.status_code == 200
    contrato_id = resp_cts.json()["items"][0]["id"]

    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_pers.status_code == 200
    periodos = resp_pers.json()["items"]
    assert len(periodos) > 0
    periodo_id = periodos[0]["id"]

    resp_docs = client.get(f"/api/v1/periodos/{periodo_id}/documentos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_docs.status_code == 200
    docs = resp_docs.json()
    assert len(docs) > 0
    doc_id = docs[0]["id"]

    # 2. Carga versión 1 por RR.HH.
    resp_v1 = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/f30_v1.pdf", "archivo_nombre": "f30_v1.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_v1.status_code == 200
    doc_v1 = resp_v1.json()
    assert doc_v1["estado"] == "en_revision"

    # Verificar que existe v1
    resp_vers = client.get(f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/versiones", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_vers.status_code == 200
    versiones = resp_vers.json()
    assert len(versiones) == 1
    assert versiones[0]["version"] == 1
    assert versiones[0]["archivo_url"] == "https://storage.acredittia.cl/f30_v1.pdf"

    # 3. Reemplazo antes de que el ADC lo abra: debe mantenerse en versión 1
    resp_v1_rep = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/f30_v1_reemplazo.pdf", "archivo_nombre": "f30_v1_reemplazo.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_v1_rep.status_code == 200
    resp_vers_rep = client.get(f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/versiones", headers={"Authorization": f"Bearer {user_token}"})
    vers_rep = resp_vers_rep.json()
    assert len(vers_rep) == 1
    assert vers_rep[0]["version"] == 1
    assert vers_rep[0]["archivo_url"] == "https://storage.acredittia.cl/f30_v1_reemplazo.pdf"

    # 4. ADC observa el documento con comentario obligatorio (Sección 4.2)
    resp_obs = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "observar", "comentario": "Falta firma del representante legal en página 2"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_obs.status_code == 200
    assert resp_obs.json()["estado"] == "observado"

    # 5. RR.HH. sube corrección: DEBE generar versión 2 sin borrar v1
    resp_v2 = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/f30_v2_firmado.pdf", "archivo_nombre": "f30_v2_firmado.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_v2.status_code == 200
    doc_v2 = resp_v2.json()
    assert doc_v2["estado"] == "en_revision"

    # Verificar historial completo de versiones (v1 y v2 intactas con la observación histórica en v1)
    resp_vers2 = client.get(f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/versiones", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_vers2.status_code == 200
    vers_final = resp_vers2.json()
    assert len(vers_final) == 2
    # Ordenadas desc por versión
    assert vers_final[0]["version"] == 2
    assert vers_final[0]["estado"] == "en_revision"
    assert vers_final[0]["archivo_url"] == "https://storage.acredittia.cl/f30_v2_firmado.pdf"

    assert vers_final[1]["version"] == 1
    assert vers_final[1]["estado"] == "observado"
    assert "Falta firma" in vers_final[1]["observacion"]


def test_revision_adc_comentario_obligatorio_y_bandeja(client, user_token, session):
    """
    [CA 10, CA 11] Cada entrega en revisión aparece para el ADC.
    Para observar o rechazar exige comentario obligatorio (422 si falta).
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]
    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    periodo_id = resp_pers.json()["items"][0]["id"]

    resp_docs = client.get(f"/api/v1/periodos/{periodo_id}/documentos", headers={"Authorization": f"Bearer {user_token}"})
    docs = resp_docs.json()
    doc_id = docs[0]["id"]

    # Subir entrega
    client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/lre.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )

    # 1. Intentar observar SIN comentario -> Debe retornar 422
    resp_bad = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "observar", "comentario": ""},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_bad.status_code == 422, f"Esperado 422, obtenido: {resp_bad.status_code}"

    # 2. Intentar rechazar con espacios en blanco -> Debe retornar 422
    resp_bad2 = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "rechazar", "comentario": "   "},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_bad2.status_code == 422

    # 3. Aprobar con éxito
    resp_ok = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "aprobar", "comentario": "Conforme a la normativa laboral"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_ok.status_code == 200
    assert resp_ok.json()["estado"] == "aprobado"


def test_cierre_periodo_inmutable_al_100_pct(client, user_token, session):
    """
    [CA 12] El botón de cierre de período sólo permite cerrar cuando el cumplimiento alcanza 100%,
    y una vez cerrado bloquea nuevas cargas o ediciones (400 Bad Request).
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]
    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    periodo_id = resp_pers.json()["items"][0]["id"]

    # 1. Intentar cerrar cuando NO está al 100% -> Debe fallar con 400
    resp_cerrar_fail = client.post(
        f"/api/v1/periodos/{periodo_id}/cerrar",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_cerrar_fail.status_code == 400, resp_cerrar_fail.text
    err_json = resp_cerrar_fail.json()
    err_code = err_json.get("error", {}).get("code") or err_json.get("detail", {}).get("code") or err_json.get("code") or ""
    assert "CUMPLIMIENTO_INCOMPLETO" in err_code

    # 2. Dictaminar todos los requisitos del período a 'aprobado' o 'no_aplica'
    resp_docs = client.get(f"/api/v1/periodos/{periodo_id}/documentos", headers={"Authorization": f"Bearer {user_token}"})
    for d in resp_docs.json():
        r = client.post(
            f"/api/v1/periodos/{periodo_id}/documentos/{d['id']}/revisar",
            json={"accion": "aprobar", "comentario": "Validado 100%"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200

    # 3. Ahora que el cumplimiento es 100%, cerrar el período
    resp_cerrar = client.post(
        f"/api/v1/periodos/{periodo_id}/cerrar",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_cerrar.status_code == 200, resp_cerrar.text
    data_cierre = resp_cerrar.json()
    assert data_cierre["estado"] == "cerrado"
    assert data_cierre["porcentaje_cumplimiento"] == 100.0

    # 4. REGLA DE INMUTABILIDAD: Intentar subir un nuevo archivo a un período cerrado -> Debe fallar con 400
    doc_id = resp_docs.json()[0]["id"]
    resp_subir_bloqueado = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/intento_post_cierre.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_subir_bloqueado.status_code == 400
    err_subir = resp_subir_bloqueado.json()
    err_subir_code = err_subir.get("error", {}).get("code") or err_subir.get("detail", {}).get("code") or err_subir.get("code") or ""
    assert "PERIODO_CERRADO" in err_subir_code


def test_bandeja_mis_pendientes_rrhh(client, user_token, session):
    """
    [CA 9, Sección 3.4] Verifica la consulta de la bandeja consolidada Mis Pendientes para RR.HH.
    """
    resp = client.get(
        "/api/v1/certificacion-laboral/mis-pendientes",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "observados_rechazados" in data
    assert "pendientes_carga" in data
    assert "periodos_proximos" in data
    assert "total_pendientes" in data
    assert isinstance(data["observados_rechazados"], list)
    assert isinstance(data["pendientes_carga"], list)
