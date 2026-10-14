"""Conexión, contexto multi-tenant para RLS y aplicación del esquema.

Modelo de aislamiento (doble barrera, §7 del modelo de datos):

1. **RLS en el motor.** La API se conecta con `acredittia_app` (NOBYPASSRLS) y
   fija por transacción `app.company_id`, `app.is_admin` y `app.user_id`. Las
   políticas `p_tenant` filtran cada tabla por `company_id`.
2. **Filtros explícitos en las consultas.** No se eliminan: si un endpoint
   nuevo olvida el `WHERE company_id`, el motor lo tapa; si RLS se desactivara
   por un error de despliegue, el filtro sigue en pie.

El contexto viaja en un `ContextVar`, de modo que cada request (incluidos los
endpoints síncronos que corren en el threadpool de anyio) tiene su propia
copia. El listener `after_begin` lo materializa con `set_config(..., true)`,
que es local a la transacción: al terminarla el ajuste desaparece solo.
"""

from __future__ import annotations

import contextlib
import os
import re
import time
from contextvars import ContextVar
from dataclasses import dataclass

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

# Normalización del dialecto para SQLAlchemy 2.0 + psycopg 3
_db_url = str(settings.database_url)
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif _db_url.startswith("postgresql://") and "+psycopg" not in _db_url:
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    _db_url,
    pool_pre_ping=True,
    future=True,
    connect_args={"application_name": "acredittia-api"},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Registro del tipo `vector` de pgvector en cada conexión psycopg.
# Sin esto, leer un embedding devuelve string y escribir una lista falla.
# Fuente: https://github.com/pgvector/pgvector-python?tab=readme-ov-file#sqlalchemy
from pgvector.psycopg import register_vector  # noqa: E402


@event.listens_for(engine, "connect")
def _registrar_vector(dbapi_connection, connection_record) -> None:
    try:
        register_vector(dbapi_connection)
    except Exception:
        # El tipo 'vector' de pgvector solo existe tras aplicar la migración 11
        # (11_rag_pgvector.sql). Si el esquema aún no lo tiene, ignoramos el fallo
        # para permitir que las migraciones o conexiones iniciales funcionen.
        pass



# Scripts del modelo de datos en orden y versión de esquema que representan.
SCHEMA_SCRIPTS = [
    "01_esquema.sql",
    "02_indices.sql",
    "03_triggers.sql",
    "04_rls.sql",
    "06_migracion_v11.sql",
    "07_migracion_v12.sql",
    "08_migracion_v13.sql",
    "09_certificacion_laboral.sql",
    "10_add_telefono_email.sql",
    "11_rag_pgvector.sql",
    "12_vinculo_faena.sql",
    "13_rol_visor.sql",
]
SCHEMA_VERSION = 13
MIGRATION_LOCK_ID = 918273  # clave del pg_advisory_lock de migración


# ---------------------------------------------------------------- contexto
@dataclass
class TenantCtx:
    company_id: str | None = None
    is_admin: bool = False
    user_id: str | None = None

    def instantanea(self) -> tuple:
        return (self.company_id, self.is_admin, self.user_id)

    def restaurar(self, instantanea: tuple) -> None:
        self.company_id, self.is_admin, self.user_id = instantanea


_ctx: ContextVar[TenantCtx] = ContextVar("tenant_ctx")


def _contenedor() -> TenantCtx:
    """Contenedor del contexto actual, creándolo si el request no pasó por el
    middleware (jobs de Celery, scripts, pruebas)."""
    try:
        return _ctx.get()
    except LookupError:
        nuevo = TenantCtx()
        _ctx.set(nuevo)
        return nuevo


def set_ctx(company_id=None, is_admin: bool = False, user_id=None) -> None:
    ctx = _contenedor()
    ctx.company_id = str(company_id) if company_id else None
    ctx.is_admin = is_admin
    ctx.user_id = str(user_id) if user_id else None


def get_ctx() -> TenantCtx:
    return _contenedor()


def reset_ctx() -> None:
    """Instala un contenedor nuevo: aísla el request de cualquier anterior."""
    _ctx.set(TenantCtx())


