import { NextRequest, NextResponse } from "next/server";

// Correo de destino resguardado estrictamente en el entorno del servidor.
// Criterio Día 4: El correo destino NO queda en el bundle del cliente.
const CONTACT_DESTINATION_EMAIL =
  process.env.CONTACT_DESTINATION_EMAIL || "acredittia.contacto@gmail.com";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Formato de solicitud no válido." },
        { status: 400 }
      );
    }

    const { nombre, apellido, email, empresa, mensaje, _honey } = body;

    // Protección anti-spam con honeypot invisible.
    // Si un bot rellena el campo trampa, respondemos 200 silenciosamente sin reenviar.
    if (_honey && String(_honey).trim().length > 0) {
      return NextResponse.json({
        ok: true,
        message: "¡Gracias! Recibimos tu mensaje y te contactaremos pronto.",
      });
    }

    const cleanNombre = typeof nombre === "string" ? nombre.trim() : "";
    const cleanApellido = typeof apellido === "string" ? apellido.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    const cleanEmpresa = typeof empresa === "string" ? empresa.trim() : "";
    const cleanMensaje = typeof mensaje === "string" ? mensaje.trim() : "";

    // Validación de campos requeridos
    if (!cleanNombre || !cleanEmail || !cleanMensaje) {
      return NextResponse.json(
        { ok: false, error: "Completa tu nombre, email y mensaje." },
        { status: 400 }
      );
    }

    // Validación sintáctica del correo
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { ok: false, error: "Revisa que tu email esté bien escrito." },
        { status: 400 }
      );
    }

    // Preparación del payload para el servicio de envío
    const payload = {
      Nombre: cleanNombre,
      Apellido: cleanApellido,
      email: cleanEmail,
      Empresa: cleanEmpresa,
      Mensaje: cleanMensaje,
      _subject: `Nuevo contacto web ACREDITTIA: ${cleanNombre}${
        cleanEmpresa ? ` (${cleanEmpresa})` : ""
      }`,
      _template: "table",
      _captcha: "false",
    };

    const targetUrl = `https://formsubmit.co/ajax/${CONTACT_DESTINATION_EMAIL}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return NextResponse.json({
          ok: true,
          message: "¡Gracias! Recibimos tu mensaje y te contactaremos pronto.",
        });
      }

      const resData = await response.json().catch(() => null);
      console.error("[api/contacto] Error del servicio externo:", resData);

      return NextResponse.json(
        {
          ok: false,
          error: "No pudimos enviar el mensaje. Inténtalo nuevamente o escríbenos directamente.",
        },
        { status: 502 }
      );
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      console.error("[api/contacto] Excepción de conexión:", fetchErr);

      return NextResponse.json(
        {
          ok: false,
          error: "Error de conexión al procesar el mensaje. Por favor intenta más tarde.",
        },
        { status: 504 }
      );
    }
  } catch (err: unknown) {
    console.error("[api/contacto] Error interno:", err);
    return NextResponse.json(
      { ok: false, error: "Ocurrió un error inesperado al procesar la solicitud." },
      { status: 500 }
    );
  }
}
