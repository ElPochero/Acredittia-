"""Correos de Acredittia: un layout y cinco plantillas.

Todo el HTML sale de `_layout`, que fija el ancho de 600 px, el preheader
oculto, el botón "bulletproof" y el pie con el enlace a preferencias. Las
plantillas son funciones puras (`correo_*`) para poder probarlas sin base de
datos; los datos se componen en `datos_*` y `enviar_*`.

Reglas que no se rompen:

* Todo dato dinámico pasa por `html.escape`: los títulos de documento, nombres
  de trabajadores y mensajes de la IA vienen de archivos subidos por terceros.
* Las URLs absolutas se arman solo desde `settings.app_url`; un enlace recibido
  del cliente nunca se usa como CTA.
* La contraseña temporal viaja en el HTML y en el texto, nunca al log.
* Tablas y CSS inline: sin flex, sin grid, sin JavaScript. El texto alternativo
  se genera en `enviar_email`, así todo correo sale como `multipart/alternative`.

Si `smtp_host` está vacío el envío se simula en el log (`[EMAIL SIMULADO]`).
"""
from __future__ import annotations

import html
import logging
import re
import smtplib
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import or_, select

from ..config import settings
from ..models import Alerta, Company, Contrato, Documento, RequisitoTerreno, Sujeto
from .jobs import tarea

log = logging.getLogger("acredittia.email")

_MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)

# Paleta tomada del frontend: verde = acreditado, ámbar = por vencer,
# rojo = vencido/bloqueado, azul = acción.
_C = {
    "navy": "#0F172A",
    "blue": "#1D4ED8",
    "blue2": "#3D62F5",
    "ink": "#334155",
    "mut": "#64748B",
    "line": "#E2E8F0",
    "bg": "#F1F5F9",
    "red": "#B91C1C",
    "red_bg": "#FEE2E2",
    "amb": "#B45309",
    "amb_bg": "#FEF3C7",
    "grn": "#15803D",
    "grn_bg": "#DCFCE7",
}

_COLORES_SEVERIDAD = {
    "critica": {"bg": _C["red_bg"], "border": "#EF4444",
                "badge_bg": _C["red"], "badge_txt": "#FFFFFF", "icon": "🚨"},
    "advertencia": {"bg": _C["amb_bg"], "border": "#F59E0B",
                    "badge_bg": _C["amb"], "badge_txt": "#FFFFFF", "icon": "⚠️"},
    "info": {"bg": "#EFF6FF", "border": "#3B82F6",
             "badge_bg": "#2563EB", "badge_txt": "#FFFFFF", "icon": "ℹ️"},
}


# ---------------------------------------------------------------------------
# Helpers de render
# ---------------------------------------------------------------------------
def _e(valor) -> str:
    """Escapa un dato dinámico para HTML (incluye comillas)."""
    return html.escape(str(valor if valor is not None else ""), quote=True)


def _fecha(valor: date | datetime | None) -> str:
    return f"{valor:%d/%m/%Y}" if valor else ""


def _periodo(valor: date | None = None) -> str:
    hoy = valor or date.today()
    return f"{_MESES[hoy.month - 1]} de {hoy.year}"


def _url(ruta: str) -> str:
    """URL absoluta del frontend; la base sale siempre de `settings`."""
    return f"{settings.app_url.rstrip('/')}/{ruta.lstrip('/')}"


def _url_prefs() -> str:
    return _url("/config/notificaciones")


def _enlace_seguro(enlace: str | None, por_defecto: str) -> str:
    """Solo acepta CTA dentro de `app_url`; cualquier otro host se descarta."""
    base = settings.app_url.rstrip("/") + "/"
    if enlace and enlace.startswith(base):
        return enlace
    return por_defecto


def _boton(texto: str, url: str, color: str | None = None) -> str:
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 6px;">
  <tr><td style="background:{color or _C['blue']};border-radius:10px;">
    <a href="{_e(url)}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">{_e(texto)}</a>
  </td></tr>
</table>"""


def _badge(texto: str, color: str, fondo: str) -> str:
    return (f'<span style="display:inline-block;background:{fondo};color:{color};'
            f'font-size:11px;font-weight:bold;padding:3px 9px;border-radius:10px;'
            f'white-space:nowrap;">{_e(texto)}</span>')


def _badge_documento(estado: str, dias: int) -> str:
    if estado == "venc" or dias < 0:
        return _badge(f"Vencido hace {abs(dias)} d", _C["red"], _C["red_bg"])
    return _badge(f"Vence en {dias} d", _C["amb"], _C["amb_bg"])


def _fila_documento(titulo: str, quien: str, badge: str,
                    fecha: str = "") -> str:
    return f"""
<tr>
  <td style="padding:10px 0;border-bottom:1px solid {_C['line']};">
    <div style="font-size:14px;font-weight:bold;color:{_C['navy']};">{_e(titulo)}</div>
    <div style="font-size:12px;color:{_C['mut']};padding-top:2px;">{_e(quien)}</div>
  </td>
  <td align="right" valign="top" style="padding:10px 0;border-bottom:1px solid {_C['line']};white-space:nowrap;">
    {badge}
    <div style="font-size:11px;color:#94A3B8;padding-top:4px;">{_e(fecha)}</div>
  </td>
