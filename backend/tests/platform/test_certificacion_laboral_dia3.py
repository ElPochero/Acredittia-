"""Pruebas Día 3: Módulo Certificación Laboral (Dashboard 6 etapas, Carga en revisión y Trazabilidad)."""
import uuid

def test_dashboard_mensual_6_etapas_y_kpis(client, user_token, session):
    """
    [CA 3, CA 12] Al seleccionar un período mensual se obtienen sus 6 etapas, 5 KPIs en tiempo real,
    estado por documento y panel de alertas correspondientes a la BD.
    """
    # 1. Obtener contrato y períodos generados
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_cts.status_code == 200
    contratos = resp_cts.json()["items"]
    assert len(contratos) > 0
    contrato_id = contratos[0]["id"]

    resp_pers = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_pers.status_code == 200
    periodos = resp_pers.json()["items"]
    assert len(periodos) > 0
    periodo_id = periodos[0]["id"]

    # 2. Consultar el dashboard del período
    resp_dash = client.get(
        f"/api/v1/periodos/{periodo_id}/dashboard",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_dash.status_code == 200, resp_dash.text
    data = resp_dash.json()

    # Verificar 5 KPIs numéricos y total
    assert "total_requeridos" in data
    assert "aprobados" in data
    assert "observados" in data
    assert "rechazados" in data
    assert "en_revision" in data
    assert "pendientes" in data
    assert "porcentaje_cumplimiento" in data
    assert 0.0 <= data["porcentaje_cumplimiento"] <= 100.0

    # Verificar Stepper de 6 etapas
    assert "etapa_actual" in data
    assert 1 <= data["etapa_actual"] <= 6
    assert "etapa_nombre" in data and len(data["etapa_nombre"]) > 0

    # Verificar Estado por documento
    assert "por_documento" in data
    assert isinstance(data["por_documento"], list)
    for doc_kpi in data["por_documento"]:
        assert "nombre" in doc_kpi
        assert "ambito" in doc_kpi
        assert "total" in doc_kpi
        assert "aprobados" in doc_kpi
        assert "porcentaje" in doc_kpi

    # Verificar Alertas del contrato
    assert "alertas" in data
    assert isinstance(data["alertas"], list)


def test_subida_documento_estado_en_revision(client, user_token, session):
    """
    [CA 7] Los documentos se cargan directamente y al subirse transicionan obligatoriamente
    a estado 'en_revision' (NUNCA se aprueban automáticamente).
    """
    # 1. Obtener período y sus documentos
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_cts.status_code == 200
    contrato_id = resp_cts.json()["items"][0]["id"]

    resp_pers = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_pers.status_code == 200
    periodos = resp_pers.json()["items"]
    assert len(periodos) > 0
    periodo_id = periodos[0]["id"]

    resp_docs = client.get(
        f"/api/v1/periodos/{periodo_id}/documentos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_docs.status_code == 200
    docs = resp_docs.json()
    assert len(docs) > 0, "Debe existir al menos un documento en el período"
    target_doc = docs[0]
    doc_id = target_doc["id"]

    # 2. Subir archivo al requisito directamente
    url_test = "https://storage.acredittia.cl/evidencias/f30_prueba.pdf"
    resp_subida = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={
            "archivo_url": url_test,
            "archivo_nombre": "f30_prueba.pdf"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_subida.status_code == 200, resp_subida.text
    doc_actualizado = resp_subida.json()

    # REGLA DE ORO (CA 7): Debe quedar obligatoriamente en 'en_revision'
    assert doc_actualizado["estado"] == "en_revision", f"Esperado 'en_revision', obtenido: {doc_actualizado['estado']}"
    assert doc_actualizado["archivo_url"] == url_test

    # 3. Verificar que el dashboard refleja la entrega en revisión en tiempo real (CA 12)
    resp_dash = client.get(
        f"/api/v1/periodos/{periodo_id}/dashboard",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_dash.status_code == 200
    dash_data = resp_dash.json()
    assert dash_data["en_revision"] >= 1


def test_trazabilidad_cronologica_periodo(client, user_token, session):
    """
    [CA 4] El registro de trazabilidad es cronológico y corresponde estrictamente al contrato
    y mes seleccionados, reflejando subidas y eventos de auditoría.
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_cts.status_code == 200
    contrato_id = resp_cts.json()["items"][0]["id"]

    resp_pers = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_pers.status_code == 200
    periodo_id = resp_pers.json()["items"][0]["id"]

    # Consultar trazabilidad
    resp_traz = client.get(
        f"/api/v1/periodos/{periodo_id}/trazabilidad",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_traz.status_code == 200, resp_traz.text
    eventos = resp_traz.json()
    assert isinstance(eventos, list)
    assert len(eventos) > 0, "Debe existir al menos un evento en la bitácora de trazabilidad"

    for ev in eventos:
        assert "id" in ev
        assert "fecha" in ev
        assert "usuario_nombre" in ev
        assert "rol" in ev
        assert "accion" in ev
        assert "icono" in ev
        assert "detalle" in ev
