"""Datos semilla idempotentes: catálogos base y datos de prueba completos para DEMO SpA."""
from datetime import date, datetime, timedelta
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Actividad, Alerta, Cargo, CargoRequisito, Company, CompanyFaenaPlataforma,
    Contrato, ContratoPlataforma, ContratoRequisito, ContratoPlantillaOverride,
    CumplimientoSnapshot, DocEjemplo, Documento, DocumentoArchivo, EventoCalendario,
    Factura, Faena, FaenaPlataforma, IaHallazgo, IaReview, Integracion,
    LicenciaInterna, NotificacionPreferencia, PasswordResetToken, Plan,
    PlataformaCredencial, ProveedorCatalogo, RefreshToken, Reporte,
    ReporteProgramado, RequisitoTemplate, RequisitoTerreno, Sujeto, Suscripcion,
    SyncLog, User, PeriodoLaboral, PeriodoDocumentoRequerido, PeriodoDocumento, AuditoriaDocumento
)
from .security import hash_password

FAENAS = [
    ("Los Pelambres", "Antofagasta Minerals", "AMSA", "Coquimbo", "#1f6f54", -31.72, -70.49),
    ("Minera Centinela", "Antofagasta Minerals", "AMSA", "Antofagasta", "#8a5a00", -22.97, -69.09),
    ("Zaldívar", "Antofagasta Minerals", "AMSA", "Antofagasta", "#7a3030", -24.20, -69.05),
    ("Antucoya", "Antofagasta Minerals", "AMSA", "Antofagasta", "#3a5f8a", -22.63, -69.85),
    ("Candelaria", "Lundin Mining", "Lundin", "Atacama", "#795c9c", -27.51, -70.29),
    ("Caserones", "Lundin Mining", "Lundin", "Atacama", "#2f7d8a", -28.03, -69.28),
    ("Andina", "Codelco", "Codelco", "Valparaíso", "#b04a17", -33.15, -70.25),
    ("El Teniente", "Codelco", "Codelco", "O'Higgins", "#5f7a30", -34.09, -70.35),
]

PLATAFORMAS = {
    "Los Pelambres": ["SIGA", "DIRECTIC", "SGES", "Academia MLP", "EMSIPOR"],
    "Minera Centinela": ["SIGA", "INTELICONTROL"],
    "Zaldívar": ["WEBCONTROL"],
    "Antucoya": ["SIGA", "INTELICONTROL"],
    "Candelaria": ["WEBCONTROL"],
    "Caserones": ["WEBCONTROL", "SUCAL"],
    "Andina": ["META CONTRATAS", "WEBCONTROL"],
    "El Teniente": ["META CONTRATAS", "WEBCONTROL"],
}

REQ_EMPRESA = [
    ("Contrato de Servicio", True, "contrato", "legal", None),
    ("Estrategias de Control SSO", True, None, "certificacion", None),
    ("Declaración Representante Legal", True, None, "legal", None),
    ("Reunión de Arranque", True, None, "certificacion", None),
    ("Programa de Trabajo SSO", True, "programa", "certificacion", 12),
    ("Copia Carta Inicio Actividades SERNAGEOMIN", True, None, "legal", None),
    ("Matriz de Riesgo", True, None, "tecnico", 12),
    ("Procedimiento de Emergencia", True, None, "tecnico", None),
    ("Certificado Ley 16.744", True, "mutual", "legal", 1),
    ("Jornada Excepcional de Trabajo", False, None, "legal", None),
]
REQ_PERSONAL = [
    ("Cédula de Identidad", True, "licencia", "legal", None),
    ("Contrato de Trabajo", True, "contrato", "legal", None),
    ("Anexo Contrato", True, "contrato", "legal", None),
    ("Certificado de Salud y Examen de Altura", True, "altura", "medico", 12),
    ("Inducción Hombre Nuevo", True, "induccion", "capacitacion", 24),
    ("Reglamento Interno", True, "rioshs", "legal", None),
    ("Certificado de Estudios", True, "estudios", "legal", None),
    ("Finiquito Anterior", False, "finiquito", "legal", None),
    ("Consentimiento Alcohol y Drogas", True, "consentimiento", "legal", 12),
    ("ODI Curso COVID", True, "odi", "capacitacion", None),
    ("Certificado de Residencia", False, "residencia", "legal", 6),
    ("IRL Mina y Chancado", True, "irlmina", "capacitacion", 12),
    ("Manejo Defensivo", True, "curso", "capacitacion", 24),
]
REQ_EQUIPO = [
    ("Permiso de Circulación", True, "circulacion", "legal", 12),
    ("SOAP", True, "soap", "legal", 12),
    ("Revisión Técnica", True, "revtec", "tecnico", 12),
    ("GPS", True, "gps", "tecnico", None),
    ("Certificado Incorporación Multiflota GPS MLP", True, "gps", "tecnico", None),
    ("Certificado de Láminas", True, None, "tecnico", None),
    ("Inspección Visual", True, "checklist", "tecnico", 6),
    ("Certificado de Mantenciones", True, "mantencion", "tecnico", 6),
    ("Certificado de Operatividad", True, "mantencion", "tecnico", 12),
    ("Certificado Barra Antivuelcos", False, "barra", "tecnico", None),
]
REQ_EMSIPOR = [
    ("Solicitud AIC Mina", True, None, "certificacion", None, "SIGA"),
    ("Fotografía Trabajador", True, None, "certificacion", None, "SIGA"),
    ("Licencia Municipal de Conducir", True, "licencia", "legal", None, "SIGA"),
    ("Hoja de Vida del Conductor", True, None, "legal", 1, "SIGA"),
    ("Psicosensométrico Riguroso", True, "psico", "medico", 24, "DIRECTIC"),
    ("Curso Manejo Defensivo y Alta Montaña", True, "curso", "capacitacion", 24, "Academia MLP"),
    ("Examen Práctico Mina", True, None, "capacitacion", None, "EMSIPOR"),
    ("Anexo Faena", True, None, "legal", None, "EMSIPOR"),
    ("Anexo Mina", True, None, "legal", None, "EMSIPOR"),
]

