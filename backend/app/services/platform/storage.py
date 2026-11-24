"""Almacenamiento de archivos con subida y descarga directas por URL firmada.

Arquitectura objetivo (§2.1 y §10 de la especificación): los archivos **no
pasan por la API**. La API emite una URL firmada (SAS / SigV4 / GCS V4 / HMAC
local) de escritura, el navegador sube el blob directo al proveedor cloud, y
luego confirma con `POST /documentos/{id}/archivos` enviando el `blob_path`.

Backends (STORAGE_BACKEND):
  azure  Azure Blob Storage (identidad administrada + SAS de usuario delegado
         o cadena de conexión).
  aws    Amazon S3 (IAM/IRSA + Presigned URLs SigV4).
  s3     Almacenamiento compatible con S3 (MinIO, Cloudflare R2, Spaces).
  gcp    Google Cloud Storage (ADC / Workload Identity + Signed URLs V4).
  local  Disco. Emite URLs firmadas HMAC contra `/api/v1/blobs/*`.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from ...config import settings


@dataclass
class SasUpload:
    upload_url: str
    blob_path: str
    expires_at: datetime
    headers: dict


@dataclass
class SasDownload:
    download_url: str
    expires_at: datetime


@dataclass
class BlobMeta:
    blob_path: str
    created_at: datetime


def _sanitize_filename(filename: str) -> str:
    limpio = os.path.basename(filename or "archivo")
    return re.sub(r'[\r\n"\\]', "_", limpio) or "archivo"


def _content_disposition(filename: str) -> str:
    return f'attachment; filename="{_sanitize_filename(filename)}"'


class Storage(ABC):
    @abstractmethod
    def upload_url(self, blob_path: str, content_type: str | None) -> SasUpload: ...

    @abstractmethod
    def download_url(self, blob_path: str, filename: str) -> SasDownload: ...

    @abstractmethod
    def exists(self, blob_path: str) -> bool: ...

    @abstractmethod
    def size(self, blob_path: str) -> int | None: ...

    @abstractmethod
    def save(self, blob_path: str, data: bytes) -> None: ...

    @abstractmethod
    def read(self, blob_path: str) -> bytes: ...

    @abstractmethod
    def delete(self, blob_path: str) -> None: ...

    @abstractmethod
    def list_prefix(self, prefix: str) -> list[BlobMeta]: ...


# ------------------------------------------------------------------- local
def _firma_local(blob_path: str, exp: int, modo: str) -> str:
    msg = f"{modo}:{blob_path}:{exp}".encode()
    return hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()[:32]


def verificar_firma_local(blob_path: str, exp: int, modo: str, sig: str) -> bool:
    if exp < int(time.time()):
        return False
    return hmac.compare_digest(_firma_local(blob_path, exp, modo), sig)


class LocalStorage(Storage):
    def __init__(self, base_dir: str):
        self.base = base_dir
        os.makedirs(base_dir, exist_ok=True)

    def _full(self, blob_path: str) -> str:
        base = os.path.abspath(self.base)
        full = os.path.abspath(os.path.normpath(os.path.join(base, blob_path)))
        if os.path.commonpath([base, full]) != base:
            raise ValueError("Ruta inválida")
        return full

    def _url(self, blob_path: str, modo: str, ttl_min: int,
             extra: str = "") -> tuple[str, datetime]:
        exp = int(time.time()) + ttl_min * 60
        sig = _firma_local(blob_path, exp, modo)
        base = settings.public_base_url.rstrip("/")
        ruta = "blobs/upload" if modo == "w" else "blobs/download"
        url = (
            f"{base}/api/v1/{ruta}?blob_path={quote(blob_path, safe='/')}"
            f"&exp={exp}&sig={sig}{extra}"
        )
        return url, datetime.fromtimestamp(exp, timezone.utc)

    def upload_url(self, blob_path: str, content_type: str | None) -> SasUpload:
        url, exp = self._url(blob_path, "w", settings.sas_upload_ttl_min)
        return SasUpload(
            upload_url=url, blob_path=blob_path, expires_at=exp,
            headers={"Content-Type": content_type or "application/octet-stream"})

    def download_url(self, blob_path: str, filename: str) -> SasDownload:
        nombre = _sanitize_filename(filename)
        url, exp = self._url(blob_path, "r", settings.sas_download_ttl_min,
                             extra=f"&filename={quote(nombre)}")
        return SasDownload(download_url=url, expires_at=exp)

    def exists(self, blob_path: str) -> bool:
        return os.path.exists(self._full(blob_path))

    def size(self, blob_path: str) -> int | None:
        try:
            return os.path.getsize(self._full(blob_path))
        except OSError:
            return None

    def save(self, blob_path: str, data: bytes) -> None:
        full = self._full(blob_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(data)

    def read(self, blob_path: str) -> bytes:
        with open(self._full(blob_path), "rb") as f:
            return f.read()

    def delete(self, blob_path: str) -> None:
        try:
            os.remove(self._full(blob_path))
        except FileNotFoundError:
            pass

    def list_prefix(self, prefix: str) -> list[BlobMeta]:
        base = os.path.abspath(self.base)
        pref = prefix.lstrip("/")
        if not os.path.isdir(base):
            return []
        salida: list[BlobMeta] = []
        for raiz, _dirs, archivos in os.walk(base):
            for nombre in archivos:
                ruta = os.path.join(raiz, nombre)
                rel = os.path.relpath(ruta, base).replace(os.sep, "/")
                if rel.startswith(pref):
                    try:
                        ts = os.path.getmtime(ruta)
                        salida.append(BlobMeta(
                            blob_path=rel,
                            created_at=datetime.fromtimestamp(ts, timezone.utc),
                        ))
                    except OSError:
                        continue
        return salida


# ------------------------------------------------------------------- azure
class AzureBlobStorage(Storage):
    """SAS de usuario delegado con identidad administrada, o SAS de cuenta.

    La identidad del contenedor necesita el rol `Storage Blob Data Contributor`
    sobre la cuenta para poder pedir la clave de delegación de usuario.
    """

    def __init__(self):
        from azure.storage.blob import BlobServiceClient

        self.container = settings.azure_blob_container
        self._delegado = False
        self._account_key = None
        if settings.azure_storage_account:
            from azure.identity import DefaultAzureCredential
            self._cred = DefaultAzureCredential()
            self.account = settings.azure_storage_account
            self.client = BlobServiceClient(
                f"https://{self.account}.blob.core.windows.net", credential=self._cred)
            self._delegado = True
        elif settings.azure_blob_conn:
            self.client = BlobServiceClient.from_connection_string(settings.azure_blob_conn)
            self.account = self.client.account_name
            self._account_key = self.client.credential.account_key
        else:
            raise RuntimeError(
                "STORAGE_BACKEND=azure requiere AZURE_STORAGE_ACCOUNT "
                "(identidad administrada) o AZURE_BLOB_CONN")
        try:
            self.client.create_container(self.container)
        except Exception:
            pass    # ya existe o no hay permiso de creación

    def _blob(self, blob_path: str):
        return self.client.get_blob_client(self.container, blob_path)

    def _sas(self, blob_path: str, permisos, ttl_min: int,
             **kwargs) -> tuple[str, datetime]:
        from azure.storage.blob import generate_blob_sas

        ahora = datetime.now(timezone.utc)
        expira = ahora + timedelta(minutes=ttl_min)
        comun = dict(account_name=self.account, container_name=self.container,
                     blob_name=blob_path, permission=permisos, expiry=expira,
                     start=ahora - timedelta(minutes=2), **kwargs)
        if self._delegado:
            udk = self.client.get_user_delegation_key(
                key_start_time=ahora - timedelta(minutes=2),
                key_expiry_time=expira + timedelta(minutes=5),
            )
            token = generate_blob_sas(user_delegation_key=udk, **comun)
        else:
            token = generate_blob_sas(account_key=self._account_key, **comun)
        url = (f"https://{self.account}.blob.core.windows.net/"
               f"{self.container}/{blob_path}?{token}")
        return url, expira

    def upload_url(self, blob_path: str, content_type: str | None) -> SasUpload:
        from azure.storage.blob import BlobSasPermissions
        url, exp = self._sas(blob_path, BlobSasPermissions(create=True, write=True),
                             settings.sas_upload_ttl_min)
        return SasUpload(
            upload_url=url, blob_path=blob_path, expires_at=exp,
            headers={"x-ms-blob-type": "BlockBlob",
                     "Content-Type": content_type or "application/octet-stream"},
        )

    def download_url(self, blob_path: str, filename: str) -> SasDownload:
        from azure.storage.blob import BlobSasPermissions
        url, exp = self._sas(
            blob_path, BlobSasPermissions(read=True), settings.sas_download_ttl_min,
            content_disposition=_content_disposition(filename),
        )
        return SasDownload(download_url=url, expires_at=exp)

    def exists(self, blob_path: str) -> bool:
        try:
            return self._blob(blob_path).exists()
        except Exception:
            return False

    def size(self, blob_path: str) -> int | None:
        try:
            return self._blob(blob_path).get_blob_properties().size
        except Exception:
            return None

    def save(self, blob_path: str, data: bytes) -> None:
        self._blob(blob_path).upload_blob(data, overwrite=True)

    def read(self, blob_path: str) -> bytes:
        return self._blob(blob_path).download_blob().readall()

    def delete(self, blob_path: str) -> None:
        try:
            self._blob(blob_path).delete_blob()
        except Exception:
            pass

    def list_prefix(self, prefix: str) -> list[BlobMeta]:
        contenedor = self.client.get_container_client(self.container)
        salida: list[BlobMeta] = []
        for blob in contenedor.list_blobs(name_starts_with=prefix):
            creado = getattr(blob, "creation_time", None) or getattr(blob, "last_modified", None)
            if creado is None:
                creado = datetime.now(timezone.utc)
            elif creado.tzinfo is None:
                creado = creado.replace(tzinfo=timezone.utc)
            salida.append(BlobMeta(blob_path=blob.name, created_at=creado))
        return salida


# ----------------------------------------------------------------- aws / s3
class S3Storage(Storage):
    """Amazon S3 y proveedores compatibles (MinIO, Cloudflare R2, Spaces)."""

    def __init__(self):
        import boto3
        from botocore.config import Config

        if not settings.s3_bucket:
            raise RuntimeError("STORAGE_BACKEND=aws/s3 requiere S3_BUCKET")
        if settings.storage_backend == "s3" and not settings.s3_endpoint_url:
            raise RuntimeError("STORAGE_BACKEND=s3 requiere S3_ENDPOINT_URL")
        region = (
            settings.aws_region
            or os.environ.get("AWS_REGION")
            or os.environ.get("AWS_DEFAULT_REGION")
            or ("us-east-1" if settings.storage_backend == "s3" else "")
        )
        if settings.storage_backend == "aws" and not region:
            raise RuntimeError("STORAGE_BACKEND=aws requiere AWS_REGION")

        self.bucket = settings.s3_bucket
        style = "path" if (settings.s3_force_path_style or settings.storage_backend == "s3") else "auto"
        cfg = Config(signature_version="s3v4", s3={"addressing_style": style})

        kw: dict = {"config": cfg}
        if region:
            kw["region_name"] = region
        if settings.s3_access_key_id and settings.s3_secret_access_key:
            kw["aws_access_key_id"] = settings.s3_access_key_id
            kw["aws_secret_access_key"] = settings.s3_secret_access_key

        internal_ep = settings.s3_endpoint_url or None
        public_ep = settings.s3_public_endpoint_url or internal_ep
        self.client = boto3.client("s3", endpoint_url=internal_ep, **kw)
        self.signer_client = (
            self.client
            if public_ep == internal_ep
            else boto3.client("s3", endpoint_url=public_ep, **kw)
        )

    def upload_url(self, blob_path: str, content_type: str | None) -> SasUpload:
        ct = content_type or "application/octet-stream"
        exp = datetime.now(timezone.utc) + timedelta(minutes=settings.sas_upload_ttl_min)
        url = self.signer_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": blob_path, "ContentType": ct},
            ExpiresIn=settings.sas_upload_ttl_min * 60,
        )
        return SasUpload(
            upload_url=url,
            blob_path=blob_path,
            expires_at=exp,
            headers={"Content-Type": ct},
        )

    def download_url(self, blob_path: str, filename: str) -> SasDownload:
        exp = datetime.now(timezone.utc) + timedelta(minutes=settings.sas_download_ttl_min)
        url = self.signer_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": blob_path,
                "ResponseContentDisposition": _content_disposition(filename),
            },
            ExpiresIn=settings.sas_download_ttl_min * 60,
        )
        return SasDownload(download_url=url, expires_at=exp)

    def exists(self, blob_path: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=blob_path)
            return True
        except Exception:
            return False

    def size(self, blob_path: str) -> int | None:
        try:
            res = self.client.head_object(Bucket=self.bucket, Key=blob_path)
            return int(res["ContentLength"])
        except Exception:
            return None

    def save(self, blob_path: str, data: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=blob_path, Body=data)

    def read(self, blob_path: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=blob_path)["Body"].read()

    def delete(self, blob_path: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=blob_path)
        except Exception:
            pass

    def list_prefix(self, prefix: str) -> list[BlobMeta]:
        salida: list[BlobMeta] = []
        token: str | None = None
        while True:
            params: dict = {"Bucket": self.bucket, "Prefix": prefix}
            if token:
                params["ContinuationToken"] = token
            resp = self.client.list_objects_v2(**params)
            for obj in resp.get("Contents", []):
                creado = obj.get("LastModified") or datetime.now(timezone.utc)
                if creado.tzinfo is None:
                    creado = creado.replace(tzinfo=timezone.utc)
                salida.append(BlobMeta(blob_path=obj["Key"], created_at=creado))
            if not resp.get("IsTruncated"):
                break
            token = resp.get("NextContinuationToken")
        return salida


# --------------------------------------------------------------------- gcp
class GCSStorage(Storage):
    """Google Cloud Storage con Signed URLs V4 (ADC / Workload Identity)."""

    def __init__(self):
        from google.cloud import storage as gcs

        if not settings.gcp_storage_bucket:
            raise RuntimeError("STORAGE_BACKEND=gcp requiere GCP_STORAGE_BUCKET")
        self.client = gcs.Client(project=settings.gcp_project_id or None)
        self.bucket = self.client.bucket(settings.gcp_storage_bucket)

    def _sign_kwargs(self) -> dict:
        creds = getattr(self.client, "_credentials", None)
        if creds is None or hasattr(creds, "signer"):
            return {}
        sa_email = settings.gcp_service_account_email or getattr(creds, "service_account_email", "")
        if not sa_email:
            return {}
        try:
            from google.auth.transport.requests import Request
            if not getattr(creds, "valid", False):
                creds.refresh(Request())
        except Exception:
            pass
        token = getattr(creds, "token", None)
        if not token:
            return {}
        return {"service_account_email": sa_email, "access_token": token}

    def upload_url(self, blob_path: str, content_type: str | None) -> SasUpload:
        ct = content_type or "application/octet-stream"
        exp = datetime.now(timezone.utc) + timedelta(minutes=settings.sas_upload_ttl_min)
        url = self.bucket.blob(blob_path).generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=settings.sas_upload_ttl_min),
            method="PUT",
            content_type=ct,
            **self._sign_kwargs(),
        )
        return SasUpload(
            upload_url=url,
            blob_path=blob_path,
            expires_at=exp,
            headers={"Content-Type": ct},
        )

    def download_url(self, blob_path: str, filename: str) -> SasDownload:
        exp = datetime.now(timezone.utc) + timedelta(minutes=settings.sas_download_ttl_min)
        url = self.bucket.blob(blob_path).generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=settings.sas_download_ttl_min),
            method="GET",
            response_disposition=_content_disposition(filename),
            **self._sign_kwargs(),
        )
        return SasDownload(download_url=url, expires_at=exp)

    def exists(self, blob_path: str) -> bool:
        try:
            return bool(self.bucket.blob(blob_path).exists())
        except Exception:
            return False

    def size(self, blob_path: str) -> int | None:
        try:
            blob = self.bucket.blob(blob_path)
            blob.reload()
            return int(blob.size) if blob.size is not None else None
        except Exception:
            return None

    def save(self, blob_path: str, data: bytes) -> None:
        self.bucket.blob(blob_path).upload_from_string(data)

    def read(self, blob_path: str) -> bytes:
        return self.bucket.blob(blob_path).download_as_bytes()

    def delete(self, blob_path: str) -> None:
        try:
            self.bucket.blob(blob_path).delete()
        except Exception:
            pass

    def list_prefix(self, prefix: str) -> list[BlobMeta]:
        salida: list[BlobMeta] = []
        for blob in self.client.list_blobs(self.bucket, prefix=prefix):
            creado = getattr(blob, "time_created", None) or getattr(blob, "updated", None)
            if creado is None:
                creado = datetime.now(timezone.utc)
            elif creado.tzinfo is None:
                creado = creado.replace(tzinfo=timezone.utc)
            salida.append(BlobMeta(blob_path=blob.name, created_at=creado))
        return salida


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        backend = settings.storage_backend
        if backend == "azure":
            _storage = AzureBlobStorage()
        elif backend in ("aws", "s3"):
            _storage = S3Storage()
        elif backend == "gcp":
            _storage = GCSStorage()
        elif backend == "local":
            _storage = LocalStorage(settings.storage_dir)
        else:
            raise RuntimeError(f"STORAGE_BACKEND no soportado: {backend}")
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None


def make_blob_path(company_id, dueno_tipo: str, dueno_id, documento_id,
                   filename: str) -> str:
    """{company_id}/{tipo}/{dueno}/{documento}/{uuid}_{filename} (§2 de la spec)."""
    safe = os.path.basename(filename).replace("\\", "_")
    return f"{company_id}/{dueno_tipo}/{dueno_id}/{documento_id}/{uuid.uuid4().hex[:8]}_{safe}"


def make_tmp_path(company_id, prefijo: str, filename: str) -> str:
    """Blobs temporales de extracción IA; se purgan a las 24 horas."""
    safe = os.path.basename(filename).replace("\\", "_")
    return f"tmp/{company_id}/{prefijo}_{uuid.uuid4().hex[:8]}_{safe}"


def make_template_blob_path(company_id_or_global: str, filename: str) -> str:
    """Blobs para archivos de ejemplo de plantillas."""
    safe = os.path.basename(filename).replace("\\", "_")
    return f"templates/{company_id_or_global}/{uuid.uuid4().hex[:8]}_{safe}"
