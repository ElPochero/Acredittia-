"""Embeddings para RAG vía NVIDIA NIM (endpoint OpenAI-compatible).

Modelo verificado con la key actual: `nvidia/nemotron-3-embed-1b`
(2048 dims, `encoding_format: float`).
"""

from __future__ import annotations

import logging

import httpx

from ..config import settings

logger = logging.getLogger("acredittia.embeddings")

_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings"
_MAX_BATCH = 96  # tope anti-DoS: un request gigante colgaría al worker
_MAX_CHARS = 12000  # textos más largos se truncan (el modelo los truncaría igual)


class EmbeddingsError(RuntimeError):
    """Fallo al obtener embeddings. El mensaje es apto para el cliente."""


def embed_texts(texts: list[str], *, timeout_s: float = 60.0) -> list[list[float]]:
    """Devuelve un embedding por texto, en el mismo orden.

    Lanza `EmbeddingsError` si falta la key, el lote es inválido o NIM
    responde error o dimensiones inesperadas. La key nunca va al log.
    """
    limpios = [t.strip() for t in texts]
    if not limpios:
        raise EmbeddingsError("Sin textos para indexar.")
    if len(limpios) > _MAX_BATCH:
        raise EmbeddingsError(f"Máximo {_MAX_BATCH} textos por lote.")
    if not settings.nvidia_nim_api_key:
        raise EmbeddingsError("Embeddings no configurados (NVIDIA_NIM_API_KEY).")
    recortados = [t[:_MAX_CHARS] for t in limpios]

    try:
        with httpx.Client(timeout=timeout_s) as client:
            r = client.post(
                _EMBED_URL,
                headers={"Authorization": f"Bearer {settings.nvidia_nim_api_key}"},
                json={
                    "model": settings.nvidia_embedding_model,
                    "input": recortados,
                    "encoding_format": "float",
                },
            )
            r.raise_for_status()
            data = r.json()
    except EmbeddingsError:
        raise
    except Exception as e:  # noqa: BLE001 - red timeouts, DNS, 4xx/5xx
        logger.error("Embeddings NIM falló: %s: %s", type(e).__name__, _resumen(e))
        raise EmbeddingsError("El servicio de embeddings no respondió.") from e

    try:
        vectores = [list(map(float, item["embedding"])) for item in data["data"]]
    except (KeyError, TypeError, ValueError) as e:
        raise EmbeddingsError("Respuesta de embeddings inválida.") from e
    if len(vectores) != len(recortados):
        raise EmbeddingsError("Respuesta de embeddings incompleta.")
    esperadas = settings.nvidia_embedding_dims
    if any(len(v) != esperadas for v in vectores):
        raise EmbeddingsError(f"Dimensiones inesperadas (se esperaban {esperadas}).")
    return vectores


def _resumen(e: Exception) -> str:
    """Detalle para el log sin exponer la key ni el cuerpo completo."""
    status = getattr(getattr(e, "response", None), "status_code", None)
    return f"status={status}" if status else str(e)[:120]
