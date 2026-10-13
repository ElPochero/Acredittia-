"""RAG con pgvector: aislamiento multi-tenant de `documento_chunk` (v10).

Prueba la barrera que exige el plan: los embeddings de una empresa son
invisibles para otra, tanto en lectura directa como en búsqueda por
similitud coseno. Usa sesiones con tenant (`worker_session`), el mismo
mecanismo de la API y los jobs, y vectores deterministas (sin llamadas a NIM).
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import select

from app.database import worker_session
from app.models import Company, Contrato, DocumentoChunk, Faena

DIM = 2048


def _v0() -> list[float]:
    v = [0.0] * DIM
    v[0] = 1.0
    return v


def _v1() -> list[float]:
    v = [0.0] * DIM
    v[1] = 1.0
    return v


def _v2() -> list[float]:
    v = [0.0] * DIM
    v[2] = 1.0
    return v


def _empresa(db, nombre: str, rut: str, email: str) -> Company:
    c = Company(nombre=nombre, rut=rut, email=email, status="approved")
    db.add(c)
    db.flush()
    return c


def test_chunks_no_cruzan_empresas(app_cliente):
    """A no ve los chunks de B ni por lectura ni por similitud (RLS+FORCE)."""
    with worker_session(is_admin=True) as db:
        faena = db.scalars(select(Faena)).first()
        emp_a = _empresa(db, "RAG A SpA", "11.111.111-1", "rag-a@x.cl")
        emp_b = _empresa(db, "RAG B SpA", "22.222.222-2", "rag-b@x.cl")
        ca = Contrato(company_id=emp_a.id, faena_id=faena.id, nombre="C-A")
        cb = Contrato(company_id=emp_b.id, faena_id=faena.id, nombre="C-B")
        db.add_all([ca, cb])
        db.flush()
        id_a, id_ca, id_b, id_cb = emp_a.id, ca.id, emp_b.id, cb.id
        db.commit()

    with worker_session(company_id=id_a) as db:
        db.add(
            DocumentoChunk(
                company_id=id_a,
                contrato_id=id_ca,
                titulo="Contrato de trabajo",
                texto="Contrato de trabajo indefinido.",
                embedding=_v0(),
            )
        )
        db.add(
            DocumentoChunk(
                company_id=id_a,
                contrato_id=id_ca,
                titulo="SOAP",
                texto="Seguro obligatorio.",
                embedding=_v1(),
            )
        )
        db.commit()
    with worker_session(company_id=id_b) as db:
        db.add(
            DocumentoChunk(
                company_id=id_b,
                contrato_id=id_cb,
                titulo="Secreto B",
                texto="Solo B.",
                embedding=_v2(),
            )
        )
        db.commit()

    with worker_session(company_id=id_a) as db:
        vistos = db.scalars(select(DocumentoChunk)).all()
        assert {c.titulo for c in vistos} == {"Contrato de trabajo", "SOAP"}
        # Similitud: el más cercano a _v0() es "Contrato de trabajo",
        # y el chunk de B jamás aparece aunque exista.
        top = db.scalars(
            select(DocumentoChunk)
            .order_by(DocumentoChunk.embedding.cosine_distance(_v0()))
            .limit(5)
        ).all()
        assert [c.titulo for c in top] == ["Contrato de trabajo", "SOAP"]

    with worker_session(company_id=id_b) as db:
        vistos = db.scalars(select(DocumentoChunk)).all()
        assert [c.titulo for c in vistos] == ["Secreto B"]

    # Distancias con decimales: el tipo vector devuelve float real.
    with worker_session(company_id=id_a) as db:
        d = db.scalar(
            select(DocumentoChunk.embedding.cosine_distance(_v0())).where(
                DocumentoChunk.titulo == "Contrato de trabajo"
            )
        )
        assert abs(d) < 1e-6


def test_insert_fuera_del_tenant_se_rechaza(app_cliente):
    """El WITH CHECK de p_tenant impide etiquetar chunks con otra empresa."""
    with worker_session(is_admin=True) as db:
        faena = db.scalars(select(Faena)).first()
        emp_a = _empresa(db, "RAG A2 SpA", "33.333.333-3", "rag-a2@x.cl")
        emp_b = _empresa(db, "RAG B2 SpA", "44.444.444-4", "rag-b2@x.cl")
        ca = Contrato(company_id=emp_a.id, faena_id=faena.id, nombre="C-A2")
        db.add(ca)
        db.flush()
        id_a, id_ca, id_b = emp_a.id, ca.id, emp_b.id
        db.commit()

    import sqlalchemy.exc as exc

    with worker_session(company_id=id_b) as db:
        db.add(
            DocumentoChunk(
                company_id=id_a,
                contrato_id=id_ca,
                titulo="X",
                texto="Y",
                embedding=_v0(),
            )
        )
        try:
            db.commit()
        except exc.DBAPIError:
            db.rollback()
        else:
            raise AssertionError("RLS debio rechazar el INSERT cross-tenant")
