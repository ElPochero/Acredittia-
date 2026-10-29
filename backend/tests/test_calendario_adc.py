"""Pruebas del Calendario ADC: agendamientos manuales, proyección de vencimientos
y aislamiento de scope por contrato.
"""

import uuid
from datetime import date, timedelta

from app.models import Documento, RequisitoTemplate, Sujeto
from tests.conftest import API, crear_contract_admin, crear_contrato, rut_valido


def test_post_vencimiento_rechazado_400(app_cliente, empresa_a):
    """'vencimiento' es proyectada al vuelo desde documentos.vence: POST debe fallar."""
    r = app_cliente.post(
        f"{API}/calendario/eventos",
        headers=empresa_a["headers"],
        json={
            "titulo": "Vencimiento manual prohibido",
            "categoria": "vencimiento",
            "fecha": date.today().isoformat(),
        },
    )
    assert r.status_code == 400, r.text
    assert r.json().get("error", {}).get("code") == "CATEGORIA_RESERVADA"


def test_categoria_invalida_rechazada_400(app_cliente, empresa_a):
    """Categorías no permitidas se rechazan con 400 CATEGORIA_INVALIDA."""
    r = app_cliente.post(
        f"{API}/calendario/eventos",
        headers=empresa_a["headers"],
        json={
            "titulo": "Evento inválido",
            "categoria": "categoria_inexistente",
            "fecha": date.today().isoformat(),
        },
    )
    assert r.status_code == 400, r.text
    assert r.json().get("error", {}).get("code") == "CATEGORIA_INVALIDA"


def test_crud_eventos_manuales_y_adc(app_cliente, empresa_a, contrato_a):
    """El Administrador de Contrato (ADC) puede agendar, editar y eliminar eventos manuales."""
    jefe = crear_contract_admin(app_cliente, empresa_a, contrato_a["id"])

    hoy = date.today()
    fecha_evento = hoy + timedelta(days=5)

    # 1. Crear evento manual (POST)
    r = app_cliente.post(
        f"{API}/calendario/eventos",
        headers=jefe["headers"],
        json={
            "titulo": "Capacitación de Seguridad Minera",
            "categoria": "capacitacion",
            "fecha": fecha_evento.isoformat(),
            "descripcion": "Charla obligatoria de inducción Los Pelambres",
        },
    )
    assert r.status_code == 201, r.text
    evento = r.json()
    assert evento["id"] is not None
    assert evento["titulo"] == "Capacitación de Seguridad Minera"
    assert evento["categoria"] == "capacitacion"
    assert evento["editable"] is True
    evento_id = evento["id"]

    # 2. Listar eventos (GET) dentro del rango
    desde = hoy.isoformat()
    hasta = (hoy + timedelta(days=15)).isoformat()
    r = app_cliente.get(
        f"{API}/calendario?desde={desde}&hasta={hasta}&contrato_id={contrato_a['id']}",
        headers=jefe["headers"],
    )
    assert r.status_code == 200, r.text
    lista = r.json()["items"]
    encontrado = next((i for i in lista if i["id"] == evento_id), None)
    assert encontrado is not None
    assert encontrado["titulo"] == "Capacitación de Seguridad Minera"

    # 3. Editar evento (PATCH)
    r = app_cliente.patch(
        f"{API}/calendario/eventos/{evento_id}",
        headers=jefe["headers"],
        json={
            "titulo": "Capacitación de Seguridad Minera (Completada)",
            "completado": True,
        },
    )
    assert r.status_code == 200, r.text
    editado = r.json()
    assert editado["titulo"] == "Capacitación de Seguridad Minera (Completada)"
    assert editado["completado"] is True

    # 4. Eliminar evento (DELETE)
    r = app_cliente.delete(
        f"{API}/calendario/eventos/{evento_id}",
        headers=jefe["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # 5. Confirmar que ya no aparece en el listado
    r = app_cliente.get(
        f"{API}/calendario?desde={desde}&hasta={hasta}",
        headers=jefe["headers"],
    )
    assert r.status_code == 200
    lista_post = r.json()["items"]
    assert not any(i["id"] == evento_id for i in lista_post)


def test_adc_alcance_contrato_ajeno_403(app_cliente, empresa_a, contrato_a, faenas):
    """Un contract_admin no puede consultar el calendario filtrando por un contrato ajeno."""
    faena = next(f for f in faenas if f["nombre"] == "Los Pelambres")
    contrato_2 = crear_contrato(
        app_cliente, empresa_a, faena["id"], nombre="Segundo Contrato"
    )

    jefe = crear_contract_admin(app_cliente, empresa_a, contrato_a["id"])

    hoy = date.today()
    desde = hoy.isoformat()
    hasta = (hoy + timedelta(days=30)).isoformat()

    # Consulta de contrato ajeno -> 403 CONTRATO_AJENO
    r = app_cliente.get(
        f"{API}/calendario?desde={desde}&hasta={hasta}&contrato_id={contrato_2['id']}",
        headers=jefe["headers"],
    )
    assert r.status_code == 403, r.text
    assert r.json().get("error", {}).get("code") == "CONTRATO_AJENO"

    # Consulta con su propio contrato -> 200 OK
    r = app_cliente.get(
        f"{API}/calendario?desde={desde}&hasta={hasta}&contrato_id={contrato_a['id']}",
        headers=jefe["headers"],
    )
    assert r.status_code == 200, r.text


def test_vencimiento_proyectado_lectura(app_cliente, empresa_a, contrato_a, sesion_db):
    """Los documentos vigentes con fecha de vencimiento se proyectan con id=None y editable=False."""
    hoy = date.today()
    fecha_vence = hoy + timedelta(days=12)

    # Crear documento 'ok' con fecha de vencimiento
    cid = uuid.UUID(empresa_a["company_id"])
    contrato_id = uuid.UUID(contrato_a["id"])

    doc = Documento(
        company_id=cid,
        contrato_id=contrato_id,
        titulo="Póliza de Responsabilidad Civil Minera",
        estado="ok",
        vence=fecha_vence,
    )
    sesion_db.add(doc)
    sesion_db.commit()
    doc_id = str(doc.id)

    desde = hoy.isoformat()
    hasta = (hoy + timedelta(days=20)).isoformat()

    r = app_cliente.get(
        f"{API}/calendario?desde={desde}&hasta={hasta}&categoria=vencimiento",
        headers=empresa_a["headers"],
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    proyectado = next((i for i in items if i.get("documento_id") == doc_id), None)
    assert proyectado is not None
    assert proyectado["id"] is None
    assert proyectado["categoria"] == "vencimiento"
    assert proyectado["editable"] is False
    assert proyectado["fecha"] == fecha_vence.isoformat()
    assert proyectado["contrato"]["id"] == contrato_a["id"]
