"""Endpoint GET /ia/rag/buscar: orden semántico, RLS y validación."""

from __future__ import annotations

import uuid

from app.database import worker_session
from app.models import DocumentoChunk

DIM = 768


def _v0():
    v = [0.0] * DIM
    v[0] = 1.0
    return v


def _v1():
    v = [0.0] * DIM
    v[1] = 1.0
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
    db.add(
        DocumentoChunk(
            company_id=company_id,
            contrato_id=contrato_id,
            titulo="SOAP",
            ambito="equipo",
            texto="Requisito (equipo, obligatorio): SOAP",
            embedding=_v1(),
        )
    )
    db.commit()


def test_busca_ordena_y_no_expone_vectores(
    app_cliente, empresa_a, contrato_a, monkeypatch
):
    import app.services.embeddings as embeddings

    monkeypatch.setattr(embeddings, "embed_texts", lambda texts: [_v0() for _ in texts])
    with worker_session(company_id=uuid.UUID(empresa_a["company_id"])) as db:
        _sembrar(db, uuid.UUID(empresa_a["company_id"]), uuid.UUID(contrato_a["id"]))

    r = app_cliente.get(
        "/api/v1/ia/rag/buscar",
        params={"q": "examen altura", "contrato_id": contrato_a["id"], "k": 5},
        headers=empresa_a["headers"],
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    assert [i["titulo"] for i in body["items"]] == ["Examen de altura", "SOAP"]
    assert all("embedding" not in i for i in body["items"])
    assert body["items"][0]["ambito"] == "personal"
    assert isinstance(body["items"][0]["distancia"], float)


def test_otra_empresa_no_alcanza(app_cliente, empresa_a, empresa_b, contrato_a):
    r = app_cliente.get(
        "/api/v1/ia/rag/buscar",
        params={"q": "examen", "contrato_id": contrato_a["id"]},
        headers=empresa_b["headers"],
    )
    assert r.status_code == 404


def test_contrato_inexistente_da_404(app_cliente, empresa_a):
    r = app_cliente.get(
        "/api/v1/ia/rag/buscar",
        params={"q": "examen", "contrato_id": str(uuid.uuid4())},
        headers=empresa_a["headers"],
    )
    assert r.status_code == 404


def test_parametros_invalidos(app_cliente, empresa_a, contrato_a):
    base = {"contrato_id": contrato_a["id"]}
    assert (
        app_cliente.get(
            "/api/v1/ia/rag/buscar",
            params={**base, "k": 0},
            headers=empresa_a["headers"],
        ).status_code
        == 422
    )
    assert (
        app_cliente.get(
            "/api/v1/ia/rag/buscar",
            params={**base, "k": 100},
            headers=empresa_a["headers"],
        ).status_code
        == 422
    )
    assert (
        app_cliente.get(
            "/api/v1/ia/rag/buscar",
            params={"contrato_id": contrato_a["id"]},
            headers=empresa_a["headers"],
        ).status_code
        == 422
    )


def test_nim_caido_da_502(app_cliente, empresa_a, contrato_a, monkeypatch):
    import app.services.embeddings as embeddings
    from app.services.embeddings import EmbeddingsError

    def explota(_texts):
        raise EmbeddingsError("NIM caído")

    monkeypatch.setattr(embeddings, "embed_texts", explota)
    r = app_cliente.get(
        "/api/v1/ia/rag/buscar",
        params={"q": "examen", "contrato_id": contrato_a["id"]},
        headers=empresa_a["headers"],
    )
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "EMBEDDINGS_NO_DISPONIBLES"


def test_contract_admin_acotado_a_su_contrato(
    app_cliente, empresa_a, empresa_b, contrato_a, contrato_b, monkeypatch
):
    import app.services.embeddings as embeddings
    monkeypatch.setattr(embeddings, "embed_texts", lambda texts: [_v0() for _ in texts])
    from tests.conftest import crear_contract_admin

    jefe = crear_contract_admin(app_cliente, empresa_a, contrato_a["id"])
    r = app_cliente.get(
        "/api/v1/ia/rag/buscar",
        params={"q": "examen", "contrato_id": contrato_a["id"]},
        headers=jefe["headers"],
    )
    assert r.status_code == 200, r.text
    r = app_cliente.get(
        "/api/v1/ia/rag/buscar",
        params={"q": "examen", "contrato_id": contrato_b["id"]},
        headers=jefe["headers"],
    )
    assert r.status_code == 404
