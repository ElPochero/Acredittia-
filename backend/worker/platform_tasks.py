"""Tareas de fondo y cron periódico de Plataforma."""
from __future__ import annotations

import logging
from celery.schedules import crontab

# Importar los módulos de tareas puebla el registro TAREAS.
from app.services.platform import integraciones as _svc_integraciones  # noqa: F401
from app.services.platform import tasks as _svc_tasks  # noqa: F401
from app.services.platform import email as _svc_email  # noqa: F401

log = logging.getLogger("acredittia.worker.platform")


def _cron_diario_impl():
    """00:30 America/Santiago (§10.1 de la especificación).

    Recalcula `estado_calc` de los documentos con vencimiento, actualiza el
    estado agregado de sujetos y contratos, genera alertas, escribe los
    snapshots de cumplimiento del día y marca las credenciales expiradas.
    """
    from app.database import worker_session
    from app.services.platform.vencimientos import (
        expirar_credenciales, escribir_snapshots, recalcular_documentos, alertar_vencimiento_contratos)

    with worker_session(is_admin=True) as db:
        docs = recalcular_documentos(db)
        contratos = alertar_vencimiento_contratos(db)
        snaps = escribir_snapshots(db)
        creds = expirar_credenciales(db)
    log.info("Cron diario: %s documentos, %s contratos, %s snapshots, %s credenciales expiradas",
             docs, contratos, snaps, creds)
    return {"documentos": docs, "contratos": contratos, "snapshots": snaps, "credenciales": creds}


def _cron_reportes_programados_impl():
    """Cada hora: dispara los `reportes_programados` cuyo cron toca ahora."""
    from app.database import worker_session
    from app.services.platform.programados import disparar_pendientes

    with worker_session(is_admin=True) as db:
        n = disparar_pendientes(db)
    log.info("Reportes programados disparados: %s", n)
    return {"disparados": n}


def _cron_purga_temporales_impl():
    """Purga los blobs temporales y el historial de chats de IA con más de 3 meses."""
    from app.services.platform.tasks import purgar_temporales, purgar_chat_historial
    n = purgar_temporales()
    chats_purgados = purgar_chat_historial()
    log.info("Blobs temporales purgados: %s, Chats purgados: %s", n, chats_purgados)
    return {"blobs_purgados": n, "chats_purgados": chats_purgados}


def _cron_resumen_mensual_impl():
    """Día 1 de cada mes, 07:00: resumen de vencimientos por contrato."""
    from app.database import worker_session
    from app.services.platform.email import enviar_resumen_mensual

    with worker_session(is_admin=True) as db:
        n = enviar_resumen_mensual(db)
    log.info("Resumen mensual encolado para %s destinatarios", n)
    return {"destinatarios": n}


cron_diario = _cron_diario_impl
cron_reportes_programados = _cron_reportes_programados_impl
cron_purga_temporales = _cron_purga_temporales_impl
cron_resumen_mensual = _cron_resumen_mensual_impl


def registrar_platform(celery):
    """Registra tareas y schedule de plataforma en la app Celery."""
    global cron_diario, cron_reportes_programados, cron_purga_temporales, cron_resumen_mensual

    cron_diario = celery.task(name="acredittia.cron_diario")(_cron_diario_impl)
    cron_reportes_programados = celery.task(name="acredittia.cron_reportes_programados")(_cron_reportes_programados_impl)
    cron_purga_temporales = celery.task(name="acredittia.cron_purga_temporales")(_cron_purga_temporales_impl)
    cron_resumen_mensual = celery.task(name="acredittia.cron_resumen_mensual")(_cron_resumen_mensual_impl)

    if not hasattr(celery.conf, "beat_schedule") or celery.conf.beat_schedule is None:
        celery.conf.beat_schedule = {}

    celery.conf.beat_schedule.update({
        "cron-diario": {
            "task": "acredittia.cron_diario",
            "schedule": crontab(hour=0, minute=30),
        },
        "resumen-mensual": {
            "task": "acredittia.cron_resumen_mensual",
            "schedule": crontab(day_of_month=1, hour=7, minute=0),
        },
        "reportes-programados": {
            "task": "acredittia.cron_reportes_programados",
            "schedule": crontab(minute=5),          # cada hora, al minuto 5
        },
        "purga-temporales": {
            "task": "acredittia.cron_purga_temporales",
            "schedule": crontab(hour=4, minute=0),
        },
    })

    return {
        "cron_diario": cron_diario,
        "cron_reportes_programados": cron_reportes_programados,
        "cron_purga_temporales": cron_purga_temporales,
        "cron_resumen_mensual": cron_resumen_mensual,
    }
