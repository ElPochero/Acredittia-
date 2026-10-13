"""Servicio de envío de emails para Acredittia.

Usa SMTP estándar (compatible con Gmail con Contrasenia de App). El template HTML
está inspirado en el estilo de CALIBRE: tablas inline, colores por severidad
y branding propio. Si `smtp_host` no está configurado, simula el envío en log
para que el entorno de desarrollo no falle.
"""
import smtplib
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..config import settings
from .jobs import tarea

log = logging.getLogger("acredittia.email")

# ---------------------------------------------------------------------------
# Template HTML
# ---------------------------------------------------------------------------

_COLORES_SEVERIDAD = {
    "critica":      {"bg": "#fef2f2", "border": "#ef4444", "badge_bg": "#dc2626", "badge_txt": "#ffffff", "icon": "🚨"},
    "advertencia":  {"bg": "#fffbeb", "border": "#f59e0b", "badge_bg": "#d97706", "badge_txt": "#ffffff", "icon": "⚠️"},
    "info":         {"bg": "#eff6ff", "border": "#3b82f6", "badge_bg": "#2563eb", "badge_txt": "#ffffff", "icon": "ℹ️"},
}


def _html_alerta(titulo: str, descripcion: str, severidad: str = "advertencia",
                 nombre_empresa: str = "", contrato_nombre: str = "") -> str:
    """Genera el cuerpo HTML del correo de alerta de vencimiento."""
    col = _COLORES_SEVERIDAD.get(severidad, _COLORES_SEVERIDAD["info"])
    ahora = datetime.now().strftime("%d/%m/%Y %H:%M")

    detalle_rows = ""
    if nombre_empresa:
        detalle_rows += f"""
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Empresa:</td>
          <td style="padding:6px 0;font-weight:bold;color:#111827;font-size:13px;">{nombre_empresa}</td>
        </tr>"""
    if contrato_nombre:
        detalle_rows += f"""
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Contrato:</td>
          <td style="padding:6px 0;font-weight:bold;color:#111827;font-size:13px;">{contrato_nombre}</td>
        </tr>"""

    label_severidad = {
        "critica": "CRÍTICA", "advertencia": "ADVERTENCIA", "info": "INFORMATIVO"
    }.get(severidad, severidad.upper())

    return f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;
              box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);
                padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td>
            <span style="color:#60a5fa;font-size:11px;font-weight:bold;
                         letter-spacing:2px;text-transform:uppercase;">ACREDITTIA</span>
            <div style="color:#ffffff;font-size:20px;font-weight:bold;margin-top:4px;">
              Alerta de Acreditación
            </div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <span style="background:{col['badge_bg']};color:{col['badge_txt']};
                         padding:4px 12px;border-radius:20px;font-size:11px;
                         font-weight:bold;letter-spacing:1px;">
              {col['icon']} {label_severidad}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Alerta principal -->
    <div style="padding:24px 32px;">
      <div style="background:{col['bg']};border-left:4px solid {col['border']};
                  border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:16px;font-weight:bold;color:#111827;margin-bottom:6px;">
          {col['icon']} {titulo}
        </div>
        <div style="font-size:14px;color:#374151;line-height:1.6;">
          {descripcion}
        </div>
      </div>

      <!-- Detalles -->
      {f'''
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                  padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:bold;color:#6b7280;
                    text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Detalle</div>
        <table style="width:100%;border-collapse:collapse;">
          {detalle_rows}
        </table>
      </div>
      ''' if detalle_rows else ''}

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0;">
        <a href="{settings.public_base_url}/alertas"
           style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
                  color:#ffffff;text-decoration:none;padding:12px 28px;
                  border-radius:8px;font-size:14px;font-weight:bold;
                  box-shadow:0 2px 8px rgba(37,99,235,0.3);">
          Ver alertas en Acredittia →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;
                text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        Generado automáticamente el {ahora} · Acredittia — Plataforma de Acreditación
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">
        Para desactivar estas notificaciones, ingresa a
        <a href="{settings.public_base_url}/config/notificaciones"
           style="color:#6b7280;">Configuración → Notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Envío SMTP
# ---------------------------------------------------------------------------

@tarea("enviar_email")
def enviar_email(to_email: str, subject: str, html_body: str) -> None:
    """Envía un correo electrónico en segundo plano usando la configuración SMTP.

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


# ---------------------------------------------------------------------------
# Despacho inteligente (respeta preferencias de la empresa)
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
) -> None:
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
    """
    from sqlalchemy import or_, select
    from ..models import NotificacionPreferencia, User
    from .jobs import enqueue

    # --- Preferencias de la empresa para este evento ----------------------------
    prefs = db.scalars(select(NotificacionPreferencia).where(
        NotificacionPreferencia.company_id == company_id,
        NotificacionPreferencia.evento == evento_clave,
    )).all()

    empresa_pref = next((p for p in prefs if p.user_id is None), None)
    # Por defecto (sin fila) el email está activo (ver DEFECTO_EMAIL en notificaciones.py)
    email_empresa: bool = empresa_pref.canal_email if empresa_pref is not None else True
    excepciones: dict = {p.user_id: p.canal_email for p in prefs if p.user_id is not None}

    # --- Construir HTML una sola vez ------------------------------------------
    html = _html_alerta(
        titulo=titulo,
        descripcion=descripcion,
        severidad=severidad,
        nombre_empresa=nombre_empresa,
        contrato_nombre=contrato_nombre,
    )

    # --- Usuarios de la empresa a notificar -----------------------------------
    # Reglas de inclusión por rol:
    #   'company'        → siempre incluir (admin de empresa)
    #   'contract_admin' → solo si hay contrato_id y coincide con el suyo
    #   'admin'          → excluir (superadmin de plataforma, no de la empresa)
    q_users = select(User).where(
        User.company_id == company_id,
        User.activo == True,
        User.status == "approved",
        User.role != "admin",   # excluir superadmin de plataforma
    )
    if contrato_id:
        # 'company' sin contrato_id asignado (ver toda la empresa) +
        # 'company' con contrato_id IS NULL +
        # 'contract_admin' cuyo contrato coincide
        q_users = q_users.where(
            or_(
                User.role == "company",
                User.contrato_id == contrato_id,  # contract_admin de este contrato
            )
        )
    else:
        # Sin contrato específico: solo admins de empresa, no contract_admins
        q_users = q_users.where(User.role == "company")

    usuarios = db.scalars(q_users).all()

    emails_enviados: set[str] = set()

    for u in usuarios:
        manda_email = excepciones.get(u.id, email_empresa)
        if manda_email and u.email:
            enqueue("enviar_email", to_email=u.email, subject=titulo, html_body=html)
            emails_enviados.add(u.email.lower())
            log.debug("Alerta '%s' encolada para usuario %s (%s)", evento_clave, u.email, u.role)

    # --- Trabajador afectado --------------------------------------------------
    # Se envía siempre que:
    #   - tenga email registrado
    #   - no haya sido ya notificado como usuario de la plataforma (evita duplicado)
    if sujeto_email and sujeto_email.lower() not in emails_enviados:
        enqueue("enviar_email", to_email=sujeto_email, subject=titulo, html_body=html)
        log.debug("Alerta '%s' encolada para trabajador <%s>", evento_clave, sujeto_email)
