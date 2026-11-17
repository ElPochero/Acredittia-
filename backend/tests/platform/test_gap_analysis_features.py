"""Pruebas completas de la Fase 2 (Lógica de Negocio y Endpoints FastAPI):
- Tarea 2.1: Agendamiento contextual por sujeto y contrato en calendario.
- Tarea 2.2: Matriz Hoja de Cálculo interactiva (TSV / Sheets) por contrato.
- Tarea 2.3: Extracción IA de requisitos de plataforma (con periodicidad).
- Tarea 2.4: Soporte dual Buk / Talana y endpoint sincronizar-rrhh.
"""

import uuid
from datetime import date, timedelta

from app.models import (
    Contrato, Documento, Faena, LicenciaInterna, PeriodoDocumento,
    PeriodoDocumentoRequerido, PeriodoLaboral, Sujeto,
)
from tests.conftest import API, crear_contract_admin, crear_contrato, rut_valido


# ============================================================================
# TAREA 2.1: Agendamiento contextual por sujeto y contrato
# ============================================================================

def test_agendamiento_contextual_sujeto_y_contrato(app_cliente, empresa_a, contrato_a, sesion_db):
    """Verifica creación contextual, herencia de contrato_id, atributos centro_atencion
    y enviar_notificacion, serialización de sujeto y contrato en _out, y endpoint /activo."""
    cid = uuid.UUID(empresa_a["company_id"])
    c_id = uuid.UUID(contrato_a["id"])

    # 1. Crear sujeto en la empresa asociado al contrato
    sujeto = Sujeto(
        company_id=cid,
        contrato_id=c_id,
        tipo="trabajador",
        nombre="Carlos Almonte",
        rut=rut_valido(101),
        cargo="Operador Tolva",
        estado="ok",
    )
    sesion_db.add(sujeto)
    sesion_db.commit()
    s_id = str(sujeto.id)

    hoy = date.today()
    fecha_agendada = hoy + timedelta(days=3)

    # 2. Agendar evento pasando solo sujeto_id (contrato_id heredado automáticamente)
    payload = {
        "titulo": "Examen Altura Física Geotécnica",
        "categoria": "capacitacion",
        "fecha": fecha_agendada.isoformat(),
        "descripcion": "Ayuno 8 horas y asistir con cédula",
        "sujeto_id": s_id,
        "centro_atencion": "ACHS Minería Calama",
        "enviar_notificacion": True,
    }
    r = app_cliente.post(f"{API}/calendario/eventos", headers=empresa_a["headers"], json=payload)
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["titulo"] == "Examen Altura Física Geotécnica"
    assert ev["centro_atencion"] == "ACHS Minería Calama"
    assert ev["enviar_notificacion"] is True
    assert ev["sujeto"] is not None
    assert ev["sujeto"]["id"] == s_id
    assert ev["sujeto"]["nombre"] == "Carlos Almonte"
    assert ev["contrato"] is not None
    assert ev["contrato"]["id"] == contrato_a["id"]
    ev_id = ev["id"]

    # 3. Filtrar listado de eventos por sujeto_id
    desde = hoy.isoformat()
    hasta = (hoy + timedelta(days=10)).isoformat()
    r_list = app_cliente.get(
        f"{API}/calendario?desde={desde}&hasta={hasta}&sujeto_id={s_id}",
        headers=empresa_a["headers"]
    )
    assert r_list.status_code == 200, r_list.text
    items = r_list.json()["items"]
    assert any(i["id"] == ev_id for i in items)

    # 4. Consultar próximo evento activo del sujeto
    r_act = app_cliente.get(f"{API}/calendario/sujetos/{s_id}/activo", headers=empresa_a["headers"])
    assert r_act.status_code == 200, r_act.text
    activo_data = r_act.json()
    assert activo_data["activo"] is not None
    assert activo_data["activo"]["id"] == ev_id
    assert activo_data["activo"]["centro_atencion"] == "ACHS Minería Calama"

    # 5. Marcar evento como completado y verificar que activo sea None
    r_patch = app_cliente.patch(
        f"{API}/calendario/eventos/{ev_id}",
        headers=empresa_a["headers"],
        json={"completado": True}
    )
    assert r_patch.status_code == 200, r_patch.text
    assert r_patch.json()["completado"] is True

    r_act_done = app_cliente.get(f"{API}/calendario/sujetos/{s_id}/activo", headers=empresa_a["headers"])
    assert r_act_done.status_code == 200
    assert r_act_done.json()["activo"] is None


