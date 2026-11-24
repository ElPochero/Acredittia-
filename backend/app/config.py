from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración por variables de entorno (.env soportado).

    Los adaptadores de infraestructura (storage, cola, cifrado, secretos, IA) se
    eligen por variable (o vía el preset `CLOUD_PROVIDER`) para que `docker
    compose up` funcione localmente y producción opere en Azure, AWS, GCP o
    almacenamiento S3-compatible con identidad federada sin secretos estáticos.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # --- Entorno y preset multi-cloud --------------------------------------
    app_env: str = "development"  # development | test | staging | production
    cloud_provider: str = "local"  # local | azure | aws | gcp | custom
    seed_demo_enabled: bool = False
    auth_dev_reset_token_enabled: bool = False

    # --- Base de datos -----------------------------------------------------
    # En producción se conecta con el rol acredittia_app (NOBYPASSRLS) para que
    # las políticas de RLS del modelo de datos se apliquen de verdad.
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/acredittia"
    )
    schema_dir: str = "/schema"
    schema_version_esperada: int = (
        20  # scripts 01..20 aplicados (20 motor validacion documental IA v2)
    )
    db_apply_schema_on_start: bool = False  # en producción lo hace el job de migración
    db_rls_enabled: bool = True  # fija app.company_id/is_admin/user_id por request

    # --- Autenticación -----------------------------------------------------
    jwt_secret: str = "dev-secret-cambiar-en-produccion"
    access_ttl_min: int = 30
    refresh_ttl_days: int = 30
    reset_ttl_min: int = 60
    cors_origins: str = "http://localhost:3000"

    # --- Almacenamiento: local | azure | aws | s3 | gcp --------------------
    storage_backend: str = "local"
    storage_dir: str = "/data/uploads"
    azure_storage_account: str = ""  # identidad administrada (preferido)
    azure_blob_conn: str = ""  # cadena de conexión (alternativa)
    azure_blob_container: str = "docs"
    # AWS S3 / S3-compatible (MinIO, Cloudflare R2, DigitalOcean Spaces)
    aws_region: str = ""
    s3_bucket: str = "docs"
    s3_endpoint_url: str = ""
    s3_public_endpoint_url: str = ""  # split-horizon DNS para presigned URLs
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_force_path_style: bool = False
    # Google Cloud Storage
    gcp_project_id: str = ""
    gcp_storage_bucket: str = "docs"
    gcp_service_account_email: str = ""

    sas_upload_ttl_min: int = 15
    sas_download_ttl_min: int = 15
    public_base_url: str = "http://localhost:8000"  # para URLs locales de subida
    # Base del FRONTEND (Vercel en producción). Es la que va en los correos de
    # invitación: el enlace tiene que apuntar a la aplicación, no a la API.
    app_url: str = "http://localhost:3000"

    # --- Cola de trabajos: celery | inproc --------------------------------
    queue_backend: str = "inproc"
    redis_url: str = "redis://localhost:6379/0"

    # --- Cifrado JWE y secretos: local | keyvault | azure | aws | gcp ------
    jwe_backend: str = "local"
    secret_backend: str = ""  # si está vacío hereda de jwe_backend
    azure_keyvault_url: str = ""
    keyvault_key_name: str = "plataforma-cred"
    keys_dir: str = "/data/keys"  # solo jwe_backend=local
    credencial_ttl_meses: int = 12
    aws_kms_key_id: str = ""
    aws_secrets_prefix: str = "acredittia"
    gcp_kms_key_name: str = ""

    # --- Revisión IA: simulada | gemini ------------------------------------
    ia_backend: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    # Verificador post-generación del chat (Critic/Guardrail de razonabilidad).
    gemini_verifier_model: str = "gemini-3.5-flash-lite"
    ia_verifier_enabled: bool = True
    ia_verifier_timeout_s: float = 6.0
    # Embeddings para RAG vía Google Gemini (OpenAI-compatible endpoint).
    gemini_embedding_model: str = "gemini-embedding-001"
    gemini_embedding_dims: int = 768

    # --- Notificaciones ----------------------------------------------------
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "no-reply@acredittia.cl"
    whatsapp_token: str = ""
    whatsapp_phone_id: str = ""
    whatsapp_verify_token: str = ""

    # --- Pagos -------------------------------------------------------------
    pagos_webhook_secret: str = ""

    # --- Límites -----------------------------------------------------------
    max_upload_mb: int = 20
    page_size_default: int = 25
    page_size_max: int = 100
    matriz_filas_max: int = 200
    export_filas_max: int = 5000

    @model_validator(mode="after")
    def _aplicar_preset_y_validar(self) -> "Settings":
        campos_explicitos = set(self.model_fields_set)
        self.app_env = self.app_env.strip().lower()
        self.cloud_provider = self.cloud_provider.strip().lower()
        self.storage_backend = self.storage_backend.strip().lower()
        self.jwe_backend = self.jwe_backend.strip().lower()
        self.secret_backend = self.secret_backend.strip().lower()

        if self.cloud_provider in ("azure", "aws", "gcp"):
            if "storage_backend" not in campos_explicitos and self.storage_backend == "local":
                self.storage_backend = self.cloud_provider
            if "jwe_backend" not in campos_explicitos and self.jwe_backend == "local":
                self.jwe_backend = "keyvault" if self.cloud_provider == "azure" else self.cloud_provider

        if not self.secret_backend:
            self.secret_backend = self.jwe_backend

        if self.app_env not in {"development", "test", "staging", "production"}:
            raise ValueError("APP_ENV debe ser development, test, staging o production")
        if self.cloud_provider not in {"local", "azure", "aws", "gcp", "custom"}:
            raise ValueError("CLOUD_PROVIDER inválido")
        if self.storage_backend not in {"local", "azure", "aws", "s3", "gcp"}:
            raise ValueError("STORAGE_BACKEND inválido")
        if self.jwe_backend not in {"local", "keyvault", "azure", "aws", "gcp"}:
            raise ValueError("JWE_BACKEND inválido")
        if self.secret_backend not in {"local", "keyvault", "azure", "aws", "gcp"}:
            raise ValueError("SECRET_BACKEND inválido")

        if self.app_env == "production":
            secreto = self.jwt_secret.strip()
            if secreto.lower().startswith("dev-") or len(secreto.encode()) < 32:
                raise ValueError("JWT_SECRET de producción debe ser propio y tener al menos 32 bytes")
            if self.seed_demo_enabled or self.auth_dev_reset_token_enabled:
                raise ValueError("Producción no permite semillas demo ni tokens de recuperación en respuestas")
            if not self.db_rls_enabled or self.db_apply_schema_on_start:
                raise ValueError("Producción exige RLS habilitado y migraciones separadas del arranque")
            if self.storage_backend == "local":
                raise ValueError("Producción no permite STORAGE_BACKEND=local")
            if self.jwe_backend == "local":
                raise ValueError("Producción no permite JWE_BACKEND=local")
            if self.secret_backend == "local":
                raise ValueError("Producción no permite SECRET_BACKEND=local")

            if self.storage_backend == "azure" and not (self.azure_storage_account or self.azure_blob_conn):
                raise ValueError("STORAGE_BACKEND=azure requiere AZURE_STORAGE_ACCOUNT o AZURE_BLOB_CONN")
            if self.storage_backend == "aws" and (not self.s3_bucket or not self.aws_region):
                raise ValueError("STORAGE_BACKEND=aws requiere S3_BUCKET y AWS_REGION")
            if self.storage_backend == "s3" and (not self.s3_bucket or not self.s3_endpoint_url):
                raise ValueError("STORAGE_BACKEND=s3 requiere S3_BUCKET y S3_ENDPOINT_URL")
            if self.storage_backend == "gcp" and not self.gcp_storage_bucket:
                raise ValueError("STORAGE_BACKEND=gcp requiere GCP_STORAGE_BUCKET")

            if self.jwe_backend in ("azure", "keyvault") and not self.azure_keyvault_url:
                raise ValueError("JWE_BACKEND=azure/keyvault requiere AZURE_KEYVAULT_URL")
            if self.jwe_backend == "aws" and (not self.aws_kms_key_id or not self.aws_region):
                raise ValueError("JWE_BACKEND=aws requiere AWS_KMS_KEY_ID y AWS_REGION")
            if self.jwe_backend == "gcp" and not self.gcp_kms_key_name:
                raise ValueError("JWE_BACKEND=gcp requiere GCP_KMS_KEY_NAME")

            if self.secret_backend in ("azure", "keyvault") and not self.azure_keyvault_url:
                raise ValueError("SECRET_BACKEND=azure/keyvault requiere AZURE_KEYVAULT_URL")
            if self.secret_backend == "aws" and not self.aws_region:
                raise ValueError("SECRET_BACKEND=aws requiere AWS_REGION")
            if self.secret_backend == "gcp" and not self.gcp_project_id:
                raise ValueError("SECRET_BACKEND=gcp requiere GCP_PROJECT_ID")

        return self


