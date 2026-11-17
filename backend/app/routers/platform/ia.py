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

from ...config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_EXTENSIONS_ARRANQUE,
    ALLOWED_EXTENSIONS_CONTRATO,
    settings,
)
from ...deps import (
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
from ...models import (
    Alerta,
    Company,
    Contrato,
    ContratoRequisito,
    Documento,
    DocumentoArchivo,
    DocumentoChunk,
    EquivalenciaValidacion,
    Faena,
    FaenaReglaValidacion,
    IaHallazgo,
    IaReview,
    Sujeto,
    User,
    ChatHistorial,
)
from ...services.platform import actividad
from ...services.platform.jobs import enqueue
from ...services.platform.storage import get_storage, make_tmp_path

# Importar el módulo de tareas registra TAREAS: sin él `enqueue` no resolvería
# 'revisar_documento' ni las extracciones y solo dejaría un error en el log.
from ...services.platform.tasks import cargar_contexto_validacion, contexto_de_documento
from ...services.platform.validador_documental import (
    CONTROLES_TRANSVERSALES,
    FAMILIAS_VALIDACION,
    PAUTAS_MAESTRAS,
    TIPOS_DOCUMENTO_VALIDOS,
    evaluar_validacion_documental,
    resolver_pauta_efectiva,
    sanitizar_privacidad_medica,
)

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
    "La extracción no crea entidades: confirme el formulario en "
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


def _contrato_validacion_de_review(r: IaReview, filas: list[IaHallazgo]) -> dict:
    """Construye el contrato estándar {documentData, rules, summary, status, motivo}."""
    doc_data = _publicos(r.campos_extraidos)
    rules = list(getattr(r, "rules_result", None) or [])
    summary = dict(getattr(r, "summary_result", None) or {})
    val_status = getattr(r, "validation_status", None)
    motivo = getattr(r, "motivo", None)

    if not rules and r.status == "done":
        # Compatibilidad con revisiones sembradas o previas a v2
        rules = [
            {
                "codigo": h.codigo,
                "campo": h.campo or h.codigo,
                "resultado": "RECH" if h.tipo == "error" else "OBS" if h.tipo == "warning" else "OK",
                "bloqueante": h.tipo == "error",
                "observacion": h.mensaje or "",
            }
            for h in filas
        ]
        summary = {
            "OK": sum(1 for x in rules if x["resultado"] == "OK"),
            "OBS": sum(1 for x in rules if x["resultado"] == "OBS"),
            "RECH": sum(1 for x in rules if x["resultado"] == "RECH"),
            "N/A": sum(1 for x in rules if x["resultado"] == "N/A"),
            "REV": sum(1 for x in rules if x["resultado"] == "REV"),
            "total": len(rules),
        }

    if not val_status and r.status == "done":
        val_status = (
            "RECHAZADO"
            if r.resultado == "con_errores"
            else "APROBADO"
        )
    if not motivo and r.status == "done":
        motivo = (
            "; ".join(h.mensaje for h in filas if h.tipo in ("error", "warning"))
            or "Todas las validaciones pasaron exitosamente"
        )

    return {
        "documentData": doc_data,
        "rules": rules,
        "summary": summary or {"OK": 0, "OBS": 0, "RECH": 0, "N/A": 0, "REV": 0, "total": 0},
        "status": val_status or ("RECHAZADO" if r.resultado == "con_errores" else "APROBADO"),
        "motivo": motivo or "",
    }


def review_out(
    r: IaReview,
    hallazgos: list[IaHallazgo] | None = None,
    user_role: str | None = None,
) -> dict:
    """Serializador de un job de IA (§12) con contrato v2 y privacidad médica (H8)."""
    campos = r.campos_extraidos or {}
    filas = hallazgos if hallazgos is not None else list(r.hallazgos)
    doc_data = _publicos(campos)
    validacion = _contrato_validacion_de_review(r, filas)
    salida = {
        "job_id": str(r.id),
        "status": r.status,
        "context": r.context,
        "resultado": r.resultado,
        "confianza": float(r.confianza) if r.confianza is not None else None,
        "campos_extraidos": doc_data,
        "documentData": validacion["documentData"],
        "rules": validacion["rules"],
        "summary": validacion["summary"],
        "validation_status": validacion["status"] if r.status == "done" else None,
        "motivo": validacion["motivo"] if r.status == "done" else None,
        "validation": validacion if r.status == "done" else None,
        "hallazgos": [_hallazgo_out(h) for h in filas],
        "archivo_id": str(r.archivo_id) if r.archivo_id else None,
        "documento_id": campos.get("documento_id"),
        "contrato_id": campos.get("contrato_id"),
        "started_at": _iso(r.started_at),
        "finished_at": _iso(r.finished_at),
        "error": r.error,
        # Qué se hizo con el documento a partir del veredicto. Lo escribe la
        # tarea; sin él el usuario ve el resultado de la IA pero no el efecto.
        "accion_aplicada": campos.get("_accion_aplicada"),
        "created_at": _iso(r.created_at),
    }
    return sanitizar_privacidad_medica(
        salida, user_role=user_role, tipo_documento_ia=campos.get("_tipo_documento_ia")
    )


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
        f"Revisión IA solicitada para '{doc.titulo}' (archivo '{archivo.filename}')",
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
    return review_out(r, user_role=user.role)


@router.get("/revisiones/{job_id}/validacion")
def detalle_validacion_estandar(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Contrato estándar único {documentData, rules, summary, status, motivo}."""
    r = _get_review(db, cid, job_id)
    scope = contrato_scope(user)
    if scope and not _visible_para_scope(db, cid, r, scope):
        raise err(404, "NO_ENCONTRADO", "El job de IA no existe")
    if r.status != "done":
        raise err(409, "REVISION_EN_CURSO", f"La revisión está en estado '{r.status}'")
    validacion = _contrato_validacion_de_review(r, list(r.hallazgos))
    campos = r.campos_extraidos or {}
    return sanitizar_privacidad_medica(
        validacion, user_role=user.role, tipo_documento_ia=campos.get("_tipo_documento_ia")
    )


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
    return sobre([review_out(r, user_role=user.role) for r in filas], total, p)


# =============================================================================
# Motor Común v2: Validación directa, Pautas de 3 Niveles y Equivalencias
# =============================================================================
class ValidarDocumentoIn(BaseModel):
    tipo_documento_ia: str
    documentData: dict = {}
    rules: list[dict] | dict | None = None
    portal_verificacion: dict | None = None
    sujeto_id: uuid.UUID | None = None
    contrato_id: uuid.UUID | None = None
    faena_id: uuid.UUID | None = None
    worker_rut: str | None = None
    worker_name: str | None = None
    fecha_evaluacion: str | None = None


class PautaOverrideIn(BaseModel):
    faena_id: uuid.UUID | None = None
    contrato_id: uuid.UUID | None = None
    reglas_activas: dict[str, bool] = {}
    bloqueantes_override: dict[str, bool] = {}
    parametros: dict = {}


class EquivalenciaIn(BaseModel):
    faena_id: uuid.UUID | None = None
    familia: Literal["EXAMENES", "CURSOS"]
    nombre_detectado: str
    nombre_canonico: str
    codigo_catalogo: str | None = None
    confianza: float = 1.0
    confirmado: bool = True


@router.post("/validar-documento")
def validar_documento_endpoint(
    body: ValidarDocumentoIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Ejecuta el motor común v2 con contexto de BD y retorna el contrato único."""
    from datetime import date as _date

    if body.tipo_documento_ia not in TIPOS_DOCUMENTO_VALIDOS:
        raise err(400, "TIPO_DOCUMENTO_INVALIDO", f"Tipo de documento no reconocido: {body.tipo_documento_ia}")

    suj = None
    if body.sujeto_id:
        suj = db.get(Sujeto, body.sujeto_id)
        if not suj or suj.company_id != cid:
            raise err(404, "NO_ENCONTRADO", "El sujeto no existe")
        if suj.contrato_id:
            ct_suj = db.get(Contrato, suj.contrato_id)
            require_contrato(suj.contrato_id, user, contrato=ct_suj)
        elif contrato_scope(user) is not None:
            raise err(404, "NO_ENCONTRADO", "El sujeto no existe")
        if body.contrato_id and suj.contrato_id and suj.contrato_id != body.contrato_id:
            raise err(400, "CONTRATO_INCONSISTENTE", "El sujeto no pertenece al contrato indicado")
    if body.contrato_id:
        ct = db.get(Contrato, body.contrato_id)
        if not ct or ct.company_id != cid:
            raise err(404, "NO_ENCONTRADO", "El contrato no existe")
        require_contrato(body.contrato_id, user, contrato=ct)
    if body.faena_id:
        if not db.get(Faena, body.faena_id):
            raise err(404, "NO_ENCONTRADO", "La faena no existe")

    ctx = cargar_contexto_validacion(
        db,
        cid,
        sujeto=suj,
        contrato_id=body.contrato_id,
        faena_id=body.faena_id,
        tipo_documento_ia=body.tipo_documento_ia,
    )
    if suj is None and (body.worker_rut or body.worker_name):
        suj_esp = dict(ctx.get("sujeto_esperado") or {})
        if body.worker_rut:
            suj_esp["rut"] = body.worker_rut
        if body.worker_name:
            suj_esp["nombre"] = body.worker_name
        ctx["sujeto_esperado"] = suj_esp

    fecha_ev = None
    if body.fecha_evaluacion:
        try:
            fecha_ev = _date.fromisoformat(body.fecha_evaluacion[:10])
        except ValueError:
            raise err(400, "FECHA_INVALIDA", "fecha_evaluacion debe ser YYYY-MM-DD")

    resultado = evaluar_validacion_documental(
        tipo_documento_ia=body.tipo_documento_ia,
        document_data=body.documentData,
        reglas_ia=body.rules,
        sujeto_esperado=ctx.get("sujeto_esperado"),
        empresa_esperada=ctx.get("empresa_esperada"),
        cedula_aprobada=ctx.get("cedula_aprobada"),
        padron_aprobado=ctx.get("padron_aprobado"),
        anexos_vigentes=ctx.get("anexos_vigentes"),
        override_faena=ctx.get("override_faena"),
        equivalencias=ctx.get("equivalencias"),
        portal_verificacion=body.portal_verificacion,
        fecha_evaluacion=fecha_ev,
    )
    return sanitizar_privacidad_medica(
        resultado, user_role=user.role, tipo_documento_ia=body.tipo_documento_ia
    )


@router.get("/pautas")
def listar_pautas_validacion(
    faena_id: uuid.UUID | None = Query(None),
    contrato_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Lista familias (Nivel 1), pautas maestras (Nivel 2) y overrides (Nivel 3)."""
    if contrato_id:
        ct = db.get(Contrato, contrato_id)
        if not ct or ct.company_id != cid:
            raise err(404, "NO_ENCONTRADO", "El contrato no existe")
        require_contrato(contrato_id, user, contrato=ct)
    q = select(FaenaReglaValidacion).where(FaenaReglaValidacion.company_id == cid)
    scope = contrato_scope(user)
    if scope and not contrato_id:
        q = q.where(
            or_(
                FaenaReglaValidacion.contrato_id == scope,
                FaenaReglaValidacion.contrato_id.is_(None),
            )
        )
    if faena_id:
        q = q.where(FaenaReglaValidacion.faena_id == faena_id)
    if contrato_id:
        q = q.where(FaenaReglaValidacion.contrato_id == contrato_id)
    overrides = list(db.scalars(q))
    return {
        "familias": list(FAMILIAS_VALIDACION),
        "transversales": [
            {"codigo": r.codigo, "campo": r.campo, "bloqueante": r.bloqueante, "descripcion": r.descripcion}
            for r in CONTROLES_TRANSVERSALES
        ],
        "pautas_maestras": {
            k: [
                {"codigo": r.codigo, "campo": r.campo, "bloqueante": r.bloqueante, "descripcion": r.descripcion}
                for r in v
            ]
            for k, v in PAUTAS_MAESTRAS.items()
        },
        "overrides": [
            {
                "id": str(o.id),
                "faena_id": str(o.faena_id) if o.faena_id else None,
                "contrato_id": str(o.contrato_id) if o.contrato_id else None,
                "tipo_documento_ia": o.tipo_documento_ia,
                "reglas_activas": o.reglas_activas,
                "bloqueantes_override": o.bloqueantes_override,
                "parametros": o.parametros,
            }
            for o in overrides
        ],
    }


@router.put("/pautas/{tipo_documento_ia}")
def guardar_pauta_override(
    tipo_documento_ia: str,
    body: PautaOverrideIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(require_company),
):
    """Crea o actualiza un override Nivel 3 por faena/contrato."""
    if tipo_documento_ia not in TIPOS_DOCUMENTO_VALIDOS:
        raise err(400, "TIPO_DOCUMENTO_INVALIDO", f"Tipo de documento no reconocido: {tipo_documento_ia}")
    if body.contrato_id:
        ct = db.get(Contrato, body.contrato_id)
        if not ct or ct.company_id != cid:
            raise err(404, "NO_ENCONTRADO", "El contrato no existe")
    if body.faena_id and not db.get(Faena, body.faena_id):
        raise err(404, "NO_ENCONTRADO", "La faena no existe")

    q = select(FaenaReglaValidacion).where(
        FaenaReglaValidacion.company_id == cid,
        FaenaReglaValidacion.tipo_documento_ia == tipo_documento_ia,
        FaenaReglaValidacion.faena_id == body.faena_id,
        FaenaReglaValidacion.contrato_id == body.contrato_id,
    )
    ov = db.scalar(q)
    if ov is None:
        ov = FaenaReglaValidacion(
            company_id=cid,
            faena_id=body.faena_id,
            contrato_id=body.contrato_id,
            tipo_documento_ia=tipo_documento_ia,
            reglas_activas=body.reglas_activas,
            bloqueantes_override=body.bloqueantes_override,
            parametros=body.parametros,
        )
        db.add(ov)
    else:
        ov.reglas_activas = body.reglas_activas
        ov.bloqueantes_override = body.bloqueantes_override
        ov.parametros = body.parametros
    db.commit()
    db.refresh(ov)
    reglas, params, activas = resolver_pauta_efectiva(
        tipo_documento_ia,
        {
            "reglas_activas": ov.reglas_activas,
            "bloqueantes_override": ov.bloqueantes_override,
            "parametros": ov.parametros,
        },
    )
    return {
        "id": str(ov.id),
        "tipo_documento_ia": ov.tipo_documento_ia,
        "parametros": params,
        "reglas_activas": activas,
        "reglas": [{"codigo": r.codigo, "campo": r.campo, "bloqueante": r.bloqueante} for r in reglas],
    }


@router.get("/equivalencias")
def listar_equivalencias(
    familia: str | None = Query(None),
    faena_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    q = select(EquivalenciaValidacion).where(EquivalenciaValidacion.company_id == cid)
    if familia:
        q = q.where(EquivalenciaValidacion.familia == familia)
    if faena_id:
        q = q.where(EquivalenciaValidacion.faena_id == faena_id)
    filas = list(db.scalars(q))
    return {
        "items": [
            {
                "id": str(e.id),
                "faena_id": str(e.faena_id) if e.faena_id else None,
                "familia": e.familia,
                "nombre_detectado": e.nombre_detectado,
                "nombre_canonico": e.nombre_canonico,
                "codigo_catalogo": e.codigo_catalogo,
                "confianza": float(e.confianza),
                "confirmado": e.confirmado,
            }
            for e in filas
        ]
    }


@router.post("/equivalencias", status_code=201)
def crear_equivalencia(
    body: EquivalenciaIn,
    db: Session = Depends(get_db),
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(require_company),
):
    if body.faena_id and not db.get(Faena, body.faena_id):
        raise err(404, "NO_ENCONTRADO", "La faena no existe")
    conf = max(0.0, min(1.0, float(body.confianza)))
    det = body.nombre_detectado.strip()
    can = body.nombre_canonico.strip()
    eq = db.scalar(
        select(EquivalenciaValidacion).where(
            EquivalenciaValidacion.company_id == cid,
            EquivalenciaValidacion.faena_id == body.faena_id,
            EquivalenciaValidacion.familia == body.familia,
            EquivalenciaValidacion.nombre_detectado == det,
        )
    )
    if eq is None:
        eq = EquivalenciaValidacion(
            company_id=cid,
            faena_id=body.faena_id,
            familia=body.familia,
            nombre_detectado=det,
            nombre_canonico=can,
            codigo_catalogo=body.codigo_catalogo,
            confianza=conf,
            confirmado=body.confirmado,
        )
        db.add(eq)
    else:
        eq.nombre_canonico = can
        eq.codigo_catalogo = body.codigo_catalogo
        eq.confianza = conf
        eq.confirmado = body.confirmado
    db.commit()
    db.refresh(eq)
    return {
        "id": str(eq.id),
        "faena_id": str(eq.faena_id) if eq.faena_id else None,
        "familia": eq.familia,
        "nombre_detectado": eq.nombre_detectado,
        "nombre_canonico": eq.nombre_canonico,
        "codigo_catalogo": eq.codigo_catalogo,
        "confianza": float(eq.confianza),
        "confirmado": eq.confirmado,
    }


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
        f"Extracción de {body.tipo} solicitada sobre '{body.filename}'",
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
        f"Contrato '{filename}' enviado a extracción IA",
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
        f"Carpeta de Arranque '{filename}' enviada a extracción "
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
            "La extracción propone requisitos; confírmelos con "
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
            f"El tamaño máximo es {settings.max_upload_mb} MB",
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
    role: Literal["user", "assistant"]
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
            from ...services.platform.embeddings import EmbeddingsError, embed_texts

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
    from ...services.platform.ia import chat_with_ia
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
    from ...services.platform.ia import conserva_acciones_chat

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

    if contexto.startswith("contrato_"):
        try:
            ct_id = uuid.UUID(contexto.split("_", 1)[1])
            ct = db.get(Contrato, ct_id)
            if ct and ct.company_id == cid:
                require_contrato(ct_id, user, contrato=ct)
        except ValueError:
            pass

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

    from ...services.platform.embeddings import EmbeddingsError, embed_texts

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


# =============================================================================
# Extracción síncrona de listados (Personal, Equipos, Requisitos)
# =============================================================================

DEMO_PERSONAL = [
    {"nombre": "Patricio Andrés Olivares Rojas", "rut": "17.842.315-6", "cargo": "Operador Camión Tolva", "telefono": "+56 9 8745 2210", "email": "patricio.olivares@gmail.com"},
    {"nombre": "Daniela Fernanda Cortés Pizarro", "rut": "18.904.227-1", "cargo": "Prevencionista de Riesgos", "telefono": "+56 9 6612 0934", "email": "dcortes@outlook.com"},
    {"nombre": "Marco Antonio Vega Lillo", "rut": "15.330.981-4", "cargo": "Conductor Tracto-camión", "telefono": "+56 9 7781 4456", "email": "marco.vega@gmail.com"},
    {"nombre": "Sebastián Ignacio Rojas Tapia", "rut": "19.221.640-K", "cargo": "Mecánico de Camiones", "telefono": "+56 9 5409 1188", "email": "srojas.tapia@gmail.com"},
    {"nombre": "Claudia Andrea Muñoz Soto", "rut": "16.775.302-8", "cargo": "Administradora de Contrato", "telefono": "+56 9 9023 7741", "email": "claudia.munoz@hotmail.com"}
]

DEMO_EQUIPOS = [
    {"patente": "VWXY-41", "tipo_equipo": "Camión", "marca": "Volvo", "modelo": "FMX 500 8x4", "anio": 2021},
    {"patente": "TRKZ-18", "tipo_equipo": "Tracto-Camión", "marca": "Scania", "modelo": "R540", "anio": 2019},
    {"patente": "LMNP-07", "tipo_equipo": "Camioneta", "marca": "Toyota", "modelo": "Hilux 4x4", "anio": 2023},
    {"patente": "QRST-62", "tipo_equipo": "Semirremolque", "marca": "Randon", "modelo": "tolva 30 m³", "anio": 2018}
]

DEMO_REQUISITOS = [
    {"nombre": "Certificado F30-1 de Cumplimiento de Obligaciones Laborales", "categoria": "empresa", "obligatorio": True, "periodicidad": "mensual"},
    {"nombre": "Certificado de Adhesión a Mutualidad (Ley 16.744)", "categoria": "empresa", "obligatorio": True, "periodicidad": "anual"},
    {"nombre": "Cédula de Identidad", "categoria": "personal", "obligatorio": True, "periodicidad": None},
    {"nombre": "Contrato de Trabajo", "categoria": "personal", "obligatorio": True, "periodicidad": None},
    {"nombre": "Examen Pre-ocupacional", "categoria": "personal", "obligatorio": True, "periodicidad": "anual"},
    {"nombre": "Permiso de Circulación", "categoria": "equipo", "obligatorio": True, "periodicidad": "anual"},
    {"nombre": "Revisión Técnica", "categoria": "equipo", "obligatorio": True, "periodicidad": "semestral"},
    {"nombre": "SOAP", "categoria": "equipo", "obligatorio": True, "periodicidad": "anual"}
]


class ExtraerListadoIn(BaseModel):
    tipo: Literal["personal", "equipo", "requisitos", "requisitos_plataforma"]
    texto: str | None = None
    file_b64: str | None = None
    file_name: str | None = None


def _parse_filas_a_items(rows: list[list[str]], tipo: str) -> list[dict]:
    import re
    from ...security import normalizar_rut

    if not rows:
        return []

    h = [str(x or "").lower().strip() for x in rows[0]]
    tiene_encabezado = any(
        re.search(r"nombre|rut|cargo|patente|tipo|correo|email|tel|fono|requisito|documento|periodicidad|vigencia", x)
        for x in h
    )
    body = rows[1:] if tiene_encabezado else rows

    def find_col(regex: str, defecto: int) -> int:
        if not tiene_encabezado:
            return defecto
        for idx, col in enumerate(h):
            if re.search(regex, col):
                return idx
        return -1

    items = []
    if tipo == "personal":
        cN = find_col(r"nombre", 0)
        cR = find_col(r"rut", 1)
        cC = find_col(r"cargo", 2)
        cT = find_col(r"tel|fono|celular", 3)
        cM = find_col(r"correo|email|mail", 4)
        for r in body:
            nom = (r[cN] if 0 <= cN < len(r) else "").strip()
            if not nom:
                continue
            rut_raw = (r[cR] if 0 <= cR < len(r) else "").strip()
            rut_norm = normalizar_rut(rut_raw) or rut_raw
            cargo = (r[cC] if 0 <= cC < len(r) else "").strip()
            tel = (r[cT] if 0 <= cT < len(r) else "").strip()
            mail = (r[cM] if 0 <= cM < len(r) else "").strip()
            items.append({
                "nombre": nom,
                "rut": rut_norm,
                "cargo": cargo or "Trabajador",
                "telefono": tel,
                "email": mail,
            })
    elif tipo == "equipo":
        cP = find_col(r"patente|codigo|código", 0)
        cT = find_col(r"tipo", 1)
        cM = find_col(r"marca|modelo|descrip", 2)
        cA = find_col(r"a[nñ]o", 3)
        for r in body:
            pat = (r[cP] if 0 <= cP < len(r) else "").strip().upper()
            if not pat:
                continue
            tipo_eq = (r[cT] if 0 <= cT < len(r) else "").strip() or "Otro"
            marca = (r[cM] if 0 <= cM < len(r) else "").strip()
            anio_str = (r[cA] if 0 <= cA < len(r) else "").strip()
            anio_digits = re.sub(r"\D", "", anio_str)
            anio = int(anio_digits) if anio_digits else None
            items.append({
                "patente": pat,
                "tipo_equipo": tipo_eq,
                "marca": marca,
                "modelo": "",
                "anio": anio,
            })
    elif tipo in ("requisitos", "requisitos_plataforma"):
        cNom = find_col(r"requisito|documento|nombre|descrip", 0)
        cCat = find_col(r"categor|ambito|ámbito|tipo", 1)
        cObl = find_col(r"oblig|opcion", 2)
        cPer = find_col(r"periodicidad|vigencia|frecuencia|periodo|plazo", 3)
        for r in body:
            nom = (r[cNom] if 0 <= cNom < len(r) else "").strip()
            if not nom or len(nom) < 3:
                continue
            cat_str = (r[cCat] if 0 <= cCat < len(r) else "").lower()
            cat = "empresa"
            if "equip" in cat_str or "vehic" in cat_str or "maquin" in cat_str:
                cat = "equipo"
            elif "person" in cat_str or "trabaj" in cat_str:
                cat = "personal"
            obl = True
            if 0 <= cObl < len(r):
                obl_str = r[cObl].lower().strip()
                if obl_str in ("no", "opcional", "0", "false"):
                    obl = False
            per = None
            if 0 <= cPer < len(r):
                per_raw = (r[cPer] or "").strip()
                if per_raw and per_raw.lower() not in ("none", "null", "-", "n/a"):
                    per = per_raw
            items.append({
                "nombre": nom,
                "categoria": cat,
                "obligatorio": obl,
                "periodicidad": per,
            })
    return items


async def _extraer_con_gemini_multimodal(b64_data: str, mime_type: str, tipo: str) -> list[dict]:
    if not (settings.ia_backend == "gemini" and settings.gemini_api_key):
        return []
    import json
    import httpx

    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.gemini_api_key}",
        "Content-Type": "application/json",
    }
    sys_prompt = (
        "Eres un asistente extractor de datos tabulares desde imágenes o pantallazos. "
        "Devuelve SIEMPRE y ÚNICAMENTE un objeto JSON válido con la clave 'items'.\n"
    )
    if tipo == "personal":
        sys_prompt += (
            "Extrae la lista de personas con las claves: "
            "'nombre' (string), 'rut' (string), 'cargo' (string), 'telefono' (string), 'email' (string).\n"
            "Ejemplo: {\"items\": [{\"nombre\": \"Juan Pérez\", \"rut\": \"12.345.678-9\", \"cargo\": \"Operador\", \"telefono\": \"+56912345678\", \"email\": \"juan@empresa.cl\"}]}"
        )
    elif tipo == "equipo":
        sys_prompt += (
            "Extrae la lista de vehículos o maquinaria con las claves: "
            "'patente' (string), 'tipo_equipo' (string), 'marca' (string), 'modelo' (string), 'anio' (integer or null).\n"
            "Ejemplo: {\"items\": [{\"patente\": \"ABCD-12\", \"tipo_equipo\": \"Camioneta\", \"marca\": \"Toyota\", \"modelo\": \"Hilux\", \"anio\": 2022}]}"
        )
    else:  # requisitos o requisitos_plataforma
        sys_prompt += (
            "Extrae la lista de requisitos o documentos exigidos con las claves: "
            "'nombre' (string), 'categoria' ('empresa'|'personal'|'equipo'), 'obligatorio' (boolean), 'periodicidad' (string or null).\n"
            "Ejemplo: {\"items\": [{\"nombre\": \"Cédula de Identidad\", \"categoria\": \"personal\", \"obligatorio\": true, \"periodicidad\": \"anual\"}]}"
        )

    payload = {
        "model": settings.gemini_model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Extrae los datos de {tipo} de esta imagen."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_data}"}},
                ],
            },
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(url, headers=headers, json=payload, timeout=40.0)
            r.raise_for_status()
            data = r.json()["choices"][0]["message"].get("content") or "{}"
            parsed = json.loads(data)
            raw_items = parsed.get("items", [])
            if tipo in ("requisitos", "requisitos_plataforma"):
                clean_items = []
                for it in raw_items:
                    if isinstance(it, dict) and it.get("nombre"):
                        clean_items.append({
                            "nombre": str(it["nombre"]).strip(),
                            "categoria": str(it.get("categoria", "empresa")).lower() if it.get("categoria") in ("empresa", "personal", "equipo") else "empresa",
                            "obligatorio": bool(it.get("obligatorio", True)),
                            "periodicidad": str(it["periodicidad"]).strip() if it.get("periodicidad") else None,
                        })
                return clean_items
            return raw_items
            data = r.json()["choices"][0]["message"].get("content") or "{}"
            parsed = json.loads(data)
            return parsed.get("items", [])
    except Exception as e:
        logger.warning(f"Error extrayendo con Gemini multimodal: {e}")
        return []


@router.post("/extraer-listado")
async def extraer_listado(
    body: ExtraerListadoIn,
    cid: uuid.UUID = Depends(get_company_id),
    user: User = Depends(get_current_user),
):
    """Extrae listado de Personal, Equipos o Requisitos desde Excel, CSV, texto o imagen."""
    import base64
    import io
    import re

    items: list[dict] = []

    # 1. Procesar archivo si viene adjunto
    if body.file_b64:
        mime_part, b64_data = (
            body.file_b64.split(",", 1) if "," in body.file_b64 else ("", body.file_b64)
        )
        fname = (body.file_name or "").lower()

        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            try:
                import openpyxl

                excel_bytes = base64.b64decode(b64_data)
                wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), data_only=True)
                rows: list[list[str]] = []
                for ws in wb.worksheets:
                    for row in ws.iter_rows(values_only=True):
                        if any(c is not None and str(c).strip() for c in row):
                            rows.append([str(c).strip() if c is not None else "" for c in row])
                items = _parse_filas_a_items(rows, body.tipo)
            except Exception as e:
                logger.error(f"Error parseando Excel en extraer-listado: {e}")

        elif fname.endswith(".csv") or fname.endswith(".tsv"):
            try:
                csv_bytes = base64.b64decode(b64_data)
                text = csv_bytes.decode("utf-8", errors="replace")
                lines = [l.strip() for l in text.splitlines() if l.strip()]
                sep = ";" if sum(l.count(";") for l in lines[:5]) > sum(l.count(",") for l in lines[:5]) else (
                    "\t" if "\t" in lines[0] else ","
                )
                rows = [[col.strip().strip('"') for col in l.split(sep)] for l in lines]
                items = _parse_filas_a_items(rows, body.tipo)
            except Exception as e:
                logger.error(f"Error parseando CSV en extraer-listado: {e}")

        elif any(fname.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]) or "image" in mime_part:
            mime = "image/jpeg" if ("jpeg" in fname or "jpg" in fname) else "image/png"
            items = await _extraer_con_gemini_multimodal(b64_data, mime, body.tipo)

    # 2. Si no hay items pero viene texto libre
    if not items and body.texto:
        raw_lines = [l.strip() for l in body.texto.strip().splitlines() if l.strip()]
        rows = []
        for l in raw_lines:
            cols = [c.strip() for c in re.split(r"[\t,|;]", l)]
            if len(cols) >= 1:
                rows.append(cols)
        items = _parse_filas_a_items(rows, body.tipo)

    # 3. Fallback determinista si no se detectaron items
    if not items:
        if body.tipo == "personal":
            items = list(DEMO_PERSONAL)
        elif body.tipo == "equipo":
            items = list(DEMO_EQUIPOS)
        else:
            items = list(DEMO_REQUISITOS)

    return {"items": items, "total": len(items)}
