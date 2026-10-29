"""Arranque de la API.

El esquema NO se aplica aquí: lo hace el job de migración (`python -m migrate.run`)
bajo `pg_advisory_lock`, de modo que varias réplicas de Container Apps arrancando
a la vez no compitan por el DDL. La API solo verifica la versión y falla rápido
si no coincide, para que un despliegue con esquema desfasado se detecte en el
health check y no a mitad de un request.

El cron tampoco vive aquí cuando hay Celery: `celery beat` lo ejecuta. Con
`QUEUE_BACKEND=inproc` (desarrollo) se mantiene APScheduler dentro del proceso.
"""
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import select

from .config import settings
from .database import (SessionLocal, apply_schema, assert_schema_version,
                       auth_session, reset_ctx, schema_version, set_ctx, wait_for_db)
from .models import User
from .security import decode_access_token
from .routers import (actividad, admin, alertas, auth, blobs, calendario, cargos,
                      company, contrato_requisitos, contratos, dashboard,
                      documentos, exportar, faenas, ia, integraciones, licencia_interna,
                      notificaciones, periodos_laborales, personas, plataformas, reportes,
                      requisitos, sujetos, suscripcion, emails, webhooks)
# Importar los módulos de tareas registra las entradas de TAREAS que usa la cola.
from .services import integraciones as _svc_integraciones  # noqa: F401
from .services import tasks as _svc_tasks  # noqa: F401
from .services import email as _svc_email  # noqa: F401
from .services.vencimientos import recalcular_documentos, alertar_vencimiento_contratos

log = logging.getLogger("acredittia")


def _job_vencimientos() -> None:
    """Cron de desarrollo. En producción lo dispara celery beat."""
    from .database import worker_session
    with worker_session(is_admin=True) as db:
        recalcular_documentos(db)
        alertar_vencimiento_contratos(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db()

    if settings.db_apply_schema_on_start:
        # Solo desarrollo y tests. En Azure lo hace el Container Apps Job.
        v = apply_schema()
        log.info("Esquema aplicado, versión %s", v)
    assert_schema_version(settings.schema_version_esperada)

    from . import seeds
    with SessionLocal() as db:
        set_ctx(is_admin=True)          # las semillas tocan catálogos globales
        try:
            seeds.run(db)
            recalcular_documentos(db)
            alertar_vencimiento_contratos(db)
        finally:
            reset_ctx()

    scheduler = None
    if settings.queue_backend != "celery":
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler(timezone="America/Santiago")
        scheduler.add_job(_job_vencimientos, "cron", hour=0, minute=30)
        scheduler.start()
        log.info("Cron en proceso activo (QUEUE_BACKEND=%s)", settings.queue_backend)

    yield

    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Acredittia API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # El nombre del ZIP de exportación viaja en Content-Disposition; sin esto
    # el navegador no puede leerlo en una respuesta cross-origin.
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def limpiar_contexto(request: Request, call_next):
    """Cada request empieza sin tenant.

    Es la red de seguridad del aislamiento: si un endpoint consultara la base
    sin pasar por la dependencia de autenticación, RLS no encontraría
    `app.company_id` y devolvería vacío en lugar de datos de otra empresa.
    """
    reset_ctx()
    try:
        return await call_next(request)
    finally:
        reset_ctx()


_METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}
# Mutaciones que el visor sí puede hacer: ciclo de sesión y recuperación.
# Todo lo demás que no sea lectura se le deniega (fail-closed): es de solo
# lectura en toda la plataforma y `require_company` ya lo excluye de la
# administración de empresa.
_SESION_VISOR = {
    "/auth/login", "/auth/token", "/auth/refresh", "/auth/logout",
    "/auth/password/forgot", "/auth/password/reset",
}


