"""Catálogo de requisitos de la empresa (pantalla «Requisitos» del wireframe).

Este módulo no administra plantillas ni requisitos de contrato —eso vive en
`admin` y en `contrato_requisitos.py`—: responde la pregunta transversal «de
todos los requisitos que me aplican, cómo voy». Por eso cada fila es una
`requisito_templates` y sus contadores son los `documentos` REALES que la
empresa tiene instanciados contra esa plantilla, no una proyección teórica de la
plantilla efectiva.

Visibilidad del catálogo: las plantillas estándar (`faena_id IS NULL`) más las
de las faenas donde la empresa tiene contratos. `requisito_templates` es un
catálogo global sin `company_id`, así que la barrera multi-tenant se aplica en
la subconsulta de faenas —que sí filtra por `contratos.company_id`— y en todos
los conteos de documentos. Un contract_admin ve solo la faena de su contrato y
sus contadores se calculan únicamente con los documentos de ese contrato.
"""
from __future__ import annotations

import logging
import uuid

from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, distinct, func, or_, select
from sqlalchemy.orm import Session

from ..deps import (Page, aplicar_orden, contrato_scope, err, get_company_id,
                    get_current_user, get_db, paginacion, sobre)
from ..models import Contrato, Documento, RequisitoTemplate, Sujeto, User
from ..services.storage import get_storage, make_template_blob_path
import mimetypes

logger = logging.getLogger("acredittia.requisitos")

router = APIRouter(prefix="/requisitos", tags=["requisitos"])

AMBITOS: tuple[str, ...] = ("empresa", "personal", "equipo", "emsipor")
TIPOS: tuple[str, ...] = ("legal", "medico", "capacitacion", "certificacion",
                          "tecnico", "medioambiental")
ESTADOS: tuple[str, ...] = ("ok", "porvenc", "venc", "falta")

# El listado del catálogo se agrega en memoria (el estado por fila no es una
# columna), así que el orden se resuelve aquí y no con `aplicar_orden`.
ORDEN_CATALOGO: dict[str, str] = {
    "titulo": "titulo", "codigo": "codigo", "ambito": "ambito",
    "tipo": "tipo", "docs": "docs", "estado": "estado",
    "vigencia_meses": "vigencia_meses", "created_at": "created_at",
}
ORDEN_TEMPLATES = {"titulo", "codigo", "ambito", "tipo", "vigencia_meses",
                   "created_at", "updated_at"}

# Prioridad del estado agregado al ordenar: primero lo que urge.
_PESO_ESTADO = {"venc": 0, "porvenc": 1, "falta": 2, "ok": 3}


# ------------------------------------------------------------------- helpers
def _faenas_visibles(cid: uuid.UUID, scope: uuid.UUID | None):
    """Subconsulta con las faenas donde la empresa tiene contratos."""
    q = select(distinct(Contrato.faena_id)).where(Contrato.company_id == cid)
    if scope:
        q = q.where(Contrato.id == scope)
    return q


def _catalogo_visible(cid: uuid.UUID, scope: uuid.UUID | None):
    """Plantillas activas aplicables a la empresa: estándar (globales) + de sus faenas."""
    return select(RequisitoTemplate).where(
        RequisitoTemplate.activo.is_(True),
        or_(RequisitoTemplate.faena_id.is_(None),
            RequisitoTemplate.faena_id.in_(_faenas_visibles(cid, scope))),
    )


def _filtro_scope(q, scope: uuid.UUID | None):
    """Acota una consulta de documentos al contrato del contract_admin.

    Un documento cuelga del contrato (ámbito empresa) o del sujeto (personal,
    equipo, emsipor); el contrato del sujeto es el del propio sujeto, de ahí el
    OR sobre las dos rutas.
    """
    if scope:
        q = q.where(or_(Documento.contrato_id == scope,
                        Sujeto.contrato_id == scope))
    return q


def _conteos_por_template(db: Session, cid: uuid.UUID,
                          template_ids: list[uuid.UUID],
                          scope: uuid.UUID | None) -> dict[uuid.UUID, dict]:
    """Documentos instanciados de la empresa por plantilla y estado calculado."""
    if not template_ids:
        return {}
    q = (select(Documento.template_id, Documento.estado_calc,
                func.count().label("n"))
         .select_from(Documento)
         .outerjoin(Sujeto, Sujeto.id == Documento.sujeto_id)
         .where(Documento.company_id == cid,
                Documento.template_id.in_(template_ids))
         .group_by(Documento.template_id, Documento.estado_calc))
    salida: dict[uuid.UUID, dict] = {}
    for fila in db.execute(_filtro_scope(q, scope)).all():
        d = salida.setdefault(fila.template_id,
                              {"docs": 0, "ok": 0, "porvenc": 0,
                               "venc": 0, "falta": 0})
        n = int(fila.n)
        d["docs"] += n
        if fila.estado_calc in d:
            d[fila.estado_calc] += n
    return salida


