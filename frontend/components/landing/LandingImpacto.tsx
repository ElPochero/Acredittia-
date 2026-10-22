"use client";

import React from "react";
import useReveal from "./useReveal";

const IMPACT_ITEMS = [
  "Elimina las llamadas manuales de seguimiento a cada trabajador.",
  "Evita que un documento crítico venza sin que nadie se dé cuenta.",
  "Centraliza en un solo lugar lo que hoy vive disperso en Excel y carpetas.",
  "Da a cada jefe de acreditaciones visibilidad total de todos sus contratos.",
];

/**
 * LandingImpacto — Lo que cambia cuando la acreditación funciona sola.
 * Resuelve H-19 (microinteracciones reales), H-48 (comunicación directa del valor de negocio)
 * y refuerza el posicionamiento de la solución.
 * Referencia HTML: líneas 1595-1608.
 */
export default function LandingImpacto() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      id="impacto"
      className="py-24 px-[6%] bg-landing-soft border-t border-landing-linea scroll-mt-20"
      aria-label="Impacto operacional de ACREDITTIA"
    >
      <div className="max-w-[1080px] mx-auto">
        {/* Encabezado */}
        <div className="max-w-[680px] mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            IMPACTO
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-landing-ink tracking-tight mb-4">
            Lo que cambia cuando la acreditación funciona sola
          </h2>
          <p className="text-landing-gris text-base sm:text-lg leading-relaxed">
            Menos Excel, menos llamadas, menos documentos perdidos en el camino entre tu empresa y cada faena.
          </p>
        </div>

        {/* Grilla 2x2 de Impacto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 max-w-[1080px] mx-auto">
          {IMPACT_ITEMS.map((text, idx) => (
            <div
              key={idx}
              className="bg-white border border-landing-linea rounded-2xl p-5 sm:p-6 flex items-start gap-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl bg-landing-azul-claro text-landing-azul-d flex items-center justify-center font-extrabold text-sm shrink-0 shadow-2xs">
                ✓
              </div>
              <p className="text-sm sm:text-base font-semibold text-landing-ink leading-relaxed m-0 pt-1">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