@app.middleware("http")
async def negar_mutaciones_visor(request: Request, call_next):
    """Bloquea con 403 las mutaciones del rol visor (C20).

    Punto único de enforcement: ocultar botones en el frontend no es un
    control (el atacante llama a la API directo), así que la denegación vive
    aquí y cubre también los endpoints que se agreguen en el futuro. El rol se
    lee de la BD en cada mutación para que un cambio de rol aplique sin
    esperar al refresh del token.
    """
    if request.method in _METODOS_LECTURA or not request.url.path.startswith(API):
        return await call_next(request)
    if request.method == "POST" and request.url.path[len(API):] in _SESION_VISOR:
        return await call_next(request)
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return await call_next(request)  # sin token: lo rechaza get_current_user
    try:
        sub = decode_access_token(auth[7:].strip())["sub"]
    except Exception:
        return await call_next(request)  # inválido: lo rechaza get_current_user
    with auth_session() as db:
        rol = db.scalar(select(User.role).where(User.id == uuid.UUID(sub)))
    if rol != "visor":
        return await call_next(request)
    log.warning("visor bloqueado: %s %s", request.method, request.url.path)
    return JSONResponse(status_code=403, content={"error": {
        "code": "SOLO_LECTURA",
        "message": "El rol visor es de solo lectura"}})


@app.exception_handler(HTTPException)
async def http_exc(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {
        "code": "ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail},
                        headers=getattr(exc, "headers", None))

@app.exception_handler(RequestValidationError)
async def validation_exc(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = "Error de validación"
    if errors:
        msg = f"{errors[0]['loc'][-1]}: {errors[0]['msg']}"
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": msg}}
    )


API = "/api/v1"

# --- Autenticación y administración de la plataforma ---------------------
app.include_router(auth.router, prefix=API)
app.include_router(admin.router, prefix=API)
app.include_router(cargos.router_admin, prefix=API)
app.include_router(suscripcion.router_admin, prefix=API)

# --- Empresa y catálogos --------------------------------------------------
app.include_router(company.router, prefix=API)
app.include_router(faenas.router, prefix=API)
app.include_router(cargos.router, prefix=API)
app.include_router(requisitos.router, prefix=API)

# --- Contratos: el router base primero, para conservar el orden de rutas ---
app.include_router(contratos.router, prefix=API)
app.include_router(plataformas.router, prefix=API)
app.include_router(contrato_requisitos.router, prefix=API)
app.include_router(periodos_laborales.router, prefix=API)

# --- Sujetos e identidad --------------------------------------------------
app.include_router(sujetos.router, prefix=API)
app.include_router(licencia_interna.router, prefix=API)
app.include_router(licencia_interna.router_contrato, prefix=API)
app.include_router(personas.router, prefix=API)
app.include_router(personas.router_flota, prefix=API)

# --- Documentos, IA y almacenamiento -------------------------------------
app.include_router(documentos.router, prefix=API)
app.include_router(ia.router, prefix=API)
app.include_router(blobs.router, prefix=API)     # SAS local; en Azure no se usa

# --- Operación ------------------------------------------------------------
app.include_router(alertas.router, prefix=API)
app.include_router(dashboard.router, prefix=API)
app.include_router(calendario.router, prefix=API)
app.include_router(actividad.router, prefix=API)
app.include_router(notificaciones.router, prefix=API)
app.include_router(reportes.router, prefix=API)
app.include_router(reportes.router_export, prefix=API)
app.include_router(exportar.router, prefix=API)
app.include_router(integraciones.router, prefix=API)

# --- Comercial y webhooks -------------------------------------------------
app.include_router(suscripcion.router_planes, prefix=API)
app.include_router(suscripcion.router, prefix=API)
app.include_router(suscripcion.router_facturas, prefix=API)
app.include_router(webhooks.router, prefix=API)
app.include_router(emails.router, prefix=API)


@app.get("/health")
def health():
    """Liveness. Container Apps lo usa como probe de arranque."""
    return {"status": "ok", "version": app.version}


@app.get("/health/esquema")
def health_esquema():
    """Readiness estricta: comprueba que la BD esté en la versión esperada."""
    v = schema_version()
    esperada = settings.schema_version_esperada
    if v != esperada:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "ESQUEMA_DESFASADO",
                               "message": f"Esquema {v}, se esperaba {esperada}"}},
        )
    return {"status": "ok", "schema_version": v}
