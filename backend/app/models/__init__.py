"""Paquete de modelos SQLAlchemy.

Re-exporta entidades de negocio de platform.py para compatibilidad con código existente
(from app.models import ...).
"""

from .platform import *  # noqa: F401, F403
from .platform import (  # noqa: F401
    Base,
    _ENUM_VALUES,
    _enum,
    pg_enum,
)
