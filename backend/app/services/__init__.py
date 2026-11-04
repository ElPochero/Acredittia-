"""Puente de compatibilidad para servicios migrados a app.services.platform.

Registra cada submódulo en sys.modules bajo app.services.<modulo> y como atributo
de este paquete, garantizando identidad de singleton en memoria.
"""
import importlib
import sys

_PLATFORM_SERVICES = (
    "actividad",
    "checklist",
    "crypto",
    "email",
    "embeddings",
    "ia",
    "ia_consultas",
    "integraciones",
    "jobs",
    "nvidia_nim",
    "programados",
    "rag_index",
    "storage",
    "tasks",
    "vencimientos",
)

for _name in _PLATFORM_SERVICES:
    _mod = importlib.import_module(f".platform.{_name}", __name__)
    setattr(sys.modules[__name__], _name, _mod)
    sys.modules[f"{__name__}.{_name}"] = _mod
