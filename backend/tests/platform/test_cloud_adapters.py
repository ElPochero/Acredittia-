"""Contratos multi-cloud para Storage, KeyWrapper, SecretWriter y purga PII.

Ejercita `local`, `azure`, `aws`, `s3` y `gcp` en memoria sin credenciales reales.
"""
from __future__ import annotations

import os
import sys
import types
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.config import settings
from app.services.platform import crypto, integraciones, storage
from app.services.platform.tasks import purgar_temporales


def _instalar_fakes_cloud(monkeypatch, store_objs: dict, store_secrets: dict):
    """Instala SDKs falsos en sys.modules para pruebas deterministas sin red."""
    priv = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    pub_pem = priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    # --- Azure Blob & Key Vault ---
    az_pkg = types.ModuleType("azure")
    az_id = types.ModuleType("azure.identity")
    az_id.DefaultAzureCredential = lambda: object()

    az_st = types.ModuleType("azure.storage")
    az_blob_mod = types.ModuleType("azure.storage.blob")

    class _FakeAzBlobClient:
        def __init__(self, container: str, path: str):
            self.key = (container, path)

        def exists(self) -> bool:
            return self.key in store_objs

        def get_blob_properties(self):
            return types.SimpleNamespace(size=len(store_objs[self.key]["data"]))

        def upload_blob(self, data: bytes, overwrite: bool = True):
            store_objs[self.key] = {
                "data": data,
                "created_at": datetime.now(timezone.utc),
            }

        def download_blob(self):
            return types.SimpleNamespace(readall=lambda: store_objs[self.key]["data"])

        def delete_blob(self):
            store_objs.pop(self.key, None)

    class _FakeAzContainerClient:
        def __init__(self, container: str):
            self.container = container

        def list_blobs(self, name_starts_with: str = ""):
            out = []
            for (c, path), meta in list(store_objs.items()):
                if c == self.container and path.startswith(name_starts_with):
                    out.append(types.SimpleNamespace(
                        name=path,
                        creation_time=meta["created_at"],
                        last_modified=meta["created_at"],
                    ))
            return out

    class _FakeBlobServiceClient:
        def __init__(self, account_url: str, credential=None):
            self.account_name = account_url.split("//", 1)[1].split(".")[0]
            self.credential = types.SimpleNamespace(account_key="fake-key")

        @classmethod
        def from_connection_string(cls, conn: str):
            return cls("https://fakeacct.blob.core.windows.net")

        def create_container(self, name: str):
            pass

        def get_blob_client(self, container: str, path: str):
            return _FakeAzBlobClient(container, path)

        def get_container_client(self, container: str):
            return _FakeAzContainerClient(container)

        def get_user_delegation_key(self, **kwargs):
            return "fake-udk"

    az_blob_mod.BlobServiceClient = _FakeBlobServiceClient
    az_blob_mod.BlobSasPermissions = lambda **kw: kw
    az_blob_mod.generate_blob_sas = lambda **kw: (
        f"sig=azfake&cd={kw.get('content_disposition', '')}"
    )

    az_kv = types.ModuleType("azure.keyvault")
    az_kv_keys = types.ModuleType("azure.keyvault.keys")
    az_kv_crypto = types.ModuleType("azure.keyvault.keys.crypto")
    az_kv_sec = types.ModuleType("azure.keyvault.secrets")

    class _FakeKeyClient:
        def __init__(self, vault_url: str, credential=None):
            self.vault_url = vault_url.rstrip("/")

        def get_key(self, name: str, version: str | None = None):
            ver = version or "v1"
            return types.SimpleNamespace(id=f"{self.vault_url}/keys/{name}/{ver}")

    class _FakeCryptoClient:
        def __init__(self, key, credential=None):
            self.key = key

        def wrap_key(self, alg, cek: bytes):
            ct = priv.public_key().encrypt(
                cek,
                padding.OAEP(
                    mgf=padding.MGF1(hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return types.SimpleNamespace(encrypted_key=ct)

        def unwrap_key(self, alg, wrapped: bytes):
            pt = priv.decrypt(
                wrapped,
                padding.OAEP(
                    mgf=padding.MGF1(hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return types.SimpleNamespace(key=pt)

    class _FakeSecretClient:
        def __init__(self, vault_url: str, credential=None):
            self.vault_url = vault_url

        def set_secret(self, name: str, val: str):
            entry = store_secrets.get(name)
            if entry and entry.get("deleted"):
                raise RuntimeError("Conflict: Secret is currently deleted")
            store_secrets[name] = {"value": val, "deleted": False}

        def begin_recover_deleted_secret(self, name: str):
            if name in store_secrets:
                store_secrets[name]["deleted"] = False
            return types.SimpleNamespace(wait=lambda: None)

        def begin_delete_secret(self, name: str):
            if name in store_secrets:
                store_secrets[name]["deleted"] = True
            return types.SimpleNamespace(wait=lambda: None)

    az_kv_keys.KeyClient = _FakeKeyClient
    az_kv_crypto.CryptographyClient = _FakeCryptoClient
    az_kv_crypto.KeyWrapAlgorithm = types.SimpleNamespace(rsa_oaep_256="RSA-OAEP-256")
    az_kv_sec.SecretClient = _FakeSecretClient

    # --- AWS boto3 / botocore ---
    boto3_mod = types.ModuleType("boto3")
    botocore_mod = types.ModuleType("botocore")
    botocore_cfg = types.ModuleType("botocore.config")
    botocore_cfg.Config = lambda **kw: kw

    class _FakeS3Client:
        def __init__(self, endpoint_url: str | None = None, **kw):
            self.endpoint_url = endpoint_url or "https://s3.us-east-1.amazonaws.com"

        def generate_presigned_url(self, op: str, Params: dict, ExpiresIn: int):
            base = self.endpoint_url.rstrip("/")
            disp = Params.get("ResponseContentDisposition", "")
            return f"{base}/{Params['Bucket']}/{Params['Key']}?op={op}&exp={ExpiresIn}&cd={disp}"

        def head_object(self, Bucket: str, Key: str):
            if (Bucket, Key) not in store_objs:
                raise KeyError("404")
            return {"ContentLength": len(store_objs[(Bucket, Key)]["data"])}

        def put_object(self, Bucket: str, Key: str, Body: bytes):
            store_objs[(Bucket, Key)] = {
                "data": Body,
                "created_at": datetime.now(timezone.utc),
            }

        def get_object(self, Bucket: str, Key: str):
            data = store_objs[(Bucket, Key)]["data"]
            return {"Body": types.SimpleNamespace(read=lambda: data)}

        def delete_object(self, Bucket: str, Key: str):
            store_objs.pop((Bucket, Key), None)

        def list_objects_v2(self, Bucket: str, Prefix: str = "", **kw):
            items = [
                {"Key": k, "LastModified": v["created_at"]}
                for (b, k), v in list(store_objs.items())
                if b == Bucket and k.startswith(Prefix)
            ]
            return {"Contents": items, "IsTruncated": False}

    class _FakeKmsClient:
        def encrypt(self, KeyId: str, Plaintext: bytes, EncryptionAlgorithm: str):
            ct = priv.public_key().encrypt(
                Plaintext,
                padding.OAEP(
                    mgf=padding.MGF1(hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return {"CiphertextBlob": ct, "KeyId": KeyId}

        def decrypt(self, KeyId: str, CiphertextBlob: bytes, EncryptionAlgorithm: str):
            pt = priv.decrypt(
                CiphertextBlob,
                padding.OAEP(
                    mgf=padding.MGF1(hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return {"Plaintext": pt}

    class _FakeSmClient:
        def put_secret_value(self, SecretId: str, SecretString: str):
            entry = store_secrets.get(SecretId)
            if entry is None:
                raise RuntimeError("ResourceNotFoundException: not found")
            if entry.get("deleted"):
                raise RuntimeError("InvalidRequestException: scheduled for deletion")
            entry["value"] = SecretString

        def create_secret(self, Name: str, SecretString: str):
            store_secrets[Name] = {"value": SecretString, "deleted": False}

        def restore_secret(self, SecretId: str):
            store_secrets[SecretId]["deleted"] = False

        def delete_secret(self, SecretId: str, **kw):
            if SecretId in store_secrets:
                store_secrets[SecretId]["deleted"] = True

    def _boto_client(service: str, **kw):
        if service == "s3":
            return _FakeS3Client(**kw)
        if service == "kms":
            return _FakeKmsClient()
        if service == "secretsmanager":
            return _FakeSmClient()
        raise ValueError(service)

    boto3_mod.client = _boto_client

    # --- Google Cloud ---
    google_mod = types.ModuleType("google")
    gcloud_mod = types.ModuleType("google.cloud")
    gcs_mod = types.ModuleType("google.cloud.storage")
    gkms_mod = types.ModuleType("google.cloud.kms_v1")
    gsm_mod = types.ModuleType("google.cloud.secretmanager")

    class _FakeGcsBlob:
        def __init__(self, bucket: str, name: str):
            self.bucket = bucket
            self.name = name
            self.size = None

        def generate_signed_url(self, version: str, expiration, method: str, **kw):
            disp = kw.get("response_disposition", "")
            return f"https://storage.googleapis.com/{self.bucket}/{self.name}?X-Goog-Algorithm=GOOG4&method={method}&cd={disp}"

        def exists(self) -> bool:
            return (self.bucket, self.name) in store_objs

        def reload(self):
            if (self.bucket, self.name) not in store_objs:
                raise KeyError("404")
            self.size = len(store_objs[(self.bucket, self.name)]["data"])

        def upload_from_string(self, data: bytes):
            store_objs[(self.bucket, self.name)] = {
                "data": data,
                "created_at": datetime.now(timezone.utc),
            }

        def download_as_bytes(self) -> bytes:
            return store_objs[(self.bucket, self.name)]["data"]

        def delete(self):
            store_objs.pop((self.bucket, self.name), None)

    class _FakeGcsBucket:
        def __init__(self, name: str):
            self.name = name

        def blob(self, blob_path: str):
            return _FakeGcsBlob(self.name, blob_path)

    class _FakeGcsClient:
        def __init__(self, project=None):
            self.project = project
            self._credentials = types.SimpleNamespace(signer=object())

        def bucket(self, name: str):
            return _FakeGcsBucket(name)

        def list_blobs(self, bucket, prefix: str = ""):
            bname = bucket.name if hasattr(bucket, "name") else str(bucket)
            return [
                types.SimpleNamespace(
                    name=k,
                    time_created=v["created_at"],
                    updated=v["created_at"],
                )
                for (b, k), v in list(store_objs.items())
                if b == bname and k.startswith(prefix)
            ]

    gcs_mod.Client = _FakeGcsClient

    class _FakeGcpKmsClient:
        def get_public_key(self, request: dict):
            return types.SimpleNamespace(pem=pub_pem)

        def asymmetric_decrypt(self, request: dict):
            pt = priv.decrypt(
                request["ciphertext"],
                padding.OAEP(
                    mgf=padding.MGF1(hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return types.SimpleNamespace(plaintext=pt)

    gkms_mod.KeyManagementServiceClient = _FakeGcpKmsClient

    class _FakeGcpSmClient:
        def get_secret(self, request: dict):
            if request["name"] not in store_secrets:
                raise KeyError("NotFound")
            return types.SimpleNamespace(name=request["name"])

        def create_secret(self, request: dict):
            path = f"{request['parent']}/secrets/{request['secret_id']}"
            store_secrets[path] = {"versions": [], "deleted": False}
            return types.SimpleNamespace(name=path)

        def add_secret_version(self, request: dict):
            path = request["parent"]
            ver_num = len(store_secrets[path]["versions"]) + 1
            ver_name = f"{path}/versions/{ver_num}"
            store_secrets[path]["versions"].append(
                types.SimpleNamespace(
                    name=ver_name,
                    state="ENABLED",
                    data=request["payload"]["data"],
                )
            )
            return types.SimpleNamespace(name=ver_name)

        def list_secret_versions(self, request: dict):
            return list(store_secrets[request["parent"]]["versions"])

        def destroy_secret_version(self, request: dict):
            for entry in store_secrets.values():
                for v in entry.get("versions", []):
                    if v.name == request["name"]:
                        v.state = "DESTROYED"

        def delete_secret(self, request: dict):
            store_secrets.pop(request["name"], None)

    gsm_mod.SecretManagerServiceClient = _FakeGcpSmClient

    gcloud_mod.storage = gcs_mod
    gcloud_mod.kms_v1 = gkms_mod
    gcloud_mod.secretmanager = gsm_mod
    google_mod.cloud = gcloud_mod

    for name, mod in {
        "azure": az_pkg,
        "azure.identity": az_id,
        "azure.storage": az_st,
        "azure.storage.blob": az_blob_mod,
        "azure.keyvault": az_kv,
        "azure.keyvault.keys": az_kv_keys,
        "azure.keyvault.keys.crypto": az_kv_crypto,
        "azure.keyvault.secrets": az_kv_sec,
        "boto3": boto3_mod,
        "botocore": botocore_mod,
        "botocore.config": botocore_cfg,
        "google": google_mod,
        "google.cloud": gcloud_mod,
        "google.cloud.storage": gcs_mod,
        "google.cloud.kms_v1": gkms_mod,
        "google.cloud.secretmanager": gsm_mod,
    }.items():
        monkeypatch.setitem(sys.modules, name, mod)


@pytest.fixture
def fake_clouds(monkeypatch):
    objs: dict = {}
    secrets: dict = {}
    _instalar_fakes_cloud(monkeypatch, objs, secrets)
    yield objs, secrets
    storage.reset_storage()
    crypto.reset_wrapper()
    integraciones.reset_secret_writer()


@pytest.mark.parametrize("backend", ["local", "azure", "aws", "s3", "gcp"])
def test_storage_contract_multicloud(backend, fake_clouds, tmp_path, monkeypatch):
    objs, _ = fake_clouds
    storage.reset_storage()

    monkeypatch.setattr(settings, "storage_backend", backend)
    monkeypatch.setattr(settings, "storage_dir", str(tmp_path / "uploads"))
    monkeypatch.setattr(settings, "azure_storage_account", "acredittiablobs")
    monkeypatch.setattr(settings, "azure_blob_container", "docs")
    monkeypatch.setattr(settings, "aws_region", "us-east-1")
    monkeypatch.setattr(settings, "s3_bucket", "acredittia-docs")
    monkeypatch.setattr(settings, "s3_endpoint_url", "http://minio:9000" if backend == "s3" else "")
    monkeypatch.setattr(settings, "s3_public_endpoint_url", "https://files.acredittia.cl" if backend == "s3" else "")
    monkeypatch.setattr(settings, "gcp_project_id", "acredittia-prod")
    monkeypatch.setattr(settings, "gcp_storage_bucket", "acredittia-gcp")

    st = storage.get_storage()
    path = "c1/sujeto/s1/d1/file.pdf"
    payload = b"%PDF-1.4\nhello"

    assert not st.exists(path)
    st.save(path, payload)
    assert st.exists(path)
    assert st.size(path) == len(payload)
    assert st.read(path) == payload

    up = st.upload_url(path, "application/pdf")
    assert up.blob_path == path
    assert up.expires_at > datetime.now(timezone.utc)
    assert up.headers["Content-Type"] == "application/pdf"
    if backend == "azure":
        assert up.headers.get("x-ms-blob-type") == "BlockBlob"
    else:
        assert "x-ms-blob-type" not in up.headers
    if backend == "s3":
        assert urlparse(up.upload_url).netloc == "files.acredittia.cl"

    dl = st.download_url(path, 'acta"\r\n_evil.pdf')
    assert dl.expires_at > datetime.now(timezone.utc)
    assert "\r" not in dl.download_url and "\n" not in dl.download_url

    st.delete(path)
    assert not st.exists(path)
    assert st.size(path) is None
    st.delete(path)  # idempotente


@pytest.mark.parametrize("backend", ["local", "azure", "aws", "s3", "gcp"])
def test_purgar_temporales_multicloud(backend, fake_clouds, tmp_path, monkeypatch):
    objs, _ = fake_clouds
    storage.reset_storage()

    monkeypatch.setattr(settings, "storage_backend", backend)
    monkeypatch.setattr(settings, "storage_dir", str(tmp_path / "uploads"))
    monkeypatch.setattr(settings, "azure_storage_account", "acredittiablobs")
    monkeypatch.setattr(settings, "azure_blob_container", "docs")
    monkeypatch.setattr(settings, "aws_region", "us-east-1")
    monkeypatch.setattr(settings, "s3_bucket", "docs")
    monkeypatch.setattr(settings, "s3_endpoint_url", "http://minio:9000" if backend == "s3" else "")
    monkeypatch.setattr(settings, "s3_public_endpoint_url", "")
    monkeypatch.setattr(settings, "gcp_storage_bucket", "docs")

    st = storage.get_storage()
    st.save("tmp/c1/viejo.pdf", b"old")
    st.save("tmp/c1/nuevo.pdf", b"new")
    st.save("c1/doc/permanente.pdf", b"keep")

    hace_30h = datetime.now(timezone.utc) - timedelta(hours=30)
    if backend == "local":
        viejo_fs = st._full("tmp/c1/viejo.pdf")
        os.utime(viejo_fs, (hace_30h.timestamp(), hace_30h.timestamp()))
    else:
        for key, meta in objs.items():
            if key[1] == "tmp/c1/viejo.pdf":
                meta["created_at"] = hace_30h

    borrados = purgar_temporales(horas=24)
    assert borrados == 1
    assert not st.exists("tmp/c1/viejo.pdf")
    assert st.exists("tmp/c1/nuevo.pdf")
    assert st.exists("c1/doc/permanente.pdf")


def test_local_storage_rechaza_traversal_directorio_hermano(tmp_path):
    base = tmp_path / "uploads"
    hermano = tmp_path / "uploads_evil"
    hermano.mkdir()
    st = storage.LocalStorage(str(base))
    with pytest.raises(ValueError, match="Ruta inválida"):
        st._full("../uploads_evil/secret.txt")


@pytest.mark.parametrize("backend, prefijo_kid", [
    ("local", "local://"),
    ("azure", "https://acredittia-kv.vault.azure.net/keys/"),
    ("aws", "awskms://arn:aws:kms:us-east-1:123456789012:key/"),
    ("gcp", "gcpkms://projects/p1/locations/global/keyRings/r1/cryptoKeys/k1/cryptoKeyVersions/"),
])
def test_keywrapper_jwe_contract_multicloud(backend, prefijo_kid, fake_clouds, tmp_path, monkeypatch):
    crypto.reset_wrapper()
    monkeypatch.setattr(settings, "jwe_backend", backend)
    monkeypatch.setattr(settings, "keys_dir", str(tmp_path / "keys"))
    monkeypatch.setattr(settings, "azure_keyvault_url", "https://acredittia-kv.vault.azure.net/")
    monkeypatch.setattr(settings, "keyvault_key_name", "plataforma-cred")
    monkeypatch.setattr(settings, "aws_region", "us-east-1")
    monkeypatch.setattr(settings, "aws_kms_key_id", "arn:aws:kms:us-east-1:123456789012:key/k-1")
    monkeypatch.setattr(settings, "gcp_kms_key_name", "projects/p1/locations/global/keyRings/r1/cryptoKeys/k1")

    jwe, kid, _exp = crypto.cifrar_credencial(
        credencial_id="cred-1",
        company_id="comp-1",
        contrato_id="ctr-1",
        plataforma="SIGA",
        usuario="jperez",
        password="Secr3t-Password!",
    )
    assert jwe.count(".") == 4
    assert kid.startswith(prefijo_kid), kid

    payload = crypto.descifrar_credencial(
        jwe, esperado_sub="cred-1", esperado_cid="comp-1", esperado_ctr="ctr-1"
    )
    assert payload["pwd"] == "Secr3t-Password!"
    assert payload["usr"] == "jperez"


def test_keywrapper_rechaza_kid_de_otro_dominio_o_cuenta(fake_clouds, monkeypatch):
    crypto.reset_wrapper()
    monkeypatch.setattr(settings, "jwe_backend", "azure")
    monkeypatch.setattr(settings, "azure_keyvault_url", "https://acredittia-kv.vault.azure.net/")
    w_az = crypto.get_wrapper()
    with pytest.raises(crypto.CredencialError, match="fuera del dominio"):
        w_az.unwrap(b"abc", "https://attacker-kv.vault.azure.net/keys/k/v1")

    crypto.reset_wrapper()
    monkeypatch.setattr(settings, "jwe_backend", "aws")
    monkeypatch.setattr(settings, "aws_kms_key_id", "arn:aws:kms:us-east-1:111111111111:key/k1")
    w_aws = crypto.get_wrapper()
    with pytest.raises(crypto.CredencialError, match="no coincide"):
        w_aws.unwrap(b"abc", "awskms://arn:aws:kms:us-east-1:999999999999:key/evil")

    crypto.reset_wrapper()
    monkeypatch.setattr(settings, "jwe_backend", "gcp")
    monkeypatch.setattr(settings, "gcp_kms_key_name", "projects/p1/locations/global/keyRings/r1/cryptoKeys/k1")
    w_gcp = crypto.get_wrapper()
    with pytest.raises(crypto.CredencialError, match="fuera de la clave"):
        w_gcp.unwrap(b"abc", "gcpkms://projects/evil/locations/global/keyRings/r/cryptoKeys/k/cryptoKeyVersions/1")


@pytest.mark.parametrize("backend", ["local", "azure", "aws", "gcp"])
def test_secret_writer_multicloud_y_soft_delete(backend, fake_clouds, tmp_path, monkeypatch):
    _, secrets = fake_clouds
    integraciones.reset_secret_writer()

    monkeypatch.setattr(settings, "secret_backend", backend)
    monkeypatch.setattr(settings, "keys_dir", str(tmp_path / "keys"))
    monkeypatch.setattr(settings, "azure_keyvault_url", "https://acredittia-kv.vault.azure.net/")
    monkeypatch.setattr(settings, "aws_region", "us-east-1")
    monkeypatch.setattr(settings, "aws_secrets_prefix", "acredittia")
    monkeypatch.setattr(settings, "gcp_project_id", "acredittia-prod")

    writer = integraciones.get_secret_writer()
    ref = "kv://11111111-1111-1111-1111-111111111111/siga"
    writer.write(ref, {"usr": "a", "pwd": "1"})
    writer.write(ref, {"usr": "a", "pwd": "2"})

    if backend == "gcp":
        path = "projects/acredittia-prod/secrets/" + integraciones.nombre_secreto(ref)
        vers = secrets[path]["versions"]
        assert len(vers) == 2
        assert vers[0].state == "DESTROYED"
        assert vers[1].state == "ENABLED"

    # Borrar y volver a escribir (recuperación automática de soft-delete en Azure/AWS)
    writer.delete(ref)
    writer.write(ref, {"usr": "a", "pwd": "3"})
    writer.delete("kv://no-existe/siga")
