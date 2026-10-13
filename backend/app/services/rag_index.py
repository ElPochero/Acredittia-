"""Indexación RAG: chunks de requisitos y documentos con embeddings.

Corpus deliberadamente acotado (decisión del plan): una chunk por fila de
`contrato_requisitos` (custom/arranque; las base son catálogo global idéntico
para todos y ya las lista el chat) y una por `documento` del contrato.
Sin sub-chunking por ahora: títulos y textos cortos caben de sobra.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from .embeddings import embed_texts
from ..models import Contrato, ContratoRequisito, Documento, DocumentoChunk, Sujeto

logger = logging.getLogger("acredittia.rag_index")

_LOTE = 96  # igual que el tope del cliente de embeddings


def _texto_requisito(ambito: str, titulo: str, obligatorio: bool) -> str:
    return (
        f"Requisito ({ambito}, {'obligatorio' if obligatorio else 'opcional'}): "
        f"{titulo}"
    )


def _texto_documento(titulo: str, estado: str, vence) -> str:
    if vence:
        return f"Documento: {titulo} (estado {estado}, vence {vence})"
    return f"Documento: {titulo} (estado {estado})"


def indexar_contrato(db: Session, cid: uuid.UUID, contrato_id: uuid.UUID) -> dict:
    """Reconstruye los chunks del contrato. Idempotente. Devuelve conteos.

    Orden deliberado: primero se calculan TODOS los embeddings y solo si
    eso funciona se borra e inserta en la misma transacción. Si NIM falla,
    los chunks anteriores siguen intactos.
    """
    c = db.get(Contrato, contrato_id)
    if c is None or c.company_id != cid:
        logger.error("contrato %s inexistente o de otra empresa", contrato_id)
        return {"requisitos": 0, "documentos": 0, "chunks": 0}

    reqs = list(
        db.scalars(
            select(ContratoRequisito).where(
                ContratoRequisito.company_id == cid,
                ContratoRequisito.contrato_id == contrato_id,
            )
        )
    )
    sujetos = list(
        db.scalars(
            select(Sujeto.id).where(
                Sujeto.company_id == cid, Sujeto.contrato_id == contrato_id
            )
        )
    )
    docs = list(
        db.scalars(
            select(Documento).where(
                Documento.company_id == cid,
                or_(
                    Documento.contrato_id == contrato_id,
                    Documento.sujeto_id.in_(sujetos),
                ),
            )
        )
    )

    pendientes: list[tuple[str | None, str | None, str, str]] = []
    for r in reqs:
        pendientes.append(
            (
                None,
                r.ambito,
                r.titulo,
                _texto_requisito(r.ambito, r.titulo, r.obligatorio),
            )
        )
    for d in docs:
        pendientes.append(
            (
                str(d.id),
                None,
                d.titulo,
                _texto_documento(d.titulo, d.estado, d.vence),
            )
        )
    if not pendientes:
        db.execute(
            delete(DocumentoChunk).where(
                DocumentoChunk.company_id == cid,
                DocumentoChunk.contrato_id == contrato_id,
            )
        )
        return {"requisitos": 0, "documentos": 0, "chunks": 0}

    vectores: list[list[float]] = []
    for i in range(0, len(pendientes), _LOTE):
        vectores.extend(embed_texts([t for _, _, _, t in pendientes[i : i + _LOTE]]))

    db.execute(
        delete(DocumentoChunk).where(
            DocumentoChunk.company_id == cid,
            DocumentoChunk.contrato_id == contrato_id,
        )
    )
    for (doc_id, ambito, titulo, texto), vec in zip(pendientes, vectores):
        db.add(
            DocumentoChunk(
                company_id=cid,
                contrato_id=contrato_id,
                documento_id=uuid.UUID(doc_id) if doc_id else None,
                ambito=ambito,
                titulo=titulo,
                texto=texto,
                embedding=vec,
            )
        )
    db.flush()
    return {"requisitos": len(reqs), "documentos": len(docs), "chunks": len(pendientes)}
