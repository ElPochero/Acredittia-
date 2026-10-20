"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

interface AlertaItem {
  id: string;
  icon: string;
  title: string;
  subject: string;
  time: string;
  heading: string;
  sender: string;
  body: string;
}

const ALERTAS: AlertaItem[] = [
  {
    id: "alerta-0",
    icon: "🩺",
    title: "ACREDITTIA",
    subject: "Examen ocupacional de José Toro vence en 30 días",
    time: "Hace 2h",
    heading: "Examen ocupacional por vencer",
    sender: "De: alertas@acredittia.cl · Para: ti",
    body: "Hola, te avisamos que el examen ocupacional de José Toro vence en 30 días. Sube el documento renovado en ACREDITTIA antes de esa fecha para que su acreditación siga vigente.",
  },
  {
    id: "alerta-1",
    icon: "🚗",
    title: "ACREDITTIA",
    subject: "Curso de manejo a la defensiva de Rodrigo Soto vence en 15 días",
    time: "Ayer",
    heading: "Curso de manejo a la defensiva por vencer",
    sender: "De: alertas@acredittia.cl · Para: ti",
    body: "Hola, te avisamos que el curso de manejo a la defensiva de Rodrigo Soto vence en 15 días. Agenda la recertificación o sube el nuevo certificado en ACREDITTIA antes de esa fecha.",
  },
  {
    id: "alerta-2",
    icon: "📄",
    title: "ACREDITTIA",
    subject: "Certificado de accidentabilidad de Proveedor SpA vence en 10 días",
    time: "Hace 3 días",
    heading: "Certificado de accidentabilidad por vencer",
    sender: "De: alertas@acredittia.cl · Para: ti",
    body: "Hola, te avisamos que el certificado de accidentabilidad de Proveedor SpA vence en 10 días. Sube el documento actualizado en ACREDITTIA para mantener vigente el contrato con el mandante.",
  },
  {
    id: "alerta-3",
    icon: "🚛",
    title: "ACREDITTIA",
    subject: "Revisión técnica de Camión Jaula #12 vence en 12 días",
    time: "Hace 5 días",
    heading: "Revisión técnica por vencer",
    sender: "De: alertas@acredittia.cl · Para: ti",
    body: "Hola, te avisamos que la revisión técnica de Camión Jaula #12 vence en 12 días. Sube el certificado renovado en ACREDITTIA antes de esa fecha para que el equipo siga habilitado en faena.",
  },
];

/**
 * LandingAlertas — Bandeja interactiva de alertas por correo con acordeón y rotación accesible.
 * Cierra H-10 (ejemplos reales), H-21 (interacción React sin videos/GIFs) y H-50 (primera cerrada en carga).
 * Cumple R1 (enlace a ancla #plataforma, no URL absoluta) y WCAG 2.2.2 (control de pausa).
 * Referencia HTML: líneas 1057-1111 y 2017-2048.
 */
