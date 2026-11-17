"""Pruebas de regresión para el Motor Común de Validación Documental por IA (v2).

Cubre:
- Contrato estándar único {documentData, rules, summary, status, motivo}
- Controles transversales antes de reglas específicas
- Jerarquía de 3 niveles (Familias, Pautas Maestras, Overrides por Faena y Equivalencias)
- Validación cruzada por titular (Cédula / Padrón aprobados como fuente de verdad)
- Hallazgos H1 a H8 de Pautas v2 y EJEMPLO VALIDACIONES PERSONAL.md
- Privacidad médica por rol y aislamiento multi-tenant
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from app.database import worker_session
from app.models import IaHallazgo, IaReview, Sujeto, User
from app.security import create_access_token, hash_password
from app.services.platform.validador_documental import (
    CONTROLES_TRANSVERSALES,
    FAMILIAS_VALIDACION,
    PAUTAS_MAESTRAS,
    evaluar_validacion_documental,
    inferir_clasificacion_documento,
    limite_jornada_legal_semanal,
    normalizar_jornada_a_semanal,
    sanitizar_privacidad_medica,
)
from tests.conftest import API, patente_valida, rut_valido


def _crear_usuario_con_rol(
    company_id: str, contrato_id: str | None, rol: str
) -> dict[str, str]:
    uid = uuid.uuid4()
    email = f"{rol}-{uid.hex[:8]}@acredittia.cl"
    with worker_session(company_id=company_id, is_admin=True) as db:
        u = User(
            id=uid,
            email=email,
            password_hash=hash_password("Secreta123"),
            role=rol,
            company_id=uuid.UUID(company_id),
            contrato_id=uuid.UUID(contrato_id) if contrato_id else None,
            nombre=f"Usuario {rol}",
            status="approved",
            activo=True,
        )
        db.add(u)
        db.commit()
    token = create_access_token(uid, rol, uuid.UUID(company_id))
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. Contrato Estándar, Controles Transversales y Bloqueantes de Producto
# ============================================================================
@pytest.mark.parametrize(
    "tipo_doc,prefijo_esperado",
    [
        ("cedula", "CED"),
        ("licencia", "LIC"),
        ("hvc", "HVC"),
        ("antecedentes", "ANT"),
        ("pasaporte", "PAS"),
        ("contrato", "EMP"),
        ("anexo", "ANX"),
        ("examen_altura", "EXA"),
        ("curso_manejo_defensivo", "CUR"),
        ("padron", "EQD"),
        ("cert_grua", "EQC"),
        ("f30_1", "EMPR"),
    ],
)
def test_contrato_estandar_y_orden_transversal_antes_especificas(
    tipo_doc: str, prefijo_esperado: str
):
    res = evaluar_validacion_documental(
        tipo_documento_ia=tipo_doc,
        document_data={"RUN": "11784946-5", "Nombres": "ALFONSO", "Apellidos": "ROCO"},
        fecha_evaluacion=date(2026, 11, 16),
    )
    assert set(res.keys()) == {"documentData", "rules", "summary", "status", "motivo"}
    assert set(res["summary"].keys()) == {"OK", "OBS", "RECH", "N/A", "REV", "total"}
    assert res["status"] in ("APROBADO", "RECHAZADO", "REQUIERE_REVISION")
    assert isinstance(res["motivo"], str) and res["motivo"]

    codigos = [r["codigo"] for r in res["rules"]]
    transversales = [c.codigo for c in CONTROLES_TRANSVERSALES]
    assert codigos[: len(transversales)] == transversales
    especificas = codigos[len(transversales) :]
    assert any(c.startswith(prefijo_esperado) for c in especificas)

    for rule in res["rules"]:
        assert set(rule.keys()) == {
            "codigo",
            "campo",
            "resultado",
            "bloqueante",
            "observacion",
        }
        assert rule["resultado"] in ("OK", "OBS", "RECH", "N/A", "REV")
        assert isinstance(rule["bloqueante"], bool)
        assert isinstance(rule["observacion"], str)


def test_bloqueante_lo_define_producto_no_el_llm():
    """Aunque el LLM envíe bloqueante=False para CED02, producto impone True."""
    res = evaluar_validacion_documental(
        tipo_documento_ia="cedula",
        document_data={"RUN": "11.784.946-5", "Nombres": "ALFONSO", "Apellidos": "ROCO"},
        reglas_ia=[
            {
                "codigo": "CED02",
                "resultado": "RECH",
                "bloqueante": False,  # intento del LLM de bajar severidad
                "observacion": "Diferencia de RUN",
            }
        ],
    )
    ced02 = next(r for r in res["rules"] if r["codigo"] == "CED02")
    assert ced02["bloqueante"] is True
    assert res["status"] == "RECHAZADO"


# ============================================================================
# 2. Jerarquía de 3 Niveles y Equivalencias
# ============================================================================
def test_jerarquia_3_niveles_overrides_y_equivalencias(
    app_cliente, empresa_a, contrato_a
):
    h = empresa_a["headers"]
    assert set(FAMILIAS_VALIDACION) == {
        "TRABAJADORES_DOCUMENTOS",
        "TRABAJADORES_EXAMENES",
        "TRABAJADORES_CURSOS",
        "EQUIPOS_DOCUMENTOS",
        "EQUIPOS_CERTIFICADOS",
        "EMPRESA",
    }
    assert "contrato" in PAUTAS_MAESTRAS and "examen" in PAUTAS_MAESTRAS

    # Nivel 3: configurar override por contrato en examen de altura geográfica (4500 msnm)
    # y activar EXA07 como bloqueante
    r_ov = app_cliente.put(
        f"{API}/ia/pautas/examen_altura_geo",
        headers=h,
        json={
            "contrato_id": contrato_a["id"],
            "reglas_activas": {"EXA10": False},
            "bloqueantes_override": {"EXA07": True},
            "parametros": {"altitud_geografica_msnm": 4500},
        },
    )
    assert r_ov.status_code == 200, r_ov.text

    r_list = app_cliente.get(
        f"{API}/ia/pautas?contrato_id={contrato_a['id']}", headers=h
    )
    assert r_list.status_code == 200
    assert len(r_list.json()["overrides"]) == 1

    # Validar examen con altitud insuficiente (3500 < 4500) y EXA10 desactivada (N/A)
    r_val = app_cliente.post(
        f"{API}/ia/validar-documento",
        headers=h,
        json={
            "tipo_documento_ia": "examen_altura_geo",
            "contrato_id": contrato_a["id"],
            "documentData": {
                "RUTPaciente": "11784946-5",
                "NombrePaciente": "ALFONSO ROCO",
                "NombreEmisor": "ACHS",
                "AltitudEvaluadaMsnm": 3500,
                "Conclusion": "APTO",
            },
        },
    )
    assert r_val.status_code == 200, r_val.text
    body = r_val.json()
    reglas = {r["codigo"]: r for r in body["rules"]}
    assert reglas["EXA10"]["resultado"] == "N/A"
    assert reglas["EXA07"]["bloqueante"] is True
    assert reglas["FAE01"]["resultado"] == "RECH"
    assert body["status"] == "RECHAZADO"

    # Nivel 3 Equivalencias: curso con nombre no catalogado y confianza baja -> REQUIERE_REVISION
    r_cur_rev = app_cliente.post(
        f"{API}/ia/validar-documento",
        headers=h,
        json={
            "tipo_documento_ia": "curso_manejo_defensivo",
            "contrato_id": contrato_a["id"],
            "documentData": {
                "nombre_curso": "Manejo Seguro Alta Cordillera",
                "confianza_equivalencia": 0.65,
            },
        },
    )
    assert r_cur_rev.status_code == 200
    assert r_cur_rev.json()["status"] == "REQUIERE_REVISION"

    # Confirmar equivalencia en Nivel 3 -> ahora aprueba como equivalente
    r_eq = app_cliente.post(
        f"{API}/ia/equivalencias",
        headers=h,
        json={
            "familia": "CURSOS",
            "nombre_detectado": "Manejo Seguro Alta Cordillera",
            "nombre_canonico": "Conducción defensiva",
            "codigo_catalogo": "CUR-MD",
            "confianza": 0.96,
            "confirmado": True,
        },
    )
    assert r_eq.status_code == 201, r_eq.text

    r_cur_ok = app_cliente.post(
        f"{API}/ia/validar-documento",
        headers=h,
        json={
            "tipo_documento_ia": "curso_manejo_defensivo",
            "contrato_id": contrato_a["id"],
            "documentData": {
                "nombre_curso": "Manejo Seguro Alta Cordillera",
                "confianza_equivalencia": 0.65,
            },
        },
    )
    assert r_cur_ok.status_code == 200
    assert r_cur_ok.json()["status"] == "APROBADO"
    assert r_cur_ok.json()["documentData"]["curso_canonico"] == "Conducción defensiva"


# ============================================================================
# 3. Corrección de los 8 Hallazgos (H1–H8) + Validación Cruzada por Titular
# ============================================================================
def test_h1_discrepancia_nombre_contra_cedula_aprobada_requiere_revision(
    app_cliente, empresa_a, contrato_a
):
    """H1: Cédula aprobada dice ALFONSO, examen dice ALFREDO (mismo RUT) -> ID02=REV."""
    h = empresa_a["headers"]
    r_suj = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={
            "contrato_id": contrato_a["id"],
            "nombre": "Alfonso Francisco Roco Carvajal",
            "rut": "11.784.946-5",
            "cargo": "Conductor de Camión",
            "es_conductor": True,
        },
    )
    assert r_suj.status_code == 201, r_suj.text
    suj_id = r_suj.json()["id"]

    # Simular que la Cédula ya fue aprobada y dejó datos_verificados como fuente de verdad
    with worker_session(company_id=empresa_a["company_id"]) as db:
        suj = db.get(Sujeto, uuid.UUID(suj_id))
        suj.datos_verificados = {
            "tipo": "cedula",
            "rut": "11784946-5",
            "nombre_completo": "ALFONSO FRANCISCO ROCO CARVAJAL",
        }
        db.commit()

    # Validar examen ACHS con nombre ALFREDO FRANCISCO ROCO CARVAJAL y mismo RUT
    r_val = app_cliente.post(
        f"{API}/ia/validar-documento",
        headers=h,
        json={
            "tipo_documento_ia": "examen_altura",
            "sujeto_id": suj_id,
            "contrato_id": contrato_a["id"],
            "documentData": {
                "RUTPaciente": "11784946-5",
                "NombrePaciente": "ALFREDO FRANCISCO ROCO CARVAJAL",
                "NombreEmisor": "Asociación Chilena de Seguridad",
                "Conclusion": "OK",
                "FechaVigenciaInforme": (date.today() + timedelta(days=365)).isoformat(),
            },
        },
    )
    assert r_val.status_code == 200, r_val.text
    out = r_val.json()
    reglas = {r["codigo"]: r for r in out["rules"]}
    assert reglas["ID01"]["resultado"] == "OK"
    assert reglas["ID02"]["resultado"] == "REV"
    assert reglas["EXA03"]["resultado"] == "REV"
    assert out["status"] == "REQUIERE_REVISION"


def test_h2_contrato_trab01_y_trab02_comparan_contra_sujeto_esperado():
    """H2: Contrato de Javier Muñoz (18.151.535-K) para Alfredo Roco (11784946-5) -> RECH."""
    res = evaluar_validacion_documental(
        tipo_documento_ia="contrato",
        sujeto_esperado={"nombre": "Alfredo Roco", "rut": "11784946-5"},
        document_data={
            "trabajador": {
                "rut": "18.151.535-K",
                "nombre": "Javier Antonio Muñoz Cortes",
            },
            "jornada": {"duracion_semanal": "180 horas mensuales"},
            "vigencia": {
                "tipo_contrato": "indefinido",
                "fecha_inicio": "2024-07-08",
            },
        },
        fecha_evaluacion=date(2026, 11, 16),
    )
    reglas = {r["codigo"]: r for r in res["rules"]}
    assert reglas["TRAB01"]["resultado"] == "RECH"
    assert reglas["TRAB01"]["bloqueante"] is True
    assert reglas["TRAB02"]["resultado"] == "RECH"
    assert reglas["TRAB02"]["bloqueante"] is True
    assert reglas["ID01"]["resultado"] == "RECH"
    assert reglas["ID02"]["resultado"] == "RECH"
    assert res["status"] == "RECHAZADO"
    assert res["summary"]["RECH"] >= 2


def test_h3_y_h4_normalizacion_jornada_mensual_y_ley_40_horas():
    """H3: 180 horas mensuales -> 42.0 h/semana. H4: límite parametrizado por fecha."""
    horas, _ = normalizar_jornada_a_semanal("180 horas mensuales")
    assert horas == 42.0

    assert limite_jornada_legal_semanal(date(2024, 4, 25)) == 45
    assert limite_jornada_legal_semanal(date(2024, 4, 26)) == 44
    assert limite_jornada_legal_semanal(date(2026, 4, 26)) == 42
    assert limite_jornada_legal_semanal(date(2028, 4, 26)) == 40

    base_doc = {
        "trabajador": {"rut": "11784946-5", "nombre": "ALFREDO ROCO"},
        "jornada": {"duracion_semanal": "180 horas mensuales"},
        "vigencia": {"tipo_contrato": "indefinido", "fecha_inicio": "2024-07-08"},
    }
    # En 2026 (límite 42h), 180h mensuales (=42h semanales) es OK (sin falsa OBS!)
    res_2026 = evaluar_validacion_documental(
        tipo_documento_ia="contrato",
        sujeto_esperado={"nombre": "ALFREDO ROCO", "rut": "11784946-5"},
        document_data=base_doc,
        reglas_ia=[
            {"codigo": "JORN03", "resultado": "OBS", "observacion": "180 hrs/semana"}
        ],
        fecha_evaluacion=date(2026, 11, 16),
    )
    jorn_2026 = next(r for r in res_2026["rules"] if r["codigo"] == "JORN03")
    assert jorn_2026["resultado"] == "OK"
    assert res_2026["documentData"]["jornada"]["duracion_semanal_normalizada_hrs"] == 42.0
    assert res_2026["documentData"]["jornada"]["limite_legal_aplicado_hrs"] == 42

    # En mayo 2028 (límite 40h), 42h semanales excede el límite -> RECH
    res_2028 = evaluar_validacion_documental(
        tipo_documento_ia="contrato",
        sujeto_esperado={"nombre": "ALFREDO ROCO", "rut": "11784946-5"},
        document_data=base_doc,
        fecha_evaluacion=date(2028, 5, 1),
    )
    jorn_2028 = next(r for r in res_2028["rules"] if r["codigo"] == "JORN03")
    assert jorn_2028["resultado"] == "RECH"
    assert res_2028["status"] == "RECHAZADO"


def test_h5_plazo_fijo_vencido_sin_y_con_anexo_prorroga():
    """H5: Plazo fijo vencido 2024-09-30 sin anexo -> VIG03/VIG04 = RECH; con anexo -> OK."""
    doc_pf = {
        "trabajador": {"rut": "11784946-5", "nombre": "ALFREDO ROCO"},
        "jornada": {"duracion_semanal": "180 horas mensuales"},
        "vigencia": {
            "tipo_contrato": "plazo fijo",
            "fecha_inicio": "2024-07-08",
            "fecha_termino": "2024-09-30",
        },
    }
    sin_anexo = evaluar_validacion_documental(
        tipo_documento_ia="contrato",
        sujeto_esperado={"nombre": "ALFREDO ROCO", "rut": "11784946-5"},
        document_data=doc_pf,
        anexos_vigentes=[],
        fecha_evaluacion=date(2026, 11, 16),
    )
    reglas_sin = {r["codigo"]: r for r in sin_anexo["rules"]}
    assert reglas_sin["VIG03"]["resultado"] == "RECH"
    assert reglas_sin["VIG04"]["resultado"] == "RECH"
    assert sin_anexo["status"] == "RECHAZADO"

    con_anexo = evaluar_validacion_documental(
        tipo_documento_ia="contrato",
        sujeto_esperado={"nombre": "ALFREDO ROCO", "rut": "11784946-5"},
        document_data=doc_pf,
        anexos_vigentes=[{"pasa_indefinido": True}],
        fecha_evaluacion=date(2026, 11, 16),
    )
    reglas_con = {r["codigo"]: r for r in con_anexo["rules"]}
    assert reglas_con["VIG03"]["resultado"] == "OK"
    assert reglas_con["VIG04"]["resultado"] == "OK"
    assert con_anexo["status"] == "APROBADO"


def test_h6_invariante_rechazado_siempre_tiene_regla_rech_en_summary_y_motivo():
    """H6: Nunca puede existir status=RECHAZADO con summary.RECH == 0."""
    res = evaluar_validacion_documental(
        tipo_documento_ia="contrato",
        sujeto_esperado={"nombre": "ALFREDO ROCO", "rut": "11784946-5"},
        document_data={
            "trabajador": {"rut": "99999999-9", "nombre": "OTRA PERSONA"},
        },
    )
    assert res["status"] == "RECHAZADO"
    assert res["summary"]["RECH"] >= 1
    assert any(r["resultado"] == "RECH" and r["bloqueante"] for r in res["rules"])
    assert "TRAB01" in res["motivo"] or "TRAB02" in res["motivo"] or "ID01" in res["motivo"]


def test_h7_portal_aprobado_por_campos_pero_similitud_menor_95_registra_obs():
    """H7: Examen ACHS con similitud 79% (<95%) y páginas 8 vs 7 -> EXA09/AUT01 = OBS."""
    res = evaluar_validacion_documental(
        tipo_documento_ia="examen_altura",
        sujeto_esperado={"nombre": "ALFREDO FRANCISCO ROCO CARVAJAL", "rut": "11784946-5"},
        document_data={
            "RUTPaciente": "11784946-5",
            "NombrePaciente": "ALFREDO FRANCISCO ROCO CARVAJAL",
            "NombreEmisor": "Asociación Chilena de Seguridad",
            "Conclusion": "OK",
            "FechaVigenciaInforme": (date.today() + timedelta(days=365)).isoformat(),
        },
        portal_verificacion={
            "validated": True,
            "comparison": {
                "containment": 79,
                "text_similarity": 79,
                "containment_threshold": 95,
                "pages_match": False,
                "portal_pages": 7,
                "original_pages": 8,
            },
            "field_comparison": {"isValid": True},
        },
    )
    reglas = {r["codigo"]: r for r in res["rules"]}
    assert reglas["EXA09"]["resultado"] == "OBS"
    assert reglas["AUT01"]["resultado"] == "OBS"
    assert res["summary"]["OBS"] >= 2
    assert res["status"] == "APROBADO"
    assert "79%" in reglas["EXA09"]["observacion"]


def test_h8_privacidad_medica_oculta_detalle_a_roles_no_autorizados(
    app_cliente, empresa_a, contrato_a
):
    """H8: Roles no autorizados (visor/contract_admin/adc) solo ven aptitud y vigencia."""
    # Alcohol y drogas positivo -> REQUIERE_REVISION y datos clínicos ocultos fuera de rrhh/company/admin
    payload_examen = {
        "tipo_documento_ia": "examen_alcohol_drogas",
        "contrato_id": contrato_a["id"],
        "documentData": {
            "RUTPaciente": "11784946-5",
            "NombrePaciente": "ALFREDO ROCO",
            "NombreEmisor": "ACHS",
            "Conclusion": "POSITIVO",
            "Positivo": True,
            "GlosaConclusion": "Presencia de THC en muestra urinaria",
            "Restricciones": "Restricción conducción maquinaria pesada",
            "SustanciasAnalizadas": ["THC", "Cocaína"],
            "FechaEmisionInforme": "2026-11-01",
            "FechaVigenciaInforme": "2027-11-01",
        },
    }

    # Rol autorizado (company): ve todo el detalle clínico
    r_auth = app_cliente.post(
        f"{API}/ia/validar-documento", headers=empresa_a["headers"], json=payload_examen
    )
    assert r_auth.status_code == 200, r_auth.text
    d_auth = r_auth.json()
    assert d_auth["status"] == "REQUIERE_REVISION"
    assert d_auth["documentData"]["GlosaConclusion"] == "Presencia de THC en muestra urinaria"
    assert d_auth["documentData"]["Restricciones"] == "Restricción conducción maquinaria pesada"
    assert d_auth["documentData"]["SustanciasAnalizadas"] == ["THC", "Cocaína"]

    # Rol autorizado (rrhh): también ve detalle clínico
    h_rrhh = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "rrhh")
    r_rrhh = app_cliente.post(
        f"{API}/ia/validar-documento", headers=h_rrhh, json=payload_examen
    )
    assert r_rrhh.status_code == 200
    assert "GlosaConclusion" in r_rrhh.json()["documentData"]

    # Rol NO autorizado (contract_admin): NO ve glosa, restricciones ni sustancias; solo aptitud y vigencia
    h_ca = _crear_usuario_con_rol(
        empresa_a["company_id"], contrato_a["id"], "contract_admin"
    )
    r_ca = app_cliente.post(
        f"{API}/ia/validar-documento", headers=h_ca, json=payload_examen
    )
    assert r_ca.status_code == 200, r_ca.text
    d_ca = r_ca.json()
    assert "GlosaConclusion" not in d_ca["documentData"]
    assert "Restricciones" not in d_ca["documentData"]
    assert "SustanciasAnalizadas" not in d_ca["documentData"]
    assert "Positivo" not in d_ca["documentData"]
    assert d_ca["documentData"]["Conclusion"] == "REQUIERE_REVISION"
    assert d_ca["documentData"]["FechaVigenciaInforme"] == "2027-11-01"
    assert "THC" not in d_ca["motivo"]

    # Rol visor (solo lectura) consultando GET /ia/revisiones/{job_id} tampoco ve glosa clínica
    h_visor = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "visor")
    job_id = uuid.uuid4()
    with worker_session(company_id=empresa_a["company_id"], is_admin=True) as db:
        rev = IaReview(
            id=job_id,
            company_id=uuid.UUID(empresa_a["company_id"]),
            context="personal",
            status="done",
            resultado="con_observaciones",
            confianza=0.95,
            campos_extraidos={
                "contrato_id": contrato_a["id"],
                **d_auth["documentData"],
            },
            validation_status=d_auth["status"],
            rules_result=d_auth["rules"],
            summary_result=d_auth["summary"],
            motivo=d_auth["motivo"],
        )
        db.add(rev)
        db.flush()
        db.add(
            IaHallazgo(
                review_id=job_id,
                tipo="warning",
                codigo="EXA06",
                mensaje="Resultado positivo THC",
                campo="Conclusión de aptitud",
            )
        )
        db.commit()

    r_visor = app_cliente.get(
        f"{API}/ia/revisiones/{job_id}/validacion", headers=h_visor
    )
    assert r_visor.status_code == 200, r_visor.text
    dv = r_visor.json()
    assert "GlosaConclusion" not in dv["documentData"]
    assert "SustanciasAnalizadas" not in dv["documentData"]
    assert dv["documentData"]["Conclusion"] == "REQUIERE_REVISION"
    assert dv["documentData"]["FechaVigenciaInforme"] == "2027-11-01"

    r_visor_det = app_cliente.get(f"{API}/ia/revisiones/{job_id}", headers=h_visor)
    assert r_visor_det.status_code == 200
    assert "GlosaConclusion" not in r_visor_det.json()["campos_extraidos"]
    assert "THC" not in str(r_visor_det.json()["hallazgos"])


def test_equipos_cruce_padron_y_aislamiento_tenant(
    app_cliente, empresa_a, empresa_b, contrato_a
):
    """Validación cruzada de equipos por patente/VIN y aislamiento multi-tenant."""
    pat = patente_valida(99)
    res = evaluar_validacion_documental(
        tipo_documento_ia="revtec",
        sujeto_esperado={"patente": pat, "nombre": "Camión Volvo"},
        padron_aprobado={"tipo": "padron", "patente": pat, "vin": "YV2RT40A8PB123456"},
        document_data={"Patente": pat, "VIN": "YV2RT40A8PB999999"},
    )
    reglas = {r["codigo"]: r for r in res["rules"]}
    assert reglas["EQD01"]["resultado"] == "OK"
    assert reglas["EQD02"]["resultado"] == "REV"
    assert res["status"] == "REQUIERE_REVISION"

    # Aislamiento: empresa_b no ve overrides ni equivalencias de empresa_a
    app_cliente.put(
        f"{API}/ia/pautas/hvc",
        headers=empresa_a["headers"],
        json={"parametros": {"antiguedad_max_dias_hvc": 15}},
    )
    r_b = app_cliente.get(f"{API}/ia/pautas", headers=empresa_b["headers"])
    assert r_b.status_code == 200
    assert r_b.json()["overrides"] == []


def test_seguridad_x_company_id_rrhh_adc_descarga_medica_y_regla_ia_omitida(
    app_cliente, admin, empresa_a, empresa_b, contrato_a, contrato_b
):
    """Hardening:
    1) rrhh y adc NO pueden usar X-Company-Id para saltar a otra empresa.
    2) descarga y detalle clínico de examen médico bloqueados a roles no autorizados (contract_admin/adc)
       y permitidos a roles autorizados (rrhh/admin).
    3) reglas omitidas o desconocidas del LLM pasan a REV (fail-safe), nunca OK.
    """
    # 1) rrhh y adc de empresa_b intentan leer pautas de empresa_a con X-Company-Id
    app_cliente.put(
        f"{API}/ia/pautas/hvc",
        headers=empresa_a["headers"],
        json={"parametros": {"antiguedad_max_dias_hvc": 15}},
    )
    for rol_cross in ("rrhh", "adc"):
        h_role_b = _crear_usuario_con_rol(empresa_b["company_id"], contrato_b["id"], rol_cross)
        h_forged = {**h_role_b, "X-Company-Id": empresa_a["company_id"]}
        r_cross = app_cliente.get(f"{API}/ia/pautas", headers=h_forged)
        assert r_cross.status_code == 200
        assert r_cross.json()["overrides"] == [], (
            f"{rol_cross} no debe cruzar de empresa vía X-Company-Id"
        )

    # 2) Descarga y lectura clínica de examen médico: 403/redactado para contract_admin y adc;
    #    200/sin redactar para rrhh y admin.
    r_suj = app_cliente.post(
        f"{API}/personal",
        headers=empresa_a["headers"],
        json={
            "contrato_id": contrato_a["id"],
            "nombre": "Paciente Prueba",
            "rut": rut_valido(777),
            "cargo": "Conductor",
            "es_conductor": True,
        },
    )
    assert r_suj.status_code == 201
    suj_id = r_suj.json()["id"]
    docs = app_cliente.get(
        f"{API}/personal/{suj_id}", headers=empresa_a["headers"]
    ).json()["documentos"]
    doc_exa = next(d for d in docs if "examen" in d["titulo"].lower() or "salud" in d["titulo"].lower())

    from tests.conftest import subir_archivo

    sub = subir_archivo(app_cliente, empresa_a, doc_exa["id"], filename="examen_altura.pdf")
    arch_id = sub["archivo"]["id"]

    h_ca = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "contract_admin")
    h_adc = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "adc")
    for h_no_auth in (h_ca, h_adc):
        r_dl_no = app_cliente.get(
            f"{API}/documentos/{doc_exa['id']}/archivos/{arch_id}/download-url",
            headers=h_no_auth,
        )
        assert r_dl_no.status_code == 403
        assert r_dl_no.json()["error"]["code"] == "PRIVACIDAD_MEDICA"

    h_rrhh = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "rrhh")
    h_admin_tenant = {**admin["headers"], "X-Company-Id": empresa_a["company_id"]}
    for h_auth in (h_rrhh, h_admin_tenant):
        r_dl_ok = app_cliente.get(
            f"{API}/documentos/{doc_exa['id']}/archivos/{arch_id}/download-url",
            headers=h_auth,
        )
        assert r_dl_ok.status_code == 200

    job_id = uuid.uuid4()
    with worker_session(company_id=empresa_a["company_id"], is_admin=True) as db:
        db.add(
            IaReview(
                id=job_id,
                company_id=uuid.UUID(empresa_a["company_id"]),
                context="personal",
                status="done",
                resultado="con_observaciones",
                confianza=0.92,
                campos_extraidos={
                    "_tipo_documento_ia": "examen_altura",
                    "contrato_id": contrato_a["id"],
                    "Conclusion": "NO_APTO",
                    "GlosaConclusion": "Hipertensión arterial no controlada",
                    "Restricciones": "Sin trabajo sobre 3.000 msnm",
                    "FechaVigenciaInforme": "2027-11-01",
                },
                validation_status="REQUIERE_REVISION",
                rules_result=[
                    {
                        "codigo": "EXA06",
                        "campo": "Conclusión de aptitud",
                        "resultado": "REV",
                        "bloqueante": True,
                        "observacion": "Hipertensión arterial no controlada",
                    }
                ],
                summary_result={"OK": 0, "OBS": 0, "RECH": 0, "N/A": 0, "REV": 1, "total": 1},
                motivo="Hipertensión arterial no controlada",
            )
        )
        db.commit()

    r_val_adc = app_cliente.get(f"{API}/ia/revisiones/{job_id}/validacion", headers=h_adc)
    assert r_val_adc.status_code == 200, r_val_adc.text
    d_adc = r_val_adc.json()
    assert "GlosaConclusion" not in d_adc["documentData"]
    assert "Restricciones" not in d_adc["documentData"]
    assert "Hipertensión" not in d_adc["motivo"]

    r_val_admin = app_cliente.get(f"{API}/ia/revisiones/{job_id}/validacion", headers=h_admin_tenant)
    assert r_val_admin.status_code == 200, r_val_admin.text
    d_adm = r_val_admin.json()
    assert d_adm["documentData"]["GlosaConclusion"] == "Hipertensión arterial no controlada"
    assert d_adm["documentData"]["Restricciones"] == "Sin trabajo sobre 3.000 msnm"

    # 3) Regla LLM desconocida o truncada -> REV (no OK fail-open)
    res_fail_safe = evaluar_validacion_documental(
        tipo_documento_ia="cedula",
        document_data={"RUN": "11784946-5", "Nombres": "ALFONSO", "Apellidos": "ROCO"},
        reglas_ia=[{"codigo": "CED03", "resultado": "UNKNOWN_STATE", "observacion": "raro"}],
    )
    reglas = {r["codigo"]: r for r in res_fail_safe["rules"]}
    assert reglas["CED03"]["resultado"] == "REV"
    assert reglas["CED04"]["resultado"] == "REV"
    assert res_fail_safe["status"] == "REQUIERE_REVISION"


def test_h8_allowlist_clinica_y_bloqueo_exportar_arbol_zip(
    app_cliente, empresa_a, contrato_a
):
    """H8 completo: allowlist estricta en sanitización y filtro en /exportar/arbol y /exportar/zip."""
    payload_arbitrario = {
        "documentData": {
            "RUTPaciente": "11784946-5",
            "NombrePaciente": "ALFREDO ROCO",
            "NombreEmisor": "ACHS",
            "Conclusion": "APTO",
            "FechaVigenciaInforme": "2027-12-01",
            "diagnostico_cie10": "I10 Hipertensión esencial",
            "parametros_clinicos": {"presion_arterial": "150/95"},
            "observacion_medica": "Seguimiento cardiológico",
        },
        "rules": [
            {"codigo": "EXA06", "campo": "Conclusión", "resultado": "OK", "bloqueante": True, "observacion": ""}
        ],
        "summary": {"OK": 1, "OBS": 0, "RECH": 0, "N/A": 0, "REV": 0, "total": 1},
        "status": "APROBADO",
        "motivo": "Sin hallazgos",
    }
    san_ca = sanitizar_privacidad_medica(
        payload_arbitrario, user_role="contract_admin", tipo_documento_ia="examen_altura"
    )
    dd_ca = san_ca["documentData"]
    assert "diagnostico_cie10" not in dd_ca
    assert "parametros_clinicos" not in dd_ca
    assert "observacion_medica" not in dd_ca
    assert dd_ca["Conclusion"] == "APTO"
    assert dd_ca["FechaVigenciaInforme"] == "2027-12-01"

    # Crear trabajador con cédula + examen médico subidos al mismo contrato
    r_suj = app_cliente.post(
        f"{API}/personal",
        headers=empresa_a["headers"],
        json={
            "contrato_id": contrato_a["id"],
            "nombre": "Export Test Trabajador",
            "rut": rut_valido(888),
            "cargo": "Operador",
            "es_conductor": True,
        },
    )
    assert r_suj.status_code == 201
    suj_id = r_suj.json()["id"]
    docs = app_cliente.get(
        f"{API}/personal/{suj_id}", headers=empresa_a["headers"]
    ).json()["documentos"]
    doc_ced = next(d for d in docs if "cédula" in d["titulo"].lower() or "cedula" in d["titulo"].lower())
    doc_exa = next(d for d in docs if "examen" in d["titulo"].lower() or "salud" in d["titulo"].lower())

    from tests.conftest import subir_archivo
    import io, zipfile

    subir_archivo(app_cliente, empresa_a, doc_ced["id"], filename="cedula_trabajador.pdf")
    subir_archivo(app_cliente, empresa_a, doc_exa["id"], filename="examen_secreto.pdf")

    h_ca = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "contract_admin")
    h_rrhh = _crear_usuario_con_rol(empresa_a["company_id"], contrato_a["id"], "rrhh")

    r_arb_ca = app_cliente.get(
        f"{API}/exportar/arbol",
        params={"contrato_id": contrato_a["id"], "solo_vigentes": "false", "estructura": "personal:carpetas"},
        headers=h_ca,
    )
    assert r_arb_ca.status_code == 200
    rutas_ca = r_arb_ca.json()["rutas"]
    assert any("cedula_trabajador" in r for r in rutas_ca)
    assert not any("examen_secreto" in r for r in rutas_ca)

    r_zip_ca = app_cliente.get(
        f"{API}/exportar/zip",
        params={"contrato_id": contrato_a["id"], "solo_vigentes": "false", "estructura": "personal:carpetas"},
        headers=h_ca,
    )
    assert r_zip_ca.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r_zip_ca.content)) as zf:
        nombres_ca = zf.namelist()
    assert any("cedula_trabajador" in n for n in nombres_ca)
    assert not any("examen_secreto" in n for n in nombres_ca)

    r_zip_rrhh = app_cliente.get(
        f"{API}/exportar/zip",
        params={"contrato_id": contrato_a["id"], "solo_vigentes": "false", "estructura": "personal:carpetas"},
        headers=h_rrhh,
    )
    assert r_zip_rrhh.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r_zip_rrhh.content)) as zf:
        nombres_rrhh = zf.namelist()
    assert any("examen_secreto" in n for n in nombres_rrhh)


def test_clasificacion_empresa_origen_llm_cur02_y_h7_containment():
    """Regresiones: colisiones de inferencia, pauta 'empresa', origen_llm, CUR02 RECH y H7 null."""
    assert inferir_clasificacion_documento("Carnet de Conducir Clase B", contexto="personal") == (
        "TRABAJADORES_DOCUMENTOS",
        "licencia",
    )
    assert inferir_clasificacion_documento("Curso Trabajo en Altura", contexto="personal") == (
        "TRABAJADORES_CURSOS",
        "curso_trabajo_altura",
    )
    assert inferir_clasificacion_documento("Certificado Trabajo en Altura", contexto="equipo")[0] == "EQUIPOS_CERTIFICADOS"
    assert inferir_clasificacion_documento("Programa de Salud Ocupacional", contexto="empresa")[0] == "EMPRESA"

    # Pauta "empresa" usa EMPR01..04 y valida RUT empresa
    res_emp = evaluar_validacion_documental(
        tipo_documento_ia="empresa",
        empresa_esperada={"rut": "76.111.222-3", "nombre": "Empresa Alfa SpA"},
        document_data={"RUTEmpresa": "77.999.888-1", "razon_social": "Empresa Alfa SpA"},
    )
    cods_emp = {r["codigo"]: r for r in res_emp["rules"]}
    assert "EMPR01" in cods_emp
    assert cods_emp["EMPR01"]["resultado"] == "RECH"

    # origen_llm=True con rules=[] -> fail-safe REV; origen_llm=False con 1 OBS -> APROBADO
    res_llm_vacio = evaluar_validacion_documental(
        tipo_documento_ia="cedula",
        document_data={"RUN": "11784946-5"},
        reglas_ia=[],
        origen_llm=True,
    )
    assert res_llm_vacio["status"] == "REQUIERE_REVISION"
    assert all(r["resultado"] == "REV" for r in res_llm_vacio["rules"])

    res_sim_warn = evaluar_validacion_documental(
        tipo_documento_ia="cedula",
        document_data={"RUN": "11784946-5", "Nombres": "ALFONSO", "Apellidos": "ROCO"},
        reglas_ia=[{"codigo": "VIG01", "resultado": "OBS", "observacion": "Emisión antigua"}],
        origen_llm=False,
    )
    assert res_sim_warn["status"] == "APROBADO"
    assert res_sim_warn["summary"]["OBS"] >= 1

    # CUR02 RECH (RUT distinto) no debe degradarse a REV por discrepancia de nombre
    res_cur = evaluar_validacion_documental(
        tipo_documento_ia="curso",
        sujeto_esperado={"rut": "11.784.946-5", "nombre": "ALFONSO ROCO"},
        cedula_aprobada={"tipo": "cedula", "rut": "11.784.946-5", "nombre_completo": "ALFONSO ROCO"},
        document_data={
            "participante": {"rut": "99.999.999-K", "nombre": "OTRO TRABAJADOR"},
            "nombre_curso": "Manejo Defensivo",
        },
    )
    cods_cur = {r["codigo"]: r for r in res_cur["rules"]}
    assert cods_cur["CUR02"]["resultado"] == "RECH"

    # H7: text_similarity=None usa containment=80 -> OBS; >=95 -> OK
    res_h7_null = evaluar_validacion_documental(
        tipo_documento_ia="examen_altura",
        document_data={"RUTPaciente": "11784946-5", "Conclusion": "OK"},
        portal_verificacion={
            "validated": True,
            "comparison": {"text_similarity": None, "containment": 80, "containment_threshold": 95, "pages_match": True},
            "field_comparison": {"isValid": True},
        },
    )
    cods_h7 = {r["codigo"]: r for r in res_h7_null["rules"]}
    assert cods_h7["EXA09"]["resultado"] == "OBS"
    assert cods_h7["AUT01"]["resultado"] == "OBS"

