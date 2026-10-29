from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..deps import err, get_company_id, get_current_user, get_db, require_company
from ..models import Contrato, User
from ..services import email as svc

router = APIRouter(prefix="/emails", tags=["emails"])

_LIMITE = defaultdict(lambda: deque())
_LIMITE_MAX = 5
_LIMITE_VENTANA = 60.0


def _rate_limit(clave: str) -> None:
    ahora = time.time()
    cola = _LIMITE[clave]
    while cola and ahora - cola[0] > _LIMITE_VENTANA:
        cola.popleft()
    if len(cola) >= _LIMITE_MAX:
        raise err(429, "LIMITE_CORREOS", "Demasiadas solicitudes de envío")
    cola.append(ahora)


class TestMailIn(BaseModel):
    plantilla: str
    para: str | None = None


@router.get("/preview/{plantilla}")
def preview(plantilla: str, contrato_id: uuid.UUID = Query(...),
            db: Session = Depends(get_db),
            cid: uuid.UUID = Depends(get_company_id),
            _user: User = Depends(require_company)):
    c = db.get(Contrato, contrato_id)
    if not c or c.company_id != cid:
        raise err(404, "CONTRATO_NO_ENCONTRADO", "Contrato no encontrado")
    if plantilla not in ("resumen", "porvencer", "observado", "semanal", "invitacion"):
        raise err(400, "PLANTILLA_INVALIDA", "Plantilla desconocida")
    asunto, html_body, texto = svc.construir_correo(db, plantilla, c)
    return {"plantilla": plantilla, "asunto": asunto, "html": html_body,
            "text": texto}


@router.post("/test")
def test_email(body: TestMailIn, request: Request,
               db: Session = Depends(get_db),
               cid: uuid.UUID = Depends(get_company_id),
               user: User = Depends(require_company)):
    clave = f"{cid}:{user.id}:{request.client.host if request.client else ''}"
    _rate_limit(clave)
    if body.plantilla not in ("resumen", "porvencer", "observado", "semanal", "invitacion"):
        raise err(400, "PLANTILLA_INVALIDA", "Plantilla desconocida")
    if body.plantilla == "invitacion" and not body.para:
        raise err(400, "FALTA_DESTINATARIO", "Invitación necesita destinatario")
    contrato = db.scalars(__import__("sqlalchemy").select(Contrato).where(
        Contrato.company_id == cid).order_by(Contrato.created_at.asc())).first()
    if not contrato:
        raise err(404, "CONTRATO_NO_ENCONTRADO", "No hay contrato para previsualizar")
    if body.plantilla == "invitacion":
        asunto, html_body, texto = svc.correo_invitacion(
            empresa=svc._contexto(db, contrato)["empresa"],
            nombre="Colaborador del contrato",
            correo=body.para or "",
            clave="Acr7k2qp!",
            rol="Colaborador del contrato",
            contrato=contrato.nombre,
            enlace=settings.app_url.rstrip('/') + "/login",
        )
    elif body.plantilla == "resumen":
        asunto, html_body, texto = svc.datos_resumen(db, contrato)
    elif body.plantilla == "porvencer":
        asunto, html_body, texto = svc.datos_porvencer(db, contrato)
    elif body.plantilla == "observado":
        asunto, html_body, texto = svc.datos_observado(db, contrato)
    else:
        asunto, html_body, texto = svc.datos_semanal(db, contrato)
    from ..services.jobs import enqueue
    destinos = []
    if body.plantilla == "invitacion":
        destinos = [body.para] if body.para else []
    else:
        for u in db.scalars(__import__("sqlalchemy").select(User).where(
                User.company_id == cid, User.activo == True, User.status == "approved")):
            if u.email:
                destinos.append(u.email)
        if not destinos and body.para:
            destinos = [body.para]
    for d in destinos:
        enqueue("enviar_email", to_email=d, subject=asunto,
                html_body=html_body, text_body=texto)
    return {"enviados": len(destinos), "asunto": asunto}
