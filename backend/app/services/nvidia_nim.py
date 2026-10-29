"""DEPRECATED: alias de compatibilidad hacia ia_consultas.

Migrado a services/ia_consultas.py. Este archivo se mantiene únicamente por
compatibilidad con importaciones previas.
"""

from .ia_consultas import extraer_requisitos_job, revisar_documento_job

__all__ = ["extraer_requisitos_job", "revisar_documento_job"]
