"""Contratos: alta, ficha, dotación, alertas, historial y matriz (§8).

El contrato es la unidad de acreditación: la empresa se acredita ANTE UNA FAENA
POR UN CONTRATO, y de él cuelgan las plataformas del mandante, los requisitos
efectivos, el personal y los equipos. Por eso este módulo agrega vistas que
técnicamente viven en otras tablas (`/personal`, `/equipos`, `/alertas`,
`/historial`): son la misma información acotada al contrato, y se delegan en los
helpers de sus módulos en vez de duplicar los filtros.

La **matriz de cumplimiento** (§8.4) es la vista que justifica el diseño disperso
del checklist: cada sujeto tiene solo los documentos que le aplican, así que la
cuadrícula sujeto × requisito tiene huecos. Los huecos se omiten (no se emiten
celdas nulas) y significan «este requisito no aplica a este sujeto», que no es lo
mismo que «falta».
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import (Page, aplicar_orden, contrato_permitido, contrato_scope, err,
                    get_company_id, get_current_user, paginacion, sobre)
from ..models import (
    Actividad, Alerta, Contrato, Documento, DocumentoArchivo, Faena, IaReview,
    Sujeto, User,
)
from ..services import actividad
from ..services.checklist import instanciar_docs, normalizar, stats_sujeto
from ..services.storage import get_storage

logger = logging.getLogger("acredittia.contratos")

router = APIRouter(prefix="/contratos", tags=["contratos"])

ESTADOS: tuple[str, ...] = ("vigente", "en_evaluacion", "terminado")

# Unidad de negocio: eje transversal a la faena que agrupa los contratos de una
# empresa (Transporte de Personal, Mantención, Obras Civiles…). Es un conjunto
# cerrado y corto, así que vive en el código y no en una tabla.
UNIDADES_NEGOCIO: tuple[str, ...] = (
    "Transporte de Personal",
    "Mantención",
    "Obras Civiles",
    "Servicios Generales",
    "Minería Subterránea",
    "Explosivos",
    "Servicios Industriales",
)

ORDEN_CONTRATOS = {"nombre", "codigo", "estado", "fecha_inicio", "fecha_termino",
                   "created_at", "updated_at"}


# ============================================================================
# Entradas
# ============================================================================
class ContratoIn(BaseModel):
    nombre: str
    codigo: str | None = None
    faena_id: uuid.UUID
    fecha_inicio: date | None = None
    fecha_termino: date | None = None
    renovacion_automatica: bool = False
    # Unidad de negocio a la que pertenece el contrato (agrupa y da acceso).
    unidad_negocio: str | None = None
    # Trazabilidad del alta asistida por IA (§12.1): el job de extracción que
    # pre-llenó el formulario. No obliga a nada; solo deja el rastro.
    ia_review_id: uuid.UUID | None = None
    requisitos_custom: dict[str, list[str]] | None = None


class ContratoPatch(BaseModel):
    nombre: str | None = None
    codigo: str | None = None
    fecha_inicio: date | None = None
    fecha_termino: date | None = None
    renovacion_automatica: bool | None = None
    estado: str | None = None
    unidad_negocio: str | None = None


class AnalizarIn(BaseModel):
    blob_path: str
    filename: str


# ============================================================================
# Helpers
# ============================================================================
def _get_contrato(db: Session, cid: uuid.UUID, contrato_id: uuid.UUID,
                  user: User | None = None) -> Contrato:
    """Contrato de la empresa, o 404. Acota al contract_admin a su contrato
    o a los de su unidad de negocio (encargado jerárquico)."""
    c = db.get(Contrato, contrato_id)
    if not c or c.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "Contrato no existe")
    if user is not None and not contrato_permitido(user, c):
        raise err(404, "NO_ENCONTRADO", "Recurso inexistente")
    return c


def _stats(db: Session, c: Contrato) -> dict:
    """Cumplimiento del contrato: media de los tres frentes que lo componen.

    Documentos de empresa, personal acreditado y equipos acreditados pesan igual,
    y los frentes vacíos no cuentan: un contrato sin equipos no debe quedar al
    66 % por no tener flota. Lo reutilizan `dashboard.py` y `reportes.py`.
    """
    def contar(tipo: str, estado: str | None = None) -> int:
        q = select(func.count()).select_from(Sujeto).where(
            Sujeto.company_id == c.company_id,
            Sujeto.contrato_id == c.id, Sujeto.tipo == tipo,
            Sujeto.estado != "baja")
        if estado:
            q = q.where(Sujeto.estado == estado)
        return db.scalar(q) or 0

    docs_emp = list(db.scalars(select(Documento).where(
        Documento.company_id == c.company_id, Documento.contrato_id == c.id)))
    oblig = [d for d in docs_emp if d.obligatorio]
    ok_emp = sum(1 for d in oblig if d.estado_calc == "ok")
    alertas = db.scalar(select(func.count()).select_from(Alerta).where(
        Alerta.company_id == c.company_id, Alerta.contrato_id == c.id,
        Alerta.resuelta_at.is_(None))) or 0

    p_tot, p_ok = contar("trabajador"), contar("trabajador", "ok")
    e_tot, e_ok = contar("equipo"), contar("equipo", "ok")
    partes = []
    if oblig:
        partes.append(ok_emp / len(oblig))
    if p_tot:
        partes.append(p_ok / p_tot)
    if e_tot:
        partes.append(e_ok / e_tot)
    pct = round(100 * sum(partes) / len(partes)) if partes else 0
    return {
        "cumplimiento_pct": pct,
        "personal": {"total": p_tot, "acreditados": p_ok},
        "equipos": {"total": e_tot, "acreditados": e_ok},
        "docs_empresa": {"total": len(docs_emp), "ok": ok_emp},
        "alertas_activas": alertas,
    }


def _out(db: Session, c: Contrato, con_stats: bool = True) -> dict:
    f = c.faena
    d = {
        "id": str(c.id), "nombre": c.nombre, "codigo": c.codigo,
        "estado": c.estado,
        "fecha_inicio": c.fecha_inicio.isoformat() if c.fecha_inicio else None,
        "fecha_termino": c.fecha_termino.isoformat() if c.fecha_termino else None,
        "renovacion_automatica": c.renovacion_automatica,
        "unidad_negocio": c.unidad_negocio,
        "origen_ia_review_id": (str(c.origen_ia_review_id)
                                if c.origen_ia_review_id else None),
        "faena": {"id": str(f.id), "nombre": f.nombre, "mandante": f.mandante,
                  "grupo": f.grupo, "region": f.region, "color": f.color},
    }
    if con_stats:
        d["stats"] = _stats(db, c)
    return d


# ============================================================================
# §8.1 — CRUD
# ============================================================================
@router.get("/unidades-negocio")
def unidades_negocio(user: User = Depends(get_current_user)):
    """Catálogo de unidades de negocio. Va antes que `/{contrato_id}` porque
    FastAPI resuelve las rutas en orden de declaración."""
    return {"items": [{"nombre": u} for u in UNIDADES_NEGOCIO]}


@router.get("")
def listar(faena_id: uuid.UUID | None = Query(None),
           estado: str | None = Query(None),
           unidad_negocio: str | None = Query(None),
           p: Page = Depends(paginacion),
           db: Session = Depends(get_db),
           cid: uuid.UUID = Depends(get_company_id),
           user: User = Depends(get_current_user)):
    """Contratos de la empresa. Un contract_admin ve únicamente el suyo o los
    de su unidad de negocio (encargado jerárquico)."""
    if estado and estado not in ESTADOS:
        raise err(400, "ESTADO_INVALIDO",
                  f"Estado debe ser uno de: {', '.join(ESTADOS)}")
    q = select(Contrato).where(Contrato.company_id == cid)
    scope = contrato_scope(user)
    unidad = user.unidad_negocio
    if scope and unidad:
        # Encargado jerárquico: su contrato + todos los de su unidad.
        q = q.where(or_(Contrato.id == scope,
                        Contrato.unidad_negocio == unidad))
    elif scope:
        q = q.where(Contrato.id == scope)
    elif unidad:
        q = q.where(Contrato.unidad_negocio == unidad)
    if faena_id:
        q = q.where(Contrato.faena_id == faena_id)
    if estado:
        q = q.where(Contrato.estado == estado)
    if unidad_negocio:
        q = q.where(Contrato.unidad_negocio == unidad_negocio)
    if p.search:
        like = f"%{p.search}%"
        q = q.where(or_(Contrato.nombre.ilike(like), Contrato.codigo.ilike(like)))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    q = aplicar_orden(q, Contrato, p.sort, ORDEN_CONTRATOS, "-created_at")
    filas = list(db.scalars(q.offset(p.offset).limit(p.page_size)))
    return sobre([_out(db, c) for c in filas], total, p)


def _valida_unidad(unidad: str | None) -> str | None:
    """Normaliza la unidad de negocio; 400 si no está en el catálogo."""
    if unidad is None:
        return None
    u = unidad.strip()
    if not u:
        return None
    if u not in UNIDADES_NEGOCIO:
        raise err(400, "UNIDAD_NEGOCIO_INVALIDA",
                  f"Unidad de negocio debe ser una de: {', '.join(UNIDADES_NEGOCIO)}")
    return u


@router.post("", status_code=201)
def crear(body: ContratoIn, db: Session = Depends(get_db),
          cid: uuid.UUID = Depends(get_company_id),
          user: User = Depends(get_current_user)):
    """Crea el contrato e instancia su checklist de ámbito empresa.

    Con `ia_review_id` se guarda en `origen_ia_review_id` el job de extracción
    que pre-llenó el formulario: la IA nunca crea el contrato, solo propone los
    campos, y este es el rastro de que el alta vino de ahí (§12.1).
    """
    faena = db.get(Faena, body.faena_id)
    if not faena:
        raise err(404, "NO_ENCONTRADO", "Faena no existe")
    if not faena.activa:
        raise err(400, "FAENA_INACTIVA", "La faena aún no está disponible")
    if body.codigo and db.scalar(select(Contrato.id).where(
            Contrato.company_id == cid, Contrato.codigo == body.codigo)):
        raise err(409, "CODIGO_DUPLICADO", "Ya existe un contrato con ese código")
    unidad = _valida_unidad(body.unidad_negocio)

    origen = None
    if body.ia_review_id:
        review = db.get(IaReview, body.ia_review_id)
        if not review or review.company_id != cid:
            raise err(404, "NO_ENCONTRADO", "El job de IA no existe")
        origen = review.id

    c = Contrato(company_id=cid, faena_id=body.faena_id, nombre=body.nombre.strip(),
                 codigo=body.codigo, fecha_inicio=body.fecha_inicio,
                 fecha_termino=body.fecha_termino,
                 renovacion_automatica=body.renovacion_automatica,
                 unidad_negocio=unidad,
                 origen_ia_review_id=origen)
    db.add(c)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise err(409, "CODIGO_DUPLICADO", "Ya existe un contrato con ese código")

    if body.requisitos_custom:
        from ..models import ContratoRequisito
        for ambito, reqs in body.requisitos_custom.items():
            if ambito not in ("empresa", "personal", "equipos", "licencia"):
                continue
            db_ambito = "personal" if ambito in ("personal", "licencia") else ("equipo" if ambito == "equipos" else "empresa")
            for req in reqs:
                if not req.strip():
                    continue
                cr = ContratoRequisito(
                    company_id=cid,
                    contrato_id=c.id,
                    ambito=db_ambito,
                    titulo=req.strip(),
                    vinculo_tipo="otro",
                    obligatorio=True
                )
                db.add(cr)
        db.flush()

    n = instanciar_docs(db, cid, "empresa", contrato_id=c.id,
                        faena_id=faena.id, contrato_plantilla_id=c.id)
    actividad.log(db, cid, "creacion", "contrato",
                  f"Contrato '{c.nombre}' creado en {faena.nombre}"
                  + (" a partir de una extracción IA" if origen else ""),
                  user_id=user.id, entidad_tipo="contrato", entidad_id=c.id)
    db.commit()
    out = _out(db, c, con_stats=False)
    out["documentos_creados"] = n
    return out


@router.get("/{contrato_id}")
def detalle(contrato_id: uuid.UUID, db: Session = Depends(get_db),
            cid: uuid.UUID = Depends(get_company_id),
            user: User = Depends(get_current_user)):
    return _out(db, _get_contrato(db, cid, contrato_id, user))


@router.patch("/{contrato_id}")
def editar(contrato_id: uuid.UUID, body: ContratoPatch,
           db: Session = Depends(get_db),
           cid: uuid.UUID = Depends(get_company_id),
           user: User = Depends(get_current_user)):
    c = _get_contrato(db, cid, contrato_id, user)
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise err(400, "SIN_CAMBIOS", "No se indicó ningún campo a modificar")
    if data.get("estado") and data["estado"] not in ESTADOS:
        raise err(400, "ESTADO_INVALIDO",
                  f"Estado debe ser uno de: {', '.join(ESTADOS)}")
    if data.get("codigo") and data["codigo"] != c.codigo and db.scalar(
            select(Contrato.id).where(Contrato.company_id == cid,
                                      Contrato.codigo == data["codigo"],
                                      Contrato.id != c.id)):
        raise err(409, "CODIGO_DUPLICADO", "Ya existe un contrato con ese código")
    if "unidad_negocio" in data:
        data["unidad_negocio"] = _valida_unidad(data["unidad_negocio"])
    for k, v in data.items():
        setattr(c, k, v)
    c.updated_at = datetime.now(timezone.utc)
    actividad.log(db, cid, "actualizacion", "contrato",
                  f"Contrato '{c.nombre}' actualizado", user_id=user.id,
                  entidad_tipo="contrato", entidad_id=c.id)
    db.commit()
    return _out(db, c)


@router.delete("/{contrato_id}")
def eliminar(contrato_id: uuid.UUID, confirm: bool = Query(False),
             db: Session = Depends(get_db),
             cid: uuid.UUID = Depends(get_company_id),
             user: User = Depends(get_current_user)):
    """Borra el contrato y todo lo que cuelga de él. Exige confirm con dotación."""
    c = _get_contrato(db, cid, contrato_id, user)
    n_sujetos = db.scalar(select(func.count()).select_from(Sujeto).where(
        Sujeto.company_id == cid, Sujeto.contrato_id == c.id)) or 0
    if n_sujetos and not confirm:
        raise err(400, "REQUIERE_CONFIRMACION",
                  f"El contrato tiene {n_sujetos} sujetos asociados; "
                  "repita con confirm=true")
    # Los blobs se purgan antes de borrar las filas: después no habría forma de
    # saber qué rutas quedaron huérfanas en el storage.
    archivos = list(db.scalars(
        select(DocumentoArchivo)
        .join(Documento, Documento.id == DocumentoArchivo.documento_id)
        .where(DocumentoArchivo.company_id == cid,
               or_(Documento.contrato_id == c.id,
                   Documento.sujeto_id.in_(select(Sujeto.id).where(
                       Sujeto.company_id == cid, Sujeto.contrato_id == c.id))))))
    storage = get_storage()
    for a in archivos:
        storage.delete(a.blob_path)
    nombre = c.nombre
    db.delete(c)      # cascadas: sujetos, documentos, archivos, alertas, plataformas
    actividad.log(db, cid, "actualizacion", "contrato",
                  f"Contrato '{nombre}' eliminado", user_id=user.id)
    db.commit()
    return {"ok": True, "sujetos_eliminados": n_sujetos,
            "archivos_eliminados": len(archivos)}


# ============================================================================
# §8.2 — Vistas del contrato
# ============================================================================
@router.get("/{contrato_id}/resumen")
def resumen_contrato(contrato_id: uuid.UUID, db: Session = Depends(get_db),
                     cid: uuid.UUID = Depends(get_company_id),
                     user: User = Depends(get_current_user)):
    """Vista enriquecida de contrato como carpeta: incluye plataformas y requisitos por ámbito."""
    from ..models import ContratoPlataforma, ContratoRequisito

    c = _get_contrato(db, cid, contrato_id, user)
    out = _out(db, c, con_stats=True)

    plataformas = list(db.scalars(
        select(ContratoPlataforma).where(
            ContratoPlataforma.company_id == cid,
            ContratoPlataforma.contrato_id == c.id
        ).order_by(ContratoPlataforma.orden)
    ))
    out["plataformas"] = [
        {
            "id": str(p.id),
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "url": p.url,
            "color": p.color,
            "estado": p.estado,
            "es_custom": p.es_custom
        } for p in plataformas
    ]

    reqs = list(db.execute(
        select(ContratoRequisito.ambito, func.count())
        .where(
            ContratoRequisito.company_id == cid,
            ContratoRequisito.contrato_id == c.id,
            ContratoRequisito.activo == True
        )
        .group_by(ContratoRequisito.ambito)
    ))
    out["requisitos_resumen"] = {r[0]: r[1] for r in reqs}

    return out


@router.get("/{contrato_id}/documentos")
def docs_empresa(contrato_id: uuid.UUID, p: Page = Depends(paginacion),
                 db: Session = Depends(get_db),
                 cid: uuid.UUID = Depends(get_company_id),
                 user: User = Depends(get_current_user)):
    """Checklist de ámbito empresa del contrato (los que cuelgan del contrato)."""
    from .documentos import doc_out

    c = _get_contrato(db, cid, contrato_id, user)
    q = select(Documento).where(Documento.company_id == cid,
                                Documento.contrato_id == c.id)
    if p.search:
        q = q.where(Documento.titulo.ilike(f"%{p.search}%"))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    filas = list(db.scalars(q.order_by(Documento.titulo)
                            .offset(p.offset).limit(p.page_size)))
    return sobre([doc_out(d) for d in filas], total, p)


@router.get("/{contrato_id}/personal")
def personal_contrato(contrato_id: uuid.UUID,
                      estado: str | None = Query(None),
                      cargo_id: uuid.UUID | None = Query(None),
                      cargo: str | None = Query(None),
                      es_conductor: bool | None = Query(None),
                      p: Page = Depends(paginacion),
                      db: Session = Depends(get_db),
                      cid: uuid.UUID = Depends(get_company_id),
                      user: User = Depends(get_current_user)):
    """Personal del contrato. Mismos filtros y formato que `GET /personal`."""
    from .sujetos import listar_sujetos

    c = _get_contrato(db, cid, contrato_id, user)
    return listar_sujetos(db, cid, "trabajador", p, contrato_id=c.id,
                          estado=estado, cargo_id=cargo_id, cargo=cargo,
                          es_conductor=es_conductor)


class ImportarPersonalIn(BaseModel):
    sujetos_ids: list[uuid.UUID]


def _reutilizar_documentos(db: Session, cid: uuid.UUID, s_new: Sujeto) -> int:
    """Feedback 17-10 punto 2: los documentos obligatorios VIGENTES de la persona
    en otros contratos quedan ligados y validados en el registro nuevo, sin que
    nadie vuelva a subir el archivo.

    Cada copia integra el `documento_destino` del checklist nuevo: el blob se
    duplica server-side (el índice UNIQUE de `blob_path` impide compartir la
    fila) pero el contenido es idéntico y el usuario no repite la subida.
    """
    from ..models import DocumentoArchivo
    from ..services.checklist import calc_estado_doc
    from ..services.storage import get_storage, make_blob_path

    # autoflush=False en `SessionLocal`: los documentos recién instanciados son
    # pendientes; sin flush explícito la consulta los vería como inexistentes.
    db.flush()

    faltantes = {
        d.template_id: d
        for d in db.scalars(select(Documento).where(
            Documento.sujeto_id == s_new.id, Documento.template_id.is_not(None),
            Documento.es_emsipor.is_(False), Documento.estado == "falta"))
        if d.template_id
    }
    if not faltantes:
        return 0

    otros = select(Sujeto.id).where(
        Sujeto.company_id == cid, Sujeto.tipo == "trabajador",
        Sujeto.rut == s_new.rut, Sujeto.id != s_new.id)
    # El más actualizado por plantilla: si la persona tira dos registros con el
    # mismo documento, gana la versión más reciente.
    fuentes: dict[uuid.UUID, Documento] = {}
    for d in db.scalars(select(Documento).join(DocumentoArchivo,
            Documento.id == DocumentoArchivo.documento_id).where(
            Documento.sujeto_id.in_(otros),
            Documento.template_id.in_(list(faltantes)),
            Documento.estado == "ok").order_by(Documento.updated_at.desc())):
        fuentes.setdefault(d.template_id, d)
    if not fuentes:
        return 0

    storage = get_storage()
    ahora = datetime.now(timezone.utc)
    usados = 0
    for tid, fuente in fuentes.items():
        dest = faltantes[tid]
        # Sólo copiamos si los bytes del archivo fuente existen: los datos
        # semilla pueden marcar documentos `ok` con un blob_path sin archivo
        # real, y fallar aquí rompería la importación completa.
        filas = [(a, make_blob_path(cid, "sujeto", s_new.id, dest.id, a.filename))
                 for a in fuente.archivos if storage.exists(a.blob_path)]
        if not filas:
            continue
        dest.estado = "ok"
        dest.vence = fuente.vence
        dest.updated_at = ahora
        dest.estado_calc = calc_estado_doc(dest)
        for a, ruta in filas:
            storage.save(ruta, storage.read(a.blob_path))
            db.add(DocumentoArchivo(
                company_id=cid, documento_id=dest.id, filename=a.filename,
                blob_path=ruta, content_type=a.content_type,
                size_bytes=a.size_bytes, uploaded_by=a.uploaded_by))
        usados += 1
    return usados


@router.post("/{contrato_id}/personal/importar")
def importar_personal(contrato_id: uuid.UUID, body: ImportarPersonalIn,
                      db: Session = Depends(get_db),
                      cid: uuid.UUID = Depends(get_company_id),
                      user: User = Depends(get_current_user)):
    """Importa personal desde nómina u otro contrato copiando el sujeto."""
    from ..services.checklist import instanciar_docs

    c = _get_contrato(db, cid, contrato_id, user)

    sujetos = db.scalars(select(Sujeto).where(
        Sujeto.company_id == cid,
        Sujeto.id.in_(body.sujetos_ids),
        Sujeto.tipo == "trabajador"
    )).all()

    importados = 0
    docs_creados = 0
    docs_reutilizados = 0
    for s_old in sujetos:
        existe = db.scalar(select(Sujeto.id).where(
            Sujeto.company_id == cid,
            Sujeto.contrato_id == c.id,
            Sujeto.rut == s_old.rut,
            Sujeto.estado != "baja"
        ))
        if existe:
            continue

        s_new = Sujeto(
            company_id=cid,
            contrato_id=c.id,
            tipo="trabajador",
            estado="proc",
            nombre=s_old.nombre,
            rut=s_old.rut,
            cargo=s_old.cargo,
            cargo_id=s_old.cargo_id,
            es_conductor=s_old.es_conductor
        )
        db.add(s_new)
        db.flush()

        n = instanciar_docs(db, cid, "personal", sujeto_id=s_new.id,
                            faena_id=c.faena_id, cargo_id=s_new.cargo_id,
                            contrato_plantilla_id=c.id)
        docs_creados += n
        docs_reutilizados += _reutilizar_documentos(db, cid, s_new)
        importados += 1

    actividad.log(db, cid, "creacion", "personal",
                  f"Importados {importados} trabajadores al contrato '{c.nombre}'",
                  user_id=user.id, entidad_tipo="contrato", entidad_id=c.id)
    db.commit()
    return {"importados": importados, "documentos_creados": docs_creados,
            "documentos_reutilizados": docs_reutilizados}


@router.get("/{contrato_id}/personal/{sujeto_id}/docs-reutilizables")
def docs_reutilizables(contrato_id: uuid.UUID, sujeto_id: uuid.UUID,
                       db: Session = Depends(get_db),
                       cid: uuid.UUID = Depends(get_company_id),
                       user: User = Depends(get_current_user)):
    """Busca documentos vigentes del mismo trabajador en otros contratos."""
    c = _get_contrato(db, cid, contrato_id, user)
    s_actual = db.get(Sujeto, sujeto_id)
    if not s_actual or s_actual.contrato_id != c.id or s_actual.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "Trabajador no pertenece a este contrato")

    docs_actuales = list(db.scalars(
        select(Documento).where(Documento.sujeto_id == s_actual.id)
    ))
    
    reqs_necesitados = {d.template_id: d for d in docs_actuales if d.estado_calc != "ok" and d.template_id}
    if not reqs_necesitados:
        return {"reutilizables": []}

    otros_sujetos = select(Sujeto.id).where(
        Sujeto.company_id == cid,
        Sujeto.rut == s_actual.rut,
        Sujeto.id != s_actual.id
    )

    reutilizables = list(db.scalars(
        select(Documento).where(
            Documento.sujeto_id.in_(otros_sujetos),
            Documento.estado_calc == "ok",
            Documento.template_id.in_(list(reqs_necesitados.keys()))
        )
    ))

    from .documentos import doc_out
    out_docs = []
    vistos = set()
    for d in reutilizables:
        if d.template_id in vistos:
            continue
        vistos.add(d.template_id)
        
        doc_dest = reqs_necesitados[d.template_id]
        item = doc_out(d)
        item["documento_destino_id"] = str(doc_dest.id)
        out_docs.append(item)

    return {"reutilizables": out_docs}


@router.get("/{contrato_id}/equipos")
def equipos_contrato(contrato_id: uuid.UUID,
                     estado: str | None = Query(None),
                     tipo_equipo: str | None = Query(None),
                     p: Page = Depends(paginacion),
                     db: Session = Depends(get_db),
                     cid: uuid.UUID = Depends(get_company_id),
                     user: User = Depends(get_current_user)):
    """Flota del contrato. Mismos filtros y formato que `GET /equipos`."""
    from .sujetos import listar_sujetos

    c = _get_contrato(db, cid, contrato_id, user)
    return listar_sujetos(db, cid, "equipo", p, contrato_id=c.id,
                          estado=estado, tipo_equipo=tipo_equipo)


@router.post("/{contrato_id}/equipos/importar")
def importar_equipos(contrato_id: uuid.UUID, body: ImportarPersonalIn,
                     db: Session = Depends(get_db),
                     cid: uuid.UUID = Depends(get_company_id),
                     user: User = Depends(get_current_user)):
    """Importa equipos de la flota u otro contrato copiando el sujeto."""
    from ..services.checklist import instanciar_docs

    c = _get_contrato(db, cid, contrato_id, user)

    sujetos = db.scalars(select(Sujeto).where(
        Sujeto.company_id == cid,
        Sujeto.id.in_(body.sujetos_ids),
        Sujeto.tipo == "equipo"
    )).all()

    importados = 0
    docs_creados = 0
    for s_old in sujetos:
        if not s_old.patente:
            continue
        existe = db.scalar(select(Sujeto.id).where(
            Sujeto.company_id == cid,
            Sujeto.contrato_id == c.id,
            Sujeto.patente == s_old.patente.strip().upper(),
            Sujeto.tipo == "equipo",
            Sujeto.estado != "baja"
        ))
        if existe:
            continue

        s_new = Sujeto(
            company_id=cid,
            contrato_id=c.id,
            tipo="equipo",
            estado="proc",
            nombre=s_old.nombre or s_old.patente,
            patente=s_old.patente.strip().upper(),
            tipo_equipo=s_old.tipo_equipo,
            marca=s_old.marca,
            modelo=s_old.modelo,
            anio=s_old.anio
        )
        db.add(s_new)
        db.flush()

        n = instanciar_docs(db, cid, "equipo", sujeto_id=s_new.id,
                            faena_id=c.faena_id,
                            contrato_plantilla_id=c.id)
        docs_creados += n
        importados += 1

    actividad.log(db, cid, "creacion", "equipos",
                  f"Importados {importados} equipos al contrato '{c.nombre}'",
                  user_id=user.id, entidad_tipo="contrato", entidad_id=c.id)
    db.commit()
    return {"importados": importados, "documentos_creados": docs_creados}


@router.get("/{contrato_id}/alertas")
def alertas_contrato(contrato_id: uuid.UUID,
                     severidad: str | None = Query(None),
                     origen: str | None = Query(None),
                     solo_activas: bool = Query(True),
                     p: Page = Depends(paginacion),
                     db: Session = Depends(get_db),
                     cid: uuid.UUID = Depends(get_company_id),
                     user: User = Depends(get_current_user)):
    """Alertas del contrato, en el mismo formato que `GET /alertas`.

    Solo las que tienen `contrato_id` puesto. Una alerta de un sujeto lo lleva
    porque quien la emite (vencimientos, IA) copia el contrato del documento.
    """
    from .alertas import _out as alerta_out

    c = _get_contrato(db, cid, contrato_id, user)
    q = select(Alerta).where(Alerta.company_id == cid, Alerta.contrato_id == c.id)
    if solo_activas:
        q = q.where(Alerta.resuelta_at.is_(None))
    if severidad:
        q = q.where(Alerta.severidad == severidad)
    if origen:
        q = q.where(Alerta.origen == origen)
    if p.search:
        q = q.where(Alerta.titulo.ilike(f"%{p.search}%"))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    filas = list(db.scalars(q.order_by(Alerta.created_at.desc())
                            .offset(p.offset).limit(p.page_size)))
    return sobre([alerta_out(a) for a in filas], total, p)


class MailIn(BaseModel):
    plantilla: str
    para: str | None = None
    asunto: str | None = None


PLANTILLAS_MAIL: tuple[str, ...] = ("resumen", "porvencer", "observado",
                                    "semanal", "invitacion")
_EVENTO_PLANTILLA = {
    "resumen": "vencimiento_documento",
    "porvencer": "vencimiento_documento",
    "observado": "alerta_bloqueante",
    "semanal": "reporte_programado",
}
_SEVERIDAD_PLANTILLA = {
    "resumen": "advertencia",
    "porvencer": "advertencia",
    "observado": "advertencia",
    "semanal": "info",
    "invitacion": "info",
}
_CORREO_OK = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _contenido_mail(db: Session, c: Contrato, plantilla: str
                    ) -> tuple[str | None, str, str, str]:
    """(evento, titulo, descripcion, severidad) con datos reales del contrato."""
    stats = _stats(db, c)
    pct = stats.get("cumplimiento_pct", 0)
    n_alertas = stats.get("alertas_activas", 0)
    top = list(db.scalars(
        select(Alerta)
        .where(Alerta.company_id == c.company_id, Alerta.contrato_id == c.id,
               Alerta.resuelta_at.is_(None))
        .order_by(Alerta.created_at.desc()).limit(5)))

    if plantilla == "resumen":
        return (_EVENTO_PLANTILLA[plantilla],
                f"Resumen de vencimientos — {c.nombre}",
                f"El contrato tiene {n_alertas} alertas activas "
                f"y un cumplimiento documental del {pct}%.",
                _SEVERIDAD_PLANTILLA[plantilla])
    if plantilla == "porvencer":
        if top:
            return (_EVENTO_PLANTILLA[plantilla], top[0].titulo,
                    top[0].descripcion or "", _SEVERIDAD_PLANTILLA[plantilla])
        return (_EVENTO_PLANTILLA[plantilla], "Sin vencimientos activos",
                f"El contrato {c.nombre} no tiene alertas activas.",
                _SEVERIDAD_PLANTILLA[plantilla])
    if plantilla == "observado":
        return (_EVENTO_PLANTILLA[plantilla],
                "Documento observado por la IA",
                f"La IA observó un documento del contrato {c.nombre}: "
                "requiere corrección antes de exportarlo.",
                _SEVERIDAD_PLANTILLA[plantilla])
    if plantilla == "semanal":
        return (_EVENTO_PLANTILLA[plantilla],
                f"Estado semanal — {c.nombre}",
                f"Cumplimiento documental del {pct}% "
                f"con {n_alertas} alertas activas.",
                _SEVERIDAD_PLANTILLA[plantilla])
    return (None, f"Te dieron acceso al contrato {c.nombre} en ACREDITTIA",
            "Te invitaron a colaborar en ACREDITTIA con permiso "
            "de colaborador del contrato.",
            _SEVERIDAD_PLANTILLA[plantilla])


@router.post("/{contrato_id}/mails")
def enviar_mail(contrato_id: uuid.UUID, body: MailIn,
                db: Session = Depends(get_db),
                cid: uuid.UUID = Depends(get_company_id),
                user: User = Depends(get_current_user)):
    """Despacha una plantilla de correo del contrato.

    Con `para` el envío es directo a esa dirección (acción explícita del
    usuario, no pasa por preferencias). Sin `para` se difunde a los
    responsables del contrato respetando `notificacion_preferencias`.
    La plantilla `invitacion` siempre exige destinatario.
    """
    from ..services.email import _html_alerta, despachar_alerta_email
    from ..services.jobs import enqueue

    c = _get_contrato(db, cid, contrato_id, user)
    if body.plantilla not in PLANTILLAS_MAIL:
        raise err(400, "PLANTILLA_INVALIDA",
                  f"Plantilla debe ser una de: {', '.join(PLANTILLAS_MAIL)}")
    para = (body.para or "").strip() or None
    if para is not None and not _CORREO_OK.match(para):
        raise err(400, "CORREO_INVALIDO", "El correo destinatario no es válido")
    if body.plantilla == "invitacion" and para is None:
        raise err(400, "FALTA_DESTINATARIO",
                  "La invitación necesita un correo destinatario")

    evento, titulo, descripcion, severidad = _contenido_mail(
        db, c, body.plantilla)
    asunto = (body.asunto or "").strip() or titulo

    if para is not None:
        enqueue("enviar_email", to_email=para, subject=asunto,
                html_body=_html_alerta(
                    titulo=titulo, descripcion=descripcion,
                    severidad=severidad, contrato_nombre=c.nombre))
        enviados, modo = 1, "directo"
    else:
        enviados = despachar_alerta_email(
            db, cid, evento or "vencimiento_documento", titulo, descripcion,
            contrato_id=c.id, severidad=severidad, contrato_nombre=c.nombre)
        modo = "difusion"

    actividad.log(db, cid, "actualizacion", "contratos",
                  f"Correo '{body.plantilla}' enviado ({modo}, {enviados}) "
                  f"en el contrato '{c.nombre}'",
                  user_id=user.id, entidad_tipo="contrato", entidad_id=c.id)
    db.commit()
    return {"plantilla": body.plantilla, "asunto": asunto,
            "modo": modo, "enviados": enviados}


@router.get("/{contrato_id}/historial")
def historial_contrato(contrato_id: uuid.UUID,
                       modulo: str | None = Query(None),
                       tipo: str | None = Query(None),
                       p: Page = Depends(paginacion),
                       db: Session = Depends(get_db),
                       cid: uuid.UUID = Depends(get_company_id),
                       user: User = Depends(get_current_user)):
    """Actividad relacionada con el contrato, la más reciente primero.

    Reutiliza el filtro de `routers/actividad.py`, que resuelve la pertenencia
    por `entidad_id` del propio contrato más la de sus sujetos y documentos, con
    sus mismas limitaciones: una acción sin `entidad_id` no se puede atribuir.
    """
    from .actividad import (ORDEN_ACTIVIDAD, TIPOS, _filtro_contrato,
                            _out as actividad_out)

    c = _get_contrato(db, cid, contrato_id, user)
    if tipo and tipo not in TIPOS:
        raise err(400, "TIPO_INVALIDO", f"Tipo debe ser uno de: {', '.join(TIPOS)}")

    q = (select(Actividad, User.nombre, User.email, User.role)
         .select_from(Actividad)
         .outerjoin(User, User.id == Actividad.user_id)
         .where(Actividad.company_id == cid))
    if modulo:
        q = q.where(Actividad.modulo == modulo)
    if tipo:
        q = q.where(Actividad.tipo == tipo)
    if p.search:
        q = q.where(Actividad.descripcion.ilike(f"%{p.search}%"))
    q = _filtro_contrato(q, cid, c.id)

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    q = aplicar_orden(q, Actividad, p.sort, ORDEN_ACTIVIDAD, "-id")
    filas = db.execute(q.offset(p.offset).limit(p.page_size)).all()
    items = [actividad_out(f[0], f.nombre, f.email, f.role) for f in filas]
    return sobre(items, total, p)


# ============================================================================
# §12.1 — Alta asistida: analizar el contrato firmado
# ============================================================================
@router.post("/analizar", status_code=202)
def analizar(body: AnalizarIn, db: Session = Depends(get_db),
             cid: uuid.UUID = Depends(get_company_id),
             user: User = Depends(get_current_user)):
    """Encola la extracción IA de un contrato ya subido por SAS.

    Alias de `POST /ia/extraer-contrato`: delega en el mismo helper para que la
    validación, el job y el encolado no puedan divergir. No crea el contrato;
    devuelve el `job_id` que luego se pasa a `POST /contratos` como
    `ia_review_id`.
    """
    from .ia import encolar_extraccion_contrato

    return encolar_extraccion_contrato(db, cid, user, body.blob_path,
                                       body.filename)


# ============================================================================
# §8.4 — Matriz de cumplimiento
# ============================================================================
@router.get("/{contrato_id}/matriz")
def matriz(contrato_id: uuid.UUID,
           tipo: str = Query("personal"),
           incluir_opcionales: bool = Query(False),
           cargo_id: uuid.UUID | None = Query(None),
           page: int = Query(1, ge=1),
           page_size: int | None = Query(None, ge=1),
           db: Session = Depends(get_db),
           cid: uuid.UUID = Depends(get_company_id),
           user: User = Depends(get_current_user)):
    """Matriz dispersa sujeto × requisito del contrato (§8.4).

    Las columnas son los requisitos que aparecen en AL MENOS un sujeto de la
    página, no la plantilla teórica: dos trabajadores de cargos distintos tienen
    checklists distintos y la cuadrícula debe reflejarlo. El orden de columnas es
    estable y determinista —ámbito (empresa, personal, equipo, emsipor), luego
    obligatorio primero, luego título alfabético— para que la columna N sea
    siempre la misma entre páginas y coincida con la exportación a Excel.

    Las celdas AUSENTES significan «el requisito no aplica a este sujeto». No se
    emiten celdas nulas: rellenarlas con `null` se confundiría con `falta`, que
    es un incumplimiento y no una exención.
    """
    from .reportes import ORDEN_AMBITO, _ambito_doc, _docs_por_sujeto

    c = _get_contrato(db, cid, contrato_id, user)
    if tipo not in ("personal", "equipo"):
        raise err(400, "TIPO_INVALIDO", "tipo debe ser 'personal' o 'equipo'")
    if cargo_id and tipo != "personal":
        raise err(400, "CARGO_SOLO_PERSONAL",
                  "El filtro por cargo solo aplica a la matriz de personal")

    # El tope de filas es propio de la matriz: cada fila arrastra sus celdas y
    # una página grande se convierte en un payload enorme.
    limite = settings.matriz_filas_max
    tam = min(page_size or min(settings.page_size_default, limite), limite)

    subtipo = "trabajador" if tipo == "personal" else "equipo"
    q = select(Sujeto).where(Sujeto.company_id == cid,
                             Sujeto.contrato_id == c.id,
                             Sujeto.tipo == subtipo,
                             Sujeto.estado != "baja")
    if cargo_id:
        q = q.where(Sujeto.cargo_id == cargo_id)
    total_filas = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    orden = Sujeto.nombre if tipo == "personal" else Sujeto.patente
    sujetos = list(db.scalars(q.order_by(orden, Sujeto.id)
                              .offset((page - 1) * tam).limit(tam)))
    docs = _docs_por_sujeto(db, cid, [s.id for s in sujetos])

    # Columnas: clave -> (peso_ambito, peso_obligatorio, orden_titulo, titulo, ambito)
    # `orden_titulo` es el título normalizado (minúsculas y sin tildes) y no el
    # título crudo: ordenar por el crudo mezcla mayúsculas y acentos con el
    # orden de code points y produce secuencias que no son alfabéticas en
    # español («IRL Mina» antes de «Inducción», «Cédula» después de
    # «Certificado»). `reportes._filas_matriz` usa exactamente la misma clave,
    # que es lo que sostiene la promesa de que la columna N de la pantalla es la
    # columna N del Excel.
    columnas: dict[str, tuple] = {}
    for s in sujetos:
        for d in docs.get(s.id, []):
            if not d.obligatorio and not incluir_opcionales:
                continue
            clave = d.titulo.strip().lower()
            if clave not in columnas:
                ambito = _ambito_doc(d, s)
                columnas[clave] = (ORDEN_AMBITO.get(ambito, 9),
                                   0 if d.obligatorio else 1,
                                   normalizar(d.titulo), d.titulo, ambito)
    ordenadas = sorted(columnas.items(), key=lambda kv: kv[1][:3])
    claves = [k for k, _ in ordenadas]
    indice = {k: i for i, k in enumerate(claves)}
    cols_out = [{"titulo": v[3], "obligatorio": v[1] == 0, "ambito": v[4]}
                for _, v in ordenadas]

    filas = []
    for s in sujetos:
        propios = docs.get(s.id, [])
        celdas = []
        for d in propios:
            i = indice.get(d.titulo.strip().lower())
            if i is None:                      # opcional excluido de las columnas
                continue
            celdas.append({"col": i, "estado_calc": d.estado_calc,
                           "vence": d.vence.isoformat() if d.vence else None})
        celdas.sort(key=lambda x: x["col"])
        filas.append({
            "sujeto_id": str(s.id),
            "nombre": s.nombre if tipo == "personal" else (s.patente or s.nombre),
            "rut": s.rut or s.patente,
            "cargo": s.cargo if tipo == "personal" else s.tipo_equipo,
            "cumplimiento_pct": stats_sujeto(propios)["cumplimiento_pct"],
            "celdas": celdas,
        })

    return {
        "tipo": tipo, "contrato_id": str(c.id),
        "incluir_opcionales": incluir_opcionales,
        "columnas": cols_out, "filas": filas,
        "page": page, "page_size": tam, "total_filas": total_filas,
        "total_pages": (total_filas + tam - 1) // tam if tam else 0,
        "nota": ("Matriz dispersa: una celda ausente significa que el requisito "
                 "no aplica a ese sujeto, no que falte."),
    }
