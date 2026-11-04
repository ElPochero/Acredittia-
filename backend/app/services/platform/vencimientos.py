"""Recalculo de estados de vencimiento, snapshots y expiración de credenciales.

Es el contenido del cron diario de las 00:30 America/Santiago (§10.1 de la
especificación). Se ejecuta con `worker_session(is_admin=True)` porque barre
todas las empresas: RLS se relaja a propósito solo en este proceso.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ...config import UMBRAL_ACREDITADO_PCT, UMBRAL_PORVENC_DIAS
from ...models import (Alerta, Contrato, CumplimientoSnapshot, Documento,
                      PlataformaCredencial, Sujeto)
from .checklist import calc_estado_doc, calc_estado_sujeto
from .email import datos_porvencer_documento, despachar_alerta_email

log = logging.getLogger("acredittia.vencimientos")


def _dias_desde_ultimo_aviso(a: Alerta) -> int:
    """Días transcurridos desde el último envío de una alerta sin resolver.

    Las filas leídas de un `timestamptz` siempre vienen con zona; el `replace`
    cubre las creadas en esta misma sesión (el default del modelo es naive).
    """
    ultimo = a.updated_at
    if ultimo.tzinfo is None:
        ultimo = ultimo.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - ultimo).days


def _alerta_contrato_existente(db: Session, contrato_id: uuid.UUID,
                               severidad: str) -> Alerta | None:
    return db.scalar(select(Alerta).where(
        Alerta.contrato_id == contrato_id,
        Alerta.documento_id.is_(None),
        Alerta.sujeto_id.is_(None),
        Alerta.severidad == severidad,
        Alerta.origen == "vencimiento",
        Alerta.resuelta_at.is_(None),
    ))


def _alerta_existente(db: Session, documento_id: uuid.UUID,
                      severidad: str) -> Alerta | None:
    return db.scalar(select(Alerta).where(
        Alerta.documento_id == documento_id,
        Alerta.severidad == severidad,
        Alerta.origen == "vencimiento",
        Alerta.resuelta_at.is_(None),
    ))


def _emitir_alerta_vencimiento(db: Session, doc: Documento,
                               contrato: Contrato | None = None) -> None:
    """Alerta de vencimiento del documento, respetando la frecuencia del contrato.

    No se duplica: si ya hay una alerta sin resolver se refresca y solo se
    reenvía el correo cuando pasó la frecuencia configurada (v15).
    """
    quien = ""
    if doc.sujeto_id and doc.sujeto:
        quien = f" — {doc.sujeto.nombre}"
    if doc.estado_calc == "venc":
        sev, estado = "critica", "bloqueante"
        titulo = f"{doc.titulo} vencido"
        desc = f"{doc.titulo}{quien} venció el {doc.vence:%d/%m/%Y}."
    else:
        sev, estado = "advertencia", "nueva"
        dias = (doc.vence - date.today()).days
        titulo = f"{doc.titulo} por vencer"
        desc = f"{doc.titulo}{quien} vence en {dias} días ({doc.vence:%d/%m/%Y})."

    frecuencia = (contrato.alerta_frecuencia_dias if contrato else None) or 1
    existente = _alerta_existente(db, doc.id, sev)
    if existente:
        if _dias_desde_ultimo_aviso(existente) < frecuencia:
            return
        existente.titulo, existente.descripcion = titulo, desc
        existente.updated_at = datetime.now(timezone.utc)
    else:
        db.add(Alerta(
            company_id=doc.company_id, severidad=sev, estado=estado,
            origen="vencimiento", titulo=titulo, descripcion=desc,
            documento_id=doc.id, sujeto_id=doc.sujeto_id, contrato_id=doc.contrato_id,
        ))

    # Mapear al evento configurable que más se acerque
    if doc.estado_calc == "venc":
        evento = "alerta_critica"
    else:
        dias = (doc.vence - date.today()).days
        if dias <= 7:
            evento = "vencimiento_7"
        elif dias <= 15:
            evento = "vencimiento_15"
        else:
            evento = "vencimiento_30"

    sujeto_email = doc.sujeto.email if doc.sujeto_id and doc.sujeto else None
    contrato_nombre = ""
    if doc.contrato_id and doc.sujeto and doc.sujeto.contrato:
        contrato_nombre = doc.sujeto.contrato.nombre
    asunto, html_body, texto = datos_porvencer_documento(db, doc, contrato)
    despachar_alerta_email(
        db, doc.company_id, evento, asunto, desc,
        contrato_id=doc.contrato_id,
        sujeto_email=sujeto_email,
        severidad="critica" if doc.estado_calc == "venc" else "advertencia",
        contrato_nombre=contrato_nombre,
        html=html_body,
        texto=texto,
    )
    if contrato and getattr(contrato, "alertas_config", None):
        cfg = contrato.alertas_config or {}
        areas = cfg.get("areas", [])
        if areas:
            from ...routers.platform.contratos import resolver_area_para_doc
            a_id = resolver_area_para_doc(cfg, doc.titulo, "Empresa" if doc.contrato_id else "Personal")
            area_obj = next((a for a in areas if a.get("id") == a_id), None)
            if area_obj and area_obj.get("encargados"):
                for e in area_obj["encargados"]:
                    if e.get("email"):
                        despachar_alerta_email(
                            db, doc.company_id, evento, f"[{area_obj['nombre']}] {asunto}", desc,
                            contrato_id=doc.contrato_id,
                            sujeto_email=e["email"],
                            severidad="critica" if doc.estado_calc == "venc" else "advertencia",
                            contrato_nombre=contrato_nombre,
                            html=html_body,
                            texto=texto,
                        )


def _emitir_alerta_faltantes(db: Session, c: Contrato, n: int) -> None:
    """Un recordatorio agregado por contrato, no uno por documento faltante."""
    titulo = f"Documentos faltantes: {c.nombre}"
    existente = db.scalar(select(Alerta).where(
        Alerta.contrato_id == c.id,
        Alerta.origen == "sistema",
        Alerta.titulo == titulo,
        Alerta.resuelta_at.is_(None),
    ))
    if existente and _dias_desde_ultimo_aviso(existente) < (c.alerta_faltantes_dias or 3):
        return
    desc = f"{n} documento(s) obligatorios de '{c.nombre}' siguen sin cargarse."
    if existente:
        existente.descripcion = desc
        existente.updated_at = datetime.now(timezone.utc)
    else:
        db.add(Alerta(
            company_id=c.company_id, severidad="advertencia", estado="nueva",
            origen="sistema", titulo=titulo, descripcion=desc, contrato_id=c.id,
        ))
    despachar_alerta_email(
        db, c.company_id, "documentos_faltantes", titulo, desc,
        contrato_id=c.id, severidad="advertencia", contrato_nombre=c.nombre,
    )


def recalcular_documentos(db: Session, company_id: uuid.UUID | None = None) -> int:
    """Recalcula `estado_calc` y emite alertas. Devuelve documentos cambiados."""
    contratos = {c.id: c for c in db.scalars(select(Contrato))}
    # Los documentos de un sujeto no llevan `contrato_id` propio: se resuelve
    # por su sujeto para aplicar la configuración de alertas del contrato.
    sujeto_contrato = dict(db.execute(select(Sujeto.id, Sujeto.contrato_id)).all())
    q = select(Documento)
    if company_id:
        q = q.where(Documento.company_id == company_id)
    cambios = 0
    sujetos_afectados: set[uuid.UUID] = set()
    faltantes: dict[uuid.UUID, int] = {}
    for doc in db.scalars(q):
        cid_doc = doc.contrato_id or (
            sujeto_contrato.get(doc.sujeto_id) if doc.sujeto_id else None)
        contrato = contratos.get(cid_doc)
        nuevo = calc_estado_doc(
            doc, dias=(contrato.alerta_anticipacion_dias if contrato else None)
            or UMBRAL_PORVENC_DIAS)
        if nuevo != doc.estado_calc:
            doc.estado_calc = nuevo
            cambios += 1
            if doc.sujeto_id:
                sujetos_afectados.add(doc.sujeto_id)
        if nuevo in ("venc", "porvenc"):
            _emitir_alerta_vencimiento(db, doc, contrato)
        elif nuevo == "falta" and contrato and doc.obligatorio and not doc.es_emsipor:
            faltantes[contrato.id] = faltantes.get(contrato.id, 0) + 1
    for contrato_id, n in faltantes.items():
        _emitir_alerta_faltantes(db, contratos[contrato_id], n)
    for sid in sujetos_afectados:
        recalcular_sujeto(db, sid)
    db.commit()
    return cambios


def recalcular_sujeto(db: Session, sujeto_id: uuid.UUID) -> None:
    sujeto = db.get(Sujeto, sujeto_id)
    if not sujeto:
        return
    docs = db.scalars(select(Documento).where(Documento.sujeto_id == sujeto_id)).all()
    for d in docs:
        d.estado_calc = calc_estado_doc(d)
    sujeto.estado = calc_estado_sujeto(list(docs), sujeto.estado)


def alertar_vencimiento_contratos(db: Session) -> int:
    """Emite alertas para contratos por vencer o vencidos.

    La anticipación y la frecuencia salen de la configuración del contrato
    (v15), no de un umbral global.
    """
    hoy = date.today()
    cambios = 0

    q = select(Contrato).where(
        Contrato.estado != "terminado",
        Contrato.fecha_termino.is_not(None)
    )
    for c in db.scalars(q):
        if c.fecha_termino < hoy:
            sev, estado = "critica", "bloqueante"
            titulo = f"Contrato vencido: {c.nombre}"
            desc = f"El contrato '{c.nombre}' venció el {c.fecha_termino:%d/%m/%Y}."
        else:
            dias = (c.fecha_termino - hoy).days
            if dias <= (c.alerta_anticipacion_dias or 30):
                sev, estado = "advertencia", "nueva"
                titulo = f"Contrato por vencer: {c.nombre}"
                desc = f"El contrato '{c.nombre}' vence en {dias} días ({c.fecha_termino:%d/%m/%Y})."
            else:
                continue

        existente = _alerta_contrato_existente(db, c.id, sev)
        if existente and _dias_desde_ultimo_aviso(existente) < c.alerta_frecuencia_dias:
            continue
        if existente:
            existente.titulo, existente.descripcion = titulo, desc
            existente.updated_at = datetime.now(timezone.utc)
        else:
            db.add(Alerta(
                company_id=c.company_id, severidad=sev, estado=estado,
                origen="vencimiento", titulo=titulo, descripcion=desc,
                contrato_id=c.id
            ))
            cambios += 1
        evento = "alerta_critica" if sev == "critica" else "vencimiento_30"
        despachar_alerta_email(
            db, c.company_id, evento, titulo, desc,
            contrato_id=c.id,
            severidad=sev,
            contrato_nombre=c.nombre,
        )

    db.commit()
    return cambios


# ------------------------------------------------------------- snapshots
def _agregados(db: Session, company_id: uuid.UUID,
               contrato_id: uuid.UUID | None) -> dict:
    """Cumplimiento y conteos de una empresa o de uno de sus contratos."""
    docs = select(Documento).where(Documento.company_id == company_id)
    sujetos = select(Sujeto).where(Sujeto.company_id == company_id,
                                  Sujeto.estado != "baja")
    if contrato_id:
        # Documentos del contrato: los de empresa (contrato_id) más los de sus sujetos.
        ids_sujetos = select(Sujeto.id).where(Sujeto.contrato_id == contrato_id)
        docs = docs.where((Documento.contrato_id == contrato_id)
                          | Documento.sujeto_id.in_(ids_sujetos))
        sujetos = sujetos.where(Sujeto.contrato_id == contrato_id)

    filas = db.scalars(docs).all()
    oblig = [d for d in filas if d.obligatorio and not d.es_emsipor]
    ok = sum(1 for d in oblig if d.estado_calc == "ok")
    total = len(oblig)
    pct = round(100 * ok / total) if total else 0

    por_sujeto: dict[uuid.UUID, list[Documento]] = {}
    for d in filas:
        if d.sujeto_id:
            por_sujeto.setdefault(d.sujeto_id, []).append(d)

    p_total = p_ok = e_total = e_ok = 0
    for s in db.scalars(sujetos):
        sd = por_sujeto.get(s.id, [])
        so = [d for d in sd if d.obligatorio and not d.es_emsipor]
        spct = round(100 * sum(1 for d in so if d.estado_calc == "ok") / len(so)) if so else 0
        acreditado = spct >= UMBRAL_ACREDITADO_PCT
        if s.tipo == "trabajador":
            p_total += 1
            p_ok += int(acreditado)
        else:
            e_total += 1
            e_ok += int(acreditado)

    criticas = db.scalar(
        select(func.count()).select_from(Alerta).where(
            Alerta.company_id == company_id,
            Alerta.severidad == "critica",
            Alerta.resuelta_at.is_(None),
            *([Alerta.contrato_id == contrato_id] if contrato_id else []),
        )
    ) or 0

    return {
        "cumplimiento_pct": pct, "docs_ok": ok, "docs_total": total,
        "personal_acreditados": p_ok, "personal_total": p_total,
        "equipos_acreditados": e_ok, "equipos_total": e_total,
        "alertas_criticas": int(criticas),
    }


def escribir_snapshots(db: Session, fecha: date | None = None) -> int:
    """Una fila por empresa (contrato_id NULL) y una por contrato, cada día.

    Los snapshots son inmutables: si el día ya está escrito no se reescribe, se
    omite. Un recálculo posterior no debe alterar el histórico, porque la
    comparativa del dashboard pierde sentido si el pasado cambia.
    """
    hoy = fecha or date.today()
    creados = 0

    empresas = db.scalars(select(Contrato.company_id).distinct()).all()
    for cid in set(empresas):
        objetivos: list[uuid.UUID | None] = [None]
        objetivos += list(db.scalars(select(Contrato.id).where(
            Contrato.company_id == cid, Contrato.estado != "terminado")).all())

        for contrato_id in objetivos:
            existe = db.scalar(select(CumplimientoSnapshot.id).where(
                CumplimientoSnapshot.company_id == cid,
                CumplimientoSnapshot.fecha == hoy,
                (CumplimientoSnapshot.contrato_id == contrato_id
                 if contrato_id else CumplimientoSnapshot.contrato_id.is_(None)),
            ))
            if existe:
                continue
            db.add(CumplimientoSnapshot(
                company_id=cid, contrato_id=contrato_id, fecha=hoy,
                **_agregados(db, cid, contrato_id)))
            creados += 1

    db.commit()
    return creados


# --------------------------------------------------- credenciales expiradas
def expirar_credenciales(db: Session, dias_aviso: int = 30) -> int:
    """Marca expiradas las credenciales caducadas y avisa de las próximas.

    El JWE lleva su propio claim `exp`, así que una credencial vencida ya no
    descifra; esto mantiene la columna `estado` coherente para que la interfaz
    lo muestre y el chequeo 18 de `05_verificacion.sql` no dispare.
    """
    ahora = datetime.now(timezone.utc)

    vencidas = db.scalars(select(PlataformaCredencial).where(
        PlataformaCredencial.estado == "activa",
        PlataformaCredencial.expira_at <= ahora,
    )).all()
    for c in vencidas:
        db.execute(update(PlataformaCredencial)
                   .where(PlataformaCredencial.id == c.id)
                   .values(estado="expirada"))
        db.add(Alerta(
            company_id=c.company_id, severidad="critica", estado="bloqueante",
            origen="integracion", titulo=f"Credencial expirada: {c.usuario}",
            descripcion=("La credencial de acceso a la plataforma del mandante "
                         f"expiró el {c.expira_at:%d/%m/%Y}. Debe rotarse para "
                         "reanudar la sincronización."),
        ))

    limite = ahora + timedelta(days=dias_aviso)
    proximas = db.scalars(select(PlataformaCredencial).where(
        PlataformaCredencial.estado == "activa",
        PlataformaCredencial.expira_at > ahora,
        PlataformaCredencial.expira_at <= limite,
    )).all()
    for c in proximas:
        ya = db.scalar(select(Alerta.id).where(
            Alerta.company_id == c.company_id,
            Alerta.origen == "integracion",
            Alerta.titulo == f"Credencial por expirar: {c.usuario}",
            Alerta.resuelta_at.is_(None),
        ))
        if ya:
            continue
        dias = (c.expira_at - ahora).days
        db.add(Alerta(
            company_id=c.company_id, severidad="advertencia", estado="nueva",
            origen="integracion", titulo=f"Credencial por expirar: {c.usuario}",
            descripcion=(f"La credencial vence en {dias} días "
                         f"({c.expira_at:%d/%m/%Y}). Código CREDENCIAL_EXPIRADA."),
        ))

    db.commit()
    return len(vencidas)


# --------------------------------------------------- notificaciones certificación laboral
def notificar_evento_certificacion_laboral(
    db: Session,
    contrato_id: uuid.UUID,
    periodo_nombre: str,
    doc_nombre: str,
    accion: str,
    detalle: str | None = None,
    destinatario_email: str | None = None,
) -> None:
    """
    Emite alerta y despacha notificación por correo según la configuración
    de alertas_config del contrato (Sección 4.3).
    """
    c = db.get(Contrato, contrato_id)
    if not c:
        return

    sev = "advertencia" if accion in ("observar", "rechazar") else "informativa"
    est = "nueva"

    if accion == "observar":
        titulo = f"Documento observado en {periodo_nombre}: {doc_nombre}"
        descripcion = f"El ADC ha registrado observaciones: {detalle or 'Sin detalle adicional'}. Requiere corrección por RR.HH."
    elif accion == "rechazar":
        titulo = f"Documento rechazado en {periodo_nombre}: {doc_nombre}"
        descripcion = f"El ADC ha rechazado la entrega: {detalle or 'Sin detalle adicional'}. Debe subirse una nueva versión."
    elif accion == "aprobar":
        titulo = f"Documento aprobado en {periodo_nombre}: {doc_nombre}"
        descripcion = f"El requisito '{doc_nombre}' fue aprobado por la auditoría ADC."
    elif accion == "cargar":
        titulo = f"Nueva entrega en {periodo_nombre}: {doc_nombre}"
        descripcion = f"Se cargó una nueva entrega para revisión ADC: {detalle or ''}"
    elif accion == "cierre":
        titulo = f"Período cerrado exitosamente: {periodo_nombre}"
        descripcion = f"El período {periodo_nombre} del contrato {c.nombre} alcanzó 100% de cumplimiento y fue cerrado."
        sev = "informativa"
    else:
        titulo = f"Actualización en {periodo_nombre}: {doc_nombre}"
        descripcion = detalle or ""

    alerta = Alerta(
        company_id=c.company_id,
        contrato_id=c.id,
        severidad=sev,
        estado=est,
        origen="sistema",
        titulo=titulo,
        descripcion=descripcion
    )
    db.add(alerta)

    email_dest = destinatario_email
    if not email_dest and getattr(c, "alertas_config", None) and isinstance(c.alertas_config, dict):
        destinatarios = c.alertas_config.get("destinatarios") or []
        if destinatarios and isinstance(destinatarios, list):
            email_dest = destinatarios[0]

    if not email_dest:
        email_dest = "rrhh@acredittia.cl" if accion in ("observar", "rechazar") else "adc@acredittia.cl"

    try:
        from .email import enviar_email
        cuerpo = f"""
        <p><strong>Contrato:</strong> {c.nombre} ({c.codigo or 'S/C'})</p>
        <p><strong>Período:</strong> {periodo_nombre}</p>
        <p><strong>Documento:</strong> {doc_nombre}</p>
        <p><strong>Acción:</strong> {accion.upper()}</p>
        <p><strong>Detalle:</strong> {detalle or 'Sin comentarios'}</p>
        """
        enviar_email(email_dest, f"[Certificación Laboral] {titulo}", cuerpo)
    except Exception as e:
        log.warning("No se pudo despachar email de notificación certificación laboral: %s", e)
