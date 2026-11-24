"""Cifrado de credenciales de plataforma en JWE (§8.2 de la API, §4.8 del modelo).

Diseño:

* El secreto se envuelve en un **JWE compact** con `alg=RSA-OAEP-256` y
  `enc=A256GCM`. La CEK (clave de contenido, 256 bits aleatoria por credencial)
  se envuelve con la clave pública RSA; el payload se cifra con AES-GCM.
* La clave privada vive en un HSM/KMS gestionado (Azure Key Vault, AWS KMS o
  GCP Cloud KMS). La API solo envuelve la CEK y el worker la desenvuelve, de
  modo que la clave privada nunca entra en el proceso de la API.
* `aud = acredittia-platform-worker`: el token es inservible fuera del worker de
  integración. La API construye JWE pero **no** los descifra.

Backends (JWE_BACKEND):
  azure / keyvault  Azure Key Vault con DefaultAzureCredential
  aws               AWS KMS asimétrico (RSAES_OAEP_SHA_256)
  gcp               Google Cloud KMS asimétrico (RSA_DECRYPT_OAEP_3072_SHA256)
  local             par RSA en KEYS_DIR, generado al primer uso (solo dev/tests)

El payload descifrado nunca se serializa en logs ni en excepciones: los errores
reportan únicamente `kid` y `jti`.
"""
from __future__ import annotations

import base64
import json
import os
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ...config import settings

ISS = "acredittia-api"
AUD_WORKER = "acredittia-platform-worker"
ALG = "RSA-OAEP-256"
ENC = "A256GCM"


