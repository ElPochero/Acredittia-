"""RevisiÃ³n y extracciÃ³n IA (Â§12 y Â§12.1).

Todo en este mÃ³dulo es **asÃ­ncrono**: el endpoint valida, crea la fila de
`ia_reviews` en estado `queued`, encola la tarea y responde `202 {job_id,
status}`. El resultado se consulta siempre con `GET /ia/revisiones/{job_id}`,
tanto para la revisiÃ³n de un documento cargado como para las tres extracciones
que pre-llenan formularios. Un solo recurso de polling para todo: el frontend no
necesita saber quÃ© tipo de trabajo pidiÃ³, solo el `job_id`.

Dos consecuencias de que `ia_reviews` sea la Ãºnica tabla de jobs:

* **No tiene `contrato_id`.** La trazabilidad de las extracciones (contrato al
  que apuntan, blob temporal y nombre original) va dentro de `campos_extraidos`.
  Es la convenciÃ³n que ya usa `contrato_requisitos.py` y se respeta aquÃ­.
* **`campos_extraidos` mezcla datos de entrada y de salida.** Las claves internas
  se prefijan con `_` (`_accion_aplicada`) y se excluyen del payload pÃºblico:
  la especificaciÃ³n las expone como campos hermanos, no dentro del diccionario
  de valores detectados.

Las extracciones no crean entidades. Devuelven valores propuestos con confianza
por campo; el alta ocurre en el endpoint del recurso, que acepta `ia_review_id`
para dejar el rastro (Â§12.1).
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_EXTENSIONS_ARRANQUE,
    ALLOWED_EXTENSIONS_CONTRATO,
    settings,
)
from ..deps import (
    Page,
    aplicar_orden,
    contrato_scope,
    err,
    get_company_id,
    get_current_user,
    get_db,
    paginacion,
    require_company,
    require_contrato,
    sobre,
)
from ..models import (
    Alerta,
    Contrato,
    ContratoRequisito,
    Documento,
    DocumentoArchivo,
    DocumentoChunk,
    IaHallazgo,
    IaReview,
    Sujeto,
    User,
    ChatHistorial,
)
from ..services import actividad
from ..services.jobs import enqueue
from ..services.storage import get_storage, make_tmp_path

# Importar el mÃ³dulo de tareas registra TAREAS: sin Ã©l `enqueue` no resolverÃ­a
# 'revisar_documento' ni las extracciones y solo dejarÃ­a un error en el log.
from ..services.tasks import contexto_de_documento

logger = logging.getLogger("acredittia.ia")

router = APIRouter(prefix="/ia", tags=["ia"])

RESULTADOS: tuple[str, ...] = ("validado", "con_observaciones", "con_errores")
CONTEXTOS: tuple[str, ...] = (
    "empresa",
    "personal",
    "equipo",
    "contrato",
    "emsipor",
    "cedula",
    "padron",
    "carpeta_arranque",
)
ESTADOS: tuple[str, ...] = ("queued", "processing", "done", "failed")

ORDEN_REVISIONES = {"created_at", "started_at", "finished_at", "status", "confianza"}

NOTA_EXTRACCION = (
    "La extracciÃ³n no crea entidades: confirme el formulario en "
    "el endpoint del recurso indicando ia_review_id."
)


# ------------------------------------------------------------------- entradas
class RevisionIn(BaseModel):
    archivo_id: uuid.UUID


class ExtraerSujetoIn(BaseModel):
    blob_path: str
    filename: str
    tipo: Literal["cedula", "padron"]


class ExtraerContratoIn(BaseModel):
    blob_path: str
    filename: str


class ExtraerArranqueIn(BaseModel):
    blob_path: str
    filename: str
    contrato_id: uuid.UUID


# ------------------------------------------------------------------- helpers
def _iso(v: datetime | None) -> str | None:
    return v.isoformat() if v else None


def _publicos(campos: dict | None) -> dict:
    """Campos detectados sin las claves internas (prefijo `_`)."""
    return {k: v for k, v in (campos or {}).items() if not k.startswith("_")}


def _valida_extension(filename: str, permitidas: set[str]) -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in permitidas:
        raise err(
            400,
            "EXTENSION_NO_PERMITIDA",
            f"Extensiones permitidas: {', '.join(sorted(permitidas))}",
        )


def _valida_blob(blob_path: str) -> str:
    """El archivo ya se subiÃ³ por SAS; aquÃ­ solo llega su ruta (Â§10)."""
    ruta = (blob_path or "").strip()
    if not ruta:
        raise err(400, "BLOB_PATH_REQUERIDO", "Falta la ruta del archivo ya subido")
    return ruta


def _hallazgo_out(h: IaHallazgo) -> dict:
    return {
        "tipo": h.tipo,
        "codigo": h.codigo,
        "mensaje": h.mensaje,
        "campo": h.campo,
        "valor_detectado": h.valor_detectado,
        "valor_esperado": h.valor_esperado,
    }


def review_out(r: IaReview, hallazgos: list[IaHallazgo] | None = None) -> dict:
    """Serializador de un job de IA (Â§12). Lo reutilizan otros routers."""
    campos = r.campos_extraidos or {}
    filas = hallazgos if hallazgos is not None else list(r.hallazgos)
    return {
        "job_id": str(r.id),
        "status": r.status,
        "context": r.context,
        "resultado": r.resultado,
        "confianza": float(r.confianza) if r.confianza is not None else None,
        "campos_extraidos": _publicos(campos),
        "hallazgos": [_hallazgo_out(h) for h in filas],
        "archivo_id": str(r.archivo_id) if r.archivo_id else None,
        "documento_id": campos.get("documento_id"),
        "contrato_id": campos.get("contrato_id"),
        "started_at": _iso(r.started_at),
        "finished_at": _iso(r.finished_at),
        "error": r.error,
        # QuÃ© se hizo con el documento a partir del veredicto. Lo escribe la
        # tarea; sin Ã©l el usuario ve el resultado de la IA pero no el efecto.
        "accion_aplicada": campos.get("_accion_aplicada"),
        "created_at": _iso(r.created_at),
    }


def _archivos_de(
    cid: uuid.UUID,
    *,
    documento_id: uuid.UUID | None = None,
    sujeto_id: uuid.UUID | None = None,
    contrato_id: uuid.UUID | None = None,
):
    """Subconsulta de `documento_archivos` que cumplen el filtro pedido.

    `ia_reviews.archivo_id` es una columna uuid suelta (sin FK mapeada), asÃ­ que
    los filtros por documento, sujeto o contrato se resuelven con un semi-join y
    no con un JOIN que multiplicarÃ­a filas.
    """
    q = (
        select(DocumentoArchivo.id)
        .join(Documento, Documento.id == DocumentoArchivo.documento_id)
        .where(DocumentoArchivo.company_id == cid)
    )
    if documento_id:
        q = q.where(DocumentoArchivo.documento_id == documento_id)
    if sujeto_id:
        q = q.where(Documento.sujeto_id == sujeto_id)
    if contrato_id:
        q = q.where(
            or_(
                Documento.contrato_id == contrato_id,
                Documento.sujeto_id.in_(
                    select(Sujeto.id).where(
                        Sujeto.company_id == cid, Sujeto.contrato_id == contrato_id
                    )
                ),
            )
        )
    return q


def _get_review(db: Session, cid: uuid.UUID, job_id: uuid.UUID) -> IaReview:
    r = db.get(IaReview, job_id)
    if not r or r.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "El job de IA no existe")
    return r


def _crear_job(
    db: Session,
    cid: uuid.UUID,
    *,
    context: str,
    archivo_id: uuid.UUID | None = None,
    campos: dict | None = None,
) -> IaReview:
    review = IaReview(
        company_id=cid,
        archivo_id=archivo_id,
        context=context,
        status="queued",
        campos_extraidos=campos or {},
    )
    db.add(review)
    db.flush()
    return review


# =============================================================================
# Â§12 â€” RevisiÃ³n de documentos
# =============================================================================
@router.post("/revisiones", status_code=202)
def encolar_revision(
    body: RevisionIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Encola la revisiÃ³n IA de un archivo ya subido.

    Normalmente la dispara la propia confirmaciÃ³n de subida; este endpoint existe
    para volver a revisar un archivo (nueva versiÃ³n del modelo, revisiÃ³n que
    fallÃ³) sin obligar a resubirlo.

    El `context` no lo elige el cliente: se deriva del dueÃ±o del documento, que
    es quien determina quÃ© debe validar la IA. Un archivo de otra empresa
    responde 404 y no 403, para no revelar su existencia (Â§3.3).
    """
    archivo = db.get(DocumentoArchivo, body.archivo_id)
    if not archivo or archivo.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "El archivo no existe")
    doc = archivo.documento
    # Un contract_admin solo puede pedir revisiones dentro de su contrato.
    contrato_dueno = doc.contrato_id or (doc.sujeto.contrato_id if doc.sujeto else None)
    if contrato_dueno:
        require_contrato(contrato_dueno, user)

    contexto = contexto_de_documento(doc)
    review = _crear_job(
        db,
        cid,
        context=contexto,
        archivo_id=archivo.id,
        campos={
            "documento_id": str(doc.id),
            "blob_path": archivo.blob_path,
            "filename": archivo.filename,
        },
    )
    actividad.log(
        db,
        cid,
        "alerta_ia",
        "alertas_ia",
        f"RevisiÃ³n IA solicitada para '{doc.titulo}' (archivo '{archivo.filename}')",
        user_id=user.id,
        entidad_tipo="documento",
        entidad_id=doc.id,
    )
    db.commit()

    # Se encola despuÃ©s del commit: con QUEUE_BACKEND=inproc la tarea corre en
    # el acto y abre su propia sesiÃ³n, que solo ve lo ya confirmado.
    enqueue(
        "revisar_documento",
        archivo_id=str(archivo.id),
        company_id=str(cid),
        review_id=str(review.id),
    )
    logger.info(
        "revisiÃ³n encolada review=%s archivo=%s contexto=%s",
        review.id,
        archivo.id,
        contexto,
    )
    return {"job_id": str(review.id), "status": review.status, "context": contexto}


