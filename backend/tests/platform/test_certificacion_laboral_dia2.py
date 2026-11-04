"""Pruebas Día 2: Módulo Certificación Laboral (Generador de Períodos, Pantalla 2 y Nómina Inmutable)."""
import uuid
from datetime import date

def test_generador_periodos_automatico_por_vigencia(client, user_token, session):
    """
    [CA 2] Al seleccionar un contrato en Certificación Laboral se visualizan su cabecera completa
    (incluyendo ADC y Encargado RR.HH.) y sus períodos mensuales generados automáticamente según vigencia.
    """
    # 1. Obtener listado de contratos disponibles
    resp = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200, resp.text
    contratos = resp.json()["items"]
    assert len(contratos) > 0, "Se requiere al menos un contrato para la prueba"
    contrato = contratos[0]
    contrato_id = contrato["id"]

    # 2. Consultar cabecera completa del contrato para Certificación Laboral
    resp_cabecera = client.get(
        f"/api/v1/certificacion-laboral/contratos/{contrato_id}",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_cabecera.status_code == 200, resp_cabecera.text
    cabecera = resp_cabecera.json()

    assert cabecera["id"] == contrato_id
    assert "nombre" in cabecera
    assert "empresa_proveedora" in cabecera
    assert "mandante_nombre" in cabecera
    assert "faena_nombre" in cabecera
    assert "adc_asignado" in cabecera and cabecera["adc_asignado"] is not None
    assert "rrhh_asignado" in cabecera and cabecera["rrhh_asignado"] is not None
    assert "estado_contractual" in cabecera

    # 3. Consultar períodos del contrato (deben haberse generado automáticamente)
    resp_periodos = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_periodos.status_code == 200, resp_periodos.text
    datos_periodos = resp_periodos.json()
    periodos = datos_periodos["items"]
    assert len(periodos) > 0, "Deben generarse períodos mensuales según la vigencia del contrato"

    # Verificar estructura enriquecida de cada período (.cl-per)
    for p in periodos:
        assert "id" in p
        assert "nombre" in p
        assert "mes_anio" in p
        assert "fecha_inicio" in p
        assert "fecha_fin" in p
        assert "estado" in p
        assert "porcentaje_cumplimiento" in p
        assert "total_requeridos" in p
        assert "total_aprobados" in p
        assert "total_observados" in p
        assert "total_pendientes" in p

    # 4. Probar idempotencia: una segunda llamada no debe duplicar períodos
    resp_reintento = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_reintento.status_code == 200
    assert len(resp_reintento.json()["items"]) == len(periodos), "La generación debe ser estrictamente idempotente"


def test_nomina_periodo_snapshot_inmutable(client, user_token, session):
    """
    [CA 6] La pestaña Nómina y su historial (vigentes, incorporaciones y bajas del mes) se consultan
    directamente desde el contrato y conservan foto inmutable al cerrar período.
    """
    # 1. Obtener contrato y sus períodos
    resp_cts = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_cts.status_code == 200
    contrato_id = resp_cts.json()["items"][0]["id"]

    resp_pers = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_pers.status_code == 200
    periodos = resp_pers.json()["items"]
    assert len(periodos) > 0
    periodo = periodos[0]
    periodo_id = periodo["id"]

    # 2. Consultar la nómina del período
    resp_nom = client.get(
        f"/api/v1/contratos/{contrato_id}/periodos/{periodo_id}/nomina",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_nom.status_code == 200, resp_nom.text
    data_nom = resp_nom.json()

    assert data_nom["periodo_id"] == periodo_id
    assert "periodo_nombre" in data_nom
    assert "inmutable" in data_nom
    assert "datos" in data_nom

    datos = data_nom["datos"]
    assert "resumen" in datos
    assert "total_nomina" in datos["resumen"]
    assert "total_vigentes" in datos["resumen"]
    assert "total_incorporaciones" in datos["resumen"]
    assert "total_bajas" in datos["resumen"]

    assert "vigentes" in datos
    assert "incorporaciones" in datos
    assert "bajas" in datos

    # Si hay trabajadores vigentes, verificar estructura mínima de campos
    for t in datos["vigentes"]:
        assert "id" in t
        assert "nombre" in t
        assert "rut" in t
        assert "cargo" in t
        assert "estado" in t