def test_agendamiento_aislamiento_multitenant_y_scope(app_cliente, empresa_a, empresa_b, contrato_a, faenas, sesion_db):
    """Verifica 403 y 404 al intentar agendar o consultar sujetos o contratos ajenos."""
    cid_b = uuid.UUID(empresa_b["company_id"])

    # Sujeto de Empresa B
    sujeto_b = Sujeto(
        company_id=cid_b,
        tipo="trabajador",
        nombre="Trabajador Ajeno",
        rut=rut_valido(202),
        estado="ok"
    )
    sesion_db.add(sujeto_b)
    sesion_db.commit()

    # 1. Empresa A intentando agendar para sujeto de Empresa B -> 404 SUJETO_NO_ENCONTRADO
    r_bad_subj = app_cliente.post(
        f"{API}/calendario/eventos",
        headers=empresa_a["headers"],
        json={
            "titulo": "Evento Inválido",
            "categoria": "otro",
            "fecha": date.today().isoformat(),
            "sujeto_id": str(sujeto_b.id),
        }
    )
    assert r_bad_subj.status_code == 404
    assert r_bad_subj.json().get("error", {}).get("code") == "SUJETO_NO_ENCONTRADO"

    # 2. Empresa A intentando ver activo de sujeto ajeno -> 404
    r_bad_act = app_cliente.get(f"{API}/calendario/sujetos/{sujeto_b.id}/activo", headers=empresa_a["headers"])
    assert r_bad_act.status_code == 404

    # 3. Contract Admin intentando agendar para contrato fuera de su scope -> 403 CONTRATO_AJENO
    faena = next(f for f in faenas if f["nombre"] == "Los Pelambres")
    contrato_2 = crear_contrato(app_cliente, empresa_a, faena["id"], nombre="Segundo Contrato Alfa")
    jefe = crear_contract_admin(app_cliente, empresa_a, contrato_a["id"])

    r_bad_scope = app_cliente.post(
        f"{API}/calendario/eventos",
        headers=jefe["headers"],
        json={
            "titulo": "Intento fuera de scope",
            "categoria": "capacitacion",
            "fecha": date.today().isoformat(),
            "contrato_id": contrato_2["id"]
        }
    )
    assert r_bad_scope.status_code == 403
    assert r_bad_scope.json().get("error", {}).get("code") == "CONTRATO_AJENO"


# ============================================================================
# TAREA 2.2: Endpoint de Matriz Hoja de Cálculo (TSV / Sheets)
# ============================================================================

