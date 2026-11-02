"""Cliente de embeddings Gemini con la red simulada (sin gastar cuota ni filtrar key)."""

from __future__ import annotations

import pytest

from app.config import settings
from app.services import embeddings as emb


class _Resp:
    def __init__(self, payload=None, error=None):
        self._payload = payload
        self._error = error

    def raise_for_status(self):
        if self._error:
            raise self._error

    def json(self):
        return self._payload


class _ClientFake:
    llamadas = 0
    responder = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def post(self, url, headers=None, json=None):
        type(self).llamadas += 1
        assert url == "https://generativelanguage.googleapis.com/v1beta/openai/embeddings"
        assert (
            headers["Authorization"].startswith("Bearer ")
            and len(headers["Authorization"]) > 10
        )
        assert isinstance(json["input"], list)
        return type(self).responder()


@pytest.fixture
def fake_gemini(monkeypatch):
    _ClientFake.llamadas = 0
    monkeypatch.setattr(emb.httpx, "Client", _ClientFake)
    return _ClientFake


def _vec(n, base=0.0):
    dims = settings.gemini_embedding_dims
    return [base + i / dims for i in range(dims)]


def test_ok_en_orden(fake_gemini):
    fake_gemini.responder = staticmethod(
        lambda: _Resp({"data": [{"embedding": _vec(2)}, {"embedding": _vec(2, 1.0)}]})
    )
    out = emb.embed_texts(["hola", "chao"])
    assert len(out) == 2 and len(out[0]) == settings.gemini_embedding_dims
    assert out[1][0] > out[0][0]
    assert fake_gemini.llamadas == 1


def test_vacio_y_lote_excesivo_no_llaman(fake_gemini):
    with pytest.raises(emb.EmbeddingsError):
        emb.embed_texts([])
    with pytest.raises(emb.EmbeddingsError):
        emb.embed_texts(["x"] * 200)
    assert fake_gemini.llamadas == 0


def test_sin_key_no_llama(fake_gemini, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(emb.EmbeddingsError, match="no configurados"):
        emb.embed_texts(["hola"])
    assert fake_gemini.llamadas == 0


def test_error_http_mensaje_generico(fake_gemini):
    import httpx

    def boom():
        r = httpx.Response(401, text="invalid key xyz")
        raise httpx.HTTPStatusError("auth", request=None, response=r)

    fake_gemini.responder = staticmethod(boom)
    with pytest.raises(emb.EmbeddingsError, match="no respondió") as e:
        emb.embed_texts(["hola"])
    assert "xyz" not in str(e.value) and settings.gemini_api_key not in str(e.value)


def test_dimensiones_inesperadas(fake_gemini):
    fake_gemini.responder = staticmethod(
        lambda: _Resp({"data": [{"embedding": [0.1, 0.2]}]})
    )
    with pytest.raises(emb.EmbeddingsError, match="Dimensiones"):
        emb.embed_texts(["hola"])


def test_respuesta_incompleta(fake_gemini):
    fake_gemini.responder = staticmethod(lambda: _Resp({"data": [{"embedding": _vec(1)}]}))
    with pytest.raises(emb.EmbeddingsError, match="incompleta"):
        emb.embed_texts(["uno", "dos"])
