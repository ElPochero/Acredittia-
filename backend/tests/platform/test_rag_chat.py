"""Chat con RAG: usa retrieval top-K si hay chunks, volcado si no los hay."""

from __future__ import annotations

import uuid

from app.database import worker_session
from app.models import DocumentoChunk

DIM = 768


def _v0():
    v = [0.0] * DIM
    v[0] = 1.0
    return v


def _sembrar(db, company_id, contrato_id):
    db.add(
        DocumentoChunk(
            company_id=company_id,
            contrato_id=contrato_id,
            titulo="Examen de altura",
            ambito="personal",
            texto="Requisito (personal, obligatorio): Examen de altura",
            embedding=_v0(),
        )
    )
    db.commit()


def _mock_llm(monkeypatch, visto):
    import app.services.ia as ia_svc

    async def falso(historial):
        visto.append(historial)
        return '{"respuesta": "ok"}'

    monkeypatch.setattr(ia_svc, "chat_with_ia", falso)


def test_chat_usa_retrieval_si_hay_chunks(
    app_cliente, empresa_a, contrato_a, monkeypatch
):
    import app.services.embeddings as embeddings

    _mock_llm(monkeypatch, visto := [])
    monkeypatch.setattr(embeddings, "embed_texts", lambda texts: [_v0() for _ in texts])
    with worker_session(company_id=uuid.UUID(empresa_a["company_id"])) as db:
        _sembrar(db, uuid.UUID(empresa_a["company_id"]), uuid.UUID(contrato_a["id"]))

    r = app_cliente.post(
        "/api/v1/ia/chat",
        json={
            "contexto": f"contrato_{contrato_a['id']}",
            "mensaje": "¿Qué documentos faltan?",
            "historial": [],
        },
        headers=empresa_a["headers"],
    )
    assert r.status_code == 200, r.text
    ctx = visto[0][0]
    assert ctx["role"] == "system"
    assert "(busqueda semantica)" in ctx["content"]
    assert "Examen de altura" in ctx["content"]
    # El volcado completo no aparece: solo el conteo + fragmentos top-K.
    linea = next(
        l for l in ctx["content"].splitlines() if l.startswith("Requisitos del contrato")
    )
    assert len(linea) < 1500, len(linea)


def test_chat_recurre_al_volcado_sin_chunks(
    app_cliente, empresa_a, contrato_a, monkeypatch
):
    _mock_llm(monkeypatch, visto := [])
    r = app_cliente.post(
        "/api/v1/ia/chat",
        json={
            "contexto": f"contrato_{contrato_a['id']}",
            "mensaje": "¿Cómo va el contrato?",
            "historial": [],
        },
        headers=empresa_a["headers"],
    )
    assert r.status_code == 200, r.text
    ctx = visto[0][0]
    assert "(busqueda semantica)" not in ctx["content"]
    assert "Requisitos del contrato" in ctx["content"]