</tr>"""


def _layout(*, titulo: str, preheader: str, contenido: str,
            cta_texto: str | None = None, cta_url: str | None = None,
            cta_color: str | None = None, badge: str = "",
            pie: str = "") -> str:
    """Estructura común: 600 px, preheader oculto, CTA y pie."""
    ahora = datetime.now().strftime("%d/%m/%Y %H:%M")
    cta = _boton(cta_texto, cta_url, cta_color) if cta_texto and cta_url else ""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{_e(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:{_C['bg']};font-family:Arial,Helvetica,sans-serif;color:{_C['navy']};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{_e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_C['bg']};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:14px;border:1px solid {_C['line']};">
      <tr><td style="padding:22px 32px;border-bottom:3px solid {_C['blue']};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="font-size:15px;font-weight:bold;letter-spacing:3px;color:{_C['navy']};">ACREDITTIA</span></td>
          <td align="right">{badge}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 32px 8px;">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:{_C['navy']};">{_e(titulo)}</h1>
        {contenido}
        {cta}
      </td></tr>
      <tr><td style="padding:18px 32px 26px;">
        <div style="border-top:1px solid {_C['line']};padding-top:14px;font-size:12px;line-height:1.6;color:{_C['mut']};">
          Este es un correo automático de ACREDITTIA · {ahora}. Puedes ajustar qué
          notificaciones recibes en <a href="{_e(_url_prefs())}" style="color:{_C['blue']};">Configuración → Notificaciones</a>.{pie}
        </div>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#94A3B8;margin-top:14px;text-align:center;">
      ACREDITTIA — Acreditación inteligente para proveedores de minería y energía
    </div>
  </td></tr>
</table>
</body>
</html>"""


def _parrafo(texto_html: str) -> str:
    """Párrafo con partes ya escapadas por quien lo arma."""
    return (f'<p style="margin:0 0 14px;font-size:14px;line-height:1.6;'
            f'color:{_C["ink"]};">{texto_html}</p>')


def _fuerte(texto) -> str:
    return f'<b style="color:{_C["navy"]};">{_e(texto)}</b>'


# ---------------------------------------------------------------------------
# Plantilla 1 — Resumen mensual de vencimientos
# ---------------------------------------------------------------------------
def correo_resumen(*, empresa: str, contratos: list[dict], periodo: str,
                   url: str) -> tuple[str, str, str]:
    """Resumen por contrato de vencidos y por vencer en los próximos 30 días.

    Cada contrato trae `vencidos` y `porvencer`, listas de filas con
    `titulo`, `quien`, `vence`, `dias` y `estado`.
    """
    total = sum(len(c["vencidos"]) + len(c["porvencer"]) for c in contratos)
    asunto = f"ACREDITTIA · Resumen mensual: {total} vencimientos"

    secciones = []
    texto_lineas = [
        f"Resumen de vencimientos de {empresa} — {periodo}",
        f"{total} documento(s) vencidos o por vencer en los próximos 30 días.",
        "",
    ]
    for c in contratos:
        n_venc = len(c["vencidos"])
        n_por = len(c["porvencer"])
        conteo = []
        if n_venc:
            conteo.append(f'<span style="color:{_C["red"]};font-weight:bold;">'
                          f'{n_venc} vencido{"s" if n_venc != 1 else ""}</span>')
        if n_por:
            conteo.append(f'<span style="color:{_C["amb"]};font-weight:bold;">'
                          f'{n_por} por vencer</span>')
        separador = " · " if conteo else ""
        filas = []
        for d in (c["vencidos"] + c["porvencer"])[:7]:
            filas.append(_fila_documento(
                d["titulo"], d["quien"], _badge_documento(d["estado"], d["dias"]),
                _fecha(d["vence"])))
        restantes = n_venc + n_por - len(filas)
        secciones.append(f"""
<div style="margin:22px 0 4px;font-size:15px;font-weight:bold;color:{_C['navy']};text-transform:uppercase;letter-spacing:0.3px;">{_e(c['nombre'])}</div>
<div style="font-size:12px;margin-bottom:6px;">{separador.join(conteo)} <span style="color:{_C['mut']};">· {_e(c['faena'])}</span></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  {''.join(filas)}
</table>
{f'<div style="font-size:12px;color:{_C["mut"]};padding-top:8px;">y {restantes} más en este contrato</div>' if restantes > 0 else ''}""")
        texto_lineas.append(f"{c['nombre']} ({c['faena']}): "
                            f"{n_venc} vencido(s), {n_por} por vencer.")
        for d in (c["vencidos"] + c["porvencer"]):
            texto_lineas.append(
                f"  - {d['titulo']} — {d['quien']} — {_fecha(d['vence'])}")

    contenido = (
        _parrafo("Hola,")
        + _parrafo("Este es el resumen de documentos <b>vencidos y por vencer "
                   f"en los próximos 30 días</b> de {_fuerte(empresa)} al "
                   f"{_e(periodo)}.")
        + "".join(secciones)
    )
    html_body = _layout(
        titulo="Resumen mensual de vencimientos",
        preheader=f"{total} documentos vencidos o por vencer este mes",
        contenido=contenido,
        cta_texto="Ver detalle en ACREDITTIA",
        cta_url=url,
    )
    texto_lineas += ["", f"Ver detalle: {url}"]
    return asunto, html_body, "\n".join(texto_lineas)


