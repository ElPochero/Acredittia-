"""El motor de vencimientos respeta la configuración de Alertas IA (v15)."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Alerta, Contrato
from app.services.vencimientos import alertar_vencimiento_contratos


def _contrato(sesion_db, contrato_id: str) -> Contrato:
    return sesion_db.get(Contrato, uuid.UUID(contrato_id))


def _alertas(sesion_db, contrato_id: str) -> list[Alerta]:
    return list(sesion_db.scalars(select(Alerta).where(
        Alerta.contrato_id == uuid.UUID(contrato_id),
        Alerta.titulo.like("Contrato por vencer%"),
        Alerta.resuelta_at.is_(None),
    )))


def test_la_anticipacion_del_contrato_decide_si_avisa(contrato_a, sesion_db):
    c = _contrato(sesion_db, contrato_a["id"])
    c.fecha_termino = date.today() + timedelta(days=20)
    c.alerta_anticipacion_dias = 10
    sesion_db.commit()

    alertar_vencimiento_contratos(sesion_db)
    assert _alertas(sesion_db, contrato_a["id"]) == [], "10 días no alcanzan para 20"

    c = _contrato(sesion_db, contrato_a["id"])
    c.alerta_anticipacion_dias = 30
    sesion_db.commit()

    alertar_vencimiento_contratos(sesion_db)
    assert len(_alertas(sesion_db, contrato_a["id"])) == 1


def test_la_frecuencia_evita_repetir_el_aviso_el_mismo_dia(contrato_a, sesion_db):
    c = _contrato(sesion_db, contrato_a["id"])
    c.fecha_termino = date.today() + timedelta(days=20)
    c.alerta_anticipacion_dias = 30
    c.alerta_frecuencia_dias = 7
    sesion_db.commit()

    alertar_vencimiento_contratos(sesion_db)
    [alerta] = _alertas(sesion_db, contrato_a["id"])
    primero = alerta.updated_at

    alertar_vencimiento_contratos(sesion_db)
    [alerta] = _alertas(sesion_db, contrato_a["id"])
    assert alerta.updated_at == primero, "no se reenvía dentro de la frecuencia"

    alerta.updated_at = datetime.now(timezone.utc) - timedelta(days=8)
    sesion_db.commit()
    alertar_vencimiento_contratos(sesion_db)
    [alerta] = _alertas(sesion_db, contrato_a["id"])
    assert alerta.updated_at > primero, "pasada la frecuencia se vuelve a avisar"