export default function LandingAlertas() {
  const sectionRef = useReveal<HTMLElement>();

  // Criterio crítico Día 3 y H-50: todas las filas parten cerradas en cada carga.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Estados de control de autoplay
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const shouldAutoplay = !isManualPaused && !isHovered && !isFocused && !prefersReducedMotion;

  useEffect(() => {
    if (!shouldAutoplay) return;

    const timer = setInterval(() => {
      setOpenIndex((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % ALERTAS.length;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [shouldAutoplay]);

  const handleRowClick = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section
      ref={sectionRef}
      id="alertas-correo"
      className="py-24 px-[6%] bg-landing-soft border-t border-landing-linea scroll-mt-20"
      aria-label="Alertas automáticas por correo"
    >
      <div className="max-w-[640px] mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-landing-azul" />
          ALERTAS AUTOMÁTICAS
        </div>
        <h2 className="text-2xl md:text-[2.1rem] font-extrabold tracking-tight text-landing-ink mb-3.5 leading-tight">
          El aviso llega solo, antes de que algo se venza
        </h2>
        <p className="text-landing-gris text-base md:text-[1rem] leading-relaxed">
          Personas, cursos, equipos y certificados de la empresa: cada vencimiento genera una alerta automática a tu correo, con todo lo que necesitas para resolverla.
        </p>
      </div>

      <div className="max-w-[520px] mx-auto">
        <div
          className="border border-landing-linea rounded-2xl bg-white shadow-[0_10px_30px_-18px_rgba(13,27,42,0.2)] overflow-hidden transition-all duration-300"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Barra superior estilo cliente de correo */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#F7F9FC] border-b border-landing-linea">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
              <span className="ml-2 font-bold text-[0.72rem] text-landing-gris">
                Bandeja de entrada
              </span>
            </div>

            {/* Control de pausa accesible (WCAG 2.2.2) */}
            <button
              type="button"
              onClick={() => setIsManualPaused((prev) => !prev)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              aria-label={isManualPaused ? "Reanudar rotación de alertas" : "Pausar rotación de alertas"}
              title={isManualPaused ? "Reanudar rotación" : "Pausar rotación"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.68rem] font-medium text-landing-gris hover:text-landing-ink bg-white border border-landing-linea transition-colors"
            >
              <span aria-hidden="true">{isManualPaused ? "▶" : "⏸"}</span>
              <span className="hidden sm:inline">{isManualPaused ? "Reanudar" : "Pausar"}</span>
            </button>
          </div>

          {/* Lista de correos / acordeón */}
          <div className="divide-y divide-landing-linea">
            {ALERTAS.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <div key={item.id} className="transition-colors">
                  {/* Fila del encabezado de correo (botón accesible) */}
                  <button
                    type="button"
                    onClick={() => handleRowClick(index)}
                    aria-expanded={isOpen}
                    aria-controls={`alert-body-${index}`}
                    className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-landing-soft/60 focus-visible:outline-none focus-visible:bg-landing-soft/80 transition-colors"
                  >
                    {/* Punto de no leído: se oculta cuando se abre */}
                    <span
                      className={`w-2 h-2 rounded-full bg-landing-azul shrink-0 transition-all duration-300 ${
                        isOpen ? "opacity-0 scale-0" : "opacity-100 scale-100"
                      }`}
                      aria-hidden="true"
                    />

                    {/* Ícono de la alerta */}
                    <span className="text-base shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>

                    {/* Texto del correo */}
                    <div className="flex-1 min-w-0 pr-2">
                      <b className="block text-[0.8rem] font-extrabold text-landing-ink leading-tight">
                        {item.title}
                      </b>
                      <span
                        className={`block text-[0.72rem] text-landing-gris truncate transition-all ${
                          isOpen ? "font-normal" : "font-semibold"
                        }`}
                      >
                        {item.subject}
                      </span>
                    </div>

                    {/* Tiempo */}
                    <span className="text-[0.68rem] text-landing-gris2 shrink-0 font-medium">
                      {item.time}
                    </span>
                  </button>

                  {/* Cuerpo del correo desplegable */}
                  <div
                    id={`alert-body-${index}`}
                    role="region"
                    aria-label={`Detalle de alerta: ${item.subject}`}
                    className={`overflow-hidden transition-all duration-500 ease-in-out px-4 ${
                      isOpen
                        ? "max-h-[360px] opacity-100 pb-5 pt-1 border-t border-landing-linea bg-landing-soft/30"
                        : "max-h-0 opacity-0 py-0 border-t-0"
                    }`}
                  >
                    <div className="pt-2">
                      <div className="mb-3">
                        <Image
                          src="/acredittia-logo.svg"
                          alt="ACREDITTIA"
                          width={110}
                          height={20}
                          className="h-4 w-auto mb-2"
                        />
                        <b className="block text-[0.82rem] text-landing-ink font-bold">
                          {item.heading}
                        </b>
                        <span className="block text-[0.66rem] text-landing-gris2 mt-0.5">
                          {item.sender}
                        </span>
                      </div>

                      <p className="text-[0.76rem] leading-relaxed text-landing-ink mb-3.5">
                        {item.body}
                      </p>

                      {/* CTA interno a #plataforma (Regla R1) */}
                      <a
                        href={`#${LANDING_SECTIONS.PLATAFORMA}`}
                        className="inline-flex items-center gap-1.5 text-[0.74rem] font-extrabold text-white bg-landing-azul hover:bg-landing-azul-d px-3.5 py-2 rounded-lg shadow-sm transition-colors"
                      >
                        Resolver alerta →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-[0.78rem] text-landing-gris leading-relaxed mt-4">
          Y así, para cualquier documento de personas, equipos o de la empresa que esté por vencer.
        </p>
      </div>
    </section>
  );
}
