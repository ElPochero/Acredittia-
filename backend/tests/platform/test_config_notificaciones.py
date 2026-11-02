"""Pruebas de Configuración, Perfil de Usuario, Empresa, Preferencias de Notificación
e Integraciones (Slice 3 - Día 9).
"""

from tests.conftest import API


def test_actualizar_perfil_usuario(app_cliente, empresa_a):
    """El usuario puede actualizar su nombre y datos de perfil mediante PATCH /auth/me."""
    nuevo_nombre = "Administrador Alfa Actualizado"
    r = app_cliente.patch(
        f"{API}/auth/me",
        headers=empresa_a["headers"],
        json={"nombre": nuevo_nombre},
    )
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["nombre"] == nuevo_nombre

    # Verificar que persiste en GET /auth/me
    r_me = app_cliente.get(f"{API}/auth/me", headers=empresa_a["headers"])
    assert r_me.status_code == 200
    assert r_me.json()["nombre"] == nuevo_nombre


def test_actualizar_datos_empresa(app_cliente, empresa_a):
    """El rol company puede actualizar el nombre y email de contacto de su empresa."""
    nuevo_nombre_empresa = "Transportes Alfa Norte SpA"
    nuevo_email_contacto = "contacto@alfanorte.cl"

    r = app_cliente.patch(
        f"{API}/company",
        headers=empresa_a["headers"],
        json={"nombre": nuevo_nombre_empresa, "email": nuevo_email_contacto},
    )
    assert r.status_code == 200, r.text
    empresa = r.json()
    assert empresa["nombre"] == nuevo_nombre_empresa
    assert empresa["email"] == nuevo_email_contacto
    # El RUT debe permanecer inmutable (mayúscula/minúscula normalizado)
    assert empresa["rut"].upper() == empresa_a["rut"].upper()


def test_notificaciones_preferencias_upsert(app_cliente, empresa_a):
    """La empresa puede consultar y configurar la matriz de preferencias de notificación."""
    # 1. Consultar estado inicial
    r_get = app_cliente.get(
        f"{API}/notificaciones/preferencias",
        headers=empresa_a["headers"],
    )
    assert r_get.status_code == 200, r_get.text
    data_inicial = r_get.json()
    assert "eventos" in data_inicial
    assert len(data_inicial["eventos"]) > 0

    # 2. Configurar preferencia específica (upsert)
    evento_test = "vencimiento_30"
    r_patch = app_cliente.patch(
        f"{API}/notificaciones/preferencias",
        headers=empresa_a["headers"],
        json={
            "preferencias": [
                {
                    "evento": evento_test,
                    "canal_email": True,
                    "canal_whatsapp": False,
                }
            ]
        },
    )
    assert r_patch.status_code == 200, r_patch.text
    items_actualizados = r_patch.json().get("items", [])
    pref_doc = next((e for e in items_actualizados if e["evento"] == evento_test), None)
    assert pref_doc is not None
    assert pref_doc["canal_email"] is True
    assert pref_doc["canal_whatsapp"] is False


def test_integraciones_crear_y_alternar_estado(app_cliente, empresa_a):
    """Conectar una integración externa y alternar su estado entre desconectada y activa."""
    # 1. Crear integración con WorkMate (frecuencia daily)
    r_crear = app_cliente.post(
        f"{API}/integraciones",
        headers=empresa_a["headers"],
        json={
            "tipo": "workmate",
            "config": {"frecuencia": "daily"},
        },
    )
    assert r_crear.status_code == 201, r_crear.text
    integ = r_crear.json()
    assert integ["tipo"] == "workmate"
    assert integ["estado"] == "desconectada"
    assert integ["credenciales_ref"] is not None
    integ_id = integ["id"]

    # 2. Conectar/activar integración
    r_patch = app_cliente.patch(
        f"{API}/integraciones/{integ_id}",
        headers=empresa_a["headers"],
        json={"estado": "activa"},
    )
    assert r_patch.status_code == 200, r_patch.text
    assert r_patch.json()["estado"] == "activa"

    # 3. Listar integraciones y verificar que aparece en el listado
    r_listar = app_cliente.get(
        f"{API}/integraciones",
        headers=empresa_a["headers"],
    )
    assert r_listar.status_code == 200, r_listar.text
    items = r_listar.json()["items"]
    assert any(i["id"] == integ_id and i["estado"] == "activa" for i in items)