EJEMPLOS = [
    ("contrato", "Contrato de Trabajo", "Código del Trabajo",
     [["Empleador", "Razón social y RUT"], ["Trabajador", "Nombre y RUT"]],
     "Debe estar firmado por ambas partes."),
    ("altura", "Certificado de Salud y Examen de Altura", "DS 594 / Estándar MLP",
     [["Resultado", "APTO / NO APTO"], ["Validez", "12 meses"]],
     "Solo centros médicos homologados por la faena."),
    ("induccion", "Inducción Hombre Nuevo", "Estándar del mandante",
     [["Vigencia", "24 meses"]], None),
    ("soap", "Seguro Obligatorio SOAP", "Ley 18.490",
     [["Vigencia", "Anual"], ["Patente", "Debe coincidir"]], None),
    ("revtec", "Revisión Técnica", "MTT",
     [["Vigencia", "Anual"]], None),
    ("psico", "Examen Psicosensométrico Riguroso", "Estándar EMSIPOR",
     [["Vigencia", "2 años"]], None),
    ("licencia", "Licencia Municipal de Conducir", "Ley de Tránsito",
     [["Clase", "Según tipo de vehículo"]], None),
    ("mutual", "Certificado Ley 16.744", "Mutualidad",
     [["Vigencia", "30 días desde emisión"]], "Se renueva mensualmente."),
    ("programa", "Programa de Trabajo SSO", "Estándar del mandante",
     [["Período", "Anual"]], None),
    ("rioshs", "Reglamento Interno de Orden, Higiene y Seguridad", "DT",
     [["Registro", "Dirección del Trabajo"]], None),
    ("estudios", "Certificado de Estudios", "MINEDUC",
     [["Nivel", "Según cargo"]], None),
    ("finiquito", "Finiquito Anterior", "Código del Trabajo",
     [["Firma", "Ministro de fe"]], None),
    ("consentimiento", "Consentimiento Alcohol y Drogas", "Estándar del mandante",
     [["Vigencia", "12 meses"]], None),
    ("residencia", "Certificado de Residencia", "Junta de vecinos / notarial",
     [["Vigencia", "6 meses"]], None),
    ("odi", "ODI - Obligación de Informar", "DS 40 art. 21",
     [["Firma", "Trabajador y empleador"]], None),
    ("irlmina", "IRL Mina y Chancado", "Estándar MLP",
     [["Vigencia", "12 meses"]], None),
    ("curso", "Certificado de Curso", "Organismo capacitador",
     [["Vigencia", "Según curso"]], None),
    ("circulacion", "Permiso de Circulación", "Municipalidad",
     [["Vigencia", "Anual"]], None),
    ("gps", "Certificado GPS", "Proveedor homologado",
     [["Proveedor", "Wisetrack / MiFlota / SafeTrack"]], None),
    ("checklist", "Inspección Visual / Checklist", "Estándar faena",
     [["Vigencia", "6 meses"]], None),
    ("mantencion", "Certificado de Mantenciones", "Taller homologado",
     [["Vigencia", "6 meses"]], None),
    ("barra", "Certificado Barra Antivuelcos", "Estándar MLP (camionetas)",
     [["Instalador", "Taller certificado"]], None),
]


