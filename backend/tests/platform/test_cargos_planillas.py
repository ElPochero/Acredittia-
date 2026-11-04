"""Tests para Cargos y Planillas Reutilizables de Contratos (Día 9, H-33, H-41, Puntos 16 y 17)."""
from __future__ import annotations

import uuid
from datetime import date
import pytest

from app.database import worker_session
from app.models import Cargo, Contrato, ContratoPlantillaOverride, ContratoRequisito, Documento, RequisitoTemplate
from tests.conftest import API, crear_contrato


def test_catalogo_cargos_base_solo_lectura(app_cliente, empresa_a):
    """Los cargos base de Acredittia (company_id IS NULL) no se pueden editar ni borrar por una empresa."""
    with worker_session(is_admin=True) as s:
        cargo_global = s.query(Cargo).filter(Cargo.company_id.is_(None)).first()
        if not cargo_global:
            cargo_global = Cargo(
                company_id=None,
                nombre=f"Conductor Minería Base {uuid.uuid4().hex[:6]}",
                nombre_normalizado=f"conductor mineria base {uuid.uuid4().hex[:6]}",
                categoria="conduccion",
                requiere_emsipor=True,
                activo=True
            )
            s.add(cargo_global)
            s.commit()
            cargo_id = str(cargo_global.id)
        else:
            cargo_id = str(cargo_global.id)

    # 1. Obtener lista de cargos
    r = app_cliente.get(f"{API}/cargos", headers=empresa_a["headers"])
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    encontrado = next((c for c in items if c["id"] == cargo_id), None)
    assert encontrado is not None
    assert encontrado["es_global"] is True

    # 2. Intentar editar el cargo base con el usuario empresa -> Debe rechazar con 403 CARGO_GLOBAL
    r_edit = app_cliente.patch(
        f"{API}/cargos/{cargo_id}",
        headers=empresa_a["headers"],
        json={"nombre": "Nombre Alterado"}
    )
    assert r_edit.status_code == 403
    assert r_edit.json().get("error", {}).get("code") == "CARGO_GLOBAL"

    # 3. Intentar borrar el cargo base con el usuario empresa -> 403
    r_del = app_cliente.delete(
        f"{API}/cargos/{cargo_id}",
        headers=empresa_a["headers"]
    )
    assert r_del.status_code == 403


def test_crear_y_editar_cargo_propio(app_cliente, empresa_a):
    """Una empresa puede crear su propio cargo, editarlo y alternar su estado activo."""
    nombre = f"Operador Especializado {uuid.uuid4().hex[:6]}"
    r_crear = app_cliente.post(
        f"{API}/cargos",
        headers=empresa_a["headers"],
        json={
            "nombre": nombre,
            "categoria": "operacion",
            "requiere_emsipor": True,
            "requisitos": []
        }
    )
    assert r_crear.status_code == 201, r_crear.text
    cargo = r_crear.json()
    assert cargo["nombre"] == nombre
    assert cargo["categoria"] == "operacion"
    assert cargo["requiere_emsipor"] is True
    assert cargo["es_global"] is False

    # Editar el cargo propio
    nuevo_nombre = f"{nombre} Modificado"
    r_patch = app_cliente.patch(
        f"{API}/cargos/{cargo['id']}",
        headers=empresa_a["headers"],
        json={"nombre": nuevo_nombre, "categoria": "mantencion"}
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["nombre"] == nuevo_nombre
    assert r_patch.json()["categoria"] == "mantencion"


def test_instanciar_contrato_desde_planilla(app_cliente, empresa_a, faena_pelambres):
    """Crear un contrato indicando plantilla_contrato_id clona overrides y custom requisitos y crea docs."""
    # 1. Crear contrato fuente (que servirá de planilla)
    c_fuente = crear_contrato(app_cliente, empresa_a, faena_pelambres["id"],
                              nombre="Contrato Matriz Planilla", codigo=f"MATRIZ-{uuid.uuid4().hex[:4]}")
    cid_fuente = c_fuente["id"]

    # Añadir un requisito custom al contrato fuente
    r_req = app_cliente.post(
        f"{API}/contratos/{cid_fuente}/requisitos",
        headers=empresa_a["headers"],
        json={
            "ambito": "empresa",
            "titulo": "Certificado Especial de Faena",
            "obligatorio": True,
            "vinculo_tipo": "otro"
        }
    )
    assert r_req.status_code == 201, r_req.text

    # 2. Consultar plantillas disponibles
    r_plantillas = app_cliente.get(
        f"{API}/contratos/plantillas-disponibles",
        headers=empresa_a["headers"]
    )
    assert r_plantillas.status_code == 200
    items_p = r_plantillas.json()["items"]
    encontrado = next((p for p in items_p if p["id"] == cid_fuente), None)
    assert encontrado is not None
    assert encontrado["total_requisitos"] > 0

    # 3. Consultar resumen de la planilla
    r_resumen = app_cliente.get(
        f"{API}/contratos/{cid_fuente}/plantilla-resumen",
        headers=empresa_a["headers"]
    )
    assert r_resumen.status_code == 200
    res_json = r_resumen.json()
    assert "requisitos_por_ambito" in res_json

    # 4. Crear nuevo contrato desde la planilla
    codigo_nuevo = f"CLON-{uuid.uuid4().hex[:4]}"
    r_clon = app_cliente.post(
        f"{API}/contratos",
        headers=empresa_a["headers"],
        json={
            "nombre": "Contrato Derivado de Planilla",
            "codigo": codigo_nuevo,
            "faena_id": faena_pelambres["id"],
            "plantilla_contrato_id": cid_fuente
        }
    )
    assert r_clon.status_code == 201, r_clon.text
    clon = r_clon.json()
    cid_clon = clon["id"]
    assert clon["documentos_creados"] > 0

    # 5. Verificar que el clon heredó el requisito custom vía API
    r_reqs_clon = app_cliente.get(
        f"{API}/contratos/{cid_clon}/requisitos?page_size=100",
        headers=empresa_a["headers"]
    )
    assert r_reqs_clon.status_code == 200
    titulos = [item["titulo"] for item in r_reqs_clon.json()["items"]]
    assert "Certificado Especial de Faena" in titulos