def _estado_agregado(c: dict) -> str:
    """Estado de la empresa frente a un requisito.

    Basta un documento vencido para que el requisito esté vencido: la faena no
    deja entrar a nadie con la documentación caduca, aunque el resto esté al
    día. Sin ningún documento instanciado el requisito está en `falta`.
    """
    if c["venc"]:
        return "venc"
    if c["porvenc"]:
        return "porvenc"
    if c["docs"] and c["ok"] == c["docs"]:
        return "ok"
    return "falta"


def _fila_out(t: RequisitoTemplate, c: dict) -> dict:
    return {
        "template_id": str(t.id), "company_id": None,
        "codigo": t.codigo, "titulo": t.titulo,
        "tipo": t.tipo, "ambito": t.ambito, "obligatorio": t.obligatorio,
        "vigencia_meses": t.vigencia_meses, "plataforma": t.plataforma,
        "aplica_a": t.aplica_a, "ejemplo_clave": t.ejemplo_clave,
        "archivo_ejemplo": t.archivo_ejemplo,
        "docs": c["docs"], "ok": c["ok"], "porvenc": c["porvenc"],
        "venc": c["venc"], "falta": c["falta"],
        "estado": _estado_agregado(c),
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _template_out(t: RequisitoTemplate) -> dict:
    """Plantilla en modo lectura/escritura."""
    return {
        "template_id": str(t.id), "company_id": None,
        "codigo": t.codigo, "titulo": t.titulo,
        "tipo": t.tipo, "ambito": t.ambito, "obligatorio": t.obligatorio,
        "vigencia_meses": t.vigencia_meses, "plataforma": t.plataforma,
        "aplica_a": t.aplica_a, "ejemplo_clave": t.ejemplo_clave,
        "archivo_ejemplo": t.archivo_ejemplo,
        "faena_id": str(t.faena_id) if t.faena_id else None,
        "es_estandar": t.faena_id is None,
        "activo": t.activo,
    }


def _kpis(db: Session, cid: uuid.UUID, scope: uuid.UUID | None) -> dict:
    """KPI de la cabecera, sobre TODOS los documentos de la empresa.

    Incluye los documentos sin plantilla (requisitos custom del contrato y de la
    Carpeta de Arranque), así que la suma de los contadores de las filas puede
    ser menor que `total`: la cabecera responde «cómo está mi documentación» y
    el listado «cómo está cada requisito del catálogo».
    """
    q = (select(func.count().label("total"),
                func.count().filter(Documento.estado_calc == "ok").label("ok"),
                func.count().filter(
                    Documento.estado_calc == "porvenc").label("porvenc"),
                func.count().filter(
                    Documento.estado_calc == "venc").label("venc"))
         .select_from(Documento)
         .outerjoin(Sujeto, Sujeto.id == Documento.sujeto_id)
         .where(Documento.company_id == cid))
    fila = db.execute(_filtro_scope(q, scope)).one()
    return {
        "total": int(fila.total or 0),
        "activos": int(fila.ok or 0),
        # El umbral de `porvenc` son 30 días (config.UMBRAL_PORVENC_DIAS), que
        # es exactamente lo que pide la tarjeta «por vencer 30d».
        "por_vencer_30d": int(fila.porvenc or 0),
        "vencidos": int(fila.venc or 0),
    }


def _ordenar(items: list[dict], sort: str | None) -> list[dict]:
    campo = sort or "ambito"
    desc = campo.startswith("-")
    campo = ORDEN_CATALOGO.get(campo.lstrip("-"), "ambito")
    if campo == "estado":
        clave = lambda i: (_PESO_ESTADO.get(i["estado"], 9), i["titulo"].lower())  # noqa: E731
    elif campo in ("docs", "vigencia_meses"):
        clave = lambda i: (i[campo] or 0, i["titulo"].lower())                     # noqa: E731
    elif campo == "ambito":
        clave = lambda i: (i["ambito"], i["titulo"].lower())                        # noqa: E731
    else:
        clave = lambda i: ((i[campo] or "").lower(), i["titulo"].lower())           # noqa: E731
    return sorted(items, key=clave, reverse=desc)


# ------------------------------------------------------------------ catálogo
@router.get("")
def listar(ambito: str | None = Query(None),
           tipo: str | None = Query(None),
           obligatorio: bool | None = Query(None),
           estado: str | None = Query(None),
           p: Page = Depends(paginacion),
           db: Session = Depends(get_db),
           cid: uuid.UUID = Depends(get_company_id),
           user: User = Depends(get_current_user)):
    """Catálogo de requisitos con el estado real de la empresa en cada uno.

    Los contadores no se derivan de la plantilla efectiva sino de los documentos
    ya instanciados: un requisito con `docs=0` está en `falta` porque nadie lo
    ha materializado todavía, y eso es precisamente lo que el usuario necesita
    ver. El filtro `estado` opera sobre el estado agregado, que no es una
    columna, así que el conjunto se compone en memoria (el catálogo son decenas
    de filas) y se pagina aquí.
    """
    if ambito and ambito not in AMBITOS:
        raise err(400, "AMBITO_INVALIDO",
                  f"Ámbito debe ser uno de: {', '.join(AMBITOS)}")
    if tipo and tipo not in TIPOS:
        raise err(400, "TIPO_INVALIDO",
                  f"Tipo debe ser uno de: {', '.join(TIPOS)}")
    if estado and estado not in ESTADOS:
        raise err(400, "ESTADO_INVALIDO",
                  f"Estado debe ser uno de: {', '.join(ESTADOS)}")

    scope = contrato_scope(user)
    q = _catalogo_visible(cid, scope)
    if ambito:
        q = q.where(RequisitoTemplate.ambito == ambito)
    if tipo:
        q = q.where(RequisitoTemplate.tipo == tipo)
    if obligatorio is not None:
        q = q.where(RequisitoTemplate.obligatorio.is_(obligatorio))
    if p.search:
        like = f"%{p.search}%"
        # `tipo` es un ENUM: se busca sobre su texto porque el placeholder del
        # buscador promete «nombre, código o tipo» (H-37).
        q = q.where(or_(RequisitoTemplate.titulo.ilike(like),
                        RequisitoTemplate.codigo.ilike(like),
                        RequisitoTemplate.plataforma.ilike(like),
                        RequisitoTemplate.tipo.cast(String).ilike(like)))

    plantillas = list(db.scalars(q))
    conteos = _conteos_por_template(db, cid, [t.id for t in plantillas], scope)
    vacio = {"docs": 0, "ok": 0, "porvenc": 0, "venc": 0, "falta": 0}
    items = [_fila_out(t, conteos.get(t.id, dict(vacio))) for t in plantillas]
    
    # Calcular KPIs basados en el catálogo (plantillas), no en documentos
    kpis = {
        "total": len(items),
        "activos": sum(1 for i in items if i["estado"] == "ok"),
        "por_vencer_30d": sum(1 for i in items if i["estado"] == "porvenc"),
        "vencidos": sum(1 for i in items if i["estado"] == "venc"),
    }

    if estado:
        items = [i for i in items if i["estado"] == estado]

    items = _ordenar(items, p.sort)
    total = len(items)
    salida = sobre(items[p.offset:p.offset + p.page_size], total, p)
    salida["kpis"] = kpis
    return salida


# ----------------------------------------------------------------- plantillas
@router.get("/templates")
def listar_templates(ambito: str | None = Query(None),
                     faena_id: uuid.UUID | None = Query(None),
                     p: Page = Depends(paginacion),
                     db: Session = Depends(get_db)):
    """Solo las plantillas activas del catálogo."""
    q = select(RequisitoTemplate).where(RequisitoTemplate.activo.is_(True))
    if ambito:
        if ambito not in AMBITOS:
            raise err(400, "AMBITO_INVALIDO", f"Ámbito debe ser uno de: {', '.join(AMBITOS)}")
        q = q.where(RequisitoTemplate.ambito == ambito)
    if faena_id:
        q = q.where(or_(RequisitoTemplate.faena_id.is_(None), RequisitoTemplate.faena_id == faena_id))
    if p.search:
        like = f"%{p.search}%"
        # `tipo` es un ENUM: se busca sobre su texto porque el placeholder del
        # buscador promete «nombre, código o tipo» (H-37).
        q = q.where(or_(RequisitoTemplate.titulo.ilike(like),
                        RequisitoTemplate.codigo.ilike(like),
                        RequisitoTemplate.plataforma.ilike(like),
                        RequisitoTemplate.tipo.cast(String).ilike(like)))

    q = aplicar_orden(q, RequisitoTemplate, p.sort, ORDEN_TEMPLATES, "titulo")
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    plantillas = list(db.scalars(q.offset(p.offset).limit(p.page_size)))
    return sobre([_template_out(t) for t in plantillas], total, p)


# -------------------------------------------------- CRUD de Plantillas por Empresa
class TemplateIn(BaseModel):
    ambito: str
    titulo: str
    codigo: str | None = None
    tipo: str | None = None
    obligatorio: bool = True
    ejemplo_clave: str | None = None
    archivo_ejemplo: str | None = None
    faena_id: uuid.UUID | None = None
    vigencia_meses: int | None = None
    plataforma: str | None = None
    aplica_a: str | None = None
    activo: bool = True


class TemplatePatch(BaseModel):
    ambito: str | None = None
    titulo: str | None = None
    codigo: str | None = None
    tipo: str | None = None
    obligatorio: bool | None = None
    ejemplo_clave: str | None = None
    archivo_ejemplo: str | None = None
    faena_id: uuid.UUID | None = None
    vigencia_meses: int | None = None
    plataforma: str | None = None
    aplica_a: str | None = None
    activo: bool | None = None


class TemplateUploadUrlIn(BaseModel):
    filename: str
    content_type: str | None = None
    size_bytes: int | None = None


@router.post("/templates/upload-url")
def upload_url_template(body: TemplateUploadUrlIn,
                        cid: uuid.UUID = Depends(get_company_id),
                        user: User = Depends(get_current_user)):
    """SAS para subir un archivo de ejemplo de un requisito."""
    from ..config import settings
    from .documentos import _valida_extension
    _valida_extension(body.filename)
    maximo = settings.max_upload_mb * 1024 * 1024
    if body.size_bytes is not None and body.size_bytes > maximo:
        raise err(400, "ARCHIVO_DEMASIADO_GRANDE",
                  f"El tamaño máximo es {settings.max_upload_mb} MB")

    blob_path = make_template_blob_path(str(cid), body.filename)
    content_type = (body.content_type
                    or mimetypes.guess_type(body.filename)[0]
                    or "application/octet-stream")
    sas = get_storage().upload_url(blob_path, content_type)
    return {
        "upload_url": sas.upload_url, "blob_path": sas.blob_path,
        "expires_at": sas.expires_at.isoformat(), "headers": sas.headers,
        "method": "PUT", "max_bytes": maximo,
    }


@router.post("/templates")
def crear_template(data: TemplateIn,
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Crea una nueva plantilla de requisito en el catálogo de requisitos.

    Exige sesión: el catálogo es global y sin autenticación cualquiera podía
    escribir en él (el RLS de producción lo frena, pero en desarrollo la API
    corre con el rol dueño y la política no se aplica).
    """
    if data.ambito not in AMBITOS:
        raise err(400, "AMBITO_INVALIDO", f"Ámbito debe ser uno de: {', '.join(AMBITOS)}")
    if data.tipo and data.tipo not in TIPOS:
        raise err(400, "TIPO_INVALIDO", f"Tipo debe ser uno de: {', '.join(TIPOS)}")

    t = RequisitoTemplate(
        ambito=data.ambito,
        titulo=data.titulo.strip(),
        codigo=data.codigo.strip() if data.codigo else None,
        tipo=data.tipo,
        obligatorio=data.obligatorio,
        ejemplo_clave=data.ejemplo_clave,
        archivo_ejemplo=data.archivo_ejemplo,
        faena_id=data.faena_id,
        vigencia_meses=data.vigencia_meses,
        plataforma=data.plataforma,
        aplica_a=data.aplica_a,
        activo=data.activo,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _template_out(t)


@router.patch("/templates/{template_id}")
def editar_template(template_id: uuid.UUID,
                    data: TemplatePatch,
                    db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    """Edita una plantilla existente. Requiere sesión (ver `crear_template`)."""
    t = db.get(RequisitoTemplate, template_id)
    if not t or not t.activo:
        raise err(404, "NO_ENCONTRADO", "Plantilla de requisito no existe")

    if data.ambito:
        if data.ambito not in AMBITOS:
            raise err(400, "AMBITO_INVALIDO", f"Ámbito debe ser uno de: {', '.join(AMBITOS)}")
        t.ambito = data.ambito
    if data.tipo is not None:
        if data.tipo and data.tipo not in TIPOS:
            raise err(400, "TIPO_INVALIDO", f"Tipo debe ser uno de: {', '.join(TIPOS)}")
        t.tipo = data.tipo
    if data.titulo is not None:
        t.titulo = data.titulo.strip()
    if data.codigo is not None:
        t.codigo = data.codigo.strip() if data.codigo else None
    if data.obligatorio is not None:
        t.obligatorio = data.obligatorio
    if data.vigencia_meses is not None:
        t.vigencia_meses = data.vigencia_meses
    if data.plataforma is not None:
        t.plataforma = data.plataforma
    if data.aplica_a is not None:
        t.aplica_a = data.aplica_a
    if data.archivo_ejemplo is not None:
        t.archivo_ejemplo = data.archivo_ejemplo
    if data.activo is not None:
        t.activo = data.activo

    db.commit()
    db.refresh(t)
    return _template_out(t)


@router.delete("/templates/{template_id}")
def eliminar_template(template_id: uuid.UUID,
                      db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Desactiva (soft delete) una plantilla de requisito."""
    t = db.get(RequisitoTemplate, template_id)
    if not t or not t.activo:
        raise err(404, "NO_ENCONTRADO", "Plantilla de requisito no existe")

    t.activo = False
    db.commit()
    return {"ok": True, "message": "Plantilla desactivada correctamente"}
