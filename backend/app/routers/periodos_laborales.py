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
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Page, aplicar_orden, err, get_company_id, paginacion, get_current_user
from ..models import Contrato, PeriodoLaboral, PeriodoDocumentoRequerido, PeriodoDocumento, AuditoriaDocumento, User

logger = logging.getLogger("acredittia.periodos_laborales")

router = APIRouter(tags=["certificacion_laboral"])

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


@router.post("/contratos/{contrato_id}/periodos")
def crear_periodo(
    contrato_id: uuid.UUID,
    carga: PeriodoLaboralIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db)
):
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
    db: Session = Depends(get_db),
    pag: Page = Depends(paginacion),
    orden: str = Query("-fecha_inicio")
):
    """Lista los perÃ­odos laborales de un contrato."""
    _get_contrato(db, cid, contrato_id)
    
    q = select(PeriodoLaboral).where(PeriodoLaboral.contrato_id == contrato_id)
    if estado:
        q = q.where(PeriodoLaboral.estado == estado)
        
    q = aplicar_orden(q, PeriodoLaboral, orden, ORDEN_PERIODOS, "-fecha_inicio")
    
    total = db.scalar(select(select(PeriodoLaboral).where(PeriodoLaboral.contrato_id == contrato_id).subquery().count()))
    if estado:
         total = db.scalar(select(select(PeriodoLaboral).where(PeriodoLaboral.contrato_id == contrato_id, PeriodoLaboral.estado == estado).subquery().count()))
         
    items = db.execute(q.offset(pag.offset).limit(pag.page_size)).scalars().all()
    
    return {
        "items": items,
        "total": total or 0,
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
    db: Session = Depends(get_db)
):
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
    db: Session = Depends(get_db)
):
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

class DocumentoIn(BaseModel):
    sujeto_id: uuid.UUID
    requisito_template_id: uuid.UUID
    archivo_url: str | None = None

@router.post("/periodos/{periodo_id}/documentos")
def subir_documento(
    periodo_id: uuid.UUID,
    carga: DocumentoIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Sube un documento o registra que estÃ¡ pendiente para un sujeto en el perÃ­odo."""
    _get_periodo(db, cid, periodo_id)
    doc = PeriodoDocumento(
        periodo_id=periodo_id,
        sujeto_id=carga.sujeto_id,
        requisito_template_id=carga.requisito_template_id,
        archivo_url=carga.archivo_url,
        estado="cargado" if carga.archivo_url else "pendiente",
        fecha_carga=datetime.utcnow() if carga.archivo_url else None,
        cargado_por=user.id if carga.archivo_url else None
    )
    db.add(doc)
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
    """Lista la matriz documental del perÃ­odo."""
    _get_periodo(db, cid, periodo_id)
    q = select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == periodo_id)
    if sujeto_id:
        q = q.where(PeriodoDocumento.sujeto_id == sujeto_id)
    if estado:
        q = q.where(PeriodoDocumento.estado == estado)
    return db.scalars(q).all()


# ============================================================================
# AuditorÃ­a
# ============================================================================

class AuditoriaIn(BaseModel):
    accion: str
    observacion: str | None = None

@router.post("/periodos/documentos/{doc_id}/auditar")
def auditar_documento(
    doc_id: uuid.UUID,
    carga: AuditoriaIn,
    cid: uuid.UUID = Depends(get_company_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Aprueba, observa o rechaza un documento subido."""
    doc = db.get(PeriodoDocumento, doc_id)
    if not doc:
        raise err(404, "NO_ENCONTRADO", "Documento no existe")
    
    _get_periodo(db, cid, doc.periodo_id)

    if doc.estado not in ["cargado", "en_revision", "observado"]:
        raise err(400, "ESTADO_INVALIDO", f"No se puede auditar un documento en estado: {doc.estado}")

    nuevo_estado = "pendiente"
    if carga.accion == "aprobar":
        nuevo_estado = "aprobado"
    elif carga.accion == "observar":
        nuevo_estado = "observado"
    elif carga.accion == "rechazar":
        nuevo_estado = "rechazado"

    doc.estado = nuevo_estado
    doc.updated_at = datetime.utcnow()

    auditoria = AuditoriaDocumento(
        periodo_documento_id=doc.id,
        auditor_id=user.id,
        accion=carga.accion,
        observacion=carga.observacion,
        version=1
    )
    db.add(auditoria)
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
    """Dashboard de cumplimiento de un perÃ­odo especÃ­fico."""
    _get_periodo(db, cid, periodo_id)
    docs = db.scalars(select(PeriodoDocumento).where(PeriodoDocumento.periodo_id == periodo_id)).all()
    
    total = len(docs)
    pendientes = sum(1 for d in docs if d.estado == "pendiente")
    cargados = sum(1 for d in docs if d.estado == "cargado")
    observados = sum(1 for d in docs if d.estado == "observado")
    aprobados = sum(1 for d in docs if d.estado == "aprobado")
    rechazados = sum(1 for d in docs if d.estado == "rechazado")
    
    cumplimiento = (aprobados / total * 100) if total > 0 else 0
    return {
        "total_requeridos": total,
        "pendientes": pendientes,
        "cargados": cargados,
        "observados": observados,
        "aprobados": aprobados,
        "rechazados": rechazados,
        "porcentaje_cumplimiento": cumplimiento
    }

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
        requisito_nombre = row.requisito_nombre or "Desconocido"

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
            "observaciones": None,
            "version": 1
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




