"use client";

import React, { useState } from "react";
import Link from "next/link";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

interface FormData {
  nombre: string;
  apellido: string;
  email: string;
  empresa: string;
  mensaje: string;
  _honey: string;
}

const INITIAL_FORM: FormData = {
  nombre: "",
  apellido: "",
  email: "",
  empresa: "",
  mensaje: "",
  _honey: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * LandingContacto — Formulario de contacto oficial de Acredittia.
 * Cumple con R7, H-05 y H-55:
 * - 5 campos claramente identificados + honeypot invisible anti-spam.
 * - Validación inmediata en cliente y confirmación server-side.
 * - Estado de carga visual explícito en primera pulsación ("Enviando…") para evitar dobles envíos.
 * - Mensaje de resultado en contenedor accesible con role="status" y aria-live="polite".
 * - Consentimiento informado con enlace a la política de privacidad (/privacidad).
 * - Cero direcciones de correo destino expuestas en el código cliente.
 * 
 * Referencia HTML: líneas 1680-1735.
 */
export default function LandingContacto() {
  const sectionRef = useReveal<HTMLElement>();

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "err"; message: string }>({
    type: "idle",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Si el honeypot fue completado, simular éxito silencioso
    if (form._honey.trim().length > 0) {
      setStatus({
        type: "ok",
        message: "¡Gracias! Recibimos tu mensaje y te contactaremos pronto.",
      });
      setForm(INITIAL_FORM);
      return;
    }

    const cleanNombre = form.nombre.trim();
    const cleanEmail = form.email.trim();
    const cleanMensaje = form.mensaje.trim();

    // Validación de campos requeridos
    if (!cleanNombre || !cleanEmail || !cleanMensaje) {
      setStatus({
        type: "err",
        message: "Completa tu nombre, email y mensaje.",
      });
      return;
    }

    // Validación sintáctica de correo
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setStatus({
        type: "err",
        message: "Revisa que tu email esté bien escrito.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/contacto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: cleanNombre,
          apellido: form.apellido.trim(),
          email: cleanEmail,
          empresa: form.empresa.trim(),
          mensaje: cleanMensaje,
          _honey: form._honey,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        setStatus({
          type: "ok",
          message: data.message || "¡Gracias! Recibimos tu mensaje y te contactaremos pronto.",
        });
        setForm(INITIAL_FORM);
      } else {
        setStatus({
          type: "err",
          message:
            data?.error ||
            "No pudimos enviar el mensaje. Inténtalo nuevamente o escríbenos directamente.",
        });
      }
    } catch {
      setStatus({
        type: "err",
        message:
          "Error de conexión. Por favor revisa tu conexión a internet o intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id={LANDING_SECTIONS.CONTACT}
      ref={sectionRef}
      className="pt-8 pb-20 sm:pb-28 px-[6%] scroll-mt-20"
    >
      <div className="max-w-[760px] mx-auto bg-landing-soft2 rounded-[24px] p-6 sm:p-10 lg:p-14 border border-landing-linea shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 text-[0.72rem] tracking-wider uppercase font-bold text-landing-azul bg-landing-azul-claro px-3.5 py-1.5 rounded-full mb-3.5">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            CONTÁCTANOS
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-landing-ink tracking-tight mb-2.5">
            Descubre cómo ACREDITTIA puede impulsar tu compañía
          </h2>
          <p className="text-landing-gris text-sm sm:text-base max-w-[520px] mx-auto">
            Cuéntanos de tu faena o tu empresa y te mostramos la plataforma en vivo.
          </p>
        </div>

        <form id="contactForm" onSubmit={handleSubmit} noValidate>
          {/* Honeypot invisible para protección anti-spam */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="cf-honey">No rellenar</label>
            <input
              id="cf-honey"
              type="text"
              name="_honey"
              value={form._honey}
              onChange={handleChange}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-nombre" className="text-xs font-bold text-landing-ink">
                Nombre <span className="text-landing-rojo">*</span>
              </label>
              <input
                id="cf-nombre"
                name="nombre"
                type="text"
                placeholder="Tu nombre"
                required
                value={form.nombre}
                onChange={handleChange}
                className="w-full border border-landing-linea rounded-xl px-3.5 py-3 text-sm text-landing-ink bg-white focus:outline-none focus:border-landing-azul focus:ring-2 focus:ring-landing-azul/30 transition-all placeholder:text-landing-gris2"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-apellido" className="text-xs font-bold text-landing-ink">
                Apellido
              </label>
              <input
                id="cf-apellido"
                name="apellido"
                type="text"
                placeholder="Tu apellido"
                value={form.apellido}
                onChange={handleChange}
                className="w-full border border-landing-linea rounded-xl px-3.5 py-3 text-sm text-landing-ink bg-white focus:outline-none focus:border-landing-azul focus:ring-2 focus:ring-landing-azul/30 transition-all placeholder:text-landing-gris2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-email" className="text-xs font-bold text-landing-ink">
                Email corporativo <span className="text-landing-rojo">*</span>
              </label>
              <input
                id="cf-email"
                name="email"
                type="email"
                placeholder="tu@empresa.cl"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full border border-landing-linea rounded-xl px-3.5 py-3 text-sm text-landing-ink bg-white focus:outline-none focus:border-landing-azul focus:ring-2 focus:ring-landing-azul/30 transition-all placeholder:text-landing-gris2"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-empresa" className="text-xs font-bold text-landing-ink">
                Empresa
              </label>
              <input
                id="cf-empresa"
                name="empresa"
                type="text"
                placeholder="Nombre de tu empresa"
                value={form.empresa}
                onChange={handleChange}
                className="w-full border border-landing-linea rounded-xl px-3.5 py-3 text-sm text-landing-ink bg-white focus:outline-none focus:border-landing-azul focus:ring-2 focus:ring-landing-azul/30 transition-all placeholder:text-landing-gris2"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-mensaje" className="text-xs font-bold text-landing-ink">
                Mensaje <span className="text-landing-rojo">*</span>
              </label>
              <textarea
                id="cf-mensaje"
                name="mensaje"
                rows={4}
                placeholder="Cuéntanos qué faenas o plataformas necesitas integrar"
                required
                value={form.mensaje}
                onChange={handleChange}
                className="w-full border border-landing-linea rounded-xl px-3.5 py-3 text-sm text-landing-ink bg-white focus:outline-none focus:border-landing-azul focus:ring-2 focus:ring-landing-azul/30 transition-all placeholder:text-landing-gris2 resize-y"
              />
            </div>
          </div>

          {/* Consentimiento informado con enlace a política de privacidad (H-55) */}
          <div className="mb-5 text-[0.78rem] text-landing-gris leading-relaxed">
            Al enviar este formulario, aceptas el tratamiento de tus datos para ser contactado de acuerdo a nuestra{" "}
            <Link
              href="/privacidad"
              className="text-landing-azul underline hover:text-landing-azul-d transition-colors font-medium focus-visible:outline-2 focus-visible:outline-landing-azul"
            >
              política de privacidad
            </Link>
            .
          </div>

          <button
            id="cfBtn"
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center font-bold text-sm sm:text-base px-6 py-3.5 rounded-full bg-landing-azul text-white hover:bg-landing-azul-d disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-azul"
          >
            {isSubmitting ? "Enviando…" : "Enviar mensaje →"}
          </button>

          {/* Región de estado accesible aria-live */}
          <div
            id="cfMsg"
            role="status"
            aria-live="polite"
            className="mt-3.5 min-h-[1.5rem] text-center"
          >
            {status.message && (
              <p
                className={`text-xs sm:text-sm font-semibold ${
                  status.type === "ok" ? "text-landing-verde" : "text-landing-rojo"
                }`}
              >
                {status.message}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
