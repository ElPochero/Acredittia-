import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from .config import settings

pwd = PasswordHash.recommended()


def hash_password(plain: str) -> str:
    return pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(user_id: uuid.UUID, role: str, company_id: uuid.UUID | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "company_id": str(company_id) if company_id else None,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_ttl_min),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def new_refresh_token() -> tuple[str, str, datetime]:
    """Devuelve (token_en_claro, hash, expiración)."""
    raw = secrets.token_urlsafe(48)
    h = hashlib.sha256(raw.encode()).hexdigest()
    exp = datetime.now(timezone.utc) + timedelta(days=settings.refresh_ttl_days)
    return raw, h, exp


def hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def normalizar_rut(entrada: str) -> str | None:
    """Acepta `19.112.466-K`, `19112466-K` o `19112466K` y devuelve en formato
    canónico con puntos, o None si el formato o el dígito verificador no
    corresponden (Módulo 11).

    Es la única fuente de la escritura del RUT: los routers guardan el valor
    aquí devuelto para que la unicidad por empresa no dependa de cómo lo
    escribió el usuario. En el formato sin guión, 8 caracteres son cuerpo de 7
    + DV y 9 caracteres son cuerpo de 8 + DV.
    """
    import re
    raw = (entrada or "").strip().upper().replace(".", "").replace(" ", "")
    m = re.fullmatch(r"(\d{7,8})-?([\dK])", raw)
    if not m:
        return None
    cuerpo, dv = m.group(1), m.group(2)
    suma, factor = 0, 2
    for c in reversed(cuerpo):
        suma += int(c) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - (suma % 11)
    esperado = "0" if resto == 11 else "K" if resto == 10 else str(resto)
    if dv != esperado:
        return None
    return f"{cuerpo[:-6]}.{cuerpo[-6:-3]}.{cuerpo[-3:]}-{dv}"


def validar_rut(rut: str) -> bool:
    """True si el RUT es válido en cualquiera de los formatos aceptados."""
    return normalizar_rut(rut) is not None

