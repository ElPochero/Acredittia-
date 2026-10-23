"use client";

import React from "react";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingCtaFinal — Sección pre-contacto con llamada a la acción hacia el formulario de contacto.
 * Cumple con H-06 y H-05:
 * - Titular y propuesta de valor enfocada en minería/faenas sin falsas promesas.
 * - Ancla interna canónica hacia #contact (#LANDING_SECTIONS.CONTACT).
 * - Cero URLs absolutas a acredittia.cl.
 * 
 * Referencia HTML: líneas 1672-1678.
 */
export default function LandingCtaFinal() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      className="mx-[6%] mt-20 sm:mt-24 lg:mt-28 mb-12 sm:mb-16 bg-landing-azul-claro rounded-[28px] px-6 sm:px-10 py-14 sm:py-20 text-center border border-blue-200/60"
    >
      <div className="max-w-[680px] mx-auto">
        <h2 className="text-2xl sm:text-3xl lg:text-[2.3rem] font-extrabold text-landing-ink tracking-tight mb-4 leading-tight">
          El próximo documento vencido que evitas es el tuyo
        </h2>
        <p className="text-landing-gris text-base sm:text-lg max-w-[540px] mx-auto mb-8 leading-relaxed">
          Treinta minutos para ver cómo tu operación de acreditación funciona sin Excel, sin llamadas y sin sorpresas.
        </p>

        <div>
          <a
            href={`#${LANDING_SECTIONS.CONTACT}`}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm sm:text-base px-8 py-3.5 rounded-full bg-landing-azul text-white hover:bg-landing-azul-d transition-colors shadow-md hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-azul"
          >
            Agendar mi demo →
          </a>
        </div>

        <span className="block mt-4 text-xs sm:text-sm text-landing-gris">
          Sin tarjeta de crédito · ves tu propia operación antes de decidir
        </span>
      </div>
    </section>
  );
}