@router.get("/revisiones/{job_id}")
def detalle_revision(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Estado y resultado de un job de IA (endpoint de polling).

    Mientras `status` es `queued` o `processing` los campos de resultado llegan
    nulos. `accion_aplicada` describe quÃ© se hizo con el documento â€”marcarlo ok,
    autocompletar el vencimiento, abrir una alertaâ€” porque el veredicto de la IA
    por sÃ­ solo no dice quÃ© cambiÃ³ en el expediente.
    """
    r = _get_review(db, cid, job_id)
    scope = contrato_scope(user)
    if scope and not _visible_para_scope(db, cid, r, scope):
        raise err(404, "NO_ENCONTRADO", "El job de IA no existe")
    return review_out(r)


def _visible_para_scope(
    db: Session, cid: uuid.UUID, r: IaReview, scope: uuid.UUID
) -> bool:
    """Â¿El job pertenece al contrato al que estÃ¡ acotado un contract_admin?

    Se acepta por dos vÃ­as: el archivo revisado cuelga de ese contrato, o el job
    es una extracciÃ³n cuyo `campos_extraidos['contrato_id']` es ese contrato.
    """
    campos = r.campos_extraidos or {}
    if str(campos.get("contrato_id") or "") == str(scope):
        return True
    if r.archivo_id is None:
        return False
    return (
        db.scalar(
            select(func.count()).select_from(
                _archivos_de(cid, contrato_id=scope)
                .where(DocumentoArchivo.id == r.archivo_id)
                .subquery()
            )
        )
        > 0
    )


@router.get("/revisiones")
def listar_revisiones(
    documento_id: uuid.UUID | None = Query(None),
    sujeto_id: uuid.UUID | None = Query(None),
    resultado: str | None = Query(None),
    context: str | None = Query(None),
    status: str | None = Query(None),
    p: Page = Depends(paginacion),
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Historial de revisiones y extracciones de la empresa, la mÃ¡s reciente primero.

    Filtrar por `documento_id` o `sujeto_id` descarta necesariamente las
    extracciones, que no tienen archivo asociado. Un contract_admin ve solo los
    jobs de su contrato.
    """
    if resultado and resultado not in RESULTADOS:
        raise err(
            400,
            "RESULTADO_INVALIDO",
            f"Resultado debe ser uno de: {', '.join(RESULTADOS)}",
        )
    if context and context not in CONTEXTOS:
        raise err(
            400, "CONTEXT_INVALIDO", f"Context debe ser uno de: {', '.join(CONTEXTOS)}"
        )
    if status and status not in ESTADOS:
        raise err(
            400, "STATUS_INVALIDO", f"Status debe ser uno de: {', '.join(ESTADOS)}"
        )

    q = select(IaReview).where(IaReview.company_id == cid)
    if resultado:
        q = q.where(IaReview.resultado == resultado)
    if context:
        q = q.where(IaReview.context == context)
    if status:
        q = q.where(IaReview.status == status)
    if documento_id or sujeto_id:
        q = q.where(
            IaReview.archivo_id.in_(
                _archivos_de(cid, documento_id=documento_id, sujeto_id=sujeto_id)
            )
        )

    scope = contrato_scope(user)
    if scope:
        q = q.where(
            or_(
                IaReview.archivo_id.in_(_archivos_de(cid, contrato_id=scope)),
                IaReview.campos_extraidos["contrato_id"].astext == str(scope),
            )
        )

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    q = aplicar_orden(q, IaReview, p.sort, ORDEN_REVISIONES, "-created_at")
    filas = list(db.scalars(q.offset(p.offset).limit(p.page_size)))
    return sobre([review_out(r) for r in filas], total, p)


# =============================================================================
# Â§12.1 â€” Extracciones que pre-llenan formularios
# =============================================================================
@router.post("/extraer-sujeto", status_code=202)
def extraer_sujeto(
    body: ExtraerSujetoIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(require_company),
):
    """Lee una cÃ©dula o un padrÃ³n y propone los campos del alta.

    CÃ©dula â†’ `{nombre, rut, cargo_sugerido}`; padrÃ³n o permiso de circulaciÃ³n â†’
    `{patente, marca, modelo, anio, tipo_equipo_sugerido}`. El `context` del job
    es el propio tipo de documento (`cedula` | `padron`), que es lo que permite
    filtrar el historial por clase de extracciÃ³n.
    """
    _valida_extension(body.filename, ALLOWED_EXTENSIONS)
    blob_path = _valida_blob(body.blob_path)

    review = _crear_job(
        db,
        cid,
        context=body.tipo,
        campos={"blob_path": blob_path, "filename": body.filename, "tipo": body.tipo},
    )
    actividad.log(
        db,
        cid,
        "alerta_ia",
        "alertas_ia",
        f"ExtracciÃ³n de {body.tipo} solicitada sobre '{body.filename}'",
        user_id=user.id,
        entidad_tipo="ia_review",
        entidad_id=review.id,
    )
    db.commit()

    enqueue(
        "extraer_sujeto",
        review_id=str(review.id),
        company_id=str(cid),
        blob_path=blob_path,
        tipo=body.tipo,
    )
    logger.info(
        "extracciÃ³n de sujeto encolada review=%s tipo=%s", review.id, body.tipo
    )
    return {
        "job_id": str(review.id),
        "status": review.status,
        "context": body.tipo,
        "nota": NOTA_EXTRACCION,
    }


def encolar_extraccion_contrato(
    db: Session, cid: uuid.UUID, user: User, blob_path: str, filename: str
) -> dict:
    """Encola la extracciÃ³n de un contrato firmado. Devuelve el sobre 202.

    Vive aquÃ­ porque `POST /ia/extraer-contrato` es el alias canÃ³nico y
    `POST /contratos/analizar` debe comportarse exactamente igual: el router de
    contratos importa esta funciÃ³n en vez de duplicar la validaciÃ³n, la creaciÃ³n
    del job y el encolado.
    """
    _valida_extension(filename, ALLOWED_EXTENSIONS_CONTRATO)
    ruta = _valida_blob(blob_path)

    review = _crear_job(
        db, cid, context="contrato", campos={"blob_path": ruta, "filename": filename}
    )
    actividad.log(
        db,
        cid,
        "alerta_ia",
        "contrato",
        f"Contrato '{filename}' enviado a extracciÃ³n IA",
        user_id=user.id,
        entidad_tipo="ia_review",
        entidad_id=review.id,
    )
    db.commit()

    enqueue(
        "extraer_contrato",
        review_id=str(review.id),
        company_id=str(cid),
        blob_path=ruta,
    )
    logger.info("extracciÃ³n de contrato encolada review=%s", review.id)
    return {
        "job_id": str(review.id),
        "status": review.status,
        "context": "contrato",
        "nota": NOTA_EXTRACCION,
    }


@router.post("/extraer-contrato", status_code=202)
def extraer_contrato(
    body: ExtraerContratoIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(require_company),
):
    """Lee un contrato en PDF o Word y propone mandante, faena, fechas y servicio.

    Alias canÃ³nico de `POST /contratos/analizar` (Â§12.1).
    """
    return encolar_extraccion_contrato(db, cid, user, body.blob_path, body.filename)


def encolar_extraccion_arranque(
    db: Session,
    cid: uuid.UUID,
    user: User,
    blob_path: str,
    filename: str,
    contrato_id: uuid.UUID,
) -> dict:
    """Encola la extracciÃ³n de una Carpeta de Arranque. Devuelve el sobre 202.

    El contrato se guarda en `campos_extraidos['contrato_id']` porque
    `ia_reviews` no tiene columna propia; es la misma convenciÃ³n que usa
    `POST /contratos/{id}/carpeta-arranque`.
    """
    _valida_extension(filename, ALLOWED_EXTENSIONS_ARRANQUE)
    ruta = _valida_blob(blob_path)

    from .plataformas import contrato_de_empresa  # evita un ciclo de imports

    c = contrato_de_empresa(db, cid, contrato_id, user)

    review = _crear_job(
        db,
        cid,
        context="carpeta_arranque",
        campos={"contrato_id": str(c.id), "blob_path": ruta, "filename": filename},
    )
    actividad.log(
        db,
        cid,
        "alerta_ia",
        "requisitos",
        f"Carpeta de Arranque '{filename}' enviada a extracciÃ³n "
        f"para el contrato '{c.nombre}'",
        user_id=user.id,
        entidad_tipo="ia_review",
        entidad_id=review.id,
    )
    db.commit()

    enqueue(
        "extraer_carpeta_arranque",
        review_id=str(review.id),
        company_id=str(cid),
        contrato_id=str(c.id),
        blob_path=ruta,
    )
    logger.info(
        "extracciÃ³n de carpeta de arranque encolada review=%s contrato=%s",
        review.id,
        c.id,
    )
    return {
        "job_id": str(review.id),
        "status": review.status,
        "context": "carpeta_arranque",
        "contrato_id": str(c.id),
        "nota": (
            "La extracciÃ³n propone requisitos; confÃ­rmelos con "
            "POST /contratos/{id}/requisitos?bulk=true"
        ),
    }


@router.post("/extraer-carpeta-arranque", status_code=202)
def extraer_carpeta_arranque(
    body: ExtraerArranqueIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(require_company),
):
    """Lee una planilla o PDF de carpeta de arranque y propone requisitos por ambito.

    Alias canonico de `POST /contratos/{id}/carpeta-arranque` (Â§12.1). La
    extraccion por si sola no crea requisitos.
    """
    return encolar_extraccion_arranque(
        db, cid, user, body.blob_path, body.filename, body.contrato_id
    )


# ============================================================================
# SAS temporal para las extracciones
# ============================================================================
class TmpUploadIn(BaseModel):
    filename: str
    content_type: str | None = None
    size_bytes: int | None = None
    proposito: Literal["contrato", "cedula", "padron", "carpeta_arranque"]


@router.post("/upload-url")
def upload_url_temporal(
    body: TmpUploadIn,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """SAS de escritura para un blob temporal de extraccion.

    Las tres extracciones de Â§12.1 y `POST /contratos/analizar` reciben un
    `blob_path` ya subido, pero el emisor de SAS de `/documentos/{id}/upload-url`
    exige un documento existente y estas extracciones son justo lo que ocurre
    ANTES de que exista la entidad: analizar el contrato para pre-llenar el
    formulario de creacion, o leer una cedula para dar de alta al trabajador.

    El blob cae en `tmp/{company_id}/â€¦` y la tarea `purgar_temporales` lo elimina
    a las 24 horas: contiene datos personales (cÃ©dulas) y no queda referenciado
    por ninguna fila, asÃ­ que no puede vivir indefinidamente.
    """
    permitidas = {
        "contrato": ALLOWED_EXTENSIONS_CONTRATO,
        "carpeta_arranque": ALLOWED_EXTENSIONS_ARRANQUE,
        "cedula": ALLOWED_EXTENSIONS,
        "padron": ALLOWED_EXTENSIONS,
    }[body.proposito]
    _valida_extension(body.filename, permitidas)

    maximo = settings.max_upload_mb * 1024 * 1024
    if body.size_bytes is not None and body.size_bytes > maximo:
        raise err(
            400,
            "ARCHIVO_DEMASIADO_GRANDE",
            f"El tamaÃ±o mÃ¡ximo es {settings.max_upload_mb} MB",
        )

    blob_path = make_tmp_path(cid, body.proposito, body.filename)
    sas = get_storage().upload_url(blob_path, body.content_type)
    return {
        "upload_url": sas.upload_url,
        "blob_path": sas.blob_path,
        "expires_at": sas.expires_at.isoformat(),
        "headers": sas.headers,
        "temporal": True,
        "purga_horas": 24,
    }


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    contexto: str
    mensaje: str
    historial: list[ChatMessageIn]
    file_name: str | None = None
    file_b64: str | None = None


def _contexto_contrato(
    db: Session,
    cid: uuid.UUID,
    user: User,
    contexto: str,
    mensaje: str | None = None,
) -> dict | None:
    """Datos reales del contrato para que el chat responda con contexto.

    El chat de contrato preguntaba a ciegas (alucinaba estados o pedía
    datos que el sistema ya tiene). Si el contexto es `contrato_<id>` se
    inyecta un mensaje de sistema con el estado real: dotación, requisitos,
    alertas y cumplimiento.
    """
    import uuid as _uuid

    if not contexto.startswith("contrato_"):
        return None
    try:
        contrato_id = _uuid.UUID(contexto.split("_", 1)[1])
    except (ValueError, IndexError):
        return None
    try:
        require_contrato(contrato_id, user)
    except Exception:
        return None
    c = db.get(Contrato, contrato_id)
    if not c or c.company_id != cid:
        return None

    sujetos = list(
        db.scalars(
            select(Sujeto).where(
                Sujeto.company_id == cid,
                Sujeto.contrato_id == c.id,
                Sujeto.estado != "baja",
            )
        )
    )
    per = [s for s in sujetos if s.tipo == "trabajador"]
    eq = [s for s in sujetos if s.tipo == "equipo"]
    reqs = list(
        db.scalars(
            select(ContratoRequisito)
            .where(
                ContratoRequisito.company_id == cid,
                ContratoRequisito.contrato_id == c.id,
            )
            .order_by(ContratoRequisito.titulo)
            .limit(60)
        )
    )
    # Los requisitos base no tienen fila propia: se proyectan desde las
    # plantillas igual que el listado de la pestaña Requisitos.
    try:
        from .contrato_requisitos import _proyectar_base
        from .plataformas import plataformas_efectivas

        base = _proyectar_base(db, c, plataformas_efectivas(db, cid, c))
    except Exception:
        base = []
    vistos = set()
    todos = []
    for r in list(reqs) + (base or []):
        titulo = (r.titulo if hasattr(r, "titulo") else r.get("titulo", "")).strip()
        ambito = r.ambito if hasattr(r, "ambito") else r.get("ambito", "")
        if titulo.lower() not in vistos:
            vistos.add(titulo.lower())
            todos.append(f"{titulo} [{ambito}]")
    reqs_txt = ", ".join(todos[:60]) or "ninguno"
    # RAG (v10): si el contrato ya esta indexado, los requisitos salen de
    # busqueda semantica top-K sobre la pregunta en vez del volcado completo.
    # Sin chunks, sin mensaje de texto o si Gemini falla, se usa el volcado.
    frags_txt = None
    if mensaje and isinstance(mensaje, str) and mensaje.strip():
        try:
            from ..services.embeddings import EmbeddingsError, embed_texts

            n_chunks = db.scalar(
                select(func.count())
                .select_from(DocumentoChunk)
                .where(
                    DocumentoChunk.company_id == cid,
                    DocumentoChunk.contrato_id == c.id,
                )
            )
            if n_chunks:
                _vec = embed_texts([mensaje.strip()[:2000]])[0]
                _top = db.scalars(
                    select(DocumentoChunk)
                    .where(
                        DocumentoChunk.company_id == cid,
                        DocumentoChunk.contrato_id == c.id,
                    )
                    .order_by(DocumentoChunk.embedding.cosine_distance(_vec))
                    .limit(8)
                ).all()
                if _top:
                    frags_txt = "; ".join(
                        f"{t.titulo} [{t.ambito or '?'}]: {t.texto}" for t in _top
                    )
        except EmbeddingsError as e:
            logger.warning("RAG sin retrieval para %s: %s", c.id, e)
        except Exception:
            logger.exception("RAG: fallo inesperado en retrieval")
    if frags_txt:
        reqs_txt = "(busqueda semantica) " + frags_txt
    alertas = list(
        db.scalars(
            select(Alerta)
            .where(
                Alerta.company_id == cid,
                Alerta.contrato_id == c.id,
                Alerta.resuelta_at.is_(None),
            )
            .order_by(Alerta.created_at.desc())
            .limit(15)
        )
    )

    def nom(s: Sujeto) -> str:
        base = s.nombre
        extra = s.rut if s.tipo == "trabajador" else (s.patente or "")
        return f"{base} ({extra}, {s.estado})" if extra else f"{base} ({s.estado})"

    lineas = [
        f"Contrato: {c.nombre} (código {c.codigo or 's/n'}, "
        f"faena {c.faena.nombre if c.faena else '?'}, "
        f"inicio {c.fecha_inicio or '?'}, término {c.fecha_termino or 'sin término'}, "
        f"estado {c.estado}).",
        f"Dotación: {len(per)} trabajadores, {len(eq)} equipos.",
        "Trabajadores: "
        + (", ".join(nom(s) for s in per[:30]) or "ninguno")
        + (f" (+{len(per) - 30} más)" if len(per) > 30 else "")
        + ".",
        "Equipos: "
        + (", ".join(nom(s) for s in eq[:30]) or "ninguno")
        + (f" (+{len(eq) - 30} más)" if len(eq) > 30 else "")
        + ".",
        f"Requisitos del contrato ({len(todos)}): {reqs_txt}.",
        "Alertas activas: "
        + (", ".join(f"{a.titulo} [{a.severidad}]" for a in alertas) or "ninguna")
        + ".",
        "Responde SIEMPRE usando estos datos. Si preguntan por el estado, "
        "vencimientos, alertas, dotación o requisitos, responde con cifras y "
        "nombres de esta lista. No inventes trabajadores, documentos ni fechas.",
    ]
    return {"role": "system", "content": "Contexto del contrato:\n" + "\n".join(lineas)}


@router.post("/chat")
async def chat_ia(
    body: ChatIn,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """API para chatear con el asistente IA (Google Gemini)."""
    from ..services.ia import chat_with_ia
    import json

    # El historial viene del frontend
    historial_dict = [
        {"role": msg.role, "content": msg.content} for msg in body.historial
    ]

    # Procesar archivo si viene adjunto
    mensaje_final = body.mensaje
    contenido_mensaje = body.mensaje

    if body.file_b64 and body.file_name:
        import base64

        # b64 viene como "data:image/png;base64,iVBORw0KGgo..."
        mime_part, b64_data = (
            body.file_b64.split(",", 1) if "," in body.file_b64 else ("", body.file_b64)
        )

        fname = body.file_name.lower()
        if fname.endswith(".pdf"):
            try:
                import fitz

                pdf_bytes = base64.b64decode(b64_data)
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                texto_pdf = ""
                for page in doc:
                    texto_pdf += page.get_text() + "\n"
                mensaje_final = f"{body.mensaje}\n\n[Contenido del PDF {body.file_name}]:\n{texto_pdf}"
                contenido_mensaje = mensaje_final
            except Exception as e:
                logger.error(f"Error parseando PDF: {e}")
                mensaje_final = f"{body.mensaje}\n\n(Error: No se pudo leer el PDF {body.file_name})"
                contenido_mensaje = mensaje_final

        elif (
            fname.endswith(".xlsx") or fname.endswith(".xls") or fname.endswith(".csv")
        ):
            try:
                import openpyxl
                import io

                excel_bytes = base64.b64decode(b64_data)
                wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), data_only=True)
                texto_excel = ""
                for ws in wb.worksheets:
                    for row in ws.iter_rows(values_only=True):
                        texto_excel += (
                            " | ".join(str(c) for c in row if c is not None) + "\n"
                        )
                # Limitar texto si es muy grande
                texto_excel = texto_excel[:15000]
                mensaje_final = f"{body.mensaje}\n\n[Contenido del Excel {body.file_name}]:\n{texto_excel}"
                contenido_mensaje = mensaje_final
            except Exception as e:
                logger.error(f"Error parseando Excel: {e}")
                mensaje_final = f"{body.mensaje}\n\n(Error: No se pudo leer el Excel {body.file_name})"
                contenido_mensaje = mensaje_final

        elif (
            fname.endswith(".jpg") or fname.endswith(".jpeg") or fname.endswith(".png")
        ):
            # Para imágenes, enviamos el array multimodal a Llama Vision
            mime_type = (
                "image/jpeg" if "jpeg" in fname or "jpg" in fname else "image/png"
            )
            contenido_mensaje = [
                {"type": "text", "text": body.mensaje},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{b64_data}"},
                },
            ]
            mensaje_final = f"{body.mensaje} [Imagen adjunta: {body.file_name}]"

    # Agregar el mensaje actual del usuario al historial para enviarlo al modelo
    historial_dict.append({"role": "user", "content": contenido_mensaje})

    ctx = _contexto_contrato(db, cid, user, body.contexto, body.mensaje)
    historial_ctx = [ctx] + historial_dict if ctx else historial_dict
    respuesta_json = await chat_with_ia(historial_ctx)

    # Los agregados/eliminados solo tienen sentido si el usuario pidió
    # agregar o quitar (igual que el `confirm` de la referencia): en una
    # consulta ("lista", "cómo va", "qué vence") el modelo tiende a
    # rellenarlos con lo listado y el botón Confirmar crearía duplicados.
    # Excepción: análisis/extracción de un archivo adjunto, donde los
    # requisitos extraídos son justamente el resultado esperado.
    from ..services.ia import conserva_acciones_chat

    tiene_adjunto = bool(body.file_b64 and body.file_name)
    if not conserva_acciones_chat(body.mensaje, tiene_adjunto):
        try:
            _parsed = json.loads(respuesta_json)
            _parsed.pop("agregados", None)
            _parsed.pop("eliminados", None)
            respuesta_json = json.dumps(_parsed, ensure_ascii=False)
        except Exception:
            pass

    # Guardar en base de datos (guardamos el texto simplificado, no la imagen b64)
    nuevo_historial = ChatHistorial(
        company_id=cid,
        user_id=user.id,
        contexto=body.contexto,
        mensaje_usuario=mensaje_final,
        respuesta_ia=respuesta_json,
    )
    db.add(nuevo_historial)
    db.commit()

    try:
        return json.loads(respuesta_json)
    except Exception:
        return {"respuesta": respuesta_json}


