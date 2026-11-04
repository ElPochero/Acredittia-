"""Pruebas para [Req 1]: endpoint síncrono rápido de reporte de estado del contrato."""
from __future__ import annotations

import time
import pytest
from tests.conftest import API, rut_valido, patente_valida


def test_reporte_estado_contrato_sincrono(app_cliente, empresa_a, contrato_a):
    h = empresa_a["headers"]
    cid = contrato_a["id"]

    # Agregar personal y equipo
    r_pers = app_cliente.post(
        f"{API}/personal",
        headers=h,
        json={
            "contrato_id": cid,
            "nombre": "Conductor Reporte",
            "rut": rut_valido(301),
            "cargo": "Chofer Camión",
            "es_conductor": True,
        },
    )
    assert r_pers.status_code == 201

    r_eq = app_cliente.post(
        f"{API}/equipos",
        headers=h,
        json={
            "contrato_id": cid,
            "patente": patente_valida(88),
            "tipo_equipo": "Camioneta",
            "marca": "Toyota",
            "modelo": "Hilux",
        },
    )
    assert r_eq.status_code == 201

    # Medir tiempo de respuesta del reporte de estado
    t0 = time.time()
    r = app_cliente.get(f"{API}/contratos/{cid}/reporte-estado", headers=h)
    delta = time.time() - t0

    assert r.status_code == 200, r.text
    assert delta < 2.0, f"Reporte de estado demoró {delta:.2f}s (debe ser < 2s)"

    data = r.json()
    assert "contrato" in data
    assert data["contrato"]["id"] == cid
    assert "kpis" in data
    assert "pct_global" in data["kpis"]
    assert "secciones" in data
    assert "empresa" in data["secciones"]
    assert "personal" in data["secciones"]
    assert "equipos" in data["secciones"]
    assert "licencias" in data["secciones"]
    assert "arranque" in data["secciones"]
    assert "vencimientos" in data["secciones"]

    # Verificar que el conductor esté en personal y licencias
    pers_names = [p["nombre"] for p in data["secciones"]["personal"]]
    assert "Conductor Reporte" in pers_names
    lic_names = [l["nombre"] for l in data["secciones"]["licencias"]]
    assert "Conductor Reporte" in lic_names

    # Verificar equipo
    eq_patentes = [e["patente"] for e in data["secciones"]["equipos"]]
    assert patente_valida(88) in eq_patentes
