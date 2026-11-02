"""Worker de Celery sobre Azure Cache for Redis.

Dos procesos separados, ambos con la misma imagen que la API:

    celery -A worker.celery_app worker --loglevel=info --concurrency=4
    celery -A worker.celery_app beat   --loglevel=info

Los routers nunca importan Celery: encolan con `services.jobs.enqueue(nombre,
**kwargs)`, que aquí se traduce a una única tarea `ejecutar_tarea` que resuelve
el nombre en el registro `TAREAS`. Así añadir una tarea de negocio no obliga a
tocar la configuración de la cola ni a redesplegar el worker con rutas nuevas.

El worker se conecta con el rol `acredittia_worker`, que es el único con SELECT
sobre `plataforma_credenciales.credencial_jwe`. Si el worker corriera con el rol
de la API, resolver una credencial fallaría con *permission denied*, que es
exactamente el comportamiento esperado.
"""
from __future__ import annotations

import logging
import os

from celery import Celery

# El rol del worker es distinto del de la API (§7.3 del modelo de datos).
if os.environ.get("WORKER_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["WORKER_DATABASE_URL"]

from app.config import settings  # noqa: E402
from app.services.platform.jobs import TAREAS  # noqa: E402
from worker.platform_tasks import registrar_platform  # noqa: E402

log = logging.getLogger("acredittia.worker")

celery = Celery("acredittia", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Santiago",
    enable_utc=True,
    task_acks_late=True,               # si el worker muere, la tarea se reintenta
    worker_prefetch_multiplier=1,      # trabajos largos: no acaparar la cola
    task_time_limit=15 * 60,
    task_soft_time_limit=13 * 60,
    broker_connection_retry_on_startup=True,
)


@celery.task(name="acredittia.ejecutar_tarea", bind=True, max_retries=3)
def ejecutar_tarea(self, nombre: str, kwargs: dict | None = None):
    """Punto de entrada único: resuelve `nombre` en el registro y ejecuta.

    Las tareas de negocio capturan sus propios errores y marcan el job como
    `failed`, así que un reintento aquí solo cubre fallos de infraestructura
    (base de datos o storage momentáneamente inaccesibles).
    """
    fn = TAREAS.get(nombre)
    if fn is None:
        log.error("Tarea desconocida: %s", nombre)
        return {"ok": False, "error": "tarea_desconocida", "tarea": nombre}
    try:
        fn(**(kwargs or {}))
        return {"ok": True, "tarea": nombre}
    except Exception as exc:      # infraestructura, no negocio
        log.exception("Fallo de infraestructura en %s", nombre)
        raise self.retry(exc=exc, countdown=30)


# Registrar tareas periódicas de plataforma y beat schedule
_platform_tasks = registrar_platform(celery)
cron_diario = _platform_tasks["cron_diario"]
cron_reportes_programados = _platform_tasks["cron_reportes_programados"]
cron_purga_temporales = _platform_tasks["cron_purga_temporales"]
cron_resumen_mensual = _platform_tasks["cron_resumen_mensual"]

__all__ = [
    "celery",
    "ejecutar_tarea",
    "cron_diario",
    "cron_reportes_programados",
    "cron_purga_temporales",
    "cron_resumen_mensual",
]
