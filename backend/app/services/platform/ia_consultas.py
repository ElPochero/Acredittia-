"""Servicio auxiliar de IA para trazabilidad y auditoría de trabajos de extracción y revisión."""

import logging
from typing import Any

logger = logging.getLogger("acredittia.ia_consultas")


def extraer_requisitos_job(
    file_path: str, contexto: str, payload_extraido: dict[str, Any]
) -> None:
    """Registra y audita el trabajo de extracción de requisitos por IA."""
    logger.info(
        "Job extraer_requisitos_job completado para contexto '%s' en archivo '%s'. Requisitos extraídos: %d",
        contexto,
        file_path,
        len(payload_extraido) if isinstance(payload_extraido, dict) else 0,
    )


def revisar_documento_job(
    file_path: str, contexto: str, payload_extraido: dict[str, Any]
) -> None:
    """Registra y audita el trabajo de revisión documental por IA."""
    logger.info(
        "Job revisar_documento_job completado para contexto '%s' en archivo '%s'",
        contexto,
        file_path,
    )


__all__ = ["extraer_requisitos_job", "revisar_documento_job"]