# ---------------------------------------------------------------------------
# Plantilla 2 — Alerta: documento por vencer (o vencido)
# ---------------------------------------------------------------------------
def correo_porvencer(*, empresa: str, contrato: str, faena: str,
                     documento: str, quien: str, vence: date | None,
                     dias: int, estado: str = "porvenc",
                     url: str) -> tuple[str, str, str]:
    """Tarjeta con los días restantes, pasos de qué hacer y CTA de subida."""
    vencido = estado == "venc" or dias < 0
    if vencido:
        asunto = f"ACREDITTIA · {documento} está vencido"
        etiqueta = f"Venció el {_fecha(vence)}"
        titulo = "Un documento está vencido"
        color, fondo = _C["red"], _C["red_bg"]
        pasos = [
            "Solicita el documento renovado (el agente de WhatsApp puede pedírselo al trabajador).",
            "Súbelo en ACREDITTIA: la IA lo revisa y detecta la nueva vigencia.",
            "Expórtalo a la plataforma del mandante para regularizar el acceso a faena.",
        ]
        cta = "Subir documento renovado"
    else:
        asunto = f"ACREDITTIA · {documento} vence en {dias} días"
        etiqueta = f"Vence en {dias} días · {_fecha(vence)}"
        titulo = "Un documento está por vencer"
        color, fondo = _C["amb"], _C["amb_bg"]
        pasos = [
            "Pide el documento renovado (el agente de WhatsApp puede pedírselo al trabajador).",
            "Súbelo en ACREDITTIA: la IA lo revisa y detecta la nueva vigencia.",
            "Expórtalo y súbelo a la plataforma del mandante antes del vencimiento.",
        ]
        cta = "Subir documento renovado"

    pasos_html = "".join(
        f'<li style="padding-bottom:6px;">{_e(p)}</li>' for p in pasos)

    contenido = (
        _parrafo(f"Hola, la IA de ACREDITTIA detectó un documento que requiere "
                 f"atención en el contrato {_fuerte(contrato)}"
                 + (f" ({_e(faena)})" if faena else "") + ".")
        + f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{fondo};border:1px solid {color};border-radius:12px;margin-bottom:18px;">
  <tr><td style="padding:18px 20px;">
    <div style="font-size:12px;color:{color};font-weight:bold;text-transform:uppercase;letter-spacing:0.4px;">{_e(etiqueta)}</div>
    <div style="font-size:18px;font-weight:bold;color:{_C['navy']};padding-top:6px;">{_e(documento)}</div>
    <div style="font-size:13px;color:#475569;padding-top:2px;">{_e(quien)}</div>
  </td></tr>
</table>
<div style="margin:18px 0 6px;font-size:13px;font-weight:bold;color:{_C['navy']};">Qué hacer</div>
<ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:{_C['ink']};">{pasos_html}</ol>"""
    )
    html_body = _layout(
        titulo=titulo,
        preheader=f"{documento} {etiqueta.lower()}",
        contenido=contenido,
        cta_texto=cta,
        cta_url=url,
        cta_color=color if vencido else None,
    )
    texto = "\n".join([
        f"{titulo} — {empresa}", "",
        f"Contrato: {contrato}" + (f" ({faena})" if faena else ""),
        f"Documento: {documento}", f"Responsable: {quien}",
        f"Estado: {etiqueta}", "", "Qué hacer:",
        *[f"{n}. {p}" for n, p in enumerate(pasos, start=1)],
        "", f"{cta}: {url}",
    ])
    return asunto, html_body, texto