def test_matriz_hoja_calculo_tabs_y_tsv(app_cliente, empresa_a, contrato_a, sesion_db):
    """Verifica las 4 pestañas de la hoja de cálculo ('empresa', 'personal', 'equipos', 'licencia'),
    la estructura de columnas, filas y el string TSV generado."""
    cid = uuid.UUID(empresa_a["company_id"])
    c_id = uuid.UUID(contrato_a["id"])

    # 1. Documento Empresa
    doc_emp = Documento(
        company_id=cid,
        contrato_id=c_id,
        sujeto_id=None,
        titulo="Reglamento Interno de Orden, Higiene y Seguridad",
        estado_calc="ok",
        obligatorio=True,
        vence=date.today() + timedelta(days=60),
    )
    sesion_db.add(doc_emp)

    # 2. Trabajador y conductor con Documentos
    trab = Sujeto(
        company_id=cid,
        contrato_id=c_id,
        tipo="trabajador",
        nombre="Pedro Picapiedra",
        rut=rut_valido(301),
        cargo="Conductor Minero",
        es_conductor=True,
        estado="ok"
    )
    sesion_db.add(trab)
    sesion_db.flush()

    doc_trab = Documento(
        company_id=cid,
        sujeto_id=trab.id,
        titulo="Cédula de Identidad",
        estado_calc="ok",
        obligatorio=True,
        vence=date.today() + timedelta(days=180),
        es_emsipor=False
    )
    doc_ems = Documento(
        company_id=cid,
        sujeto_id=trab.id,
        titulo="Hoja de Vida del Conductor",
        estado_calc="ok",
        obligatorio=True,
        vence=date.today() + timedelta(days=30),
        es_emsipor=True
    )
    lic = LicenciaInterna(
        company_id=cid,
        sujeto_id=trab.id,
        numero="LIM-9941",
        estado="vigente",
        vence=date.today() + timedelta(days=120),
        emsipor_estado="aprobado"
    )
    sesion_db.add_all([doc_trab, doc_ems, lic])

    # 3. Equipo con Documento
    eq = Sujeto(
        company_id=cid,
        contrato_id=c_id,
        tipo="equipo",
        nombre="Camioneta Hilux",
        patente="GHJK-88",
        tipo_equipo="Camioneta",
        marca="Toyota",
        modelo="Hilux",
        estado="ok"
    )
    sesion_db.add(eq)
    sesion_db.flush()

    doc_eq = Documento(
        company_id=cid,
        sujeto_id=eq.id,
        titulo="Permiso de Circulación",
        estado_calc="ok",
        obligatorio=True,
        vence=date.today() + timedelta(days=45),
        es_emsipor=False
    )
    sesion_db.add(doc_eq)
    sesion_db.commit()

    # --- PESTAÑA EMPRESA ---
    r_emp = app_cliente.get(f"{API}/contratos/{c_id}/hoja-calculo?tab=empresa", headers=empresa_a["headers"])
    assert r_emp.status_code == 200, r_emp.text
    data_emp = r_emp.json()
    assert data_emp["columnas"] == ["Requisito", "Obligatorio", "Plataforma", "Estado", "Vencimiento", "Días para vencer"]
    assert len(data_emp["filas"]) >= 1
    assert any("Reglamento Interno" in f[0] for f in data_emp["filas"])
    assert "\t" in data_emp["tsv"]

    # --- PESTAÑA PERSONAL ---
    r_per = app_cliente.get(f"{API}/contratos/{c_id}/hoja-calculo?tab=personal", headers=empresa_a["headers"])
    assert r_per.status_code == 200, r_per.text
    data_per = r_per.json()
    assert data_per["columnas"][:8] == ["Nombre", "RUT", "Cargo", "Faena", "Estado", "% cumplimiento", "Docs vigentes", "Vencidos"]
    assert "Cédula de Identidad" in data_per["columnas"]
    assert any(f[0] == "Pedro Picapiedra" for f in data_per["filas"])

    # --- PESTAÑA EQUIPOS ---
    r_eq = app_cliente.get(f"{API}/contratos/{c_id}/hoja-calculo?tab=equipos", headers=empresa_a["headers"])
    assert r_eq.status_code == 200, r_eq.text
    data_eq = r_eq.json()
    assert data_eq["columnas"][:8] == ["Patente", "Tipo", "Marca/Modelo", "Faena", "Estado", "% cumplimiento", "Docs vigentes", "Vencidos"]
    assert "Permiso de Circulación" in data_eq["columnas"]
    assert any(f[0] == "GHJK-88" for f in data_eq["filas"])

    # --- PESTAÑA LICENCIA ---
    r_lic = app_cliente.get(f"{API}/contratos/{c_id}/hoja-calculo?tab=licencia", headers=empresa_a["headers"])
    assert r_lic.status_code == 200, r_lic.text
    data_lic = r_lic.json()
    assert data_lic["columnas"][:7] == ["Conductor", "RUT", "Cargo", "N° licencia", "Estado LIM", "Vence LIM", "Estado EMSIPOR"]
    assert "Hoja de Vida del Conductor" in data_lic["columnas"]
    fila_cond = next((f for f in data_lic["filas"] if f[0] == "Pedro Picapiedra"), None)
    assert fila_cond is not None
    assert fila_cond[3] == "LIM-9941"
    assert fila_cond[4] == "Vigente"
    assert fila_cond[6] == "Acreditado"


# ============================================================================
# TAREA 2.3: Extracción IA de requisitos de plataforma
# ============================================================================

