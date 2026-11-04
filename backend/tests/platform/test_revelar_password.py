"""Pruebas para revelación de contraseña de credencial de plataforma.

Verifica que:
1. El endpoint `GET /contratos/{cid}/plataformas/{pid}/usuarios/{uid}/password`
   devuelve la contraseña desencriptada correctamente.
2. El endpoint alias `/credenciales/{uid}/password` funciona idéntico.
3. Se respeta el aislamiento multi-tenant: otra empresa recibe 404.
4. Tras rotar la contraseña, la nueva contraseña es la que se revela.
5. El SELECT directo de `credencial_jwe` sigue bloqueado por permisos (42501).
6. El listado estándar de usuarios jamás filtra la contraseña.
"""
from __future__ import annotations

import json
import pytest
import sqlalchemy as sa
import sqlalchemy.exc

from tests.conftest import API

PASSWORD = "Cl4v3-Del-Portal-2026!"


def _plataforma(cliente, empresa, contrato, nombre="PORTAL PRUEBA") -> str:
    r = cliente.post(f"{API}/contratos/{contrato['id']}/plataformas",
                     headers=empresa["headers"],
                     json={"nombre": nombre, "url": "https://siga.cl"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _credencial(cliente, empresa, contrato, pid, *, usuario="jperez",
                password=PASSWORD):
    return cliente.post(
        f"{API}/contratos/{contrato['id']}/plataformas/{pid}/usuarios",
        headers=empresa["headers"],
        json={"nombre": "Juan Pérez", "usuario": usuario, "password": password})


def test_revelar_password_exitoso(app_cliente, empresa_a, contrato_a):
    pid = _plataforma(app_cliente, empresa_a, contrato_a)
    r = _credencial(app_cliente, empresa_a, contrato_a, pid, password=PASSWORD)
    assert r.status_code == 201, r.text
    uid = r.json()["id"]

    # Endpoint estándar
    ruta = f"{API}/contratos/{contrato_a['id']}/plataformas/{pid}/usuarios/{uid}/password"
    r = app_cliente.get(ruta, headers=empresa_a["headers"])
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["password"] == PASSWORD

    # Endpoint alias
    ruta_alias = f"{API}/contratos/{contrato_a['id']}/plataformas/{pid}/credenciales/{uid}/password"
    r_alias = app_cliente.get(ruta_alias, headers=empresa_a["headers"])
    assert r_alias.status_code == 200, r_alias.text
    assert r_alias.json()["password"] == PASSWORD


def test_revelar_password_aislamiento_tenant(app_cliente, empresa_a, empresa_b, contrato_a):
    pid = _plataforma(app_cliente, empresa_a, contrato_a)
    r = _credencial(app_cliente, empresa_a, contrato_a, pid, password=PASSWORD)
    assert r.status_code == 201, r.text
    uid = r.json()["id"]

    # Empresa B intenta revelar la contraseña de Empresa A
    ruta = f"{API}/contratos/{contrato_a['id']}/plataformas/{pid}/usuarios/{uid}/password"
    r = app_cliente.get(ruta, headers=empresa_b["headers"])
    assert r.status_code == 404


def test_revelar_password_tras_rotacion(app_cliente, empresa_a, contrato_a):
    pid = _plataforma(app_cliente, empresa_a, contrato_a)
    r = _credencial(app_cliente, empresa_a, contrato_a, pid, password=PASSWORD)
    uid = r.json()["id"]

    nueva = "Segunda-Cl4ve-Rotada!"
    r_rot = app_cliente.post(
        f"{API}/contratos/{contrato_a['id']}/plataformas/{pid}/usuarios/{uid}/rotar",
        headers=empresa_a["headers"],
        json={"password": nueva}
    )
    assert r_rot.status_code == 200, r_rot.text

    # Revelar tras rotación
    ruta = f"{API}/contratos/{contrato_a['id']}/plataformas/{pid}/usuarios/{uid}/password"
    r_rev = app_cliente.get(ruta, headers=empresa_a["headers"])
    assert r_rev.status_code == 200, r_rev.text
    assert r_rev.json()["password"] == nueva


def test_listado_usuarios_no_filtra_password(app_cliente, empresa_a, contrato_a):
    pid = _plataforma(app_cliente, empresa_a, contrato_a)
    _credencial(app_cliente, empresa_a, contrato_a, pid, password=PASSWORD)

    ruta = f"{API}/contratos/{contrato_a['id']}/plataformas/{pid}/usuarios"
    r = app_cliente.get(ruta, headers=empresa_a["headers"])
    assert r.status_code == 200, r.text
    assert PASSWORD not in r.text
    assert "credencial_jwe" not in r.text
    items = r.json()["items"]
    assert len(items) > 0
    assert "password" not in items[0]


def test_select_directo_sigue_bloqueado(app_cliente, empresa_a, contrato_a):
    from app.database import SessionLocal, set_ctx

    set_ctx(is_admin=True)
    with SessionLocal() as db:
        with pytest.raises(sqlalchemy.exc.ProgrammingError) as exc:
            db.execute(sa.text("SELECT credencial_jwe FROM plataforma_credenciales"))
        assert "permission denied" in str(exc.value)
        db.rollback()