# ---------------------------------------------------------------------------
# Plantilla 3 — Documento observado por la IA
# ---------------------------------------------------------------------------
def correo_observado(*, empresa: str, contrato: str, faena: str,
                     documento: str, quien: str, archivo: str = "",
                     hallazgos: list[str], url: str) -> tuple[str, str, str]:
    """Problemas detectados en la revisión y aviso al trabajador por WhatsApp."""
    asunto = "ACREDITTIA · La IA observó un documento: requiere corrección"
    hallazgos = hallazgos or ["El archivo no cumple el estándar del mandante."]
    detalle = (f"{_e(quien)}" + (f" · {_e(archivo)}" if archivo else ""))
    vinetas = "".join(
        f'<div style="padding-bottom:6px;">● {_e(h)}</div>' for h in hallazgos)

    contenido = (
        _parrafo(f"Hola, al revisar un documento recién subido al contrato "
                 f"{_fuerte(contrato)}"
                 + (f" ({_e(faena)})" if faena else "")
                 + ", la IA encontró problemas que harían que la plataforma "
                   "del mandante lo rechace.")
        + f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #FCA5A5;border-radius:12px;overflow:hidden;margin-bottom:18px;">
  <tr><td style="background:{_C['red_bg']};padding:14px 18px;">
    <div style="font-size:16px;font-weight:bold;color:{_C['navy']};">{_e(documento)}</div>
    <div style="font-size:12px;color:#475569;padding-top:2px;">{detalle}</div>
  </td></tr>
  <tr><td style="padding:12px 18px;font-size:13px;line-height:1.7;color:{_C['red']};">{vinetas}</td></tr>
</table>"""
        + _parrafo("El agente de WhatsApp ya le pidió al trabajador una nueva "
                   "foto con buena luz. Te avisaremos cuando llegue.")
    )
    html_body = _layout(
        titulo="Un documento requiere corrección",
        preheader="Un documento subido no cumple el estándar del mandante",
        contenido=contenido,
        cta_texto="Revisar documento",
        cta_url=url,
        cta_color=_C["red"],
    )
    texto = "\n".join([
        "Un documento requiere corrección — " + empresa, "",
        f"Contrato: {contrato}" + (f" ({faena})" if faena else ""),
        f"Documento: {documento}", f"Responsable: {detalle}", "",
        "Problemas detectados:",
        *[f"- {h}" for h in hallazgos],
        "", "El agente de WhatsApp ya solicitó una nueva foto al trabajador.",
        "", f"Revisar documento: {url}",
    ])
    return asunto, html_body, texto


# ---------------------------------------------------------------------------
# Plantilla 4 — Estado semanal del contrato
# ---------------------------------------------------------------------------
def _celda_estado(etiqueta: str, numero: int, color: str) -> str:
    return (f'<td align="center" width="25%" style="padding:12px 4px;'
            f'border:1px solid {_C["line"]};border-radius:10px;">'
            f'<div style="font-size:22px;font-weight:bold;color:{color};">{numero}</div>'
            f'<div style="font-size:11px;color:{_C["mut"]};">{_e(etiqueta)}</div></td>')


def correo_semanal(*, empresa: str, contrato: str, faena: str, mandante: str,
                   semana: str, pct: int, personal: dict, equipos: dict,
                   alertas: int, atencion: list[dict],
                   url: str) -> tuple[str, str, str]:
    """Cumplimiento, contadores por estado y lo que requiere atención."""
    pct = max(0, min(100, int(pct)))
    asunto = f"ACREDITTIA · Estado semanal — {contrato}"

    def bloque(titulo: str, datos: dict) -> str:
        return f"""
<div style="margin:18px 0 8px;font-size:13px;font-weight:bold;color:{_C['navy']};">{_e(titulo)} ({datos.get('total', 0)})</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
  {_celda_estado("Acreditados", datos.get("acreditados", 0), _C["grn"])}
  {_celda_estado("Vencidos", datos.get("vencidos", 0), _C["red"])}
  {_celda_estado("En proceso", datos.get("en_proceso", 0), _C["amb"])}
  {_celda_estado("Bloqueados", datos.get("bloqueados", 0), _C["ink"])}
</tr></table>"""

    filas_atencion = "".join(
        _fila_documento(a["titulo"], a.get("detalle", ""),
                        _badge(a.get("etiqueta", "Alerta"),
                               a.get("color", _C["amb"]),
                               a.get("bg", _C["amb_bg"])))
        for a in atencion[:8]
    ) or (f'<tr><td style="padding:10px 0;font-size:13px;color:{_C["mut"]};">'
          'Sin pendientes que requieran tu atención esta semana.</td></tr>')

    contenido = (
        _parrafo(f"{_e(faena)} · {_e(mandante)} · semana al {_e(semana)}")
        + f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_C['navy']};border-radius:12px;margin-bottom:6px;">
  <tr><td style="padding:18px 20px;color:#FFFFFF;">
    <div style="font-size:12px;color:#94A3B8;">Cumplimiento documental</div>
    <div style="font-size:32px;font-weight:bold;line-height:1.2;">{pct}%</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      <tr>
        <td width="{pct}%" style="height:8px;background:{_C['blue2']};border-radius:6px;font-size:0;line-height:0;">&nbsp;</td>
        <td style="height:8px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>
    <div style="font-size:12px;color:#94A3B8;padding-top:8px;">{alertas} alerta(s) activa(s) en el contrato</div>
  </td></tr>
</table>"""
        + bloque("Trabajadores", personal)
        + bloque("Equipos y vehículos", equipos)
        + f"""
<div style="margin:18px 0 6px;font-size:13px;font-weight:bold;color:{_C['navy']};">Requiere tu atención</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas_atencion}</table>"""
    )
    html_body = _layout(
        titulo=f"Estado semanal — {contrato}",
        preheader=f"Cumplimiento {pct}% · {alertas} alertas activas",
        contenido=contenido,
        cta_texto="Abrir el contrato",
        cta_url=url,
    )
    texto = "\n".join([
        f"Estado semanal — {contrato}", empresa,
        f"{faena} · {mandante} · semana al {semana}", "",
        f"Cumplimiento documental: {pct}% ({alertas} alertas activas)",
        f"Trabajadores: {personal.get('acreditados', 0)} acreditados, "
        f"{personal.get('vencidos', 0)} vencidos, "
        f"{personal.get('en_proceso', 0)} en proceso, "
        f"{personal.get('bloqueados', 0)} bloqueados.",
        f"Equipos: {equipos.get('acreditados', 0)} acreditados, "
        f"{equipos.get('vencidos', 0)} vencidos, "
        f"{equipos.get('en_proceso', 0)} en proceso, "
        f"{equipos.get('bloqueados', 0)} bloqueados.",
        "", "Requiere tu atención:",
        *[f"- {a['titulo']} — {a.get('detalle', '')}" for a in atencion[:8]],
        "", f"Abrir el contrato: {url}",
    ])
    return asunto, html_body, texto