class CredencialError(Exception):
    """Error de cifrado o descifrado. Nunca incluye el secreto en el mensaje."""


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def b64u_dec(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


# --------------------------------------------------------------- KeyWrapper
class KeyWrapper(ABC):
    """Envuelve y desenvuelve la CEK. La clave privada nunca sale del backend."""

    @abstractmethod
    def wrap(self, cek: bytes) -> tuple[bytes, str]:
        """Devuelve (cek_envuelta, kid)."""

    @abstractmethod
    def unwrap(self, wrapped: bytes, kid: str) -> bytes:
        """Devuelve la CEK. Solo el worker debe invocarlo."""


class AzureKeyVaultWrapper(KeyWrapper):
    """wrapKey/unwrapKey delegados a Key Vault. La privada no sale del HSM."""

    def __init__(self, vault_url: str, key_name: str):
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.keys import KeyClient
        from azure.keyvault.keys.crypto import CryptographyClient

        self._cred = DefaultAzureCredential()
        self._vault_url = vault_url.rstrip("/")
        self._keys = KeyClient(vault_url=vault_url, credential=self._cred)
        self._key_name = key_name
        self._CryptographyClient = CryptographyClient
        self._cache: dict[str, object] = {}

    def _crypto_for(self, kid: str | None = None):
        raw_kid = kid[7:] if (kid and kid.startswith("azkv://")) else kid
        if raw_kid and raw_kid.startswith(("http://", "https://")):
            if not raw_kid.startswith(self._vault_url + "/"):
                raise CredencialError("kid de Key Vault fuera del dominio configurado")
        if raw_kid and raw_kid in self._cache:
            return self._cache[raw_kid], raw_kid
        key = self._keys.get_key(
            self._key_name, version=_version_de(raw_kid) if raw_kid else None
        )
        client = self._CryptographyClient(key, credential=self._cred)
        self._cache[key.id] = client
        return client, key.id

    def wrap(self, cek: bytes) -> tuple[bytes, str]:
        from azure.keyvault.keys.crypto import KeyWrapAlgorithm
        client, kid = self._crypto_for()
        res = client.wrap_key(KeyWrapAlgorithm.rsa_oaep_256, cek)
        return res.encrypted_key, kid

    def unwrap(self, wrapped: bytes, kid: str) -> bytes:
        from azure.keyvault.keys.crypto import KeyWrapAlgorithm
        client, _ = self._crypto_for(kid)
        return client.unwrap_key(KeyWrapAlgorithm.rsa_oaep_256, wrapped).key


def _version_de(kid: str | None) -> str | None:
    """Extrae la versión de un kid de Key Vault (…/keys/<nombre>/<version>)."""
    if not kid:
        return None
    partes = kid.rstrip("/").split("/")
    return partes[-1] if len(partes) >= 2 else None


class AwsKmsKeyWrapper(KeyWrapper):
    """wrap/unwrap delegados a AWS KMS asimétrico (RSAES_OAEP_SHA_256)."""

    def __init__(self, key_id: str, region: str = ""):
        import boto3

        self._key_id = key_id
        kw = {"region_name": region} if region else {}
        self._kms = boto3.client("kms", **kw)

    def _validar_kid(self, kid: str) -> str:
        target = kid[9:] if kid.startswith("awskms://") else kid
        if not target:
            raise CredencialError("kid AWS KMS vacío")
        if self._key_id.startswith("arn:"):
            if ":key/" in self._key_id:
                if target != self._key_id:
                    raise CredencialError("kid AWS KMS no coincide con la clave configurada")
            else:
                prefijo_cuenta = ":".join(self._key_id.split(":")[:5]) + ":"
                if not target.startswith(prefijo_cuenta):
                    raise CredencialError("kid AWS KMS fuera de la cuenta o región configurada")
        elif target.startswith("arn:") or target != self._key_id:
            if not target.endswith(f"/{self._key_id}") and target != self._key_id:
                raise CredencialError("kid AWS KMS no pertenece a la clave configurada")
        return target

    def wrap(self, cek: bytes) -> tuple[bytes, str]:
        res = self._kms.encrypt(
            KeyId=self._key_id,
            Plaintext=cek,
            EncryptionAlgorithm="RSAES_OAEP_SHA_256",
        )
        key_arn = res.get("KeyId") or self._key_id
        kid = key_arn if key_arn.startswith("awskms://") else f"awskms://{key_arn}"
        return res["CiphertextBlob"], kid

    def unwrap(self, wrapped: bytes, kid: str) -> bytes:
        target = self._validar_kid(kid)
        res = self._kms.decrypt(
            KeyId=target,
            CiphertextBlob=wrapped,
            EncryptionAlgorithm="RSAES_OAEP_SHA_256",
        )
        return res["Plaintext"]


class GcpKmsKeyWrapper(KeyWrapper):
    """Envuelve en proceso con la pública de Cloud KMS y desenvuelve vía HSM."""

    def __init__(self, key_name: str):
        from google.cloud import kms_v1

        self._key_name = key_name.rstrip("/")
        self._base_key_name = self._key_name.split("/cryptoKeyVersions/")[0]
        self._client = kms_v1.KeyManagementServiceClient()
        self._pub_cache: dict[str, object] = {}

    def _version_activa(self) -> str:
        if "/cryptoKeyVersions/" in self._key_name:
            return self._key_name
        return f"{self._key_name}/cryptoKeyVersions/1"

    def wrap(self, cek: bytes) -> tuple[bytes, str]:
        ver = self._version_activa()
        if ver not in self._pub_cache:
            resp = self._client.get_public_key(request={"name": ver})
            self._pub_cache[ver] = serialization.load_pem_public_key(resp.pem.encode("utf-8"))
        pub = self._pub_cache[ver]
        wrapped = pub.encrypt(
            cek,
            padding.OAEP(
                mgf=padding.MGF1(hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        return wrapped, f"gcpkms://{ver}"

    def unwrap(self, wrapped: bytes, kid: str) -> bytes:
        ver = kid[9:] if kid.startswith("gcpkms://") else kid
        if not (ver == self._base_key_name or ver.startswith(self._base_key_name + "/cryptoKeyVersions/")):
            raise CredencialError("kid Cloud KMS fuera de la clave configurada")
        res = self._client.asymmetric_decrypt(
            request={"name": ver, "ciphertext": wrapped}
        )
        return res.plaintext


class LocalKeyWrapper(KeyWrapper):
    """Par RSA en disco. SOLO desarrollo y tests: la privada sí está en proceso."""

    def __init__(self, keys_dir: str, key_name: str = "plataforma-cred"):
        self.dir = keys_dir
        self.name = key_name
        os.makedirs(keys_dir, exist_ok=True)
        self._priv = self._cargar_o_crear()

    @property
    def _ruta(self) -> str:
        return os.path.join(self.dir, f"{self.name}.pem")

    def _cargar_o_crear(self):
        if os.path.exists(self._ruta):
            with open(self._ruta, "rb") as f:
                return serialization.load_pem_private_key(f.read(), password=None)
        priv = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        with open(self._ruta, "wb") as f:
            f.write(priv.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            ))
        os.chmod(self._ruta, 0o600)
        return priv

    @property
    def kid(self) -> str:
        return f"local://{self.name}/v1"

    def wrap(self, cek: bytes) -> tuple[bytes, str]:
        wrapped = self._priv.public_key().encrypt(
            cek,
            padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                         algorithm=hashes.SHA256(), label=None),
        )
        return wrapped, self.kid

    def unwrap(self, wrapped: bytes, kid: str) -> bytes:
        return self._priv.decrypt(
            wrapped,
            padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                         algorithm=hashes.SHA256(), label=None),
        )


_wrapper: KeyWrapper | None = None


def get_wrapper() -> KeyWrapper:
    global _wrapper
    if _wrapper is None:
        backend = settings.jwe_backend
        if backend in ("keyvault", "azure"):
            if not settings.azure_keyvault_url:
                raise CredencialError("AZURE_KEYVAULT_URL no configurada")
            _wrapper = AzureKeyVaultWrapper(
                settings.azure_keyvault_url, settings.keyvault_key_name)
        elif backend == "aws":
            if not settings.aws_kms_key_id:
                raise CredencialError("AWS_KMS_KEY_ID no configurada")
            _wrapper = AwsKmsKeyWrapper(settings.aws_kms_key_id, settings.aws_region)
        elif backend == "gcp":
            if not settings.gcp_kms_key_name:
                raise CredencialError("GCP_KMS_KEY_NAME no configurada")
            _wrapper = GcpKmsKeyWrapper(settings.gcp_kms_key_name)
        elif backend == "local":
            _wrapper = LocalKeyWrapper(settings.keys_dir, settings.keyvault_key_name)
        else:
            raise CredencialError(f"JWE_BACKEND no soportado: {backend}")
    return _wrapper


def reset_wrapper() -> None:
    """Para tests: fuerza la reconstrucción del wrapper."""
    global _wrapper
    _wrapper = None


# ------------------------------------------------------------------- JWE
def cifrar_credencial(
    *, credencial_id, company_id, contrato_id, plataforma: str,
    usuario: str, password: str, ttl_meses: int | None = None,
) -> tuple[str, str, datetime]:
    """Construye el JWE de una credencial.

    Devuelve (jwe_compact, kid, expira_at). El `password` no se conserva en
    ninguna estructura tras esta llamada.
    """
    ttl = ttl_meses or settings.credencial_ttl_meses
    ahora = datetime.now(timezone.utc)
    expira = ahora + timedelta(days=30 * ttl)

    cek = AESGCM.generate_key(bit_length=256)
    wrapped, kid = get_wrapper().wrap(cek)

    header = {"alg": ALG, "enc": ENC, "kid": kid, "typ": "JWT",
              "cty": "application/json"}
    payload = {
        "iss": ISS,
        "aud": AUD_WORKER,
        "sub": str(credencial_id),
        "cid": str(company_id),
        "ctr": str(contrato_id),
        "plt": plataforma,
        "usr": usuario,
        "pwd": password,
        "iat": int(ahora.timestamp()),
        "exp": int(expira.timestamp()),
        "jti": str(uuid.uuid4()),
    }

    protected = b64u(json.dumps(header, separators=(",", ":")).encode())
    iv = os.urandom(12)
    ct_tag = AESGCM(cek).encrypt(
        iv, json.dumps(payload, separators=(",", ":")).encode(),
        protected.encode("ascii"),      # AAD = header protegido
    )
    ct, tag = ct_tag[:-16], ct_tag[-16:]

    jwe = ".".join([protected, b64u(wrapped), b64u(iv), b64u(ct), b64u(tag)])
    return jwe, kid, expira


def descifrar_credencial(jwe: str, *, esperado_sub=None, esperado_cid=None,
                         esperado_ctr=None) -> dict:
    """Descifra un JWE. **Solo el worker de integración debe llamar a esto.**

    Valida iss, aud, exp y —si se indican— la coherencia de sub/cid/ctr con la
    fila de la base. Una discrepancia implica manipulación directa de la BD.
    """
    partes = jwe.split(".")
    if len(partes) != 5:
        raise CredencialError("JWE mal formado: se esperaban 5 partes")
    protected, wrapped_b64, iv_b64, ct_b64, tag_b64 = partes

    try:
        header = json.loads(b64u_dec(protected))
    except Exception:
        raise CredencialError("Header del JWE ilegible")

    if header.get("alg") != ALG or header.get("enc") != ENC:
        raise CredencialError(
            f"Algoritmos no permitidos (alg={header.get('alg')}, enc={header.get('enc')})")
    kid = header.get("kid")
    if not kid:
        raise CredencialError("JWE sin kid")

    try:
        cek = get_wrapper().unwrap(b64u_dec(wrapped_b64), kid)
        plano = AESGCM(cek).decrypt(
            b64u_dec(iv_b64),
            b64u_dec(ct_b64) + b64u_dec(tag_b64),
            protected.encode("ascii"),
        )
        payload = json.loads(plano)
    except CredencialError:
        raise
    except Exception:
        # Sin detalle del contenido: solo el kid, que no es sensible.
        raise CredencialError(f"No se pudo descifrar la credencial (kid={kid})")

    jti = payload.get("jti")
    if payload.get("iss") != ISS:
        raise CredencialError(f"Emisor inesperado (jti={jti})")
    if payload.get("aud") != AUD_WORKER:
        raise CredencialError(f"Audiencia inválida (jti={jti})")
    if payload.get("exp", 0) <= datetime.now(timezone.utc).timestamp():
        raise CredencialError(f"Credencial expirada (jti={jti})")
    for nombre, esperado, clave in (
        ("sub", esperado_sub, "sub"), ("cid", esperado_cid, "cid"),
        ("ctr", esperado_ctr, "ctr"),
    ):
        if esperado is not None and payload.get(clave) != str(esperado):
            raise CredencialError(
                f"El claim {nombre} no coincide con la fila almacenada (jti={jti})")
    return payload


def jti_de(jwe: str) -> str | None:
    """jti sin descifrar el payload: no es posible, así que devuelve None.

    Se conserva por simetría: el jti solo se conoce tras descifrar, y quien
    descifra (el worker) lo registra en `actividad`.
    """
    return None


JWE_REGEX = r"^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]*){4}$"
