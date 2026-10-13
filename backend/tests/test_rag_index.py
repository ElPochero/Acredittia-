"""Indexación RAG: reconstrucción idempotente de chunks con embeddings simulados."""

from __future__ import annotations

from sqlalchemy import func, select

from app.database import worker_session
from app.models import (
    Company,
    Contrato,
    ContratoRequisito,
    Documento,
    DocumentoChunk,
    Faena,
)
from app.services import rag_index

DIM = 2048


def _vec(seed: int) -> list[float]:
    return [float((i + seed) % 7) / 7 for i in range(DIM)]


def _base(db):
    faena = db.scalars(select(Faena)).first()
    assert faena is not None
    emp = Company(
        nombre="RAG IDX SpA",
        rut="55.555.555-5",
        email="rag-idx@x.cl",
        status="approved",
    )
    db.add(emp)
    db.flush()
    cto = Contrato(company_id=emp.id, faena_id=faena.id, nombre="C-IDX")
    db.add(cto)
    db.flush()
    db.add(
        ContratoRequisito(
            company_id=emp.id,
            contrato_id=cto.id,
            ambito="personal",
            titulo="Examen de altura",
            obligatorio=True,
        )
    )
    db.add(
        ContratoRequisito(
            company_id=emp.id,
            contrato_id=cto.id,
            ambito="equipo",
            titulo="SOAP",
            obligatorio=True,
        )
    )
    db.add(Documento(company_id=emp.id, contrato_id=cto.id, titulo="Certificado F30-1"))
    db.commit()
    return emp.id, cto.id


def test_indexa_y_es_idempotente(app_cliente, monkeypatch):
    with worker_session(is_admin=True) as db:
        id_emp, id_cto = _base(db)

    llamadas = []

    def falso_embed(texts):
        llamadas.append(list(texts))
        return [_vec(i) for i in range(len(texts))]

    monkeypatch.setattr(rag_index, "embed_texts", falso_embed)

    with worker_session(company_id=id_emp) as db:
        n = rag_index.indexar_contrato(db, id_emp, id_cto)
        db.commit()
    assert n == {"requisitos": 2, "documentos": 1, "chunks": 3}
    assert sum(len(b) for b in llamadas) == 3

    with worker_session(company_id=id_emp) as db:
        n2 = rag_index.indexar_contrato(db, id_emp, id_cto)
        db.commit()
        total = db.scalar(select(func.count()).select_from(DocumentoChunk))
    assert n2["chunks"] == 3 and total == 3
    # Una sola llamada a NIM con los 3 textos (un lote).
    assert len(llamadas) == 2

    # Recuperación: el chunk del requisito queda primero ante su propio texto.
    with worker_session(company_id=id_emp) as db:
        q = rag_index.embed_texts(["Examen de altura"])
        top = db.scalars(
            select(DocumentoChunk)
            .order_by(DocumentoChunk.embedding.cosine_distance(q[0]))
            .limit(1)
        ).first()
        assert top is not None and "altura" in top.texto.lower()


def test_fallo_nim_no_borra_chunks(app_cliente, monkeypatch):
    from app.services.embeddings import EmbeddingsError

    with worker_session(is_admin=True) as db:
        id_emp, id_cto = _base(db)

    def explota(_texts):
        raise EmbeddingsError("NIM caído")

    monkeypatch.setattr(rag_index, "embed_texts", explota)

    import pytest

    with worker_session(company_id=id_emp) as db:
        with pytest.raises(EmbeddingsError):
            rag_index.indexar_contrato(db, id_emp, id_cto)
        db.rollback()

    # Sembrar bien y luego fallar: los buenos sobreviven.
    with worker_session(company_id=id_emp) as db:
        import app.services.rag_index as ri

        monkeypatch.setattr(ri, "embed_texts", lambda texts: [_vec(0) for _ in texts])
        assert ri.indexar_contrato(db, id_emp, id_cto)["chunks"] == 3
        db.commit()

    monkeypatch.setattr(rag_index, "embed_texts", explota)
    with worker_session(company_id=id_emp) as db:
        try:
            rag_index.indexar_contrato(db, id_emp, id_cto)
        except EmbeddingsError:
            db.rollback()
        total = db.scalar(select(func.count()).select_from(DocumentoChunk))
        assert total == 3


def test_tarea_enqueuable(app_cliente, monkeypatch):
    import app.services.tasks  # noqa: F401 - registra TAREAS
    from app.services.jobs import enqueue

    with worker_session(is_admin=True) as db:
        id_emp, id_cto = _base(db)

    monkeypatch.setattr(
        rag_index, "embed_texts", lambda texts: [_vec(0) for _ in texts]
    )
    enqueue("indexar_contrato", contrato_id=str(id_cto), company_id=str(id_emp))

    with worker_session(company_id=id_emp) as db:
        total = db.scalar(select(func.count()).select_from(DocumentoChunk))
        assert total == 3
