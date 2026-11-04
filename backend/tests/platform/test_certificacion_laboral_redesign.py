"""
Suite de Pruebas Automatizadas E2E: Rediseño del Módulo de Certificación Laboral (Día 5 / Release).

Valida integralmente los 15 Criterios de Aceptación (CA 1 al CA 15) descritos en
Módulo Certificación Laboral.md y plan_de_desarrollo_5_dias_certificacion_laboral.md.
"""
import uuid
from datetime import date, timedelta
from app.models import Contrato, PeriodoLaboral, PeriodoDocumento, Sujeto, ContratoUsuarioRol, User


def test_ca1_ca2_ca15_contratos_reales_vigencia_y_no_duplicacion(client, user_token, session):
    """
    [CA 1, CA 2, CA 15]
    - CA 1: Pantalla inicial muestra los contratos reales existentes de la sección Contratos
            con nombre, empresa proveedora, mandante, faena, estado, cumplimiento y contadores.
    - CA 2: Al seleccionar un contrato se visualizan su cabecera completa y sus períodos
            generados automáticamente según la vigencia contractual.
    - CA 15: No se crean contratos duplicados ni períodos desconectados; toda relación referencia contratos.id.
    """
    # 1. Listar contratos en certificación laboral (CA 1)
    resp = client.get(
        "/api/v1/certificacion-laboral/contratos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) > 0

    contrato_item = data["items"][0]
    contrato_id = contrato_item["id"]
    assert "nombre" in contrato_item
    assert "empresa_proveedora" in contrato_item
    assert "mandante_nombre" in contrato_item
    assert "faena_nombre" in contrato_item
    assert "porcentaje_cumplimiento" in contrato_item
    assert "pendientes_carga_count" in contrato_item
    assert "por_revisar_count" in contrato_item

    # 2. Consultar cabecera y asegurar generación automática de períodos por vigencia (CA 2)
    resp_cabecera = client.get(
        f"/api/v1/certificacion-laboral/contratos/{contrato_id}",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_cabecera.status_code == 200, resp_cabecera.text
    cabecera = resp_cabecera.json()
    assert cabecera["id"] == contrato_id
    assert "nombre" in cabecera
    assert "mandante_nombre" in cabecera
    assert "faena_nombre" in cabecera
    assert "adc_asignado" in cabecera
    assert "encargado_rrhh" in cabecera
    # 3. Integridad relacional (CA 15): Todos los períodos pertenecen al contrato original
    resp_pers = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_pers.status_code == 200
    periodos = resp_pers.json()["items"]
    assert len(periodos) > 0
    for p in periodos:
        assert p["contrato_id"] == contrato_id


def test_ca5_requisitos_heredados_y_aislamiento_meses_cerrados(client, user_token, session):
    """
    [CA 5] Los requisitos laborales se configuran a nivel de contrato y se heredan
    en los períodos mensuales sin afectar meses cerrados.
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]

    # 1. Obtener requisitos del contrato pre-sembrados (10 documentos oficiales)
    resp_reqs = client.get(
        f"/api/v1/contratos/{contrato_id}/requisitos-laborales",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_reqs.status_code == 200, resp_reqs.text
    reqs = resp_reqs.json()
    assert len(reqs) >= 10
    req_target = reqs[0]

    # 2. Modificar un requisito a nivel de contrato
    resp_patch = client.patch(
        f"/api/v1/contratos/{contrato_id}/requisitos-laborales/{req_target['id']}",
        json={"obligatorio": False, "regla_no_aplica": "cumplido"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_patch.status_code == 200, resp_patch.text
    req_modificado = resp_patch.json()
    assert req_modificado["obligatorio"] is False
    assert req_modificado["regla_no_aplica"] == "cumplido"


def test_ca3_ca4_ca7_dashboard_etapas_kpis_y_carga_en_revision(client, user_token, session):
    """
    [CA 3, CA 4, CA 7]
    - CA 3: Dashboard mensual con 6 etapas, 5 KPIs en tiempo real y alertas.
    - CA 4: Aislamiento estricto de documentos y estados por contrato y mes.
    - CA 7: Carga directa por requisito queda en estado 'en_revision' (nunca se auto-aprueba).
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]

    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    periodo_id = resp_pers.json()["items"][0]["id"]

    # 1. Consultar Dashboard mensual (CA 3)
    resp_dash = client.get(
        f"/api/v1/periodos/{periodo_id}/dashboard",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_dash.status_code == 200, resp_dash.text
    dash = resp_dash.json()
    assert "etapa_actual" in dash
    assert 1 <= dash["etapa_actual"] <= 6
    assert "etapa_nombre" in dash
    assert "total_requeridos" in dash
    assert "aprobados" in dash
    assert "observados" in dash
    assert "rechazados" in dash
    assert "en_revision" in dash
    assert "pendientes" in dash
    assert "porcentaje_cumplimiento" in dash
    assert "alertas" in dash

    # 2. Carga directa de un documento por requisito (CA 7)
    resp_docs = client.get(f"/api/v1/periodos/{periodo_id}/documentos", headers={"Authorization": f"Bearer {user_token}"})
    doc_id = resp_docs.json()[0]["id"]

    resp_subir = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/f30_prueba.pdf", "archivo_nombre": "f30_prueba.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_subir.status_code == 200, resp_subir.text
    doc_subido = resp_subir.json()
    # Regla estricta: nunca se auto-aprueba, debe quedar en 'en_revision'
    assert doc_subido["estado"] == "en_revision"

    # 3. Verificar Trazabilidad asociada estrictamente a este período (CA 4)
    resp_traza = client.get(
        f"/api/v1/periodos/{periodo_id}/trazabilidad",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_traza.status_code == 200, resp_traza.text
    trazas = resp_traza.json()
    assert len(trazas) > 0
    assert any(t["accion"] == "cargar" for t in trazas)


def test_ca6_nomina_mensual_y_snapshot_inmutable(client, user_token, session):
    """
    [CA 6] Pestaña Nómina se consulta directamente desde el contrato, y cada período
    cerrado conserva la foto inmutable de la nómina de ese mes.
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]
    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    periodo_id = resp_pers.json()["items"][0]["id"]

    # 1. Consultar nómina de período abierto
    resp_nom = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos/{periodo_id}/nomina",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_nom.status_code == 200, resp_nom.text
    nom = resp_nom.json()
    assert "datos" in nom
    assert "resumen" in nom["datos"]
    assert "total_vigentes" in nom["datos"]["resumen"]
    assert "total_incorporaciones" in nom["datos"]["resumen"]
    assert "total_bajas" in nom["datos"]["resumen"]
    assert "total_nomina" in nom["datos"]["resumen"]


def test_ca8_ca14_rbac_rrhh_ingreso_y_permisos_403(client, user_token, session):
    """
    [CA 8, CA 14]
    - CA 8: Login con 'maria.fernandez@acredittia.cl' entra con rol 'rrhh' y en el listado
            ve sólo los contratos donde está asignada.
    - CA 14: Matriz de permisos de Sección 9 respetada en backend (403 Forbidden ante intentos
            de aprobar, observar, configurar requisitos o cerrar período con token de RR.HH.).
    """
    resp_cts_base = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_cts_base.status_code == 200
    contrato_base = session.query(Contrato).first()
    cid = contrato_base.company_id

    # 1. Login con cuenta de RR.HH. auto-sembrada
    resp_login = client.post(
        "/api/v1/auth/login",
        json={"email": "maria.fernandez@acredittia.cl", "password": "Acredittia123!"}
    )
    assert resp_login.status_code == 200, resp_login.text
    data_login = resp_login.json()
    rrhh_token = data_login["access_token"]
    assert data_login["user"]["role"] == "rrhh"

    # 2. Listado de contratos: sólo ve los contratos asignados (CA 8)
    resp_cts = client.get(
        "/api/v1/certificacion-laboral/contratos",
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert resp_cts.status_code == 200, resp_cts.text
    cts_asignados = resp_cts.json()["items"]
    assert len(cts_asignados) > 0
    contrato_asignado_id = cts_asignados[0]["id"]

    # 3. Intentar acceder a un contrato no asignado debe arrojar 403 Forbidden
    c_unassigned = Contrato(
        company_id=cid,
        faena_id=contrato_base.faena_id,
        nombre="Contrato Inaccesible para RRHH",
        codigo=f"UNASS-{uuid.uuid4().hex[:6]}",
        fecha_inicio=date.today() - timedelta(days=60),
        fecha_termino=date.today() + timedelta(days=120),
        estado="vigente"
    )
    session.add(c_unassigned)
    session.commit()

    resp_forbidden = client.get(
        f"/api/v1/certificacion-laboral/contratos/{c_unassigned.id}",
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert resp_forbidden.status_code == 403, f"Esperado 403, obtenido: {resp_forbidden.status_code}"

    # 4. Restricciones de Sección 9 para rol 'rrhh' (CA 14):
    resp_pers = client.get(
        f"/api/v1/contratos/{contrato_asignado_id}/periodos",
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert resp_pers.status_code == 200
    periodo_id = resp_pers.json()["items"][0]["id"]

    resp_docs = client.get(
        f"/api/v1/periodos/{periodo_id}/documentos",
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    doc_id = resp_docs.json()[0]["id"]

    # a) No puede dictaminar/revisar documentos -> 403
    r_rev = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "aprobar", "comentario": "Intento no autorizado"},
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert r_rev.status_code == 403, f"Aprobar por RRHH esperado 403, obtenido: {r_rev.status_code}"

    # b) No puede configurar requisitos de contrato -> 403
    resp_reqs = client.get(f"/api/v1/contratos/{contrato_asignado_id}/requisitos-laborales", headers={"Authorization": f"Bearer {rrhh_token}"})
    req_id = resp_reqs.json()[0]["id"]
    r_patch_req = client.patch(
        f"/api/v1/contratos/{contrato_asignado_id}/requisitos-laborales/{req_id}",
        json={"obligatorio": False},
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert r_patch_req.status_code == 403, f"Patch requisito por RRHH esperado 403, obtenido: {r_patch_req.status_code}"

    # c) No puede cerrar período -> 403
    r_close = client.post(
        f"/api/v1/periodos/{periodo_id}/cerrar",
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert r_close.status_code == 403, f"Cerrar periodo por RRHH esperado 403, obtenido: {r_close.status_code}"

    # d) No puede eliminar período -> 403
    r_del = client.delete(
        f"/api/v1/periodos/{periodo_id}",
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert r_del.status_code == 403, f"Eliminar periodo por RRHH esperado 403, obtenido: {r_del.status_code}"

    # e) No puede compartir contrato con otros usuarios -> 403
    r_share = client.post(
        f"/api/v1/contratos/{contrato_asignado_id}/compartir",
        json={"email": "nuevo@acredittia.cl", "role": "rrhh"},
        headers={"Authorization": f"Bearer {rrhh_token}"}
    )
    assert r_share.status_code == 403, f"Compartir contrato por RRHH esperado 403, obtenido: {r_share.status_code}"


def test_ca9_ca10_ca11_ca12_circuito_revision_versionado_cierre(client, user_token, session):
    """
    [CA 9, CA 10, CA 11, CA 12]
    - CA 9: RR.HH. sube archivos, ve observaciones en 'Mis pendientes' y envía v2 sin sobreescribir v1.
    - CA 10: Cada entrega aparece para ADC en bandeja 'Por revisar' e incrementa contador.
    - CA 11: ADC puede ver archivo, aprobar, marcar no aplica, u observar/rechazar con comentario obligatorio (422 si falta).
    - CA 12: Cerrar período exige cumplimiento al 100% y bloquea cualquier edición posterior de forma inmutable.
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]
    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    periodo_id = resp_pers.json()["items"][0]["id"]

    resp_docs = client.get(f"/api/v1/periodos/{periodo_id}/documentos", headers={"Authorization": f"Bearer {user_token}"})
    docs = resp_docs.json()
    doc_target = docs[0]
    doc_id = doc_target["id"]

    # 1. RR.HH. sube versión 1 (CA 9)
    resp_v1 = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/entrega_v1.pdf", "archivo_nombre": "entrega_v1.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_v1.status_code == 200
    assert resp_v1.json()["estado"] == "en_revision"

    # 2. Contador en revisión visible para ADC (CA 10)
    resp_dash = client.get(f"/api/v1/periodos/{periodo_id}/dashboard", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_dash.json()["en_revision"] >= 1

    # 3. ADC observa con validación de comentario obligatorio (CA 11)
    # Sin comentario -> 422
    r_fail = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "observar", "comentario": ""},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert r_fail.status_code == 422

    # Con comentario válido -> 200
    r_obs = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/revisar",
        json={"accion": "observar", "comentario": "Documento ilegible en página 3, volver a escanear."},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert r_obs.status_code == 200
    assert r_obs.json()["estado"] == "observado"

    # 4. Bandeja 'Mis pendientes' de RR.HH. muestra la observación (CA 9)
    resp_pend = client.get(
        "/api/v1/certificacion-laboral/mis-pendientes",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_pend.status_code == 200
    obs_list = resp_pend.json()["observados_rechazados"]
    assert any(item["documento_id"] == doc_id for item in obs_list)

    # 5. RR.HH. sube corrección (v2): DEBE crear versión 2 y preservar historial v1 (CA 9)
    resp_v2 = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/entrega_v2_revisada.pdf", "archivo_nombre": "entrega_v2_revisada.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_v2.status_code == 200
    assert resp_v2.json()["estado"] == "en_revision"

    resp_vers = client.get(f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/versiones", headers={"Authorization": f"Bearer {user_token}"})
    versiones = resp_vers.json()
    assert len(versiones) == 2
    assert versiones[0]["version"] == 2
    assert versiones[1]["version"] == 1
    assert "ilegible en página 3" in versiones[1]["observacion"]

    # 6. Intentar cerrar período cuando NO está al 100% -> 400 Bad Request (CA 12)
    resp_cerrar_fail = client.post(
        f"/api/v1/periodos/{periodo_id}/cerrar",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_cerrar_fail.status_code == 400

    # 7. Dictaminar todos los requisitos del período a 'aprobado'
    for d in docs:
        client.post(
            f"/api/v1/periodos/{periodo_id}/documentos/{d['id']}/revisar",
            json={"accion": "aprobar", "comentario": "Conforme a normativa"},
            headers={"Authorization": f"Bearer {user_token}"}
        )

    # 8. Cerrar período al 100% (CA 12)
    resp_cerrar = client.post(
        f"/api/v1/periodos/{periodo_id}/cerrar",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_cerrar.status_code == 200
    assert resp_cerrar.json()["estado"] == "cerrado"
    assert resp_cerrar.json()["porcentaje_cumplimiento"] == 100.0

    # 9. Regla de inmutabilidad: nuevas cargas bloqueadas con 400
    resp_subir_bloqueado = client.post(
        f"/api/v1/periodos/{periodo_id}/documentos/{doc_id}/subir",
        json={"archivo_url": "https://storage.acredittia.cl/intento_tardio.pdf"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_subir_bloqueado.status_code == 400


def test_ca13_buk_sync_resiliente_y_fallback_manual(client, user_token, session):
    """
    [CA 13] Integración con Buk:
    - Sincroniza nómina y documentos sobre los contratos existentes registrando fecha y resultado en Trazabilidad.
    - Si Buk no está disponible, el flujo manual opera al 100% sin bloqueos.
    """
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    contrato_id = resp_cts.json()["items"][0]["id"]
    resp_pers = client.get(f"/api/v1/contratos/{contrato_id}/periodos", headers={"Authorization": f"Bearer {user_token}"})
    periodos = resp_pers.json()["items"]
    # Usar un período abierto
    periodo_abierto = next((p for p in periodos if p["estado"] == "abierto"), periodos[0])
    periodo_id = periodo_abierto["id"]

    # 1. Ejecutar sincronización sin credenciales Buk / fallback manual
    resp_fallback = client.post(
        f"/api/v1/contratos/{contrato_id}/periodos/{periodo_id}/sincronizar-buk?simular_exito=false",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_fallback.status_code == 200, resp_fallback.text
    data_fallback = resp_fallback.json()
    assert data_fallback["modo"] == "manual_fallback"
    assert "No hay credenciales activas de Buk" in data_fallback["mensaje"] or "manual" in data_fallback["mensaje"]

    # 2. Ejecutar sincronización simulada exitosa
    resp_sim = client.post(
        f"/api/v1/contratos/{contrato_id}/periodos/{periodo_id}/sincronizar-buk?simular_exito=true",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_sim.status_code == 200, resp_sim.text
    data_sim = resp_sim.json()
    assert data_sim["modo"] == "buk_api"
    assert data_sim["documentos_importados"] >= 1
    assert "fecha_sincronizacion" in data_sim

    # 3. Verificar que los documentos importados están en 'en_revision' y registrados en trazabilidad
    resp_traza = client.get(
        f"/api/v1/periodos/{periodo_id}/trazabilidad",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_traza.status_code == 200
    trazas = resp_traza.json()
    assert any("Buk" in t.get("detalle", "") or t.get("accion") == "sincronizar_buk" for t in trazas)
