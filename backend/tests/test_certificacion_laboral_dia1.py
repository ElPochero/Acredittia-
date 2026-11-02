"""Pruebas Día 1: Módulo Certificación Laboral (Listado de Contratos con KPIs y Requisitos)."""
import uuid
from datetime import date

def test_certificacion_laboral_contratos_kpis(client, user_token, session):
    """[CA 1, CA 15] Verifica que /certificacion-laboral/contratos lista los contratos reales con sus KPIs."""
    # 1. Obtener listado de contratos de certificación laboral
    resp = client.get("/api/v1/certificacion-laboral/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "items" in data
    assert "total" in data
    
    # 2. Si hay contratos, verificar que contienen la estructura enriquecida de KPIs
    for c in data["items"]:
        assert "id" in c
        assert "nombre" in c
        assert "estado" in c
        assert "periodo_vigente_nombre" in c
        assert "porcentaje_cumplimiento" in c
        assert "pendientes_carga_count" in c
        assert "por_revisar_count" in c
        assert "aprobados_count" in c
        assert "observados_count" in c
        assert "empresa_proveedora" in c
        assert "faena_nombre" in c


def test_contrato_requisitos_laborales_crud(client, user_token, session):
    """[CA 5] Verifica la consulta y configuración de requisitos laborales por contrato."""
    # 1. Obtener un contrato existente
    resp = client.get("/api/v1/contratos", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    contratos = resp.json()["items"]
    assert len(contratos) > 0, "Debe existir al menos un contrato para la prueba"
    contrato_id = contratos[0]["id"]
    
    # 2. Consultar los requisitos laborales del contrato (debe autosembrar los 10 oficiales si no existen)
    resp = client.get(f"/api/v1/contratos/{contrato_id}/requisitos-laborales", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200, resp.text
    reqs = resp.json()
    assert len(reqs) >= 10, f"Se esperaban al menos 10 requisitos de CL_DOCS, obtenidos: {len(reqs)}"
    
    # Verificar nombres clave de requisitos oficiales
    nombres = [r["nombre"] for r in reqs]
    assert any("F30-1" in n for n in nombres)
    assert any("Previred" in n for n in nombres)
    assert any("Libro de Remuneraciones" in n for n in nombres)
    assert any("Liquidaciones" in n for n in nombres)
    
    # 3. Modificar un requisito (PATCH)
    target_req = reqs[0]
    patch_payload = {
        "obligatorio": not target_req["obligatorio"],
        "regla_no_aplica": "cumplido" if target_req["regla_no_aplica"] == "excluir" else "excluir"
    }
    resp_patch = client.patch(
        f"/api/v1/contratos/{contrato_id}/requisitos-laborales/{target_req['id']}",
        json=patch_payload,
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp_patch.status_code == 200, resp_patch.text
    req_actualizado = resp_patch.json()
    assert req_actualizado["obligatorio"] == patch_payload["obligatorio"]
    assert req_actualizado["regla_no_aplica"] == patch_payload["regla_no_aplica"]