settings = Settings()

# Extensiones permitidas por contexto (§10 de la especificación)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_EXTENSIONS_CONTRATO = ALLOWED_EXTENSIONS | {".doc", ".docx"}
ALLOWED_EXTENSIONS_ARRANQUE = ALLOWED_EXTENSIONS_CONTRATO | {".xlsx", ".xls", ".csv"}

TIPOS_EQUIPO = [
    "Tracto-Camión",
    "Camión",
    "Camión Pluma",
    "Camión Aljibe",
    "Cama Baja",
    "Semirremolque",
    "Rampla Plana",
    "Camioneta",
    "JEEP",
    "Bus",
    "MINIBUS",
    "Furgón",
    "Automóvil",
    "Alzahombre",
    "Grúa",
    "Grúa Horquilla",
    "Retroexcavadora",
    "Motoniveladora",
    "Equipo de levante",
    "Equipo de producción",
    "Otro",
]

# Umbrales de vencimiento y acreditación
UMBRAL_PORVENC_DIAS = 30
UMBRAL_ACREDITADO_PCT = 70

# Tipos de reporte y de exportación
REPORTE_TIPOS = (
    "estado_acreditacion",
    "cumplimiento_requisitos",
    "personal_acreditado",
    "equipos_vehiculos",
    "vencimientos",
    "matriz_cumplimiento",
)
EXPORT_RECURSOS = (
    "personal",
    "equipos",
    "personas",
    "flota",
    "documentos",
    "requisitos",
    "alertas",
    "contratos",
    "matriz",
)