def run(db: Session) -> None:
    today = date.today()

    # 1. Faenas y Plataformas Base
    if not db.scalar(select(Faena.id).limit(1)):
        for nombre, mandante, grupo, region, color, lat, lng in FAENAS:
            f = Faena(nombre=nombre, mandante=mandante, grupo=grupo,
                      region=region, color=color, lat=lat, lng=lng)
            db.add(f)
            db.flush()
            for idx, p in enumerate(PLATAFORMAS.get(nombre, [])):
                db.add(FaenaPlataforma(faena_id=f.id, nombre=p, orden=idx + 1))
        db.flush()

    # 2. Documentos de Ejemplo
    if not db.scalar(select(DocEjemplo.clave).limit(1)):
        for clave, nombre, ref, campos, tip in EJEMPLOS:
            db.add(DocEjemplo(clave=clave, nombre=nombre, referencia=ref,
                              campos_clave=campos, notas=[], tip=tip))
        db.flush()

    # 3. Plantillas de Requisitos
    if not db.scalar(select(RequisitoTemplate.id).limit(1)):
        contador = 0

        def agregar(ambito, filas):
            nonlocal contador
            for fila in filas:
                titulo, oblig, ejemplo, tipo, vig = fila[:5]
                plataforma = fila[5] if len(fila) > 5 else None
                contador += 1
                db.add(RequisitoTemplate(
                    ambito=ambito, titulo=titulo, codigo=f"REQ-{contador:03d}",
                    tipo=tipo, obligatorio=oblig, ejemplo_clave=ejemplo,
                    vigencia_meses=vig, plataforma=plataforma,
                ))

        agregar("empresa", REQ_EMPRESA)
        agregar("personal", REQ_PERSONAL)
        agregar("equipo", REQ_EQUIPO)
        agregar("emsipor", REQ_EMSIPOR)
        db.flush()

    # 4. Planes Comerciales Base
    plan_pro = db.scalar(select(Plan).where(Plan.nombre == "Plan Pro"))
    if not plan_pro:
        p_starter = Plan(nombre="Plan Starter", precio=8.0, moneda="UF", periodo="mensual",
                         limites={"personal": 25, "equipos": 10}, activo=True)
        plan_pro = Plan(nombre="Plan Pro", precio=18.0, moneda="UF", periodo="mensual",
                        limites={"personal": 100, "equipos": 40}, activo=True)
        p_ent = Plan(nombre="Plan Enterprise", precio=45.0, moneda="UF", periodo="mensual",
                     limites={"personal": 500, "equipos": 200}, activo=True)
        db.add_all([p_starter, plan_pro, p_ent])
        db.flush()

    # 5. Usuarios y Empresas Base
    demo_company = db.scalar(select(Company).where(Company.email == "demo@acredittia.cl"))
    if not demo_company:
        demo_company = Company(nombre="DEMO SpA", rut="76.111.222-8",
                               email="demo@acredittia.cl", status="approved", es_demo=True)
        db.add(demo_company)
        db.flush()

    admin_user = db.scalar(select(User).where(User.email == "admin@acredittia.cl"))
    if not admin_user:
        admin_user = User(email="admin@acredittia.cl",
                          password_hash=hash_password("Admin2026!"),
                          nombre="Administrador General",
                          role="admin", company_id=None, status="approved")
        db.add(admin_user)
        db.flush()

    demo_user = db.scalar(select(User).where(User.email == "demo@acredittia.cl"))
    if not demo_user:
        demo_user = User(email="demo@acredittia.cl",
                         password_hash=hash_password("Demo2026!"),
                         nombre="Administrador DEMO",
                         role="company", company_id=demo_company.id, status="approved")
        db.add(demo_user)
        db.flush()

    # Empresa Secundaria contratista
    contratista_sec = db.scalar(select(Company).where(Company.rut == "77.888.999-5"))
    if not contratista_sec:
        contratista_sec = Company(nombre="Minera El Salto SpA", rut="77.888.999-5",
                                  email="contacto@elsaltospa.cl", status="approved", es_demo=False)
        db.add(contratista_sec)
        db.flush()

    # 6. Tokens de Sesión
    if not db.scalar(select(RefreshToken.id).limit(1)):
        db.add(RefreshToken(user_id=demo_user.id, token_hash="dummy_hash_demo_refresh",
                            expires_at=datetime.utcnow() + timedelta(days=30)))
        db.add(PasswordResetToken(user_id=demo_user.id, token_hash="dummy_hash_reset",
                                  expires_at=datetime.utcnow() + timedelta(hours=2),
                                  used_at=datetime.utcnow()))
        db.flush()

    # 7. Suscripciones y Facturas
    susc = db.scalar(select(Suscripcion).where(Suscripcion.company_id == demo_company.id))
    if not susc:
        susc = Suscripcion(company_id=demo_company.id, plan_id=plan_pro.id, estado="activa",
                           trial_hasta=today + timedelta(days=90),
                           periodo_actual_desde=today - timedelta(days=15),
                           periodo_actual_hasta=today + timedelta(days=15))
        db.add(susc)
        db.flush()
        db.add_all([
            Factura(suscripcion_id=susc.id, company_id=demo_company.id, folio="F-2026-001",
                    monto=18.0, moneda="UF", estado="pagada", emitida_at=datetime.utcnow() - timedelta(days=60),
                    pagada_at=datetime.utcnow() - timedelta(days=58)),
            Factura(suscripcion_id=susc.id, company_id=demo_company.id, folio="F-2026-002",
                    monto=18.0, moneda="UF", estado="pagada", emitida_at=datetime.utcnow() - timedelta(days=30),
                    pagada_at=datetime.utcnow() - timedelta(days=29)),
            Factura(suscripcion_id=susc.id, company_id=demo_company.id, folio="F-2026-003",
                    monto=18.0, moneda="UF", estado="pendiente", emitida_at=datetime.utcnow() - timedelta(days=2)),
        ])
        db.flush()

    # 8. Requisitos Terreno (Solo Lectura)
    if not db.scalar(select(RequisitoTerreno.id).limit(1)):
        db.add_all([
            RequisitoTerreno(ambito="conductor", titulo="Reglamento de Tránsito Minero MLP (Art. 45 - Cinturón)",
                             descripcion="Uso obligatorio de cinturón de tres puntos para todos los ocupantes.",
                             nivel="critico", icono="shield-alert", referencia="DS 132 / Art. 45"),
            RequisitoTerreno(ambito="conductor", titulo="Alcoholemia y Narcotest en Garita (Tolerancia 0.0)",
                             descripcion="Controles aleatorios diarios a la entrada de faena.",
                             nivel="critico", icono="alert-triangle", referencia="Estándar Salud MLP"),
            RequisitoTerreno(ambito="equipo", titulo="Cuñas de Seguridad y Pértiga con Luz Estroboscópica",
                             descripcion="Pértiga de 4.2m de altura mínima y banderola roja reflejante.",
                             nivel="importante", icono="truck", referencia="Manual de Equipos Mina"),
            RequisitoTerreno(ambito="equipo", titulo="Radio Transmisor VHF Frecuencia Mina (Canal 4)",
                             descripcion="Equipo base o portátil con canal de comunicación directa con Despacho Mina.",
                             nivel="importante", icono="radio", referencia="Procedimiento Comunicaciones"),
            RequisitoTerreno(ambito="conductor", titulo="Check-list Pre-operacional Diario",
                             descripcion="Inspección física previa al encendido del vehículo registrada en app móvil.",
                             nivel="informativo", icono="clipboard-check", referencia="Procedimiento Operaciones"),
        ])
        db.flush()

    # 9. Proveedores Catálogo
    faena_pelambres = db.scalar(select(Faena).where(Faena.nombre == "Los Pelambres"))
    faena_centinela = db.scalar(select(Faena).where(Faena.nombre == "Minera Centinela"))
    faena_andina = db.scalar(select(Faena).where(Faena.nombre == "Andina"))

    if not db.scalar(select(ProveedorCatalogo.id).limit(1)):
        db.add_all([
            ProveedorCatalogo(categoria="laboratorio", nombre="ACHS Laboratorio Central Santiago",
                              localidad="Santiago / Illapel", certificacion="ISO 9001 / SERNAGEOMIN",
                              faena_id=faena_pelambres.id if faena_pelambres else None),
            ProveedorCatalogo(categoria="laboratorio", nombre="Mutual de Seguridad Antofagasta",
                              localidad="Antofagasta / Calama", certificacion="Homologado AMSA",
                              faena_id=faena_centinela.id if faena_centinela else None),
            ProveedorCatalogo(categoria="taller", nombre="HeavyTrucks Servicio Mecánico SpA",
                              localidad="Los Andes", certificacion="Certificado Codelco",
                              faena_id=faena_andina.id if faena_andina else None),
            ProveedorCatalogo(categoria="gps", nombre="Wisetrack Chile S.A.",
                              localidad="Nacional", certificacion="Integración Multiflota MLP",
                              faena_id=faena_pelambres.id if faena_pelambres else None),
            ProveedorCatalogo(categoria="gps", nombre="SafeTrack GPS Minero",
                              localidad="Antofagasta", certificacion="Homologado Centinela"),
        ])
        db.flush()

    # 10. Cargos Base
    cargos_map = {}
    cargos_def = [
        ("Conductor de Alta Montaña", "conduccion", True),
        ("Operador Rigger D - Grúa Heavy", "operacion", True),
        ("Supervisor de Seguridad SSO", "supervision", False),
        ("Mecánico de Mantención Minera", "mantencion", False),
        ("Ingeniero Prevencionista de Riesgos (APR)", "supervision", True),
        ("Electricista Clase A", "operacion", False),
        ("Administrador de Contrato", "administracion", False),
    ]
    for nombre_c, cat_c, req_ems in cargos_def:
        cg = db.scalar(select(Cargo).where(Cargo.nombre == nombre_c))
        if not cg:
            cg = Cargo(company_id=None, nombre=nombre_c, nombre_normalizado=nombre_c.lower(),
                       categoria=cat_c, requiere_emsipor=req_ems, activo=True)
            db.add(cg)
            db.flush()
        cargos_map[nombre_c] = cg

    # Vincular requisitos a cargos
    if not db.scalar(select(CargoRequisito.id).limit(1)):
        tmpl_lic = db.scalar(select(RequisitoTemplate).where(RequisitoTemplate.titulo == "Cédula de Identidad"))
        tmpl_alt = db.scalar(select(RequisitoTemplate).where(RequisitoTemplate.titulo == "Certificado de Salud y Examen de Altura"))
        tmpl_def = db.scalar(select(RequisitoTemplate).where(RequisitoTemplate.titulo == "Manejo Defensivo"))

        if tmpl_lic and tmpl_alt and tmpl_def:
            c_cond = cargos_map.get("Conductor de Alta Montaña")
            if c_cond:
                db.add_all([
                    CargoRequisito(cargo_id=c_cond.id, requisito_template_id=tmpl_lic.id, obligatorio=True),
                    CargoRequisito(cargo_id=c_cond.id, requisito_template_id=tmpl_alt.id, obligatorio=True),
                    CargoRequisito(cargo_id=c_cond.id, requisito_template_id=tmpl_def.id, obligatorio=True),
                ])
                db.flush()

    # 11. Contratos para DEMO SpA
    contratos_map = {}
    contratos_def = [
        ("CTR-2026-088", "Servicios de Transporte y Operaciones Mineras MLP", faena_pelambres, today - timedelta(days=120), today + timedelta(days=245), "vigente"),
        ("CTR-2026-092", "Mantenimiento Electromecánico Planta Andina", faena_andina, today - timedelta(days=90), today + timedelta(days=275), "vigente"),
        ("CTR-2026-105", "Servicio de Movimiento de Tierra y Rigger Centinela", faena_centinela, today - timedelta(days=60), today + timedelta(days=300), "vigente"),
    ]
    for cod_c, nom_c, faena_obj, f_ini, f_fin, est_c in contratos_def:
        ct = db.scalar(select(Contrato).where(Contrato.codigo == cod_c))
        if not ct and faena_obj:
            ct = Contrato(company_id=demo_company.id, faena_id=faena_obj.id,
                          nombre=nom_c, codigo=cod_c, fecha_inicio=f_ini,
                          fecha_termino=f_fin, renovacion_automatica=True, estado=est_c)
            db.add(ct)
            db.flush()
        if ct:
            contratos_map[cod_c] = ct

    # Usuario de contrato admin
    if not db.scalar(select(User).where(User.email == "admin.contratos@acredittia.cl")):
        ct_main = contratos_map.get("CTR-2026-088")
        db.add(User(email="admin.contratos@acredittia.cl",
                    password_hash=hash_password("Contrato2026!"),
                    nombre="Juan Administrador de Contrato",
                    role="contract_admin", company_id=demo_company.id,
                    contrato_id=ct_main.id if ct_main else None, status="approved"))
        db.flush()

    # 12. Plataformas por Faena y Contrato
    ct_088 = contratos_map.get("CTR-2026-088")
    if ct_088 and faena_pelambres:
        plat_siga = db.scalar(select(FaenaPlataforma).where(
            (FaenaPlataforma.faena_id == faena_pelambres.id) & (FaenaPlataforma.nombre == "SIGA")))
        plat_directic = db.scalar(select(FaenaPlataforma).where(
            (FaenaPlataforma.faena_id == faena_pelambres.id) & (FaenaPlataforma.nombre == "DIRECTIC")))

        if plat_siga and not db.scalar(select(CompanyFaenaPlataforma.id).where(
                (CompanyFaenaPlataforma.company_id == demo_company.id) & (CompanyFaenaPlataforma.faena_plataforma_id == plat_siga.id))):
            db.add(CompanyFaenaPlataforma(company_id=demo_company.id, faena_plataforma_id=plat_siga.id,
                                          estado="activa", habilitado_at=datetime.utcnow() - timedelta(days=100)))

        if not db.scalar(select(ContratoPlataforma.id).where(ContratoPlataforma.contrato_id == ct_088.id)):
            now_dt = datetime.utcnow()
            cp_siga = ContratoPlataforma(company_id=demo_company.id, contrato_id=ct_088.id,
                                         faena_plataforma_id=plat_siga.id if plat_siga else None,
                                         nombre="SIGA MLP", descripcion="Acreditación Personal y Vehículos",
                                         estado="activa", es_custom=False, orden=1,
                                         habilitado_at=now_dt - timedelta(days=100))
            cp_directic = ContratoPlataforma(company_id=demo_company.id, contrato_id=ct_088.id,
                                             faena_plataforma_id=plat_directic.id if plat_directic else None,
                                             nombre="DIRECTIC MLP", descripcion="Exámenes Médicos y Psicosensométricos",
                                             estado="activa", es_custom=False, orden=2,
                                             habilitado_at=now_dt - timedelta(days=100))
            db.add_all([cp_siga, cp_directic])
            db.flush()

            # Credenciales de plataforma (JWE compact de 5 partes validado por fn_check_credencial)
            dummy_jwe = "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0.b3BlbnNzaA.aXZ2YWx1ZQ.Y2lwaGVydGV4dA.dGFn"
            db.add_all([
                PlataformaCredencial(company_id=demo_company.id, contrato_plataforma_id=cp_siga.id,
                                     nombre="Acceso SIGA Operaciones", usuario="demo_siga_usr",
                                     credencial_jwe=dummy_jwe, kid="key-siga-v1",
                                     estado="activa", expira_at=now_dt + timedelta(days=180)),
                PlataformaCredencial(company_id=demo_company.id, contrato_plataforma_id=cp_directic.id,
                                     nombre="Acceso DIRECTIC Salud", usuario="demo_directic_usr",
                                     credencial_jwe=dummy_jwe, kid="key-dir-v1",
                                     estado="activa", expira_at=now_dt + timedelta(days=120)),
            ])
            db.flush()

    # Requisitos de Contrato Personalizados
    if ct_088 and not db.scalar(select(ContratoRequisito.id).where(ContratoRequisito.contrato_id == ct_088.id)):
        db.add_all([
            ContratoRequisito(company_id=demo_company.id, contrato_id=ct_088.id, vinculo_tipo="otro",
                              ambito="empresa", titulo="Póliza de Responsabilidad Civil General US$ 2.000.000",
                              obligatorio=True, origen="custom", vigencia_meses=12),
            ContratoRequisito(company_id=demo_company.id, contrato_id=ct_088.id, vinculo_tipo="otro",
                              ambito="personal", titulo="Certificado de Inducción Específica Cordillera MLP",
                              obligatorio=True, origen="custom", vigencia_meses=12),
        ])
        db.flush()

    # Overrides de plantilla por contrato
    if ct_088 and not db.scalar(select(ContratoPlantillaOverride.id).where(ContratoPlantillaOverride.contrato_id == ct_088.id)):
        tmpl_sample = db.scalars(select(RequisitoTemplate.id).limit(3)).all()
        db.add(ContratoPlantillaOverride(company_id=demo_company.id, contrato_id=ct_088.id,
                                         ambito="personal", requisito_template_ids=list(tmpl_sample)))
        db.flush()

    # 13. Sujetos (Personal y Equipos)
    personal_list = [
        ("Carlos Andrés Ramírez Morales", "15.842.109-K", "Conductor de Alta Montaña", True, "ok", ct_088),
        ("Diego Francisco Contreras Silva", "17.391.450-4", "Operador Rigger D - Grúa Heavy", True, "ok", ct_088),
        ("Marcela Andrea Soto Sepúlveda", "16.204.881-2", "Supervisor de Seguridad SSO", False, "proc", ct_088),
        ("José Luis Fernández Vargas", "14.510.992-8", "Mecánico de Mantención Minera", True, "falta", contratos_map.get("CTR-2026-092")),
        ("Rodrigo Esteban Morales Pinto", "18.112.304-1", "Ingeniero Prevencionista de Riesgos (APR)", False, "venc", contratos_map.get("CTR-2026-092")),
        ("Patricia Elizabeth Vera Muñoz", "19.045.671-3", "Electricista Clase A", False, "ok", contratos_map.get("CTR-2026-105")),
        ("Andrés Felipe Araya Castro", "16.890.123-5", "Conductor de Alta Montaña", True, "proc", contratos_map.get("CTR-2026-105")),
        ("Francisco Javier Silva Rojas", "13.784.551-0", "Administrador de Contrato", False, "ok", ct_088),
    ]

    sujetos_map = {}
    for nom_p, rut_p, cargo_p, es_cond, est_p, ct_obj in personal_list:
        if ct_obj:
            sj = db.scalar(select(Sujeto).where((Sujeto.company_id == demo_company.id) & (Sujeto.rut == rut_p)))
            if not sj:
                cg_obj = cargos_map.get(cargo_p)
                sj = Sujeto(company_id=demo_company.id, contrato_id=ct_obj.id, tipo="trabajador",
                            estado=est_p, nombre=nom_p, rut=rut_p, cargo=cargo_p,
                            cargo_id=cg_obj.id if cg_obj else None, es_conductor=es_cond)
                db.add(sj)
                db.flush()
            sujetos_map[rut_p] = sj

    equipos_list = [
        ("Tracto-Camión Volvo FH 540", "KPRT-88", "Camión", "Volvo", "FH 540", 2023, "ok", ct_088),
        ("Camión Pluma Scania G450", "LHVX-12", "Camión Pluma", "Scania", "G450", 2022, "ok", ct_088),
        ("Camioneta Toyota Hilux 4x4 Minera", "PZCW-45", "Camioneta", "Toyota", "Hilux 4x4", 2024, "proc", ct_088),
        ("Excavadora CAT 336 Next Gen", "EXCV-09", "Maquinaria Pesada", "Caterpillar", "336", 2021, "venc", contratos_map.get("CTR-2026-105")),
        ("Retroexcavadora JCB 3CX", "RTRX-33", "Maquinaria Pesada", "JCB", "3CX", 2020, "ok", contratos_map.get("CTR-2026-092")),
        ("Grúa Horquilla Hyster 5.0T", "GRUA-15", "Grúa Horquilla", "Hyster", "H5.0FT", 2022, "falta", contratos_map.get("CTR-2026-092")),
    ]

    for nom_e, pat_e, tipo_e, mar_e, mod_e, anio_e, est_e, ct_obj in equipos_list:
        if ct_obj:
            eq = db.scalar(select(Sujeto).where((Sujeto.company_id == demo_company.id) & (Sujeto.patente == pat_e)))
            if not eq:
                eq = Sujeto(company_id=demo_company.id, contrato_id=ct_obj.id, tipo="equipo",
                            estado=est_e, nombre=nom_e, patente=pat_e, tipo_equipo=tipo_e,
                            marca=mar_e, modelo=mod_e, anio=anio_e)
                db.add(eq)
                db.flush()
            sujetos_map[pat_e] = eq

    # 14. Licencias Internas (LIM)
    sj_carlos = sujetos_map.get("15.842.109-K")
    if sj_carlos and not db.scalar(select(LicenciaInterna.id).where(LicenciaInterna.sujeto_id == sj_carlos.id)):
        db.add(LicenciaInterna(company_id=demo_company.id, sujeto_id=sj_carlos.id,
                               numero="LIM-MLP-2026-041", estado="vigente",
                               vence=today + timedelta(days=220), emsipor_estado="aprobado"))

    sj_diego = sujetos_map.get("17.391.450-4")
    if sj_diego and not db.scalar(select(LicenciaInterna.id).where(LicenciaInterna.sujeto_id == sj_diego.id)):
        db.add(LicenciaInterna(company_id=demo_company.id, sujeto_id=sj_diego.id,
                               numero="LIM-MLP-2026-088", estado="por_vencer",
                               vence=today + timedelta(days=14), emsipor_estado="aprobado"))

    sj_jose = sujetos_map.get("14.510.992-8")
    if sj_jose and not db.scalar(select(LicenciaInterna.id).where(LicenciaInterna.sujeto_id == sj_jose.id)):
        db.add(LicenciaInterna(company_id=demo_company.id, sujeto_id=sj_jose.id,
                               numero="LIM-AND-2026-012", estado="pendiente",
                               vence=None, emsipor_estado="pendiente"))
    db.flush()

    # 15. Documentos y Archivos
    templates = db.scalars(select(RequisitoTemplate)).all()
    tmpl_by_title = {t.titulo: t for t in templates}

    doc_samples = [
        # (sujeto_ref, template_title, titulo, estado_db, est_calc, vence_date)
        ("15.842.109-K", "Cédula de Identidad", "Cédula de Identidad Carlos Ramírez", "ok", "ok", today + timedelta(days=365)),
        ("15.842.109-K", "Contrato de Trabajo", "Contrato de Trabajo Carlos Ramírez", "ok", "ok", None),
        ("15.842.109-K", "Certificado de Salud y Examen de Altura", "Examen Salud Altura Carlos Ramírez", "ok", "ok", today + timedelta(days=180)),
        ("15.842.109-K", "Manejo Defensivo", "Curso Manejo Defensivo MLP", "ok", "ok", today + timedelta(days=210)),

        ("17.391.450-4", "Cédula de Identidad", "Cédula de Identidad Diego Contreras", "ok", "ok", today + timedelta(days=400)),
        ("17.391.450-4", "Certificado de Salud y Examen de Altura", "Examen Salud Diego Contreras", "ok", "porvenc", today + timedelta(days=12)),
        ("17.391.450-4", "Inducción Hombre Nuevo", "Inducción Hombre Nuevo Centinela", "ok", "ok", today + timedelta(days=300)),

        ("18.112.304-1", "Certificado de Salud y Examen de Altura", "Examen Salud Rodrigo Morales", "ok", "venc", today - timedelta(days=15)),
        ("18.112.304-1", "Cédula de Identidad", "Cédula de Identidad Rodrigo Morales", "ok", "ok", today + timedelta(days=120)),

        ("14.510.992-8", "Contrato de Trabajo", "Contrato de Trabajo José Fernández", "falta", "falta", None),

        ("KPRT-88", "Permiso de Circulación", "Permiso de Circulación KPRT-88", "ok", "ok", today + timedelta(days=200)),
        ("KPRT-88", "SOAP", "Seguro Obligatorio SOAP KPRT-88", "ok", "ok", today + timedelta(days=190)),
        ("KPRT-88", "Revisión Técnica", "Revisión Técnica KPRT-88", "ok", "ok", today + timedelta(days=150)),

        ("EXCV-09", "Revisión Técnica", "Revisión Técnica Excavadora EXCV-09", "ok", "venc", today - timedelta(days=8)),
        ("PZCW-45", "SOAP", "Seguro Obligatorio SOAP Camioneta PZCW-45", "ok", "porvenc", today + timedelta(days=18)),
    ]

    created_docs = []
    for ref_key, tmpl_name, doc_title, est_db, est_calc, v_date in doc_samples:
        sj_target = sujetos_map.get(ref_key)
        tmpl_obj = tmpl_by_title.get(tmpl_name)
        if sj_target:
            doc = db.scalar(select(Documento).where(
                (Documento.sujeto_id == sj_target.id) & (Documento.titulo == doc_title)))
            if not doc:
                doc = Documento(company_id=demo_company.id, template_id=tmpl_obj.id if tmpl_obj else None,
                                sujeto_id=sj_target.id, contrato_id=None,
                                titulo=doc_title, obligatorio=True, estado=est_db,
                                vence=v_date, estado_calc=est_calc, es_emsipor=False)
                db.add(doc)
                db.flush()
                created_docs.append(doc)

                if est_db == "ok":
                    fn = f"{doc_title.lower().replace(' ', '_')}.pdf"
                    arch = DocumentoArchivo(company_id=demo_company.id, documento_id=doc.id,
                                            filename=fn, blob_path=f"demo/docs/{doc.id}/{fn}",
                                            content_type="application/pdf", size_bytes=1048576,
                                            uploaded_by=demo_user.id)
                    db.add(arch)
                    db.flush()

    # 16. Revisiones de Inteligencia Artificial (IA)
    if created_docs and not db.scalar(select(IaReview.id).limit(1)):
        sample_doc = created_docs[0]
        arch_sample = db.scalar(select(DocumentoArchivo).where(DocumentoArchivo.documento_id == sample_doc.id))

        review1 = IaReview(company_id=demo_company.id, archivo_id=arch_sample.id if arch_sample else None,
                           context="cedula", status="done", resultado="validado", confianza=0.985,
                           campos_extraidos={"rut": "15.842.109-K", "nombre": "Carlos Ramírez", "vencimiento": "2027-09-15"},
                           started_at=datetime.utcnow() - timedelta(minutes=10),
                           finished_at=datetime.utcnow() - timedelta(minutes=9))
        db.add(review1)
        db.flush()

        db.add(IaHallazgo(review_id=review1.id, tipo="info", codigo="RUT_MATCH",
                          mensaje="RUT coincide 100% con registro del trabajador",
                          campo="rut", valor_detectado="15.842.109-K", valor_esperado="15.842.109-K"))

        review2 = IaReview(company_id=demo_company.id, context="personal", status="done",
                           resultado="con_observaciones", confianza=0.865,
                           campos_extraidos={"resultado_examen": "APTO CON RESTRICCION", "vigencia": "12 meses"},
                           started_at=datetime.utcnow() - timedelta(hours=2),
                           finished_at=datetime.utcnow() - timedelta(hours=2, minutes=-1))
        db.add(review2)
        db.flush()

        db.add(IaHallazgo(review_id=review2.id, tipo="warning", codigo="VIGENCIA_CORTA",
                          mensaje="El certificado vence en menos de 30 días",
                          campo="vigencia", valor_detectado="12 días restantes", valor_esperado=">30 días"))
        db.flush()

    # 17. Alertas Operacionales
    if not db.scalar(select(Alerta.id).where(Alerta.company_id == demo_company.id)):
        sj_rodrigo = sujetos_map.get("18.112.304-1")
        sj_excv = sujetos_map.get("EXCV-09")
        sj_marcela = sujetos_map.get("16.204.881-2")
        sj_hilux = sujetos_map.get("PZCW-45")

        db.add_all([
            Alerta(company_id=demo_company.id, severidad="critica", estado="bloqueante", origen="vencimiento",
                   titulo="Examen de Altura Vencido: Rodrigo Morales",
                   descripcion="El examen médico de altura física venció hace 15 días. Sujeto inhabilitado para faena.",
                   plataforma="SIGA", sujeto_id=sj_rodrigo.id if sj_rodrigo else None, contrato_id=contratos_map.get("CTR-2026-092").id if contratos_map.get("CTR-2026-092") else None),

            Alerta(company_id=demo_company.id, severidad="alta", estado="nueva", origen="vencimiento",
                   titulo="Revisión Técnica Vencida: Excavadora CAT 336",
                   descripcion="La revisión técnica venció el 05/09/2026. Se requiere subir certificado actualizado.",
                   plataforma="WEBCONTROL", sujeto_id=sj_excv.id if sj_excv else None, contrato_id=contratos_map.get("CTR-2026-105").id if contratos_map.get("CTR-2026-105") else None),

            Alerta(company_id=demo_company.id, severidad="alta", estado="en_progreso", origen="ia",
                   titulo="Discrepancia en RUT de Contrato: Marcela Soto",
                   descripcion="La IA detectó una discrepancia menor en el digito verificador del contrato adjunto.",
                   plataforma="DIRECTIC", sujeto_id=sj_marcela.id if sj_marcela else None, contrato_id=ct_088.id if ct_088 else None),

            Alerta(company_id=demo_company.id, severidad="media", estado="nueva", origen="vencimiento",
                   titulo="Póliza SOAP vence en 18 días: Camioneta Toyota Hilux",
                   descripcion="El seguro obligatorio vence el próximo 01/10/2026. Renovar para evitar bloqueo.",
                   plataforma="SIGA", sujeto_id=sj_hilux.id if sj_hilux else None, contrato_id=ct_088.id if ct_088 else None),

            Alerta(company_id=demo_company.id, severidad="baja", estado="resuelta", origen="integracion",
                   titulo="Sincronización exitosa con Plataforma SIGA MLP",
                   descripcion="Se actualizaron 48 estados de acreditación en lote correctamente.",
                   plataforma="SIGA", resuelta_at=datetime.utcnow() - timedelta(hours=5)),

            Alerta(company_id=demo_company.id, severidad="advertencia", estado="nueva", origen="sistema",
                   titulo="Nuevo Estándar de Pértigas publicado por Antofagasta Minerals",
                   descripcion="Revisar nuevo catálogo de equipamiento exigido para camionetas 4x4.",
                   plataforma="SGES"),
        ])
        db.flush()

    # 18. Eventos de Calendario
    if not db.scalar(select(EventoCalendario.id).where(EventoCalendario.company_id == demo_company.id)):
        db.add_all([
            EventoCalendario(company_id=demo_company.id, titulo="Vencimiento Examen Altura - Rodrigo Morales",
                             categoria="vencimiento", fecha=today - timedelta(days=15),
                             descripcion="Actualización urgente de examen médico", completado=False),
            EventoCalendario(company_id=demo_company.id, titulo="Vencimiento SOAP Camioneta Hilux PZCW-45",
                             categoria="vencimiento", fecha=today + timedelta(days=18),
                             descripcion="Renovación de seguro obligatorio", completado=False),
            EventoCalendario(company_id=demo_company.id, titulo="Auditoría Interna SSO Contrato CTR-2026-088",
                             categoria="administrativo", fecha=today + timedelta(days=5),
                             descripcion="Revisión de carpetas de arranque y matrices de riesgo", completado=False),
            EventoCalendario(company_id=demo_company.id, titulo="Curso Manejo Defensivo y Alta Montaña",
                             categoria="capacitacion", fecha=today + timedelta(days=10),
                             descripcion="Capacitación programada en Academia MLP para conductors", completado=False),
            EventoCalendario(company_id=demo_company.id, titulo="Mantención Preventiva Camión Plania LHVX-12",
                             categoria="mantencion", fecha=today + timedelta(days=14),
                             descripcion="Revisión de sistema hidráulico y brazo pluma", completado=False),
            EventoCalendario(company_id=demo_company.id, titulo="Renovación Certificado Ley 16.744 Mutualidad",
                             categoria="administrativo", fecha=today + timedelta(days=25),
                             descripcion="Emisión mensual de certificado de siniestralidad", completado=False),
        ])
        db.flush()

    # 19. Integraciones y SyncLogs
    integ_siga = db.scalar(select(Integracion).where(
        (Integracion.company_id == demo_company.id) & (Integracion.tipo == "siga")))
    if not integ_siga:
        integ_siga = Integracion(company_id=demo_company.id, tipo="siga", estado="activa",
                                 credenciales_ref="vault://demo/siga-api-key",
                                 config={"auto_sync": True, "sync_interval_hours": 6},
                                 ultima_sync_at=datetime.utcnow() - timedelta(hours=3))
        integ_wc = Integracion(company_id=demo_company.id, tipo="webcontrol", estado="activa",
                               credenciales_ref="vault://demo/wc-api-key",
                               config={"auto_sync": True, "sync_interval_hours": 12},
                               ultima_sync_at=datetime.utcnow() - timedelta(hours=8))
        integ_mc = Integracion(company_id=demo_company.id, tipo="metacontratas", estado="activa",
                               credenciales_ref="vault://demo/mc-token",
                               config={"company_code": "DEMO-SPA"},
                               ultima_sync_at=datetime.utcnow() - timedelta(days=1))
        integ_wa = Integracion(company_id=demo_company.id, tipo="whatsapp", estado="desconectada",
                               config={"phone_number": "+56912345678", "notify_alerts": True})
        db.add_all([integ_siga, integ_wc, integ_mc, integ_wa])
        db.flush()

        db.add_all([
            SyncLog(integracion_id=integ_siga.id, company_id=demo_company.id, status="exito",
                    mensaje="Sincronización exitosa de 48 registros de personal con SIGA MLP",
                    registros_procesados=48, started_at=datetime.utcnow() - timedelta(hours=3),
                    finished_at=datetime.utcnow() - timedelta(hours=3, minutes=-2)),
            SyncLog(integracion_id=integ_wc.id, company_id=demo_company.id, status="exito",
                    mensaje="Descarga completada de pases de ingreso mina desde WebControl",
                    registros_procesados=16, started_at=datetime.utcnow() - timedelta(hours=8),
                    finished_at=datetime.utcnow() - timedelta(hours=8, minutes=-1)),
            SyncLog(integracion_id=integ_mc.id, company_id=demo_company.id, status="error",
                    mensaje="Error de timeout al consultar API de MetaContratas (Servidor no responde)",
                    registros_procesados=0, started_at=datetime.utcnow() - timedelta(days=1),
                    finished_at=datetime.utcnow() - timedelta(days=1, minutes=-1)),
        ])
        db.flush()

    # 20. Reportes y Reportes Programados
    if not db.scalar(select(Reporte.id).where(Reporte.company_id == demo_company.id)):
        db.add_all([
            Reporte(company_id=demo_company.id, nombre="Reporte General de Acreditación Septiembre 2026",
                    tipo="estado_acreditacion", formato="pdf", status="done",
                    params={"contrato_id": str(ct_088.id) if ct_088 else None},
                    blob_path="reports/demo/acreditacion_sep_2026.pdf", generado_por=demo_user.id),
            Reporte(company_id=demo_company.id, nombre="Matriz de Cumplimiento de Requisitos por Cargo",
                    tipo="cumplimiento_requisitos", formato="excel", status="done",
                    params={"incluir_equipos": True},
                    blob_path="reports/demo/matriz_cumplimiento.xlsx", generado_por=demo_user.id),
            Reporte(company_id=demo_company.id, nombre="Nómina Oficial Personal Acreditado Faena Los Pelambres",
                    tipo="personal_acreditado", formato="pdf", status="done",
                    params={"faena": "Los Pelambres"},
                    blob_path="reports/demo/personal_mlp.pdf", generado_por=demo_user.id),
        ])
        db.flush()

    if not db.scalar(select(ReporteProgramado.id).where(ReporteProgramado.company_id == demo_company.id)):
        db.add_all([
            ReporteProgramado(company_id=demo_company.id, nombre="Consolidado Semanal de Acreditación",
                              tipo="estado_acreditacion", formato="pdf", cron_expr="0 8 * * 1",
                              activo=True, ultimo_run_at=datetime.utcnow() - timedelta(days=6)),
            ReporteProgramado(company_id=demo_company.id, nombre="Alertas y Vencimientos Mensuales",
                              tipo="vencimientos", formato="excel", cron_expr="0 8 1 * *",
                              activo=True, ultimo_run_at=datetime.utcnow() - timedelta(days=13)),
        ])
        db.flush()

    # 21. Log de Actividades
    if not db.scalar(select(Actividad.id).where(Actividad.company_id == demo_company.id)):
        db.add_all([
            Actividad(company_id=demo_company.id, user_id=demo_user.id, tipo="subida_documento",
                      modulo="personal", descripcion="Documento Examen de Altura subido para Carlos Ramírez",
                      entidad_tipo="documento", plataforma="SIGA"),
            Actividad(company_id=demo_company.id, user_id=demo_user.id, tipo="alerta_ia",
                      modulo="ia", descripcion="IA auditó Cédula de Identidad con 98.5% de confianza",
                      entidad_tipo="ia_review", plataforma="SIGA"),
            Actividad(company_id=demo_company.id, user_id=demo_user.id, tipo="creacion",
                      modulo="contratos", descripcion="Contrato CTR-2026-088 registrado para Faena Los Pelambres",
                      entidad_tipo="contrato", plataforma="SIGA"),
            Actividad(company_id=demo_company.id, user_id=demo_user.id, tipo="asignacion",
                      modulo="personal", descripcion="Trabajador Diego Contreras asignado a Contrato CTR-2026-105",
                      entidad_tipo="sujeto", plataforma="WEBCONTROL"),
            Actividad(company_id=demo_company.id, user_id=demo_user.id, tipo="actualizacion",
                      modulo="equipos", descripcion="Permiso de Circulación actualizado para Tracto-Camión KPRT-88",
                      entidad_tipo="documento", plataforma="SIGA"),
        ])
        db.flush()

    # 22. Snapshots Históricos de Cumplimiento (Últimos 30 Días)
    if not db.scalar(select(CumplimientoSnapshot.id).where(CumplimientoSnapshot.company_id == demo_company.id)):
        base_date = today - timedelta(days=30)
        snapshots = []
        for i in range(31):
            d = base_date + timedelta(days=i)
            # Simular progreso gradual del cumplimiento de 76% a 88%
            pct = min(95, 76 + int(i * 0.4) + (i % 3))
            docs_ok = min(45, 32 + int(i * 0.4))
            snapshots.append(CumplimientoSnapshot(
                company_id=demo_company.id, contrato_id=None, fecha=d,
                cumplimiento_pct=pct, docs_ok=docs_ok, docs_total=45,
                personal_acreditados=6 if i < 15 else 7, personal_total=8,
                equipos_acreditados=4 if i < 20 else 5, equipos_total=6,
                alertas_criticas=2 if i < 10 else 1
            ))
        db.add_all(snapshots)
        db.flush()

    # 23. Preferencias de Notificaciones
    if not db.scalar(select(NotificacionPreferencia.id).where(NotificacionPreferencia.company_id == demo_company.id)):
        db.add_all([
            NotificacionPreferencia(company_id=demo_company.id, user_id=demo_user.id,
                                    evento="vencimiento_documento", canal_email=True, canal_whatsapp=True),
            NotificacionPreferencia(company_id=demo_company.id, user_id=demo_user.id,
                                    evento="alerta_bloqueante", canal_email=True, canal_whatsapp=True),
            NotificacionPreferencia(company_id=demo_company.id, user_id=demo_user.id,
                                    evento="reporte_programado", canal_email=True, canal_whatsapp=False),
        ])
        db.flush()

    # 24. Periodos Laborales Demo
    if not db.scalar(select(PeriodoLaboral.id).limit(1)):
        ct = db.scalar(select(Contrato).where(Contrato.company_id == demo_company.id))
        if ct:
            # Create two periods
            p_sep = PeriodoLaboral(id=uuid.uuid4(), contrato_id=ct.id, nombre="Periodo Septiembre 2026", tipo="mensual", fecha_inicio=today.replace(day=1, month=9), fecha_fin=today.replace(day=30, month=9), estado="cerrado", porcentaje_cumplimiento=100)
            p_oct = PeriodoLaboral(id=uuid.uuid4(), contrato_id=ct.id, nombre="Periodo Octubre 2026", tipo="mensual", fecha_inicio=today.replace(day=1, month=10), fecha_fin=today.replace(day=31, month=10), estado="abierto", porcentaje_cumplimiento=0)
            db.add_all([p_sep, p_oct])
            db.flush()
            
            # Requisitos Requeridos
            req_tmpl = db.scalar(select(RequisitoTemplate).limit(1))
            if req_tmpl:
                db.add_all([
                    PeriodoDocumentoRequerido(id=uuid.uuid4(), periodo_id=p_sep.id, requisito_template_id=req_tmpl.id, ambito="personal", obligatorio=True),
                    PeriodoDocumentoRequerido(id=uuid.uuid4(), periodo_id=p_oct.id, requisito_template_id=req_tmpl.id, ambito="personal", obligatorio=True)
                ])
                db.flush()
                
                # Documentos
                s = db.scalar(select(Sujeto).where(Sujeto.company_id == demo_company.id))
                if s:
                    doc = PeriodoDocumento(id=uuid.uuid4(), periodo_id=p_sep.id, sujeto_id=s.id, requisito_template_id=req_tmpl.id, archivo_url="https://demo.url", estado="aprobado", fecha_carga=datetime.utcnow(), cargado_por=demo_user.id)
                    db.add(doc)
                    db.flush()
                    
                    db.add(AuditoriaDocumento(id=uuid.uuid4(), periodo_documento_id=doc.id, auditor_id=demo_user.id, accion="aprobar", observacion="Documento vlido", fecha=datetime.utcnow(), version=1))
                    db.flush()

    db.commit()