def test_extraer_listado_requisitos_plataforma(app_cliente, empresa_a):
    """Verifica que el endpoint y las funciones de parsing soporten 'requisitos_plataforma'
    e incluyan el campo 'periodicidad'."""
    # 1. Extracción con texto simulado
    texto_tsv = (
        "Requisito\tCategoría\tObligatorio\tPeriodicidad\n"
        "Examen Ocupacional Gran Altura\tpersonal\tSí\tanual\n"
        "Certificado F30-1\tempresa\tSí\tmensual\n"
        "Revisión Técnica Clase B\tequipo\tSí\tsemestral"
    )
    r = app_cliente.post(
        f"{API}/ia/extraer-listado",
        headers=empresa_a["headers"],
        json={"tipo": "requisitos_plataforma", "texto": texto_tsv}
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 3
    assert items[0]["nombre"] == "Examen Ocupacional Gran Altura"
    assert items[0]["categoria"] == "personal"
    assert items[0]["obligatorio"] is True
    assert items[0]["periodicidad"] == "anual"
    assert items[1]["periodicidad"] == "mensual"
    assert items[2]["periodicidad"] == "semestral"

    # 2. Fallback determinista para requisitos_plataforma
    r_fb = app_cliente.post(
        f"{API}/ia/extraer-listado",
        headers=empresa_a["headers"],
        json={"tipo": "requisitos_plataforma"}
    )
    assert r_fb.status_code == 200
    fb_items = r_fb.json()["items"]
    assert len(fb_items) > 0
    for it in fb_items:
        assert "nombre" in it
        assert "categoria" in it
        assert "obligatorio" in it
        assert "periodicidad" in it


# ============================================================================
# TAREA 2.4: Soporte dual Buk / Talana y endpoint sincronizar-rrhh
# ============================================================================

def test_sincronizar_rrhh_dual_buk_talana(app_cliente, empresa_a, contrato_a, sesion_db):
    """Verifica el soporte de proveedor 'buk' y 'talana' con fallback resiliente,
    así como la nueva ruta alias /sincronizar-rrhh."""
    c_id = uuid.UUID(contrato_a["id"])

    # Crear período laboral para la prueba
    per = PeriodoLaboral(
        contrato_id=c_id,
        nombre="Noviembre 2026",
        mes_anio="2026-11",
        fecha_inicio=date(2026, 11, 1),
        fecha_fin=date(2026, 11, 30),
        estado="abierto",
    )
    sesion_db.add(per)
    sesion_db.flush()

    # Documento de muestra en el período para auditar fallback
    pdoc = PeriodoDocumento(
        periodo_id=per.id,
        nombre="Liquidaciones de Sueldo Noviembre",
        estado="pendiente",
    )
    sesion_db.add(pdoc)
    sesion_db.commit()

    p_id = str(per.id)

    # 1. Fallback Talana por ruta estándar
    r_talana_fb = app_cliente.post(
        f"{API}/contratos/{c_id}/periodos/{p_id}/sincronizar-buk?proveedor=talana",
        headers=empresa_a["headers"]
    )
    assert r_talana_fb.status_code == 200, r_talana_fb.text
    res_t = r_talana_fb.json()
    assert res_t["ok"] is True
    assert res_t["proveedor"] == "talana"
    assert res_t["modo"] == "manual_fallback"
    assert "Talana" in res_t["mensaje"]

    # 2. Simulación éxito Talana por ruta alias /sincronizar-rrhh
    r_talana_sim = app_cliente.post(
        f"{API}/contratos/{c_id}/periodos/{p_id}/sincronizar-rrhh?proveedor=talana&simular_exito=true",
        headers=empresa_a["headers"]
    )
    assert r_talana_sim.status_code == 200, r_talana_sim.text
    res_sim_t = r_talana_sim.json()
    assert res_sim_t["ok"] is True
    assert res_sim_t["proveedor"] == "talana"
    assert res_sim_t["modo"] == "talana_api"
    assert "Talana" in res_sim_t["mensaje"]

    # 3. Simulación éxito Buk por ruta alias /sincronizar-rrhh
    r_buk_sim = app_cliente.post(
        f"{API}/contratos/{c_id}/periodos/{p_id}/sincronizar-rrhh?proveedor=buk&simular_exito=true",
        headers=empresa_a["headers"]
    )
    assert r_buk_sim.status_code == 200, r_buk_sim.text
    res_sim_b = r_buk_sim.json()
    assert res_sim_b["ok"] is True
    assert res_sim_b["proveedor"] == "buk"
    assert res_sim_b["modo"] == "buk_api"
    assert "Buk" in res_sim_b["mensaje"]


# ============================================================================
# FASE 4 (Tarea 4.1): Suite de integración Gap Analysis
# ============================================================================

def test_agendamiento_contextual_sujeto_y_aislamiento(app_cliente, empresa_a, empresa_b, contrato_a):
    """Crea trabajador en contrato_a, agenda examen en Mutual de Seguridad y valida aislamiento B->404."""
    r_trab = app_cliente.post(
        f"{API}/personal",
        headers=empresa_a["headers"],
        json={
            "contrato_id": contrato_a["id"],
            "nombre": "Marta Rojas",
            "rut": rut_valido(401),
            "cargo": "Operador",
        },
    )
    assert r_trab.status_code == 201, r_trab.text
    sujeto_id = r_trab.json()["id"]

    r_ev = app_cliente.post(
        f"{API}/calendario/eventos",
        headers=empresa_a["headers"],
        json={
            "titulo": "Examen Ocupacional Altura",
            "categoria": "capacitacion",
            "fecha": (date.today() + timedelta(days=5)).isoformat(),
            "sujeto_id": sujeto_id,
            "contrato_id": contrato_a["id"],
            "centro_atencion": "Mutual de Seguridad",
            "enviar_notificacion": True,
        },
    )
    assert r_ev.status_code == 201, r_ev.text
    ev_id = r_ev.json()["id"]

    r_act = app_cliente.get(
        f"{API}/calendario/sujetos/{sujeto_id}/activo",
        headers=empresa_a["headers"],
    )
    assert r_act.status_code == 200, r_act.text
    activo = r_act.json()["activo"]
    assert activo is not None
    assert activo["id"] == ev_id
    assert activo["centro_atencion"] == "Mutual de Seguridad"
    assert activo["sujeto"]["id"] == sujeto_id

    r_b = app_cliente.get(
        f"{API}/calendario/sujetos/{sujeto_id}/activo",
        headers=empresa_b["headers"],
    )
    assert r_b.status_code == 404


def test_hoja_calculo_tsv_cuatro_pestanas(app_cliente, empresa_a, contrato_a):
    """Valida columnas, filas y formato TSV (len(filas) + 1 líneas con \\t) en las 4 pestañas."""
    for tab in ("empresa", "personal", "equipos", "licencia"):
        r = app_cliente.get(
            f"{API}/contratos/{contrato_a['id']}/hoja-calculo?tab={tab}",
            headers=empresa_a["headers"],
        )
        assert r.status_code == 200, f"tab={tab}: {r.text}"
        data = r.json()
        assert isinstance(data["columnas"], list) and len(data["columnas"]) > 0
        assert isinstance(data["filas"], list)
        lineas = data["tsv"].splitlines()
        assert len(lineas) == len(data["filas"]) + 1
        for linea in lineas:
            assert len(linea.split("\t")) == len(data["columnas"])


def test_extraccion_ia_requisitos_plataforma(app_cliente, empresa_a):
    """Valida extracción tabular con pipe para tipo='requisitos_plataforma'."""
    texto = (
        "Examen Altura Física | personal | obligatorio | 12 meses\n"
        "Seguro RC | empresa | obligatorio | 24 meses"
    )
    r = app_cliente.post(
        f"{API}/ia/extraer-listado",
        headers=empresa_a["headers"],
        json={"tipo": "requisitos_plataforma", "texto": texto},
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 2
    assert items[0]["nombre"] == "Examen Altura Física"
    assert items[0]["categoria"] == "personal"
    assert items[0]["obligatorio"] is True
    assert items[0]["periodicidad"] == "12 meses"
    assert items[1]["nombre"] == "Seguro RC"
    assert items[1]["categoria"] == "empresa"
    assert items[1]["obligatorio"] is True
    assert items[1]["periodicidad"] == "24 meses"


def test_sincronizacion_rrhh_buk_y_talana_fallback(app_cliente, empresa_a, contrato_a):
    """Crea período laboral y verifica sincronizar-buk con Talana en fallback y simulación exitosa."""
    r_per = app_cliente.post(
        f"{API}/contratos/{contrato_a['id']}/periodos",
        headers=empresa_a["headers"],
        json={
            "nombre": "Diciembre 2026",
            "tipo": "mensual",
            "fecha_inicio": "2026-12-01",
            "fecha_fin": "2026-12-31",
        },
    )
    assert r_per.status_code == 200, r_per.text
    periodo_id = r_per.json()["id"]

    for sim in ("false", "true"):
        r_sync = app_cliente.post(
            f"{API}/contratos/{contrato_a['id']}/periodos/{periodo_id}/sincronizar-buk"
            f"?proveedor=talana&simular_exito={sim}",
            headers=empresa_a["headers"],
        )
        assert r_sync.status_code == 200, f"sim={sim}: {r_sync.text}"
        body = r_sync.json()
        assert body["ok"] is True
        assert "Talana" in body["mensaje"]
        assert any("Talana" in log for log in body.get("logs", []))

