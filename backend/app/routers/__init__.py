"""Puente de compatibilidad para routers migrados a app.routers.platform.

Registra cada router en sys.modules bajo app.routers.<modulo> y como atributo
de este paquete, garantizando identidad de singleton en memoria.
"""
import importlib
import sys

_PLATFORM_ROUTERS = (
    "actividad",
    "admin",
    "alertas",
    "auth",
    "blobs",
    "calendario",
    "cargos",
    "company",
    "contrato_requisitos",
    "contratos",
    "dashboard",
    "documentos",
    "emails",
    "exportar",
    "faenas",
    "ia",
    "integraciones",
    "licencia_interna",
    "notificaciones",
    "periodos_laborales",
    "personas",
    "plataformas",
    "reportes",
    "requisitos",
    "sujetos",
    "suscripcion",
    "webhooks",
)

for _name in _PLATFORM_ROUTERS:
    _mod = importlib.import_module(f".platform.{_name}", __name__)
    setattr(sys.modules[__name__], _name, _mod)
    sys.modules[f"{__name__}.{_name}"] = _mod
