"""Guardas fail-closed de configuración multi-cloud en producción."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.fixture(autouse=True)
def _limpiar_env_cloud(monkeypatch):
    for k in (
        "APP_ENV",
        "CLOUD_PROVIDER",
        "STORAGE_BACKEND",
        "JWE_BACKEND",
        "SECRET_BACKEND",
        "SEED_DEMO_ENABLED",
        "AUTH_DEV_RESET_TOKEN_ENABLED",
        "DB_RLS_ENABLED",
        "DB_APPLY_SCHEMA_ON_START",
    ):
        monkeypatch.delenv(k, raising=False)


def _prod(**overrides) -> Settings:
    base = dict(
        app_env="production",
        cloud_provider="azure",
        azure_storage_account="acredittiablobs",
        azure_keyvault_url="https://acredittia-kv.vault.azure.net/",
        jwt_secret="clave-produccion-segura-con-mas-de-32-bytes!",
        seed_demo_enabled=False,
        auth_dev_reset_token_enabled=False,
        db_rls_enabled=True,
        db_apply_schema_on_start=False,
    )
    base.update(overrides)
    return Settings(_env_file=None, **base)


def test_cloud_provider_resuelve_adaptadores_por_defecto():
    aws = Settings(_env_file=None, cloud_provider="aws")
    assert aws.storage_backend == "aws"
    assert aws.jwe_backend == "aws"
    assert aws.secret_backend == "aws"

    gcp = Settings(_env_file=None, cloud_provider="gcp")
    assert gcp.storage_backend == "gcp"
    assert gcp.jwe_backend == "gcp"
    assert gcp.secret_backend == "gcp"

    az = Settings(_env_file=None, cloud_provider="azure")
    assert az.storage_backend == "azure"
    assert az.jwe_backend == "keyvault"
    assert az.secret_backend == "keyvault"


@pytest.mark.parametrize("cambio", [
    {"jwt_secret": "dev-secret-cambiar-en-produccion"},
    {"jwt_secret": "corta"},
    {"seed_demo_enabled": True},
    {"auth_dev_reset_token_enabled": True},
    {"db_rls_enabled": False},
    {"db_apply_schema_on_start": True},
    {"app_env": "producion"},
    {"cloud_provider": "local"},
    {"storage_backend": "local"},
    {"jwe_backend": "local"},
    {"secret_backend": "local"},
    {"cloud_provider": "aws", "storage_backend": "local", "aws_region": "us-east-1", "aws_kms_key_id": "k"},
    {"cloud_provider": "azure", "azure_storage_account": "", "azure_blob_conn": ""},
    {"cloud_provider": "azure", "azure_keyvault_url": ""},
    {"cloud_provider": "aws", "aws_region": "", "aws_kms_key_id": "arn:aws:kms:us-east-1:1:key/k"},
    {"cloud_provider": "aws", "aws_region": "us-east-1", "aws_kms_key_id": ""},
    {"cloud_provider": "custom", "storage_backend": "s3", "s3_bucket": "b", "s3_endpoint_url": "", "jwe_backend": "aws", "aws_region": "us-east-1", "aws_kms_key_id": "k"},
    {"cloud_provider": "gcp", "gcp_project_id": "p1", "gcp_storage_bucket": "", "gcp_kms_key_name": "projects/p1/locations/global/keyRings/r/cryptoKeys/k"},
    {"cloud_provider": "gcp", "gcp_project_id": "p1", "gcp_storage_bucket": "b", "gcp_kms_key_name": ""},
    {"cloud_provider": "gcp", "gcp_project_id": "", "gcp_storage_bucket": "b", "gcp_kms_key_name": "projects/p1/locations/global/keyRings/r/cryptoKeys/k"},
])
def test_produccion_rechaza_configuracion_insegura_o_incompleta(cambio):
    with pytest.raises(ValidationError):
        _prod(**cambio)


def test_produccion_acepta_perfiles_azure_aws_gcp_y_s3_completos():
    assert _prod().storage_backend == "azure"

    aws = _prod(
        cloud_provider="aws",
        aws_region="us-east-1",
        s3_bucket="acredittia-docs",
        aws_kms_key_id="arn:aws:kms:us-east-1:123456789012:key/k1",
    )
    assert aws.storage_backend == "aws" and aws.jwe_backend == "aws"

    gcp = _prod(
        cloud_provider="gcp",
        gcp_project_id="acredittia-prod",
        gcp_storage_bucket="acredittia-docs",
        gcp_kms_key_name="projects/acredittia-prod/locations/global/keyRings/r/cryptoKeys/k",
    )
    assert gcp.storage_backend == "gcp" and gcp.secret_backend == "gcp"

    minio_plus_aws = _prod(
        cloud_provider="custom",
        storage_backend="s3",
        s3_bucket="acredittia-docs",
        s3_endpoint_url="http://minio:9000",
        jwe_backend="aws",
        aws_region="us-east-1",
        aws_kms_key_id="arn:aws:kms:us-east-1:123456789012:key/k1",
    )
    assert minio_plus_aws.storage_backend == "s3"


def test_error_validacion_no_expone_secretos():
    secreto = "secreto-super-privado-no-filtrar-en-logs"
    with pytest.raises(ValidationError) as err:
        _prod(jwt_secret=secreto, seed_demo_enabled=True)
    assert secreto not in str(err.value)
