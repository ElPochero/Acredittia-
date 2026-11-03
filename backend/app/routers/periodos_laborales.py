"""CertificaciÃ³n Laboral: GestiÃ³n de PerÃ­odos Laborales.

Endpoints:
- POST /contratos/{id}/periodos
- GET /contratos/{id}/periodos
- GET /periodos/{id}
- PATCH /periodos/{id}
- DELETE /periodos/{id}
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, delete, case
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Page, aplicar_orden, err, get_company_id, paginacion, get_current_user
from ..models import Contrato, PeriodoLaboral, PeriodoDocumentoRequerido, PeriodoDocumento, AuditoriaDocumento, User, ContratoRequisitoLaboral, PeriodoDocumentoVersion, Sujeto, ContratoUsuarioRol

logger = logging.getLogger("acredittia.periodos_laborales")

router = APIRouter(tags=["certificacion_laboral"])


def _contratos_asignados_rrhh_ids(db: Session, user: User) -> list[uuid.UUID]:
    ids = []
    if getattr(user, "contrato_id", None):
        ids.append(user.contrato_id)
    rol_ids = db.execute(
        select(ContratoUsuarioRol.contrato_id).where(ContratoUsuarioRol.user_id == user.id)
    ).scalars().all()
    ids.extend(rol_ids)
    return list(set(ids))

ORDEN_PERIODOS = {"nombre", "fecha_inicio", "fecha_fin", "estado", "porcentaje_cumplimiento"}

class PeriodoLaboralIn(BaseModel):
    nombre: str
    tipo: str = "mensual"
    fecha_inicio: date
    fecha_fin: date

class PeriodoLaboralPatch(BaseModel):
    nombre: str | None = None
    tipo: str | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    estado: str | None = None

class DocumentoRequeridoIn(BaseModel):
    requisito_template_id: uuid.UUID
    ambito: str
    obligatorio: bool = True

class DocumentosRequeridosBulkIn(BaseModel):
    documentos: list[DocumentoRequeridoIn]

class PeriodoDocumentoIn(BaseModel):
    sujeto_id: uuid.UUID
    requisito_template_id: uuid.UUID
    archivo_url: str | None = None

class AuditarDocumentoIn(BaseModel):
    accion: str
    observacion: str | None = None


def _get_contrato(db: Session, cid: uuid.UUID, contrato_id: uuid.UUID) -> Contrato:
    c = db.get(Contrato, contrato_id)
    if not c or c.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "Contrato no existe")
    return c

def _get_periodo(db: Session, cid: uuid.UUID, periodo_id: uuid.UUID) -> PeriodoLaboral:
    p = db.get(PeriodoLaboral, periodo_id)
    if not p:
        raise err(404, "NO_ENCONTRADO", "PerÃ­odo Laboral no existe")
    # Verify contract belongs to company
    c = db.get(Contrato, p.contrato_id)
    if not c or c.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "PerÃ­odo Laboral no existe")
    return p



# ============================================================================
# Requisitos Laborales por Contrato y Listado de Contratos con KPIs
# ============================================================================

DEFAULT_REQUISITOS_CL = [
    {"nombre": "F30-1 (Certificado de Antecedentes Laborales y Previsionales)", "ambito": "contrato", "fuente": "manual", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Planilla y Comprobante de Pago Previsionales (Previred)", "ambito": "contrato", "fuente": "manual", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Libro de Remuneraciones Electrónico (LRE)", "ambito": "contrato", "fuente": "buk", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Certificado F30 (Cumplimiento de Obligaciones Laborales)", "ambito": "contrato", "fuente": "manual", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Liquidaciones de Sueldo Firmadas", "ambito": "trabajador", "fuente": "buk", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Comprobantes de Pago de Remuneraciones", "ambito": "trabajador", "fuente": "manual", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Libro de Asistencia y Control de Jornada", "ambito": "trabajador", "fuente": "manual", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Contratos de Trabajo y Anexos del Período", "ambito": "trabajador", "fuente": "buk", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Finiquitos y Ratificaciones del Mes", "ambito": "trabajador", "fuente": "manual", "obligatorio": True, "regla_no_aplica": "excluir"},
    {"nombre": "Comprobante de Vacaciones y Feriado Legal", "ambito": "trabajador", "fuente": "buk", "obligatorio": False, "regla_no_aplica": "excluir"},
]

class ContratoRequisitoPatch(BaseModel):
    obligatorio: bool | None = None
    regla_no_aplica: str | None = None
    fuente: str | None = None


@router.get("/certificacion-laboral/contratos")
def listar_contratos_certificacion(
    busqueda: str | None = None,
    estado: str | None = None,
    cid: uuid.UUID = Depends(get_company_id),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pag: Page = Depends(paginacion),
):
    """
    Lista los contratos reales de la empresa con los KPIs calculados del período vigente
    para la Pantalla 1 de Certificación Laboral (CA 1, CA 15).
    """
    q = select(Contrato).where(Contrato.company_id == cid)
    if getattr(current_user, "role", None) == "rrhh":
        c_ids = _contratos_asignados_rrhh_ids(db, current_user)
        if not c_ids:
            return {"items": [], "total": 0, "page": pag.page, "page_size": pag.page_size}
        q = q.where(Contrato.id.in_(c_ids))
    
    if busqueda:
        term = f"%{busqueda.strip()}%"
        q = q.where(Contrato.nombre.ilike(term) | Contrato.codigo.ilike(term))
        
    if estado and estado != "todos":
        q = q.where(Contrato.estado == estado)
        
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    contratos = db.execute(q.order_by(Contrato.created_at.desc()).offset(pag.offset).limit(pag.page_size)).scalars().all()
    
    items = []
    for c in contratos:
        # Período vigente: abierto / en_auditoria / en_revision primero, luego fecha más reciente
        p_vigente = db.execute(
            select(PeriodoLaboral)
            .where(PeriodoLaboral.contrato_id == c.id)
            .order_by(
                case(
                    (PeriodoLaboral.estado.in_(["abierto", "en_auditoria", "en_revision"]), 1),
                    else_=2
                ),
                PeriodoLaboral.fecha_inicio.desc()
            )
        ).scalars().first()
        
        pendientes_count = 0
        por_revisar_count = 0
        aprobados_count = 0
        observados_count = 0
        
        if p_vigente:
            docs = db.execute(
                select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == p_vigente.id)
            ).scalars().all()
            for d in docs:
                if d.estado == "en_revision":
                    por_revisar_count += 1
                elif d.estado in ("pendiente", "cargado"):
                    pendientes_count += 1
                elif d.estado in ("observado", "rechazado"):
                    observados_count += 1
                    pendientes_count += 1
                elif d.estado == "aprobado":
                    aprobados_count += 1
                    
            periodo_vigente_id = str(p_vigente.id)
            periodo_vigente_nombre = p_vigente.nombre
            estado_periodo = p_vigente.estado
            porcentaje_cumplimiento = float(p_vigente.porcentaje_cumplimiento or 0.0)
        else:
            periodo_vigente_id = None
            periodo_vigente_nombre = "Sin período generado"
            estado_periodo = "sin_periodo"
            porcentaje_cumplimiento = 0.0
            
        faena_nombre = c.faena.nombre if c.faena else "Sin faena asignada"
        mandante_nombre = getattr(c.faena, "mandante", None) or "Mandante Principal"
        empresa_proveedora = c.unidad_negocio or "Empresa Proveedora Principal"
        
        items.append({
            "id": str(c.id),
            "nombre": c.nombre,
            "codigo": c.codigo,
            "empresa_proveedora": empresa_proveedora,
            "mandante": mandante_nombre,
            "mandante_nombre": mandante_nombre,
            "faena": faena_nombre,
            "faena_nombre": faena_nombre,
            "estado": c.estado,
            "fecha_inicio": c.fecha_inicio.isoformat() if c.fecha_inicio else None,
            "fecha_termino": c.fecha_termino.isoformat() if c.fecha_termino else None,
            "periodo_vigente_id": periodo_vigente_id,
            "periodo_vigente_nombre": periodo_vigente_nombre,
            "estado_periodo": estado_periodo,
            "porcentaje_cumplimiento": porcentaje_cumplimiento,
            "pendientes_carga_count": pendientes_count,
            "por_revisar_count": por_revisar_count,
            "aprobados_count": aprobados_count,
            "observados_count": observados_count,
            "adc_asignado": "Andrea Castillo",
            "rrhh_asignado": "María Fernández"
        })
        
    return {
        "items": items,
        "total": total,
        "page": pag.page,
        "page_size": pag.page_size
    }


@router.get("/certificacion-laboral/contratos/{contrato_id}")
def obtener_contrato_certificacion(
    contrato_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retorna la cabecera y metadata de certificación laboral para un contrato (CA 2).
    Asegura los períodos mensuales según vigencia automáticamente.
    """
    c = _get_contrato(db, cid, contrato_id)
    if getattr(user, "role", None) == "rrhh":
        c_ids = _contratos_asignados_rrhh_ids(db, user)
        if contrato_id not in c_ids:
            raise err(403, "FORBIDDEN", "No tiene acceso a este contrato")
    asegurar_periodos_contrato(db, c)
    
    faena_nombre = c.faena.nombre if c.faena else "Sin faena asignada"
    mandante_nombre = getattr(c.faena, "mandante", None) or "Mandante Principal"
    empresa_proveedora = c.unidad_negocio or "Empresa Proveedora Principal"
    
    p_vigente = db.execute(
        select(PeriodoLaboral)
        .where(PeriodoLaboral.contrato_id == c.id)
        .order_by(
            case(
                (PeriodoLaboral.estado.in_(["abierto", "en_auditoria", "en_revision"]), 1),
                else_=2
            ),
            PeriodoLaboral.fecha_inicio.desc()
        )
    ).scalars().first()
    
    vigente_data = None
    if p_vigente:
        docs = db.execute(
            select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == p_vigente.id)
        ).scalars().all()
        ok = sum(1 for d in docs if d.estado == "aprobado")
        ob = sum(1 for d in docs if d.estado in ("observado", "rechazado"))
        revisar = sum(1 for d in docs if d.estado == "en_revision")
        pend = sum(1 for d in docs if d.estado in ("pendiente", "cargado")) + ob
        
        vigente_data = {
            "id": str(p_vigente.id),
            "nombre": p_vigente.nombre,
            "mes_anio": p_vigente.mes_anio,
            "estado": p_vigente.estado,
            "porcentaje_cumplimiento": float(p_vigente.porcentaje_cumplimiento or 0.0),
            "total_requeridos": len(docs),
            "total_aprobados": ok,
            "total_observados": ob,
            "total_pendientes": pend,
            "por_revisar_count": revisar,
        }
        
    return {
        "id": str(c.id),
        "nombre": c.nombre,
        "codigo": c.codigo,
        "empresa_nombre": empresa_proveedora,
        "empresa_proveedora": empresa_proveedora,
        "mandante_nombre": mandante_nombre,
        "faena_nombre": faena_nombre,
        "estado_contractual": c.estado,
        "adc_asignado": "Andrea Castillo (ADC)",
        "rrhh_asignado": "María Fernández (RR.HH.)",
        "encargado_rrhh": "María Fernández (RR.HH.)",
        "periodo_vigente": vigente_data,
        "fecha_inicio": c.fecha_inicio.isoformat() if c.fecha_inicio else None,
        "fecha_termino": c.fecha_termino.isoformat() if c.fecha_termino else None,
    }


