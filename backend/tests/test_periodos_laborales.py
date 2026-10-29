"""Pruebas para el módulo de Certificación Laboral (Períodos Laborales)."""
from __future__ import annotations

import uuid
from datetime import date

from tests.conftest import API


def test_crud_periodos_laborales(app_cliente, empresa_a, contrato_a):
    headers = empresa_a["headers"]
    contrato_id = contrato_a["id"]

    # 1. Crear un periodo laboral
    payload = {
        "nombre": "Septiembre 2026",
        "tipo": "mensual",
        "fecha_inicio": "2026-09-01",
        "fecha_fin": "2026-09-30",
    }
    resp = app_cliente.post(
        f"{API}/contratos/{contrato_id}/periodos",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    datos = resp.json()
    periodo_id = datos["id"]
    assert datos["nombre"] == "Septiembre 2026"
    assert datos["estado"] == "abierto"

    # 2. Listar periodos
    resp = app_cliente.get(
        f"{API}/contratos/{contrato_id}/periodos",
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1

    # 3. Obtener detalle
    resp = app_cliente.get(
        f"{API}/periodos/{periodo_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == periodo_id

    # 4. Patch periodo
    patch_payload = {
        "estado": "en_revision",
    }
    resp = app_cliente.patch(
        f"{API}/periodos/{periodo_id}",
        json=patch_payload,
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["estado"] == "en_revision"

    # 5. Delete periodo
    resp = app_cliente.delete(
        f"{API}/periodos/{periodo_id}",
        headers=headers,
    )
    assert resp.status_code == 204

    # 6. Verificar que fue borrado
    resp = app_cliente.get(
        f"{API}/periodos/{periodo_id}",
        headers=headers,
    )
    assert resp.status_code == 404