@router.get("/chat/{contexto}")
def get_chat_historial(
    contexto: str,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recupera el historial de chat para un contexto específico."""
    from sqlalchemy import select

    historial = (
        db.execute(
            select(ChatHistorial)
            .where(ChatHistorial.company_id == cid)
            .where(ChatHistorial.contexto == contexto)
            .order_by(ChatHistorial.created_at.asc())
        )
        .scalars()
        .all()
    )

    return [
        {
            "id": str(h.id),
            "mensaje_usuario": h.mensaje_usuario,
            "respuesta_ia": h.respuesta_ia,
            "created_at": _iso(h.created_at),
        }
        for h in historial
    ]


@router.get("/rag/buscar")
def buscar_rag(
    q: str = Query(..., min_length=1, max_length=2000),
    contrato_id: uuid.UUID = Query(...),
    k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Búsqueda semántica sobre los chunks del contrato (RAG, v10).

    El tenant se aísla dos veces: `require_contrato` para el rol
    contract_admin y RLS (p_tenant) en la consulta. Los embeddings nunca
    salen en la respuesta.
    """
    from sqlalchemy import select

    from ..services.embeddings import EmbeddingsError, embed_texts

    c = db.get(Contrato, contrato_id)
    if not c or c.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "Contrato no existe")
    require_contrato(contrato_id, user)

    try:
        vec = embed_texts([q])[0]
    except EmbeddingsError as e:
        raise err(502, "EMBEDDINGS_NO_DISPONIBLES", str(e))

    dist = DocumentoChunk.embedding.cosine_distance(vec)
    filas = db.execute(
        select(DocumentoChunk, dist.label("distancia"))
        .where(
            DocumentoChunk.company_id == cid,
            DocumentoChunk.contrato_id == contrato_id,
        )
        .order_by(dist)
        .limit(k)
    ).all()
    return {
        "items": [
            {
                "id": str(ch.id),
                "titulo": ch.titulo,
                "ambito": ch.ambito,
                "texto": ch.texto,
                "documento_id": str(ch.documento_id) if ch.documento_id else None,
                "distancia": float(d),
            }
            for ch, d in filas
        ],
        "total": len(filas),
    }