@event.listens_for(Session, "after_begin")
def _apply_tenant(session: Session, transaction, connection) -> None:
    """Materializa el contexto del request en GUCs locales a la transacción."""
    if not settings.db_rls_enabled:
        return
    ctx = _contenedor()
    connection.exec_driver_sql(
        "SELECT set_config('app.company_id', %s, true),"
        "       set_config('app.is_admin',   %s, true),"
        "       set_config('app.user_id',    %s, true)",
        (ctx.company_id or "", "true" if ctx.is_admin else "false", ctx.user_id or ""),
    )


def get_db():
    """Sesión de request.

    El tenant se aplica al ABRIR la transacción, no al crear la sesión, así que
    basta con que la dependencia de autenticación haya fijado el contexto antes
    de la primera consulta. Crear la sesión no abre transacción.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextlib.contextmanager
def auth_session():
    """Sesión para consultas de autenticación (login, refresh, reset de clave)."""
    ctx = _contenedor()
    previo = ctx.instantanea()
    set_ctx(is_admin=True)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        ctx.restaurar(previo)


@contextlib.contextmanager
def worker_session(company_id=None, is_admin: bool = False, user_id=None):
    """Sesión para jobs de Celery, que no tienen request asociado."""
    ctx = _contenedor()
    previo = ctx.instantanea()
    set_ctx(company_id=company_id, is_admin=is_admin, user_id=user_id)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        ctx.restaurar(previo)


# ---------------------------------------------------------------- esquema
def wait_for_db(retries: int = 30) -> None:
    last_err = None
    for _ in range(retries):
        try:
            with engine.connect() as c:
                c.execute(text("SELECT 1"))
            return
        except Exception as e:
            last_err = e
            time.sleep(1)
    raise RuntimeError(f"Base de datos no disponible: {last_err}")



def _tabla_existe(conn, nombre: str) -> bool:
    return (
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name=:t"
            ),
            {"t": nombre},
        ).first()
        is not None
    )


def _columna_existe(conn, tabla: str, columna: str) -> bool:
    return (
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name=:t AND column_name=:c"
            ),
            {"t": tabla, "c": columna},
        ).first()
        is not None
    )


def _enum_tiene(conn, tipo: str, valor: str) -> bool:
    return (
        conn.execute(
            text(
                "SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
                "WHERE t.typname = :t AND e.enumlabel = :v"
            ),
            {"t": tipo, "v": valor},
        ).first()
        is not None
    )


def schema_version() -> int:
    """0 = vacía · 3 = baseline sin RLS · 4 = con RLS · 6 = v1.1 aplicada · 7 = archivo_ejemplo · 9 = certificación laboral · 10 = sujetos.telefono/email · 11 = RAG pgvector · 12 = vínculo 'faena' · 13 = rol 'visor'."""
    with engine.connect() as c:
        if not _tabla_existe(c, "companies"):
            return 0
        if _tabla_existe(c, "documento_chunk"):
            if _enum_tiene(c, "user_role", "visor"):
                return 13
            if _enum_tiene(c, "vinculo_tipo", "faena"):
                return 12
            return 11
        if _tabla_existe(c, "periodos_laborales"):
            if _columna_existe(c, "sujetos", "telefono"):
                return 10
            return 9
        if _columna_existe(c, "contratos", "hereda_plataformas"):
            return 8
        if _columna_existe(c, "requisito_templates", "archivo_ejemplo"):
            return 7
        if _tabla_existe(c, "plataforma_credenciales") and _tabla_existe(
            c, "cumplimiento_snapshots"
        ):
            return 6
        rls = c.execute(
            text("SELECT relrowsecurity FROM pg_class WHERE relname='contratos'")
        ).scalar()
        return 4 if rls else 3


def assert_schema_version(esperada: int = SCHEMA_VERSION) -> None:
    actual = schema_version()
    if actual != esperada:
        raise RuntimeError(
            f"Esquema en versión {actual}, se esperaba {esperada}. "
            "Ejecuta el job de migración (python -m migrate.run) antes de arrancar la API."
        )


_ADD_VALUE = re.compile(
    r"^\s*ALTER\s+TYPE\s+\w+\s+ADD\s+VALUE\b.*;\s*$",
    re.IGNORECASE,
)


def _preparar_script(sql: str) -> tuple[list[str], str]:
    add_values: list[str] = []
    resto: list[str] = []
    for linea in sql.splitlines():
        if linea.strip().startswith("\\echo"):
            continue  # metacomando de psql; psycopg no lo entiende
        if _ADD_VALUE.match(linea):
            add_values.append(linea.strip())
        else:
            resto.append(linea)
    return add_values, "\n".join(resto)


def apply_schema(schema_dir: str | None = None) -> int:
    """Aplica los scripts pendientes bajo pg_advisory_lock."""
    sdir = schema_dir or settings.schema_dir
    if not os.path.isdir(sdir):
        from .models import Base, _ENUM_VALUES

        raw = engine.raw_connection()
        try:
            raw.driver_connection.autocommit = True
            cur = raw.cursor()
            for enum_name, enum_vals in _ENUM_VALUES.items():
                vals_str = ", ".join(f"'{v}'" for v in enum_vals)
                cur.execute(f"""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN
                            CREATE TYPE {enum_name} AS ENUM ({vals_str});
                        END IF;
                    END $$;
                """)
        finally:
            raw.close()
        Base.metadata.create_all(engine)
        return schema_version()

    raw = engine.raw_connection()
    autocommit_previo = getattr(raw.driver_connection, "autocommit", False)
    try:
        raw.driver_connection.autocommit = True
        cur = raw.cursor()
        cur.execute("SELECT pg_advisory_lock(%s)", (MIGRATION_LOCK_ID,))
        try:
            actual = schema_version()
            if actual >= SCHEMA_VERSION:
                return actual
            if actual == 0:
                pendientes = SCHEMA_SCRIPTS
            elif actual == 3:
                pendientes = [
                    "04_rls.sql",
                    "06_migracion_v11.sql",
                    "07_migracion_v12.sql",
                    "08_migracion_v13.sql",
                    "09_certificacion_laboral.sql",
                    "10_add_telefono_email.sql",
                    "11_rag_pgvector.sql",
                ]
            elif actual == 4:
                pendientes = [
                    "06_migracion_v11.sql",
                    "07_migracion_v12.sql",
                    "08_migracion_v13.sql",
                    "09_certificacion_laboral.sql",
                    "10_add_telefono_email.sql",
                    "11_rag_pgvector.sql",
                ]
            elif actual == 6:
                pendientes = [
                    "07_migracion_v12.sql",
                    "08_migracion_v13.sql",
                    "09_certificacion_laboral.sql",
                    "10_add_telefono_email.sql",
                    "11_rag_pgvector.sql",
                ]
            elif actual == 7:
                pendientes = [
                    "08_migracion_v13.sql",
                    "09_certificacion_laboral.sql",
                    "10_add_telefono_email.sql",
                    "11_rag_pgvector.sql",
                ]
            elif actual == 8:
                pendientes = [
                    "09_certificacion_laboral.sql",
                    "10_add_telefono_email.sql",
                    "11_rag_pgvector.sql",
                ]
            elif actual == 9:
                pendientes = [
                    "10_add_telefono_email.sql",
                    "11_rag_pgvector.sql",
                ]
            elif actual == 10:
                pendientes = ["11_rag_pgvector.sql", "12_vinculo_faena.sql"]
            elif actual == 11:
                pendientes = ["12_vinculo_faena.sql", "13_rol_visor.sql"]
            elif actual == 12:
                pendientes = ["13_rol_visor.sql"]
            else:
                pendientes = []

            for nombre in pendientes:
                ruta = os.path.join(sdir, nombre)
                if not os.path.exists(ruta):
                    raise RuntimeError(f"Falta el script {nombre} en {sdir}")
                with open(ruta, encoding="utf-8") as f:
                    add_values, resto = _preparar_script(f.read())
                for sentencia in add_values:
                    cur.execute(sentencia)  # confirmada al instante
                if resto.strip():
                    cur.execute(resto)
            return schema_version()
        finally:
            cur.execute("SELECT pg_advisory_unlock(%s)", (MIGRATION_LOCK_ID,))
    finally:
        try:
            raw.driver_connection.autocommit = autocommit_previo
        except Exception:
            pass
        raw.close()
