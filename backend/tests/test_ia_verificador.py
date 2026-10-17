"""Verificador post-generación del chat (Critic/Guardrail de razonabilidad).

Fase 1 determinista (sin red) + Fase 2 LLM ligero solo para intención de
mutación. Fail-open: el verificador nunca rompe el chat.
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.config import settings
from app.services import ia as ia_svc


def run(coro):
    return asyncio.run(coro)


CAND_OK = json.dumps(
    {
        "respuesta": "He extraído los requisitos:",
        "agregados": {
            "empresa": ["Certificado F30-1"],
            "personal": ["Examen de altura"],
            "equipos": [],
            "licencia": [],
        },
    },
    ensure_ascii=False,
)


class _RespFake:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class _AsyncClientFake:
    llamadas = []
    responder = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers=None, json=None, timeout=None):
        type(self).llamadas.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        r = type(self).responder
        if isinstance(r, BaseException):
            raise r
        return r() if callable(r) else r


@pytest.fixture
def red_falsa(monkeypatch):
    _AsyncClientFake.llamadas = []
    _AsyncClientFake.responder = None
    monkeypatch.setattr(httpx, "AsyncClient", _AsyncClientFake)
    return _AsyncClientFake


@pytest.fixture
def cfg_gemini(monkeypatch):
    monkeypatch.setattr(settings, "ia_backend", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(settings, "ia_verifier_enabled", True)
    return settings


def _veredicto(valido, motivo="ok"):
    return _RespFake({"choices": [{"message": {"content": json.dumps({"valido": valido, "motivo": motivo})}}]})


# --- Gate: sin red cuando está desactivado o no hay key -----------------------

def test_deshabilitado_devuelve_candidata_sin_red(red_falsa, cfg_gemini, monkeypatch):
    monkeypatch.setattr(settings, "ia_verifier_enabled", False)
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega SOAP", CAND_OK))
    assert (ok, final) == (True, CAND_OK)
    assert red_falsa.llamadas == []


def test_sin_key_devuelve_candidata_sin_red(red_falsa, cfg_gemini, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega SOAP", CAND_OK))
    assert (ok, final) == (True, CAND_OK)
    assert red_falsa.llamadas == []


# --- Fase 1: forma (nunca llama a la red) -------------------------------------

def test_json_invalido_da_fallback_vacio_sin_red(red_falsa, cfg_gemini):
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega SOAP", "texto roto {{{"))
    assert ok is False
    parsed = json.loads(final)
    assert isinstance(parsed["respuesta"], str) and parsed["respuesta"]
    assert parsed["agregados"] == {"empresa": [], "personal": [], "equipos": [], "licencia": []}
    assert parsed["eliminados"] == {"empresa": [], "personal": [], "equipos": [], "licencia": []}
    assert red_falsa.llamadas == []


def test_sin_respuesta_da_fallback(red_falsa, cfg_gemini):
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega SOAP", '{"agregados": {}}'))
    assert ok is False
    assert json.loads(final)["respuesta"]
    assert red_falsa.llamadas == []


def test_clave_de_categoria_invalida_da_fallback(red_falsa, cfg_gemini):
    mala = json.dumps({"respuesta": "x", "agregados": {"vehiculos": ["SOAP"]}})
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega SOAP", mala))
    assert ok is False
    assert json.loads(final)["agregados"]["empresa"] == []
    assert red_falsa.llamadas == []


def test_listas_vacias_son_validas(red_falsa, cfg_gemini):
    # "equipos": [] es lo normal cuando no hay requisitos de esa categoría.
    red_falsa.responder = staticmethod(lambda: _veredicto(True))
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega el F30-1", CAND_OK))
    assert ok is True and final == CAND_OK


def test_duplicado_entre_categorias_da_fallback(red_falsa, cfg_gemini):
    dup = json.dumps(
        {
            "respuesta": "listo",
            "agregados": {"empresa": [], "personal": [], "equipos": ["SOAP"], "licencia": ["soap"]},
        }
    )
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega SOAP", dup))
    assert ok is False
    assert json.loads(final)["agregados"]["equipos"] == []
    assert red_falsa.llamadas == []


def test_elemento_vacio_da_fallback(red_falsa, cfg_gemini):
    mala = json.dumps({"respuesta": "x", "agregados": {"empresa": ["  "], "personal": [], "equipos": [], "licencia": []}})
    ok, _ = run(ia_svc.verificar_respuesta_chat("agrega F30", mala))
    assert ok is False
    assert red_falsa.llamadas == []


# --- Consultas informativas: sin Fase 2 ---------------------------------------

def test_consulta_sin_verbos_no_llama_a_la_red(red_falsa, cfg_gemini):
    con_extras = json.dumps(
        {"respuesta": "Hay 3 requisitos.", "agregados": {"empresa": ["F30-1"], "personal": [], "equipos": [], "licencia": []}}
    )
    ok, final = run(ia_svc.verificar_respuesta_chat("¿qué requisitos hay?", con_extras))
    assert (ok, final) == (True, con_extras)
    assert red_falsa.llamadas == []


# --- Fase 2: veredicto LLM ----------------------------------------------------

def test_veredicto_valido_deja_pasar(red_falsa, cfg_gemini):
    red_falsa.responder = staticmethod(lambda: _veredicto(True))
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega el F30-1", CAND_OK))
    assert (ok, final) == (True, CAND_OK)
    assert len(red_falsa.llamadas) == 1
    payload = red_falsa.llamadas[0]["json"]
    assert payload["temperature"] == 0.0
    assert payload["model"] == settings.gemini_verifier_model
    assert payload["max_tokens"] <= 160
    assert "untrusted" in payload["messages"][0]["content"]


def test_veredicto_invalido_vacia_agregados_y_eliminados(red_falsa, cfg_gemini):
    mala = json.dumps(
        {
            "respuesta": "listo",
            "agregados": {"empresa": [], "personal": [], "equipos": ["Examen de altura"], "licencia": []},
            "eliminados": {"empresa": ["F30-1"], "personal": [], "equipos": [], "licencia": []},
        }
    )
    red_falsa.responder = staticmethod(lambda: _veredicto(False, "examen médico no es equipo"))
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega examen", mala))
    assert ok is False
    parsed = json.loads(final)
    assert parsed["respuesta"] == "listo"  # conserva el texto, quita la acción
    assert parsed["agregados"] == {"empresa": [], "personal": [], "equipos": [], "licencia": []}
    assert parsed["eliminados"] == {"empresa": [], "personal": [], "equipos": [], "licencia": []}


def test_veredicto_con_fences_y_bool_string(red_falsa, cfg_gemini):
    cuerpo = '```json\n{"valido": "true", "motivo": "ok"}\n```'
    red_falsa.responder = staticmethod(lambda: _RespFake({"choices": [{"message": {"content": cuerpo}}]}))
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega el F30-1", CAND_OK))
    assert (ok, final) == (True, CAND_OK)


def test_timeout_del_verificador_es_fail_open(red_falsa, cfg_gemini):
    red_falsa.responder = TimeoutError("lento")
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega el F30-1", CAND_OK))
    assert (ok, final) == (True, CAND_OK)


def test_error_http_del_verificador_es_fail_open(red_falsa, cfg_gemini):
    red_falsa.responder = RuntimeError("500")
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega el F30-1", CAND_OK))
    assert (ok, final) == (True, CAND_OK)


def test_veredicto_inparseable_es_fail_open(red_falsa, cfg_gemini):
    red_falsa.responder = staticmethod(lambda: _RespFake({"choices": [{"message": {"content": "sin json aquí"}}]}))
    ok, final = run(ia_svc.verificar_respuesta_chat("agrega el F30-1", CAND_OK))
    assert (ok, final) == (True, CAND_OK)


# --- Cableado en chat_with_ia (rama gemini) ------------------------------------

def test_chat_gemini_verifica_antes_de_retornar(red_falsa, cfg_gemini):
    llamadas = [
        lambda: _RespFake({"choices": [{"message": {"content": CAND_OK}}]}),
        lambda: _veredicto(True),
    ]
    red_falsa.responder = lambda: llamadas.pop(0)()
    out = run(ia_svc.chat_with_ia([{"role": "user", "content": "agrega el F30-1"}]))
    assert out == CAND_OK
    assert len(red_falsa.llamadas) == 2
    assert red_falsa.llamadas[1]["json"]["model"] == settings.gemini_verifier_model


def test_chat_gemini_sin_mutacion_hace_un_solo_llamado(red_falsa, cfg_gemini):
    solo = json.dumps({"respuesta": "Hay 3 requisitos."})
    red_falsa.responder = staticmethod(lambda: _RespFake({"choices": [{"message": {"content": solo}}]}))
    out = run(ia_svc.chat_with_ia([{"role": "user", "content": "¿cómo va el contrato?"}]))
    assert out == solo
    assert len(red_falsa.llamadas) == 1


# --- Router: conserva agregados en análisis/adjuntos (regresión) --------------

def test_conserva_agregados_en_analisis_o_adjunto():
    # El frontend sube archivos con "Analiza el archivo adjunto y extrae los
    # requisitos": sin verbo de mutación, pero con intención de análisis, los
    # agregados NO deben descartarse.
    assert ia_svc.conserva_acciones_chat("Analiza el archivo adjunto y extrae los requisitos") is True
    assert ia_svc.conserva_acciones_chat("procesa este Excel") is True
    assert ia_svc.conserva_acciones_chat("Agrega examen de altura") is True
    assert ia_svc.conserva_acciones_chat("cualquier cosa", tiene_adjunto=True) is True
    # Consulta pura: se descartan para no duplicar.
    assert ia_svc.conserva_acciones_chat("¿qué requisitos hay?") is False
    assert ia_svc.conserva_acciones_chat("") is False