# ---------------------------------------------------------------------------
# Plantilla 5 — Invitación a un contrato (Compartir)
# ---------------------------------------------------------------------------
def correo_invitacion(*, empresa: str, nombre: str | None, correo: str,
                      clave: str, rol: str, contrato: str = "",
                      faena: str = "", enlace: str) -> tuple[str, str, str]:
    """Credenciales temporales y permiso asignado en el contrato."""
    asunto = "Te invitaron a ACREDITTIA"
    if contrato:
        asunto += f" · {contrato}"
    saludo = f"Hola {nombre}," if nombre else "Hola,"
    enlace = _enlace_seguro(enlace, _url("/login"))

    contenido = (
        _parrafo(_e(saludo))
        + _parrafo(f"{_fuerte(empresa or 'Tu empresa')} te invitó a colaborar "
                   "en ACREDITTIA"
                   + (f" en el contrato {_fuerte(contrato)}" if contrato else "")
                   + (f" ({_e(faena)})" if faena else "") + ".")
        + f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid {_C['line']};border-radius:12px;">
  <tr><td style="padding:18px 20px;font-size:13px;line-height:2;color:{_C['ink']};">
    Permiso: {_badge(rol, _C['blue'], '#DBEAFE')}<br>
    Usuario: <b style="font-family:monospace;">{_e(correo)}</b><br>
    Contraseña temporal: <b style="font-family:monospace;">{_e(clave)}</b>
  </td></tr>
</table>"""
        + _parrafo("Al ingresar por primera vez te pediremos cambiar la contraseña.")
    )
    html_body = _layout(
        titulo="Te dieron acceso a un contrato",
        preheader=f"Acceso como {rol}"
                  + (f" al contrato {contrato}" if contrato else ""),
        contenido=contenido,
        cta_texto="Ingresar a ACREDITTIA",
        cta_url=enlace,
    )
    texto = "\n".join([
        asunto, "", saludo, "",
        f"{empresa} te invitó a colaborar en ACREDITTIA"
        + (f" en el contrato {contrato}" if contrato else "") + ".",
        f"Permiso: {rol}", f"Usuario: {correo}",
        f"Contraseña temporal: {clave}", "",
        "Al ingresar por primera vez te pediremos cambiar la contraseña.",
        "", f"Ingresar a ACREDITTIA: {enlace}",
    ])
    return asunto, html_body, texto


# ---------------------------------------------------------------------------
# Alertas genéricas (contrato, faltantes, credenciales)
# ---------------------------------------------------------------------------
def _html_alerta(titulo: str, descripcion: str, severidad: str = "advertencia",
                 nombre_empresa: str = "", contrato_nombre: str = "") -> str:
    """Correo genérico de alerta sobre el layout compartido."""
    col = _COLORES_SEVERIDAD.get(severidad, _COLORES_SEVERIDAD["info"])
    label = {"critica": "CRÍTICA", "advertencia": "ADVERTENCIA",
             "info": "INFORMATIVO"}.get(severidad, severidad.upper())

    filas = ""
    if nombre_empresa:
        filas += (f'<tr><td style="padding:6px 0;color:{_C["mut"]};font-size:13px;">Empresa:</td>'
                  f'<td style="padding:6px 0;font-weight:bold;color:{_C["navy"]};font-size:13px;">'
                  f'{_e(nombre_empresa)}</td></tr>')
    if contrato_nombre:
        filas += (f'<tr><td style="padding:6px 0;color:{_C["mut"]};font-size:13px;">Contrato:</td>'
                  f'<td style="padding:6px 0;font-weight:bold;color:{_C["navy"]};font-size:13px;">'
                  f'{_e(contrato_nombre)}</td></tr>')

    detalle = ""
    if filas:
        detalle = f"""
<div style="background:#F9FAFB;border:1px solid {_C['line']};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
  <div style="font-size:12px;font-weight:bold;color:{_C['mut']};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Detalle</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas}</table>
</div>"""

    contenido = f"""
<div style="background:{col['bg']};border-left:4px solid {col['border']};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
  <div style="font-size:16px;font-weight:bold;color:{_C['navy']};padding-bottom:6px;">{col['icon']} {_e(titulo)}</div>
  <div style="font-size:14px;color:{_C['ink']};line-height:1.6;">{_e(descripcion)}</div>
</div>{detalle}"""
    return _layout(
        titulo=titulo,
        preheader=descripcion[:140],
        contenido=contenido,
        badge=_badge(f"{col['icon']} {label}", col["badge_txt"], col["badge_bg"]),
        cta_texto="Ver alertas en Acredittia",
        cta_url=_url("/alertas"),
    )


def _texto_desde_html(html_body: str) -> str:
    """Alternativa text/plain mínima cuando la plantilla no la trae."""
    texto = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html_body,
                   flags=re.S | re.I)
    texto = re.sub(r"<br\s*/?>|</p>|</tr>|</h[1-6]>|</li>", "\n", texto,
                   flags=re.I)
    texto = re.sub(r"<[^>]+>", " ", texto)
    texto = html.unescape(texto)
    texto = re.sub(r"[ \t]+", " ", texto)
    texto = re.sub(r"\n\s*\n+", "\n\n", texto)
    return texto.strip()


# ---------------------------------------------------------------------------
# Envío SMTP
# ---------------------------------------------------------------------------
@tarea("enviar_email")
def enviar_email(to_email: str, subject: str, html_body: str,
                 text_body: str | None = None) -> None:
    """Envía un correo en segundo plano usando la configuración SMTP.

    Compatible con Gmail usando una Contraseña de Aplicación (App Password):
      SMTP_HOST=smtp.gmail.com  SMTP_PORT=587
      SMTP_USER=tu@gmail.com    SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
    Si `smtp_host` está vacío, simula el envío en el log (modo desarrollo).
    """
    if not settings.smtp_host:
        log.warning("[EMAIL SIMULADO] Destino: %s | Asunto: %s", to_email, subject)
        log.debug("Contenido HTML:\n%s", html_body)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Acredittia <{settings.email_from}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body or _texto_desde_html(html_body), "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        log.info("Email enviado a %s: %s", to_email, subject)
    except Exception:
        log.exception("Fallo enviando email a %s", to_email)
        raise


def enviar_invitacion(*, to_email: str, nombre: str | None, clave: str,
                      rol: str, contrato_nombre: str | None = None,
                      enlace: str | None = None, empresa: str = "") -> None:
    """Encola el correo de invitación con las credenciales temporales.

    El enlace lo construye el servidor (`settings.app_url`): si viniera del
    cliente, un `Origin` manipulado podría mandar al invitado a una página
    ajena y quedarse con su contraseña temporal.
    """
    from .jobs import enqueue

    asunto, html_body, texto = correo_invitacion(
        empresa=empresa,
        nombre=nombre,
        correo=to_email,
        clave=clave,
        rol=rol,
        contrato=contrato_nombre or "",
        enlace=enlace or _url("/login"),
    )
    enqueue("enviar_email", to_email=to_email, subject=asunto,
            html_body=html_body, text_body=texto)
    log.info("invitación enviada a %s (%s)", to_email, rol)


# ---------------------------------------------------------------------------
# Datos desde la base
# ---------------------------------------------------------------------------
def _contexto(db, c: Contrato) -> dict:
    empresa = db.get(Company, c.company_id)
    return {
        "empresa": empresa.nombre if empresa else "",
        "contrato": c.nombre,
        "faena": c.faena.nombre if c.faena else "",
        "mandante": c.faena.mandante if c.faena else "",
    }


def _contrato_de_documento(db, doc: Documento) -> Contrato | None:
    """Contrato del documento: el propio o el de su sujeto."""
    if doc.sujeto_id and doc.sujeto and doc.sujeto.contrato:
        return doc.sujeto.contrato
    return db.get(Contrato, doc.contrato_id) if doc.contrato_id else None


def _documentos_contrato(db, c: Contrato) -> list[Documento]:
    sujetos = select(Sujeto.id).where(Sujeto.contrato_id == c.id)
    return list(db.scalars(select(Documento).where(
        Documento.company_id == c.company_id,
        or_(Documento.contrato_id == c.id, Documento.sujeto_id.in_(sujetos)),
    ).order_by(Documento.vence)))


def _filas_documentos(db, c: Contrato) -> list[dict]:
    """Filas de documentos vencidos o por vencer, listas para la plantilla."""
    hoy = date.today()
    filas = []
    for d in _documentos_contrato(db, c):
        if d.estado_calc not in ("venc", "porvenc"):
            continue
        if d.sujeto:
            tipo = "Equipo" if d.sujeto.tipo == "equipo" else "Trabajador"
            quien = f"{tipo} · {d.sujeto.nombre}"
        else:
            quien = "Empresa"
        filas.append({
            "titulo": d.titulo,
            "quien": quien,
            "vence": d.vence,
            "dias": (d.vence - hoy).days if d.vence else 0,
            "estado": d.estado_calc,
        })
    return filas


def datos_resumen(db, c: Contrato) -> tuple[str, str, str]:
    filas = _filas_documentos(db, c)
    ctx = _contexto(db, c)
    return correo_resumen(
        empresa=ctx["empresa"],
        contratos=[{
            "nombre": c.nombre,
            "faena": ctx["faena"],
            "vencidos": [f for f in filas if f["estado"] == "venc" or f["dias"] < 0],
            "porvencer": [f for f in filas if not (f["estado"] == "venc" or f["dias"] < 0)],
        }],
        periodo=_periodo(),
        url=_url(f"/contratos/{c.id}"),
    )


def datos_porvencer(db, c: Contrato) -> tuple[str, str, str]:
    filas = _filas_documentos(db, c)
    fila = next((f for f in filas if f["estado"] == "porvenc"), filas[0] if filas else None)
    ctx = _contexto(db, c)
    fila = fila or {"titulo": "Sin documentos por vencer", "quien": "",
                    "vence": None, "dias": 0, "estado": "porvenc"}
    return correo_porvencer(
        empresa=ctx["empresa"], contrato=ctx["contrato"], faena=ctx["faena"],
        documento=fila["titulo"],
        quien=fila["quien"],
        vence=fila["vence"],
        dias=fila["dias"],
        estado=fila["estado"],
        url=_url(f"/contratos/{c.id}"),
    )


def datos_porvencer_documento(db, doc: Documento,
                              contrato: Contrato | None = None) -> tuple[str, str, str]:
    """Aviso para un documento concreto, no el primero por vencer del contrato."""
    c = contrato or _contrato_de_documento(db, doc)
    ctx = _contexto(db, c) if c else {"empresa": "", "contrato": "", "faena": ""}
    empresa = ctx["empresa"]
    if not empresa:
        company = db.get(Company, doc.company_id)
        empresa = company.nombre if company else ""
    return correo_porvencer(
        empresa=empresa, contrato=ctx["contrato"], faena=ctx["faena"],
        documento=doc.titulo,
        quien=doc.sujeto.nombre if doc.sujeto_id and doc.sujeto else "Empresa",
        vence=doc.vence, dias=(doc.vence - date.today()).days,
        estado=doc.estado_calc,
        url=_url(f"/contratos/{c.id}" if c else "/documentos"),
    )


def datos_observado(db, c: Contrato) -> tuple[str, str, str]:
    alerta = db.scalar(select(Alerta).where(
        Alerta.company_id == c.company_id,
        Alerta.contrato_id == c.id,
        Alerta.origen == "ia",
    ).order_by(Alerta.created_at.desc()))
    ctx = _contexto(db, c)
    if alerta:
        documento = alerta.titulo.removeprefix("Documento rechazado por IA: ")
        hallazgos = [p.strip() for p in (alerta.descripcion or "").split(";") if p.strip()]
        quien = "Trabajador"
        if alerta.sujeto_id:
            sujeto = db.get(Sujeto, alerta.sujeto_id)
            if sujeto:
                quien = ("Equipo" if sujeto.tipo == "equipo" else "Trabajador") \
                    + f" · {sujeto.nombre}"
    else:
        documento = "Certificado de Salud y Examen de Altura"
        quien = "Trabajador"
        hallazgos = [
            "Documento ilegible: la imagen está borrosa y no se pueden leer las fechas ni el RUT.",
            "No se pudo verificar la vigencia del examen de altura geográfica.",
        ]
    return correo_observado(
        empresa=ctx["empresa"], contrato=ctx["contrato"], faena=ctx["faena"],
        documento=documento, quien=quien, hallazgos=hallazgos,
        url=_url(f"/contratos/{c.id}"),
    )


def datos_observado_documento(db, doc: Documento, archivo: str,
                               hallazgos: list[str]) -> tuple[str, str, str]:
    """Correo del archivo que la IA acaba de rechazar, con sus hallazgos."""
    c = _contrato_de_documento(db, doc)
    ctx = _contexto(db, c) if c else {"empresa": "", "contrato": "", "faena": ""}
    empresa = ctx["empresa"]
    if not empresa:
        company = db.get(Company, doc.company_id)
        empresa = company.nombre if company else ""
    if doc.sujeto_id and doc.sujeto:
        tipo = "Equipo" if doc.sujeto.tipo == "equipo" else "Trabajador"
        quien = f"{tipo} · {doc.sujeto.nombre}"
    else:
        quien = "Empresa"
    return correo_observado(
        empresa=empresa, contrato=ctx["contrato"], faena=ctx["faena"],
        documento=doc.titulo, quien=quien, archivo=archivo,
        hallazgos=hallazgos,
        url=_url(f"/contratos/{c.id}" if c else "/documentos"),
    )


def _cuenta_sujetos(sujetos: list[Sujeto]) -> dict:
    datos = {"total": len(sujetos), "acreditados": 0, "vencidos": 0,
             "en_proceso": 0, "bloqueados": 0}
    for s in sujetos:
        if s.estado == "ok":
            datos["acreditados"] += 1
        elif s.estado == "venc":
            datos["vencidos"] += 1
        elif s.estado == "proc":
            datos["en_proceso"] += 1
        else:
            datos["bloqueados"] += 1
    return datos


def datos_semanal(db, c: Contrato) -> tuple[str, str, str]:
    ctx = _contexto(db, c)
    sujetos = list(db.scalars(select(Sujeto).where(
        Sujeto.company_id == c.company_id,
        Sujeto.contrato_id == c.id,
        Sujeto.estado != "baja",
    )))
    personal = _cuenta_sujetos([s for s in sujetos if s.tipo != "equipo"])
    equipos = _cuenta_sujetos([s for s in sujetos if s.tipo == "equipo"])

    docs = [d for d in _documentos_contrato(db, c) if d.obligatorio and not d.es_emsipor]
    ok = sum(1 for d in docs if d.estado_calc in ("ok", "porvenc"))
    pct = round(100 * ok / len(docs)) if docs else 0

    alertas = list(db.scalars(select(Alerta).where(
        Alerta.company_id == c.company_id,
        Alerta.contrato_id == c.id,
        Alerta.resuelta_at.is_(None),
    ).order_by(Alerta.created_at.desc()).limit(5)))

    atencion = [
        {"titulo": r.titulo, "detalle": r.descripcion or "",
         "etiqueta": "Requisito de terreno", "color": _C["red"],
         "bg": _C["red_bg"]}
        for r in db.scalars(select(RequisitoTerreno).limit(3))
    ]
    atencion += [
        {"titulo": a.titulo, "detalle": a.descripcion or "",
         "etiqueta": "Bloqueante" if a.estado == "bloqueante" else "Alerta",
         "color": _C["red"] if a.severidad == "critica" else _C["amb"],
         "bg": _C["red_bg"] if a.severidad == "critica" else _C["amb_bg"]}
        for a in alertas
    ]

    return correo_semanal(
        **ctx, semana=_fecha(date.today()), pct=pct,
        personal=personal, equipos=equipos,
        alertas=len(alertas), atencion=atencion,
        url=_url(f"/contratos/{c.id}"),
    )


def construir_correo(db, plantilla: str, c: Contrato, *,
                     para: str | None = None,
                     nombre: str | None = None,
                     rol: str | None = None) -> tuple[str, str, str]:
    """Renderiza cualquiera de las cinco plantillas para un contrato."""
    if plantilla == "resumen":
        return datos_resumen(db, c)
    if plantilla == "porvencer":
        return datos_porvencer(db, c)
    if plantilla == "observado":
        return datos_observado(db, c)
    if plantilla == "semanal":
        return datos_semanal(db, c)
    if plantilla == "invitacion":
        ctx = _contexto(db, c)
        return correo_invitacion(
            **ctx, nombre=nombre, correo=para or "invitado@empresa.cl",
            clave="Acr7k2qp!", rol=rol or "Colaborador del contrato",
            enlace=_url("/login"),
        )
    raise ValueError(f"Plantilla desconocida: {plantilla}")


# ---------------------------------------------------------------------------
# Despacho
# ---------------------------------------------------------------------------
def despachar_alerta_email(
    db,
    company_id,
    evento_clave: str,
    titulo: str,
    descripcion: str,
    contrato_id=None,
    sujeto_email: str | None = None,
    severidad: str = "advertencia",
    nombre_empresa: str = "",
    contrato_nombre: str = "",
    html: str | None = None,
    texto: str | None = None,
) -> int:
    """Evalúa preferencias y encola correos para los usuarios de la empresa y el trabajador.

    Destinatarios:
    - `role='company'`: admin de empresa → recibe SIEMPRE (salvo que desactivó el canal).
    - `role='contract_admin'`: admin de contrato → recibe solo si el documento pertenece
      a su contrato. Si no hay contrato_id en la alerta, no se le envía.
    - `role='admin'`: superadmin de plataforma → NUNCA recibe emails de empresa.
    - `sujeto_email`: email del trabajador afectado → se envía siempre que sea distinto
      de los correos ya notificados (evita duplicar si el trabajador es también usuario).

    Respeta la tabla `notificacion_preferencias`:
    - Si la empresa desactivó `canal_email` para el evento, no se manda a nadie.
    - Las excepciones por usuario sobreescriben la preferencia de empresa.

    `html` y `texto` permiten pasar una plantilla rica; si no vienen se usa el
    correo genérico de alerta.
    """
    from ..models import NotificacionPreferencia, User
    from .jobs import enqueue

    prefs = db.scalars(select(NotificacionPreferencia).where(
        NotificacionPreferencia.company_id == company_id,
        NotificacionPreferencia.evento == evento_clave,
    )).all()

    empresa_pref = next((p for p in prefs if p.user_id is None), None)
    # Por defecto (sin fila) el email está activo (ver DEFECTO_EMAIL en notificaciones.py)
    email_empresa: bool = empresa_pref.canal_email if empresa_pref is not None else True
    excepciones: dict = {p.user_id: p.canal_email for p in prefs if p.user_id is not None}

    html = html or _html_alerta(
        titulo=titulo,
        descripcion=descripcion,
        severidad=severidad,
        nombre_empresa=nombre_empresa,
        contrato_nombre=contrato_nombre,
    )

    # --- Usuarios de la empresa a notificar -----------------------------------
    q_users = select(User).where(
        User.company_id == company_id,
        User.activo == True,
        User.status == "approved",
        User.role != "admin",   # excluir superadmin de plataforma
    )
    if contrato_id:
        q_users = q_users.where(
            or_(
                User.role == "company",
                User.contrato_id == contrato_id,
            )
        )
    else:
        q_users = q_users.where(User.role == "company")

    usuarios = db.scalars(q_users).all()

    emails_enviados: set[str] = set()

    for u in usuarios:
        manda_email = excepciones.get(u.id, email_empresa)
        if manda_email and u.email:
            enqueue("enviar_email", to_email=u.email, subject=titulo,
                    html_body=html, text_body=texto)
            emails_enviados.add(u.email.lower())
            log.debug("Alerta '%s' encolada para usuario %s (%s)", evento_clave, u.email, u.role)

    # --- Trabajador afectado --------------------------------------------------
    if sujeto_email and sujeto_email.lower() not in emails_enviados:
        enqueue("enviar_email", to_email=sujeto_email, subject=titulo,
                html_body=html, text_body=texto)
        emails_enviados.add(sujeto_email.lower())
        log.debug("Alerta '%s' encolada para trabajador <%s>", evento_clave, sujeto_email)

    return len(emails_enviados)


# ---------------------------------------------------------------------------
# Crons
# ---------------------------------------------------------------------------
def enviar_resumen_mensual(db) -> int:
    """Un resumen por contrato activo con vencimientos; respeta preferencias."""
    total = 0
    contratos = db.scalars(select(Contrato).where(Contrato.estado != "terminado"))
    for c in contratos:
        if not _filas_documentos(db, c):
            continue
        asunto, html_body, texto = datos_resumen(db, c)
        total += despachar_alerta_email(
            db, c.company_id, "resumen_mensual", asunto, "",
            contrato_id=c.id, html=html_body, texto=texto,
        )
    return total


def enviar_estado_semanal(db) -> int:
    """Estado semanal por contrato activo, con o sin pendientes."""
    total = 0
    contratos = db.scalars(select(Contrato).where(Contrato.estado != "terminado"))
    for c in contratos:
        asunto, html_body, texto = datos_semanal(db, c)
        total += despachar_alerta_email(
            db, c.company_id, "estado_semanal", asunto, "",
            contrato_id=c.id, html=html_body, texto=texto,
        )
    return total