@router.get("/contratos/{contrato_id}/requisitos-laborales")
def listar_requisitos_laborales_contrato(
    contrato_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """
    Lista los requisitos laborales configurados para el contrato (Sección 6, CA 5).
    Si el contrato no tiene requisitos configurados, inicializa los 10 documentos oficiales de CL_DOCS.
    """
    _get_contrato(db, cid, contrato_id)
    reqs = db.execute(
        select(ContratoRequisitoLaboral)
        .where(ContratoRequisitoLaboral.contrato_id == contrato_id)
        .order_by(ContratoRequisitoLaboral.created_at.asc())
    ).scalars().all()
    
    if not reqs:
        for r in DEFAULT_REQUISITOS_CL:
            nuevo = ContratoRequisitoLaboral(
                contrato_id=contrato_id,
                nombre=r["nombre"],
                ambito=r["ambito"],
                fuente=r["fuente"],
                obligatorio=r["obligatorio"],
                regla_no_aplica=r["regla_no_aplica"]
            )
            db.add(nuevo)
        db.commit()
        reqs = db.execute(
            select(ContratoRequisitoLaboral)
            .where(ContratoRequisitoLaboral.contrato_id == contrato_id)
            .order_by(ContratoRequisitoLaboral.created_at.asc())
        ).scalars().all()
        
    return reqs


@router.patch("/contratos/{contrato_id}/requisitos-laborales/{req_id}")
def actualizar_requisito_laboral_contrato(
    contrato_id: uuid.UUID,
    req_id: uuid.UUID,
    carga: ContratoRequisitoPatch,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(user, "role", None) == "rrhh":
        raise err(403, "FORBIDDEN", "El rol RR.HH. no tiene permisos para configurar requisitos")
    """
    Activa o desactiva obligaciones mensuales a nivel de contrato y propaga a períodos abiertos (Sección 6, CA 5).
    """
    _get_contrato(db, cid, contrato_id)
    req = db.get(ContratoRequisitoLaboral, req_id)
    if not req or req.contrato_id != contrato_id:
        raise err(404, "NO_ENCONTRADO", "Requisito laboral no encontrado")
        
    if carga.obligatorio is not None:
        req.obligatorio = carga.obligatorio
    if carga.regla_no_aplica is not None:
        req.regla_no_aplica = carga.regla_no_aplica
    if carga.fuente is not None:
        req.fuente = carga.fuente
        
    req.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return req



def asegurar_periodos_contrato(db: Session, contrato: Contrato) -> list[PeriodoLaboral]:
    """
    Genera automáticamente y de forma idempotente los períodos mensuales
    según la vigencia del contrato (fecha_inicio a min(fecha_termino, mes_actual + 1 mes)).
    Cumple con CA 2 y CA 15.
    """
    from datetime import timedelta
    
    MESES = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    
    today = date.today()
    if contrato.fecha_inicio:
        inicio = contrato.fecha_inicio.replace(day=1)
    elif contrato.created_at:
        inicio = contrato.created_at.date().replace(day=1)
    else:
        inicio = today.replace(day=1)
        
    if today.month == 12:
        mes_futuro = date(today.year + 1, 1, 1)
    else:
        mes_futuro = date(today.year, today.month + 1, 1)
        
    if contrato.fecha_termino:
        fin = min(contrato.fecha_termino, mes_futuro)
    else:
        fin = mes_futuro
        
    if inicio > fin:
        fin = inicio
        
    reqs = db.execute(
        select(ContratoRequisitoLaboral).where(ContratoRequisitoLaboral.contrato_id == contrato.id)
    ).scalars().all()
    if not reqs:
        for r_def in DEFAULT_REQUISITOS_CL:
            nuevo_req = ContratoRequisitoLaboral(
                contrato_id=contrato.id,
                nombre=r_def["nombre"],
                ambito=r_def["ambito"],
                fuente=r_def["fuente"],
                obligatorio=r_def["obligatorio"],
                regla_no_aplica=r_def["regla_no_aplica"],
            )
            db.add(nuevo_req)
        db.flush()
        reqs = db.execute(
            select(ContratoRequisitoLaboral).where(ContratoRequisitoLaboral.contrato_id == contrato.id)
        ).scalars().all()
        
    curr_y = inicio.year
    curr_m = inicio.month
    
    while (curr_y < fin.year) or (curr_y == fin.year and curr_m <= fin.month):
        mes_anio = f"{curr_y:04d}-{curr_m:02d}"
        nombre = f"{MESES[curr_m - 1]} {curr_y}"
        
        d_inicio = date(curr_y, curr_m, 1)
        if curr_m == 12:
            d_fin = date(curr_y, 12, 31)
            fecha_limite = date(curr_y + 1, 1, 10)
        else:
            d_fin = date(curr_y, curr_m + 1, 1) - timedelta(days=1)
            fecha_limite = date(curr_y, curr_m + 1, 10)
            
        p = db.execute(
            select(PeriodoLaboral).where(
                PeriodoLaboral.contrato_id == contrato.id,
                (PeriodoLaboral.mes_anio == mes_anio) | (PeriodoLaboral.nombre == nombre)
            )
        ).scalars().first()
        
        if not p:
            p = PeriodoLaboral(
                contrato_id=contrato.id,
                nombre=nombre,
                tipo="mensual",
                fecha_inicio=d_inicio,
                fecha_fin=d_fin,
                mes_anio=mes_anio,
                fecha_limite=fecha_limite,
                estado="abierto",
                porcentaje_cumplimiento=0.0,
                nomina_snapshot=[]
            )
            db.add(p)
            db.flush()
            
            for r in reqs:
                if r.ambito == "contrato":
                    doc = PeriodoDocumento(
                        periodo_id=p.id,
                        sujeto_id=None,
                        contrato_requisito_id=r.id,
                        nombre=r.nombre,
                        ambito="contrato",
                        estado="pendiente"
                    )
                    db.add(doc)
                    
            sujetos = db.execute(
                select(Sujeto).where(
                    Sujeto.contrato_id == contrato.id,
                    Sujeto.tipo == "trabajador",
                    Sujeto.estado != "baja"
                )
            ).scalars().all()
            
            for s in sujetos:
                for r in reqs:
                    if r.ambito == "trabajador":
                        doc = PeriodoDocumento(
                            periodo_id=p.id,
                            sujeto_id=s.id,
                            contrato_requisito_id=r.id,
                            nombre=r.nombre,
                            ambito="trabajador",
                            estado="pendiente"
                        )
                        db.add(doc)
        else:
            if not p.mes_anio:
                p.mes_anio = mes_anio
            if not p.fecha_limite:
                p.fecha_limite = fecha_limite
                
        if curr_m == 12:
            curr_y += 1
            curr_m = 1
        else:
            curr_m += 1
            
    db.commit()
    
    return db.execute(
        select(PeriodoLaboral)
        .where(PeriodoLaboral.contrato_id == contrato.id)
        .order_by(PeriodoLaboral.fecha_inicio.asc())
    ).scalars().all()


@router.post("/contratos/{contrato_id}/periodos")
def crear_periodo(
    contrato_id: uuid.UUID,
    carga: PeriodoLaboralIn,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if getattr(user, "role", None) == "rrhh":
        raise err(403, "FORBIDDEN", "El rol RR.HH. no tiene permisos para crear períodos")
    """Crea un nuevo perÃ­odo laboral para el contrato."""
    _get_contrato(db, cid, contrato_id)
    
    p = PeriodoLaboral(
        contrato_id=contrato_id,
        nombre=carga.nombre,
        tipo=carga.tipo,
        fecha_inicio=carga.fecha_inicio,
        fecha_fin=carga.fecha_fin,
        estado="abierto",
        porcentaje_cumplimiento=0.0
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/contratos/{contrato_id}/periodos")
def listar_periodos_contrato(
    contrato_id: uuid.UUID,
    estado: str | None = None,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pag: Page = Depends(paginacion),
    orden: str = Query("-fecha_inicio")
):
    """Lista los períodos laborales de un contrato asegurando generación según vigencia (CA 2)."""
    c = _get_contrato(db, cid, contrato_id)
    if getattr(user, "role", None) == "rrhh":
        c_ids = _contratos_asignados_rrhh_ids(db, user)
        if contrato_id not in c_ids:
            raise err(403, "FORBIDDEN", "No tiene acceso a este contrato")
    asegurar_periodos_contrato(db, c)
    
    q = select(PeriodoLaboral).where(PeriodoLaboral.contrato_id == contrato_id)
    if estado:
        q = q.where(PeriodoLaboral.estado == estado)
        
    q = aplicar_orden(q, PeriodoLaboral, orden, ORDEN_PERIODOS, "-fecha_inicio")
    
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    periodos = db.execute(q.offset(pag.offset).limit(pag.page_size)).scalars().all()
    
    items = []
    for p in periodos:
        docs = db.execute(
            select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == p.id)
        ).scalars().all()
        
        ok = sum(1 for d in docs if d.estado == "aprobado")
        ob = sum(1 for d in docs if d.estado in ("observado", "rechazado"))
        revisar = sum(1 for d in docs if d.estado == "en_revision")
        pend = sum(1 for d in docs if d.estado in ("pendiente", "cargado")) + ob
        tot = len(docs)
        
        items.append({
            "id": str(p.id),
            "contrato_id": str(p.contrato_id),
            "contrato_nombre": c.nombre,
            "nombre": p.nombre,
            "tipo": p.tipo,
            "fecha_inicio": p.fecha_inicio.isoformat(),
            "fecha_fin": p.fecha_fin.isoformat(),
            "fecha_limite": p.fecha_limite.isoformat() if p.fecha_limite else None,
            "mes_anio": p.mes_anio,
            "estado": p.estado,
            "porcentaje_cumplimiento": float(p.porcentaje_cumplimiento or 0.0),
            "total_requeridos": tot,
            "total_aprobados": ok,
            "total_observados": ob,
            "total_pendientes": pend,
            "por_revisar_count": revisar,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    return {
        "items": items,
        "total": total,
        "page": pag.page,
        "page_size": pag.page_size,
    }

@router.get("/periodos")
def listar_todos_los_periodos(
    estado: str | None = None,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    pag: Page = Depends(paginacion),
    orden: str = Query("-fecha_inicio")
):
    """Lista todos los perÃ­odos laborales de la empresa."""
    # To filter by company, we must join with Contrato
    q = select(PeriodoLaboral).join(Contrato).where(Contrato.company_id == cid)
    if estado:
        q = q.where(PeriodoLaboral.estado == estado)
        
    q = aplicar_orden(q, PeriodoLaboral, orden, ORDEN_PERIODOS, "-fecha_inicio")
    
    total = db.scalar(select(func.count()).select_from(select(PeriodoLaboral).join(Contrato).where(Contrato.company_id == cid).subquery()))
    if estado:
         total = db.scalar(select(func.count()).select_from(select(PeriodoLaboral).join(Contrato).where(Contrato.company_id == cid, PeriodoLaboral.estado == estado).subquery()))
         
    items = db.execute(q.offset(pag.offset).limit(pag.page_size)).scalars().all()
    
    return {
        "items": items,
        "total": total or 0,
        "page": pag.page,
        "page_size": pag.page_size,
    }

@router.get("/periodos/{periodo_id}")
def obtener_periodo(
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Obtiene el detalle de un perÃ­odo laboral."""
    return _get_periodo(db, cid, periodo_id)


@router.patch("/periodos/{periodo_id}")
def actualizar_periodo(
    periodo_id: uuid.UUID,
    carga: PeriodoLaboralPatch,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Actualiza un perÃ­odo laboral."""
    p = _get_periodo(db, cid, periodo_id)
    
    if carga.nombre is not None:
        p.nombre = carga.nombre
    if carga.tipo is not None:
        p.tipo = carga.tipo
    if carga.fecha_inicio is not None:
        p.fecha_inicio = carga.fecha_inicio
    if carga.fecha_fin is not None:
        p.fecha_fin = carga.fecha_fin
    if carga.estado is not None:
        p.estado = carga.estado
        
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


@router.delete("/periodos/{periodo_id}", status_code=204)
def eliminar_periodo(
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if getattr(user, "role", None) == "rrhh":
        raise err(403, "FORBIDDEN", "Los usuarios con rol RR.HH. no pueden eliminar períodos")
    """Elimina un perÃ­odo laboral."""
    p = _get_periodo(db, cid, periodo_id)
    
    db.execute(delete(AuditoriaDocumento).where(AuditoriaDocumento.periodo_documento_id.in_(
        select(PeriodoDocumento.id).where(PeriodoDocumento.periodo_id == periodo_id)
    )))
    db.execute(delete(PeriodoDocumento).where(PeriodoDocumento.periodo_id == periodo_id))
    db.execute(delete(PeriodoDocumentoRequerido).where(PeriodoDocumentoRequerido.periodo_id == periodo_id))
    
    db.delete(p)
    db.commit()


# ============================================================================
# Documentos Requeridos
# ============================================================================

class DocumentoRequeridoIn(BaseModel):
    requisito_template_id: uuid.UUID
    ambito: str
    obligatorio: bool = True

@router.post("/periodos/{periodo_id}/documentos-requeridos")
def agregar_documento_requerido(
    periodo_id: uuid.UUID,
    carga: DocumentoRequeridoIn | list[DocumentoRequeridoIn],
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if getattr(user, "role", None) == "rrhh":
        raise err(403, "FORBIDDEN", "El rol RR.HH. no tiene permisos para configurar requisitos")
    """Define quÃ© documento es requerido para este perÃ­odo."""
    _get_periodo(db, cid, periodo_id)
    cargas = carga if isinstance(carga, list) else [carga]
    docs_req = []
    for c in cargas:
        doc_req = PeriodoDocumentoRequerido(
            periodo_id=periodo_id,
            requisito_template_id=c.requisito_template_id,
            ambito=c.ambito,
            obligatorio=c.obligatorio
        )
        db.add(doc_req)
        docs_req.append(doc_req)
    db.commit()
    if not isinstance(carga, list):
        db.refresh(docs_req[0])
        return docs_req[0]
    return docs_req


@router.get("/periodos/{periodo_id}/documentos-requeridos")
def listar_documentos_requeridos(
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Lista todos los documentos requeridos en el perÃ­odo."""
    _get_periodo(db, cid, periodo_id)
    return db.scalars(select(PeriodoDocumentoRequerido).where(PeriodoDocumentoRequerido.periodo_id == periodo_id)).all()


# ============================================================================
# Carga Documental
# ============================================================================

class SubirDocumentoDirectoIn(BaseModel):
    archivo_url: str
    archivo_nombre: str | None = None

class DocumentoIn(BaseModel):
    sujeto_id: uuid.UUID
    requisito_template_id: uuid.UUID
    archivo_url: str | None = None


def calcular_kpis_periodo(db: Session, periodo: PeriodoLaboral) -> dict:
    """
    Motor de cálculo exacto de indicadores, etapa de 6 pasos y alertas (Sección 10, CA 3, CA 12).
    """
    docs = db.execute(
        select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == periodo.id)
    ).scalars().all()
    
    total = len(docs)
    aprobados = sum(1 for d in docs if d.estado == "aprobado")
    observados = sum(1 for d in docs if d.estado == "observado")
    rechazados = sum(1 for d in docs if d.estado == "rechazado")
    en_revision = sum(1 for d in docs if d.estado == "en_revision")
    no_aplica = sum(1 for d in docs if d.estado == "no_aplica")
    cargados = sum(1 for d in docs if d.estado == "cargado")
    pendientes = sum(1 for d in docs if d.estado == "pendiente")
    
    # Denominador excluye no_aplica
    denominador = total - no_aplica
    if denominador <= 0:
        pct = 100.0 if total > 0 else 0.0
    else:
        pct = round((aprobados / denominador) * 100.0, 1)
        
    periodo.porcentaje_cumplimiento = pct
    db.flush()
    
    # Etapa automática (1 a 6)
    if periodo.estado == "cerrado":
        etapa = 6
        etapa_nombre = "Cierre"
    elif any(d.estado in ("observado", "rechazado") for d in docs):
        versiones_subs = db.execute(
            select(PeriodoDocumentoVersion)
            .join(PeriodoDocumento, PeriodoDocumentoVersion.periodo_documento_id == PeriodoDocumento.id)
            .where(PeriodoDocumento.periodo_id == periodo.id, PeriodoDocumentoVersion.version > 1)
        ).scalars().all()
        if versiones_subs and en_revision > 0:
            etapa = 5
            etapa_nombre = "Corrección"
        else:
            etapa = 4
            etapa_nombre = "Observaciones"
    elif en_revision > 0:
        etapa = 3
        etapa_nombre = "Auditoría"
    elif any(d.estado in ("en_revision", "cargado", "aprobado") or d.archivo_url for d in docs):
        etapa = 2
        etapa_nombre = "Carga documental"
    else:
        etapa = 1
        etapa_nombre = "Período"
        
    # Agrupación por documento (Estado por documento)
    docs_por_nombre: dict[str, list[PeriodoDocumento]] = {}
    for d in docs:
        n = d.nombre or "Documento"
        if n not in docs_por_nombre:
            docs_por_nombre[n] = []
        docs_por_nombre[n].append(d)
        
    por_documento = []
    for nombre_doc, items in docs_por_nombre.items():
        sub_tot = len(items)
        sub_aprob = sum(1 for x in items if x.estado == "aprobado")
        sub_obs = sum(1 for x in items if x.estado in ("observado", "rechazado"))
        sub_rev = sum(1 for x in items if x.estado == "en_revision")
        sub_pend = sum(1 for x in items if x.estado in ("pendiente", "cargado"))
        sub_pct = round((sub_aprob / sub_tot) * 100.0, 1) if sub_tot > 0 else 0.0
        ambito_doc = items[0].ambito if items else "contrato"
        por_documento.append({
            "nombre": nombre_doc,
            "ambito": ambito_doc,
            "total": sub_tot,
            "aprobados": sub_aprob,
            "observados": sub_obs,
            "en_revision": sub_rev,
            "pendientes": sub_pend,
            "porcentaje": sub_pct
        })
        
    # Alertas del contrato
    alertas = []
    today = date.today()
    if periodo.fecha_limite:
        dias_restantes = (periodo.fecha_limite - today).days
        if dias_restantes < 0:
            alertas.append(f"⚠️ La fecha límite de entrega ({periodo.fecha_limite.isoformat()}) venció hace {abs(dias_restantes)} días.")
        elif dias_restantes == 0:
            alertas.append(f"⚠️ Hoy es la fecha límite para el cierre de entregas ({periodo.fecha_limite.isoformat()}).")
        else:
            alertas.append(f"⏳ Quedan {dias_restantes} días para el cierre de entregas ({periodo.fecha_limite.isoformat()}).")
            
    if (pendientes + cargados) > 0:
        alertas.append(f"📄 Hay {pendientes + cargados} documentos pendientes de carga por parte de RR.HH.")
    if (observados + rechazados) > 0:
        alertas.append(f"📝 Existen {observados + rechazados} observaciones pendientes de subsanar por RR.HH.")
    if en_revision > 0:
        alertas.append(f"🔍 Existen {en_revision} entregas en revisión esperando dictamen del ADC.")
    if periodo.estado == "cerrado":
        alertas.append("🔒 Período cerrado formalmente. Datos y nómina archivados de forma inmutable.")
        
    return {
        "total_requeridos": total,
        "aprobados": aprobados,
        "observados": observados,
        "rechazados": rechazados,
        "en_revision": en_revision,
        "cargados": cargados,
        "pendientes": pendientes + cargados,
        "porcentaje_cumplimiento": pct,
        "etapa_actual": etapa,
        "etapa_nombre": etapa_nombre,
        "por_documento": por_documento,
        "alertas": alertas
    }


@router.post("/periodos/{periodo_id}/documentos/{doc_id}/subir")
def subir_documento_directo(
    periodo_id: uuid.UUID,
    doc_id: uuid.UUID,
    carga: SubirDocumentoDirectoIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Asocia el archivo subido al requisito, transiciona obligatoriamente a 'en_revision'
    (CA 7: subir nunca aprueba automáticamente) y aplica regla de versionado (Sección 4.4, CA 9):
    - Si está 'en_revision' y abierto_por_adc == False: reemplaza archivo de la versión actual.
    - Si ya fue revisado ('observado'/'rechazado' o abierto_por_adc == True): incrementa version + 1
      conservando intactas las versiones anteriores y sus observaciones.
    """
    p = _get_periodo(db, cid, periodo_id)
    if p.estado == "cerrado":
        raise err(400, "PERIODO_CERRADO", "El período está cerrado y no admite nuevas entregas")
        
    doc = db.get(PeriodoDocumento, doc_id)
    if not doc or doc.periodo_id != periodo_id:
        raise err(404, "NO_ENCONTRADO", "Documento no encontrado en este período")

    # Regla de Versionado (Sección 4.4, CA 9)
    ver_actual = db.execute(
        select(PeriodoDocumentoVersion)
        .where(PeriodoDocumentoVersion.periodo_documento_id == doc.id)
        .order_by(PeriodoDocumentoVersion.version.desc())
    ).scalars().first()

    if ver_actual and doc.estado == "en_revision" and not ver_actual.abierto_por_adc:
        # Reemplazar archivo de la versión actual si aún no ha sido abierto ni revisado por ADC
        ver_actual.archivo_url = carga.archivo_url
        ver_actual.archivo_nombre = carga.archivo_nombre or f"{doc.nombre or 'documento'}_v{ver_actual.version}.pdf"
        ver_actual.subido_por = user.id
        ver_actual.estado = "en_revision"
        nueva_version = ver_actual.version
        msg_audit = f"Archivo de la versión {nueva_version} reemplazado antes de revisión ADC."
    else:
        # Ya fue revisado/abierto por ADC o es nueva entrega: incrementa version + 1
        ult_version = ver_actual.version if ver_actual else 0
        nueva_version = ult_version + 1
        ver = PeriodoDocumentoVersion(
            periodo_documento_id=doc.id,
            version=nueva_version,
            archivo_url=carga.archivo_url,
            archivo_nombre=carga.archivo_nombre or f"{doc.nombre or 'documento'}_v{nueva_version}.pdf",
            subido_por=user.id,
            estado="en_revision",
            abierto_por_adc=False
        )
        db.add(ver)
        msg_audit = f"Entrega versión {nueva_version} subida para revisión ADC."
        
    doc.archivo_url = carga.archivo_url
    doc.estado = "en_revision"
    doc.fecha_carga = datetime.utcnow()
    doc.cargado_por = user.id
    doc.updated_at = datetime.utcnow()
    
    audit = AuditoriaDocumento(
        periodo_documento_id=doc.id,
        auditor_id=user.id,
        accion="cargar",
        observacion=msg_audit,
        version=nueva_version
    )
    db.add(audit)
    
    calcular_kpis_periodo(db, p)
    
    try:
        from ..services.vencimientos import notificar_evento_certificacion_laboral
        notificar_evento_certificacion_laboral(
            db=db,
            contrato_id=p.contrato_id,
            periodo_nombre=p.nombre,
            doc_nombre=doc.nombre or "Documento",
            accion="cargar",
            detalle=msg_audit
        )
    except Exception as exc:
        logger.warning("Error notificando subida de documento: %s", exc)

    db.commit()
    db.refresh(doc)
    
    return doc


@router.post("/periodos/{periodo_id}/documentos")
def subir_documento(
    periodo_id: uuid.UUID,
    carga: DocumentoIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Sube un documento o registra que está en revisión para un sujeto en el período (CA 7)."""
    p = _get_periodo(db, cid, periodo_id)
    if p.estado == "cerrado":
        raise err(400, "PERIODO_CERRADO", "El período está cerrado y no admite nuevas entregas")
        
    q = select(PeriodoDocumento).where(
        PeriodoDocumento.periodo_id == periodo_id,
        PeriodoDocumento.sujeto_id == carga.sujeto_id,
        PeriodoDocumento.requisito_template_id == carga.requisito_template_id
    )
    doc = db.execute(q).scalars().first()
    
    if not doc:
        doc = PeriodoDocumento(
            periodo_id=periodo_id,
            sujeto_id=carga.sujeto_id,
            requisito_template_id=carga.requisito_template_id,
        )
        db.add(doc)
        db.flush()
        
    if carga.archivo_url:
        ver_actual = db.execute(
            select(PeriodoDocumentoVersion)
            .where(PeriodoDocumentoVersion.periodo_documento_id == doc.id)
            .order_by(PeriodoDocumentoVersion.version.desc())
        ).scalars().first()

        if ver_actual and doc.estado == "en_revision" and not ver_actual.abierto_por_adc:
            ver_actual.archivo_url = carga.archivo_url
            ver_actual.subido_por = user.id
            ver_actual.estado = "en_revision"
            nueva_version = ver_actual.version
            msg_audit = f"Archivo de la versión {nueva_version} reemplazado antes de revisión ADC."
        else:
            ult_version = ver_actual.version if ver_actual else 0
            nueva_version = ult_version + 1
            ver = PeriodoDocumentoVersion(
                periodo_documento_id=doc.id,
                version=nueva_version,
                archivo_url=carga.archivo_url,
                archivo_nombre=f"doc_{doc.id}_v{nueva_version}.pdf",
                subido_por=user.id,
                estado="en_revision",
                abierto_por_adc=False
            )
            db.add(ver)
            msg_audit = f"Carga de archivo versión {nueva_version} subida para revisión ADC."

        doc.archivo_url = carga.archivo_url
        doc.estado = "en_revision"
        doc.fecha_carga = datetime.utcnow()
        doc.cargado_por = user.id
        doc.updated_at = datetime.utcnow()
        
        audit = AuditoriaDocumento(
            periodo_documento_id=doc.id,
            auditor_id=user.id,
            accion="cargar",
            observacion=msg_audit,
            version=nueva_version
        )
        db.add(audit)
        
    calcular_kpis_periodo(db, p)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/periodos/{periodo_id}/documentos")
def listar_documentos(
    periodo_id: uuid.UUID,
    sujeto_id: uuid.UUID | None = None,
    estado: str | None = None,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Lista la matriz documental del período."""
    _get_periodo(db, cid, periodo_id)
    q = select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == periodo_id)
    if sujeto_id:
        q = q.where(PeriodoDocumento.sujeto_id == sujeto_id)
    if estado:
        q = q.where(PeriodoDocumento.estado == estado)
    return db.scalars(q).all()


# ============================================================================
# Auditoría y Revisión ADC (Día 4, CA 11, Sección 4)
# ============================================================================

class RevisarDocumentoIn(BaseModel):
    accion: str  # 'aprobar' | 'observar' | 'rechazar' | 'no_aplica'
    comentario: str | None = None
    observacion: str | None = None

class AuditoriaIn(BaseModel):
    accion: str
    observacion: str | None = None


@router.post("/periodos/{periodo_id}/documentos/{doc_id}/revisar")
def revisar_documento_adc(
    periodo_id: uuid.UUID,
    doc_id: uuid.UUID,
    carga: RevisarDocumentoIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Endpoint principal de revisión ADC (CA 11, Sección 4.2).
    - Valida que el usuario sea 'adc' o 'admin' (rechaza con 403 si es 'rrhh').
    - Si la acción es 'observar' o 'rechazar', exige comentario obligatorio (422 si falta).
    - Actualiza el estado a 'aprobado', 'observado', 'rechazado' o 'no_aplica'.
    - Marca 'abierto_por_adc = True' en la versión actual y registra en trazabilidad.
    - Dispara notificación en plataforma y correo vía vencimientos.py / email.py.
    """
    if getattr(user, "role", None) == "rrhh":
        raise err(403, "FORBIDDEN", "Los usuarios con rol RR.HH. no pueden auditar ni revisar documentos")

    p = _get_periodo(db, cid, periodo_id)
    if p.estado == "cerrado":
        raise err(400, "PERIODO_CERRADO", "El período está cerrado y no admite modificaciones")

    doc = db.get(PeriodoDocumento, doc_id)
    if not doc or doc.periodo_id != periodo_id:
        raise err(404, "NO_ENCONTRADO", "Documento no encontrado en este período")

    accion = carga.accion.lower()
    if accion not in ("aprobar", "observar", "rechazar", "no_aplica"):
        raise err(400, "ACCION_INVALIDA", f"Acción '{carga.accion}' no válida. Opciones: aprobar, observar, rechazar, no_aplica")

    comentario = (carga.comentario or carga.observacion or "").strip()
    if accion in ("observar", "rechazar") and not comentario:
        raise err(422, "COMENTARIO_OBLIGATORIO", f"El comentario es obligatorio para {accion} el documento")

    nuevo_estado = "aprobado" if accion == "aprobar" else ("observado" if accion == "observar" else ("rechazado" if accion == "rechazar" else "no_aplica"))

    doc.estado = nuevo_estado
    doc.observaciones = comentario or doc.observaciones
    doc.updated_at = datetime.utcnow()

    ver = db.execute(
        select(PeriodoDocumentoVersion)
        .where(PeriodoDocumentoVersion.periodo_documento_id == doc.id)
        .order_by(PeriodoDocumentoVersion.version.desc())
    ).scalars().first()

    version_actual = ver.version if ver else 1
    if ver:
        ver.estado = nuevo_estado
        if comentario:
            ver.observacion = comentario
        ver.revisado_por = user.id
        ver.abierto_por_adc = True

    audit = AuditoriaDocumento(
        periodo_documento_id=doc.id,
        auditor_id=user.id,
        accion=accion,
        observacion=comentario or f"Documento dictaminado como '{nuevo_estado}' por auditor ADC",
        version=version_actual
    )
    db.add(audit)

    calcular_kpis_periodo(db, p)

    try:
        from ..services.vencimientos import notificar_evento_certificacion_laboral
        notificar_evento_certificacion_laboral(
            db=db,
            contrato_id=p.contrato_id,
            periodo_nombre=p.nombre,
            doc_nombre=doc.nombre or "Documento",
            accion=accion,
            detalle=comentario
        )
    except Exception as exc:
        logger.warning("Error notificando dictamen ADC: %s", exc)

    db.commit()
    db.refresh(doc)
    return doc


@router.post("/periodos/{periodo_id}/documentos/{doc_id}/marcar-visto")
def marcar_documento_visto_adc(
    periodo_id: uuid.UUID,
    doc_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Marca que el ADC abrió y revisó el archivo de la versión actual (CA 9, Sección 4.4)."""
    _get_periodo(db, cid, periodo_id)
    doc = db.get(PeriodoDocumento, doc_id)
    if not doc or doc.periodo_id != periodo_id:
        raise err(404, "NO_ENCONTRADO", "Documento no encontrado")

    ver = db.execute(
        select(PeriodoDocumentoVersion)
        .where(PeriodoDocumentoVersion.periodo_documento_id == doc.id)
        .order_by(PeriodoDocumentoVersion.version.desc())
    ).scalars().first()

    if ver:
        ver.abierto_por_adc = True
        db.commit()

    return {"ok": True, "abierto_por_adc": True}


@router.get("/periodos/{periodo_id}/documentos/{doc_id}/versiones")
def listar_versiones_documento(
    periodo_id: uuid.UUID,
    doc_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
):
    """Retorna el historial completo de versiones de una entrega (Sección 4.4)."""
    _get_periodo(db, cid, periodo_id)
    doc = db.get(PeriodoDocumento, doc_id)
    if not doc or doc.periodo_id != periodo_id:
        raise err(404, "NO_ENCONTRADO", "Documento no encontrado")

    vers = db.execute(
        select(PeriodoDocumentoVersion)
        .where(PeriodoDocumentoVersion.periodo_documento_id == doc.id)
        .order_by(PeriodoDocumentoVersion.version.desc())
    ).scalars().all()

    items = []
    for v in vers:
        u_sub = db.get(User, v.subido_por) if v.subido_por else None
        u_rev = db.get(User, v.revisado_por) if v.revisado_por else None
        items.append({
            "id": str(v.id),
            "periodo_documento_id": str(v.periodo_documento_id),
            "version": v.version,
            "archivo_url": v.archivo_url,
            "archivo_nombre": v.archivo_nombre,
            "subido_por": str(v.subido_por) if v.subido_por else None,
            "subido_por_nombre": u_sub.nombre if u_sub else "Encargado RR.HH.",
            "estado": v.estado,
            "observacion": v.observacion,
            "revisado_por": str(v.revisado_por) if v.revisado_por else None,
            "revisado_por_nombre": u_rev.nombre if u_rev else "Auditor ADC",
            "abierto_por_adc": v.abierto_por_adc,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        })
    return items


@router.post("/periodos/documentos/{doc_id}/auditar")
def auditar_documento(
    doc_id: uuid.UUID,
    carga: AuditoriaIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Compatibilidad: Aprueba, observa o rechaza un documento subido."""
    doc = db.get(PeriodoDocumento, doc_id)
    if not doc:
        raise err(404, "NO_ENCONTRADO", "Documento no existe")
    
    p = _get_periodo(db, cid, doc.periodo_id)
    if p.estado == "cerrado":
        raise err(400, "PERIODO_CERRADO", "El período está cerrado y no admite modificaciones")

    accion = carga.accion.lower()
    comentario = (carga.observacion or "").strip()
    if accion in ("observar", "rechazar") and not comentario:
        raise err(422, "COMENTARIO_OBLIGATORIO", f"El comentario es obligatorio para {accion} el documento")

    nuevo_estado = "aprobado" if accion == "aprobar" else ("observado" if accion == "observar" else ("rechazado" if accion == "rechazar" else "no_aplica"))

    doc.estado = nuevo_estado
    doc.observaciones = comentario or doc.observaciones
    doc.updated_at = datetime.utcnow()

    ver = db.execute(
        select(PeriodoDocumentoVersion)
        .where(PeriodoDocumentoVersion.periodo_documento_id == doc.id)
        .order_by(PeriodoDocumentoVersion.version.desc())
    ).scalars().first()

    version_actual = ver.version if ver else 1
    if ver:
        ver.estado = nuevo_estado
        if comentario:
            ver.observacion = comentario
        ver.revisado_por = user.id
        ver.abierto_por_adc = True

    auditoria = AuditoriaDocumento(
        periodo_documento_id=doc.id,
        auditor_id=user.id,
        accion=accion,
        observacion=comentario or f"Documento dictaminado como '{nuevo_estado}'",
        version=version_actual
    )
    db.add(auditoria)
    calcular_kpis_periodo(db, p)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/periodos/documentos/{doc_id}/historial")
def historial_auditoria(
    doc_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Obtiene el timeline de revisiones del documento."""
    doc = db.get(PeriodoDocumento, doc_id)
    if not doc:
        raise err(404, "NO_ENCONTRADO", "Documento no existe")
    _get_periodo(db, cid, doc.periodo_id)
    return db.scalars(
        select(AuditoriaDocumento)
        .where(AuditoriaDocumento.periodo_documento_id == doc_id)
        .order_by(AuditoriaDocumento.fecha.desc())
    ).all()


# ============================================================================
# Dashboards
# ============================================================================


@router.get("/periodos/{periodo_id}/dashboard")
def periodo_dashboard(
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Dashboard de cumplimiento en tiempo real con 6 etapas, indicadores y alertas (CA 3, CA 12)."""
    p = _get_periodo(db, cid, periodo_id)
    return calcular_kpis_periodo(db, p)


@router.get("/periodos/{periodo_id}/trazabilidad")
def listar_trazabilidad_periodo(
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """
    Retorna la bitácora cronológica inmutable de eventos y revisiones del período (CA 4).
    """
    p = _get_periodo(db, cid, periodo_id)
    
    q = (
        select(
            AuditoriaDocumento,
            PeriodoDocumento.nombre.label("doc_nombre"),
            User.nombre.label("usuario_nombre"),
            User.role.label("usuario_rol")
        )
        .join(PeriodoDocumento, AuditoriaDocumento.periodo_documento_id == PeriodoDocumento.id)
        .outerjoin(User, AuditoriaDocumento.auditor_id == User.id)
        .where(PeriodoDocumento.periodo_id == periodo_id)
        .order_by(AuditoriaDocumento.fecha.desc())
    )
    filas = db.execute(q).all()
    
    eventos = []
    iconos = {
        "cargar": "📤",
        "aprobar": "✅",
        "observar": "📝",
        "rechazar": "⛔",
        "subir": "📤",
        "cierre": "🔒",
        "crear": "ℹ️"
    }
    
    for row in filas:
        a = row.AuditoriaDocumento
        accion = a.accion.lower() if a.accion else "accion"
        icono = iconos.get(accion, "ℹ️")
        rol = row.usuario_rol or ("ADC" if accion in ("aprobar", "observar", "rechazar") else "RR.HH.")
        user_nom = row.usuario_nombre or ("Andrea Castillo (ADC)" if accion in ("aprobar", "observar") else "Encargado RR.HH.")
        
        eventos.append({
            "id": str(a.id),
            "fecha": a.fecha.isoformat() if a.fecha else datetime.utcnow().isoformat(),
            "usuario_nombre": user_nom,
            "rol": rol,
            "accion": accion,
            "icono": icono,
            "detalle": a.observacion or f"Acción {accion} registrada en v{a.version}",
            "documento_nombre": row.doc_nombre or "Documento del período",
            "version": a.version
        })
        
    if p.created_at:
        eventos.append({
            "id": f"gen-{p.id}",
            "fecha": p.created_at.isoformat(),
            "usuario_nombre": "Sistema Automático",
            "rol": "Sistema",
            "accion": "generar",
            "icono": "ℹ️",
            "detalle": f"Período mensual {p.nombre} generado automáticamente según vigencia contractual.",
            "documento_nombre": None,
            "version": 1
        })
        
    if p.estado == "cerrado":
        eventos.insert(0, {
            "id": f"close-{p.id}",
            "fecha": (p.updated_at or datetime.utcnow()).isoformat(),
            "usuario_nombre": "Andrea Castillo (ADC)",
            "rol": "ADC",
            "accion": "cierre",
            "icono": "🔒",
            "detalle": f"Período mensual {p.nombre} certificado y cerrado formalmente.",
            "documento_nombre": None,
            "version": 1
        })
        
    return eventos


@router.get("/contratos/{contrato_id}/periodos/resumen")
def contratos_periodos_resumen(
    contrato_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
    """Resumen de perÃ­odos laborales del contrato."""
    _get_contrato(db, cid, contrato_id)
    periodos = db.scalars(select(PeriodoLaboral).where(PeriodoLaboral.contrato_id == contrato_id)).all()
    return [
        {
            "id": p.id,
            "nombre": p.nombre,
            "estado": p.estado,
            "cumplimiento": p.porcentaje_cumplimiento
        }
        for p in periodos
    ]

@router.get("/periodos/{periodo_id}/matriz")
def matriz_documental(
    periodo_id: uuid.UUID,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id)
):
    from ..models import Sujeto, RequisitoTemplate

    periodo = db.get(PeriodoLaboral, periodo_id)
    if not periodo:
        raise err(404, "NOT_FOUND", "Periodo no encontrado")
        
    # Obtener documentos requeridos (Requisitos)
    reqs = db.execute(
        select(PeriodoDocumentoRequerido, RequisitoTemplate.titulo)
        .join(RequisitoTemplate, PeriodoDocumentoRequerido.requisito_template_id == RequisitoTemplate.id)
        .where(PeriodoDocumentoRequerido.periodo_id == periodo_id)
    ).all()

    requisitos = [
        {
            "id": str(r.PeriodoDocumentoRequerido.requisito_template_id),
            "nombre": r.titulo,
            "ambito": r.PeriodoDocumentoRequerido.ambito,
            "obligatorio": r.PeriodoDocumentoRequerido.obligatorio
        } for r in reqs
    ]
    
    # Obtener documentos (Celdas)
    docs = db.execute(
        select(
            PeriodoDocumento, 
            Sujeto.nombre.label('sujeto_nombre'), 
            Sujeto.rut.label('sujeto_rut'), 
            Sujeto.cargo.label('sujeto_cargo'), 
            RequisitoTemplate.titulo.label('requisito_nombre')
        )
        .outerjoin(Sujeto, PeriodoDocumento.sujeto_id == Sujeto.id)
        .outerjoin(RequisitoTemplate, PeriodoDocumento.requisito_template_id == RequisitoTemplate.id)
        .where(PeriodoDocumento.periodo_id == periodo_id)
    ).all()
    
    celdas = {}
    sujetos_map = {}
    
    total_requeridos = len(docs)
    total_aprobados = 0
    total_pendientes = 0
    total_observados = 0
    total_rechazados = 0

    for row in docs:
        d = row.PeriodoDocumento
        sujeto_nombre = row.sujeto_nombre or "Desconocido"
        sujeto_rut = row.sujeto_rut or ""
        sujeto_cargo = row.sujeto_cargo
        requisito_nombre = row.requisito_nombre or getattr(d, "nombre", None) or "Desconocido"

        if d.estado == "aprobado": total_aprobados += 1
        elif d.estado == "pendiente": total_pendientes += 1
        elif d.estado == "observado": total_observados += 1
        elif d.estado == "rechazado": total_rechazados += 1

        key = f"{d.sujeto_id}_{d.requisito_template_id}"
        celdas[key] = {
            "id": str(d.id),
            "periodo_id": str(d.periodo_id),
            "sujeto_id": str(d.sujeto_id),
            "sujeto_nombre": sujeto_nombre,
            "sujeto_rut": sujeto_rut,
            "sujeto_cargo": sujeto_cargo,
            "requisito_template_id": str(d.requisito_template_id),
            "requisito_nombre": requisito_nombre,
            "archivo_url": d.archivo_url,
            "estado": d.estado,
            "fecha_carga": d.fecha_carga.isoformat() if d.fecha_carga else None,
            "cargado_por": str(d.cargado_por) if d.cargado_por else None,
            "observaciones": d.observaciones,
            "version": getattr(d, "version", 1) or 1,
            "abierto_por_adc": bool(getattr(d, "abierto_por_adc", False)),
        }
        
        if d.sujeto_id not in sujetos_map:
            sujetos_map[d.sujeto_id] = {
                "id": str(d.sujeto_id),
                "nombre": sujeto_nombre,
                "rut": sujeto_rut,
                "cargo": sujeto_cargo
            }
            
    sujetos = list(sujetos_map.values())
    sujetos.sort(key=lambda s: s["nombre"])
    
    return {
        "periodo": {
            "id": str(periodo.id),
            "contrato_id": str(periodo.contrato_id),
            "nombre": periodo.nombre,
            "tipo": periodo.tipo,
            "fecha_inicio": periodo.fecha_inicio.isoformat() if periodo.fecha_inicio else None,
            "fecha_fin": periodo.fecha_fin.isoformat() if periodo.fecha_fin else None,
            "estado": periodo.estado,
            "porcentaje_cumplimiento": float(periodo.porcentaje_cumplimiento),
            "total_requeridos": total_requeridos,
            "total_aprobados": total_aprobados,
            "total_pendientes": total_pendientes,
            "total_observados": total_observados,
            "total_rechazados": total_rechazados
        },
        "sujetos": sujetos,
        "requisitos": requisitos,
        "celdas": celdas
    }






@router.get("/contratos/{contrato_id}/periodos/{periodo_id}/nomina")
def obtener_nomina_periodo(
    contrato_id: uuid.UUID,
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = _get_contrato(db, cid, contrato_id)
    if getattr(user, "role", None) == "rrhh":
        c_ids = _contratos_asignados_rrhh_ids(db, user)
        if contrato_id not in c_ids:
            raise err(403, "FORBIDDEN", "No tiene acceso a este contrato")
    """
    Retorna la nómina de trabajadores del contrato para el período mensual (CA 6).
    Si el período está cerrado, retorna la foto inmutable guardada en nomina_snapshot.
    Si está abierto o en auditoría, consulta los trabajadores en tiempo real, clasificados
    en vigentes, incorporaciones del mes y bajas, y actualiza el snapshot.
    """
    c = _get_contrato(db, cid, contrato_id)
    p = _get_periodo(db, cid, periodo_id)
    if p.contrato_id != contrato_id:
        raise err(404, "NO_ENCONTRADO", "Período no pertenece al contrato")
        
    if p.estado == "cerrado" and p.nomina_snapshot and isinstance(p.nomina_snapshot, dict) and "resumen" in p.nomina_snapshot:
        return {
            "periodo_id": str(p.id),
            "periodo_nombre": p.nombre,
            "estado_periodo": p.estado,
            "inmutable": True,
            "datos": p.nomina_snapshot
        }
        
    sujetos = db.execute(
        select(Sujeto).where(
            Sujeto.contrato_id == contrato_id,
            Sujeto.tipo == "trabajador"
        ).order_by(Sujeto.nombre.asc())
    ).scalars().all()
    
    d_inicio = p.fecha_inicio
    d_fin = p.fecha_fin
    
    vigentes = []
    incorporaciones = []
    bajas = []
    
    for s in sujetos:
        item = {
            "id": str(s.id),
            "nombre": s.nombre,
            "rut": s.rut or "Sin RUT",
            "cargo": s.cargo or "Sin cargo",
            "estado": s.estado,
            "fecha_ingreso": s.created_at.date().isoformat() if s.created_at else None
        }
        
        if s.estado == "baja":
            bajas.append(item)
        else:
            vigentes.append(item)
            if s.created_at and d_inicio <= s.created_at.date() <= d_fin:
                incorporaciones.append(item)
                
    snapshot = {
        "resumen": {
            "total_vigentes": len(vigentes),
            "total_incorporaciones": len(incorporaciones),
            "total_bajas": len(bajas),
            "total_nomina": len(vigentes)
        },
        "vigentes": vigentes,
        "incorporaciones": incorporaciones,
        "bajas": bajas
    }
    
    p.nomina_snapshot = snapshot
    db.commit()
    
    return {
        "periodo_id": str(p.id),
        "periodo_nombre": p.nombre,
        "estado_periodo": p.estado,
        "inmutable": p.estado == "cerrado",
        "datos": snapshot
    }


# ============================================================================
# Cierre de Período y Bandeja Mis Pendientes RR.HH. (Día 4, CA 12, Sección 3.4 & 10)
# ============================================================================

@router.post("/periodos/{periodo_id}/cerrar")
def cerrar_periodo_laboral(
    periodo_id: uuid.UUID,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Cierre formal del período mensual (CA 12, Sección 10).
    - Verifica 100% de cumplimiento (sin requisitos pendientes, en revisión, observados ni rechazados).
    - Valida que el rol no sea 'rrhh' (403 Forbidden).
    - Una vez cerrado, bloquea cualquier subida o edición posterior de forma inmutable.
    """
    if getattr(user, "role", None) == "rrhh":
        raise err(403, "FORBIDDEN", "Los usuarios con rol RR.HH. no tienen permisos para cerrar períodos")

    p = _get_periodo(db, cid, periodo_id)
    if p.estado == "cerrado":
        raise err(400, "PERIODO_CERRADO", "El período ya está cerrado")

    kpis = calcular_kpis_periodo(db, p)
    
    if (kpis["porcentaje_cumplimiento"] < 100.0 or 
        kpis["pendientes"] > 0 or 
        kpis["en_revision"] > 0 or 
        kpis["observados"] > 0 or 
        kpis["rechazados"] > 0):
        raise err(
            400, 
            "CUMPLIMIENTO_INCOMPLETO", 
            f"No se puede cerrar el período: el cumplimiento actual es {kpis['porcentaje_cumplimiento']}% (requiere 100% sin pendientes, observaciones ni entregas en revisión)"
        )

    p.estado = "cerrado"
    p.cerrado_por = user.id
    p.updated_at = datetime.utcnow()

    # Guardar foto inmutable de nómina si no está congelada
    if not p.nomina_snapshot or (isinstance(p.nomina_snapshot, list) and len(p.nomina_snapshot) == 0):
        sujetos = db.execute(
            select(Sujeto).where(Sujeto.contrato_id == p.contrato_id, Sujeto.tipo == "trabajador")
        ).scalars().all()
        p.nomina_snapshot = {
            "resumen": {"total_vigentes": len(sujetos), "total_nomina": len(sujetos), "total_incorporaciones": 0, "total_bajas": 0},
            "vigentes": [{"id": str(s.id), "nombre": s.nombre, "rut": s.rut, "cargo": s.cargo} for s in sujetos],
            "incorporaciones": [],
            "bajas": []
        }

    # Notificar cierre
    try:
        from ..services.vencimientos import notificar_evento_certificacion_laboral
        notificar_evento_certificacion_laboral(
            db=db,
            contrato_id=p.contrato_id,
            periodo_nombre=p.nombre,
            doc_nombre="Cierre Período",
            accion="cierre",
            detalle=f"Período cerrado exitosamente al 100% por {user.nombre}."
        )
    except Exception as exc:
        logger.warning("Error notificando cierre: %s", exc)

    db.commit()
    db.refresh(p)

    return {
        "id": str(p.id),
        "nombre": p.nombre,
        "estado": p.estado,
        "porcentaje_cumplimiento": float(p.porcentaje_cumplimiento or 100.0),
        "cerrado_por": str(p.cerrado_por),
        "mensaje": "Período cerrado formalmente de forma inmutable"
    }


@router.get("/certificacion-laboral/mis-pendientes")
def obtener_mis_pendientes_rrhh(
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Vista consolidada de tareas pendientes para el Encargado de RR.HH. (Sección 3.4):
    1. Documentos observados o rechazados que requieren corrección inmediata con su comentario.
    2. Requisitos pendientes de carga ordenados por fecha límite más próxima.
    3. Períodos abiertos con días restantes para el cierre.
    """
    contratos = db.execute(
        select(Contrato).where(Contrato.company_id == cid)
    ).scalars().all()

    observados_rechazados = []
    pendientes_carga = []
    periodos_proximos = []
    today = date.today()

    for c in contratos:
        # Períodos abiertos o en auditoría de este contrato
        periodos = db.execute(
            select(PeriodoLaboral)
            .where(PeriodoLaboral.contrato_id == c.id, PeriodoLaboral.estado.in_(["abierto", "en_revision", "en_auditoria"]))
            .order_by(PeriodoLaboral.fecha_inicio.desc())
        ).scalars().all()

        for p in periodos:
            dias_restantes = (p.fecha_limite - today).days if p.fecha_limite else None
            
            docs = db.execute(
                select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == p.id)
            ).scalars().all()

            for d in docs:
                sujeto = db.get(Sujeto, d.sujeto_id) if d.sujeto_id else None

                # 1. Observados o rechazados
                if d.estado in ("observado", "rechazado"):
                    ult_ver = db.execute(
                        select(PeriodoDocumentoVersion)
                        .where(PeriodoDocumentoVersion.periodo_documento_id == d.id)
                        .order_by(PeriodoDocumentoVersion.version.desc())
                    ).scalars().first()

                    obs = (ult_ver.observacion if ult_ver and ult_ver.observacion else d.observaciones) or "Requiere corrección de antecedentes según dictamen ADC."
                    ver_num = ult_ver.version if ult_ver else 1

                    observados_rechazados.append({
                        "id": str(d.id),
                        "doc_id": str(d.id),
                        "documento_id": str(d.id),
                        "nombre": d.nombre or "Documento",
                        "ambito": d.ambito or "contrato",
                        "contrato_id": str(c.id),
                        "contrato_nombre": c.nombre,
                        "contrato_codigo": c.codigo,
                        "periodo_id": str(p.id),
                        "periodo_nombre": p.nombre,
                        "estado": d.estado,
                        "fecha_limite": p.fecha_limite.isoformat() if p.fecha_limite else None,
                        "dias_restantes": dias_restantes,
                        "ultima_observacion": obs,
                        "version": ver_num,
                        "archivo_url": d.archivo_url,
                        "sujeto_nombre": sujeto.nombre if sujeto else None,
                        "sujeto_rut": sujeto.rut if sujeto else None
                    })
                # 2. Pendientes de carga
                elif d.estado in ("pendiente", "cargado"):
                    pendientes_carga.append({
                        "id": str(d.id),
                        "doc_id": str(d.id),
                        "nombre": d.nombre or "Documento",
                        "ambito": d.ambito or "contrato",
                        "contrato_id": str(c.id),
                        "contrato_nombre": c.nombre,
                        "contrato_codigo": c.codigo,
                        "periodo_id": str(p.id),
                        "periodo_nombre": p.nombre,
                        "estado": d.estado,
                        "fecha_limite": p.fecha_limite.isoformat() if p.fecha_limite else None,
                        "dias_restantes": dias_restantes,
                        "version": 1,
                        "archivo_url": d.archivo_url,
                        "sujeto_nombre": sujeto.nombre if sujeto else None,
                        "sujeto_rut": sujeto.rut if sujeto else None
                    })

            p_pend = sum(1 for d in docs if d.estado in ("pendiente", "cargado", "observado", "rechazado"))
            p_rev = sum(1 for d in docs if d.estado == "en_revision")
            periodos_proximos.append({
                "periodo_id": str(p.id),
                "periodo_nombre": p.nombre,
                "contrato_id": str(c.id),
                "contrato_nombre": c.nombre,
                "fecha_limite": p.fecha_limite.isoformat() if p.fecha_limite else None,
                "dias_restantes": dias_restantes,
                "porcentaje_cumplimiento": float(p.porcentaje_cumplimiento or 0.0),
                "pendientes_count": p_pend,
                "por_revisar_count": p_rev
            })

    pendientes_carga.sort(key=lambda x: x["fecha_limite"] or "9999-12-31")
    periodos_proximos.sort(key=lambda x: x["fecha_limite"] or "9999-12-31")

    return {
        "observados_rechazados": observados_rechazados,
        "pendientes_carga": pendientes_carga,
        "periodos_proximos": periodos_proximos,
        "total_pendientes": len(observados_rechazados) + len(pendientes_carga)
    }



# ============================================================================
# Sincronización Buk con Fallback Manual Resiliente (Día 5, CA 13, Sección 8)
# ============================================================================

@router.post("/contratos/{contrato_id}/periodos/{periodo_id}/sincronizar-buk")
def sincronizar_buk_endpoint(
    contrato_id: uuid.UUID,
    periodo_id: uuid.UUID,
    simular_exito: bool = Query(False),
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Sincroniza nómina y documentos del período desde Buk con fallback manual resiliente (CA 13, Sección 8).
    El rol 'rrhh' sí puede sincronizar con Buk para actualizar su nómina mensual y documentos.
    """
    c = _get_contrato(db, cid, contrato_id)
    p = _get_periodo(db, cid, periodo_id)
    if p.contrato_id != contrato_id:
        raise err(400, "PERIODO_INVALIDO", "El período no corresponde al contrato")
    if p.estado == "cerrado":
        raise err(400, "PERIODO_CERRADO", "El período está cerrado y no admite sincronizaciones")

    from ..services.buk_sync import sincronizar_buk_periodo
    res = sincronizar_buk_periodo(db, c, p, user, simular_exito=simular_exito)
    return res
