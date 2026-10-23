"use client";

import React from "react";
import useReveal from "./useReveal";

/**
 * LandingTrust — Sección "Seguridad y Cumplimiento normativo".
 * Cumple con R8, H-28 y H-43:
 * - Respaldo normativo chileno (Ley 16.744, ODI, Ley 19.628).
 * - Tarjetas con contraste accesible WCAG AA y diseño limpio.
 * 
 * Referencia HTML: líneas 1647-1670.
 */
export default function LandingTrust() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      className="py-16 sm:py-24 px-[6%] bg-landing-soft2 border-t border-landing-linea"
    >
      <div className="max-w-[1080px] mx-auto">
        <div className="text-center mb-12 sm:mb-14">
          <div className="inline-flex items-center justify-center gap-2 text-[0.72rem] tracking-wider uppercase font-bold text-landing-azul bg-landing-azul-claro px-3.5 py-1.5 rounded-full mb-3.5">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            SEGURIDAD Y CUMPLIMIENTO
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold text-landing-ink tracking-tight max-w-[700px] mx-auto leading-tight">
            Construido para la realidad normativa de la minería y la energía en Chile
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-landing-linea rounded-2xl p-7 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-landing-azul-claro flex items-center justify-center text-xl mb-4 text-landing-azul-d">
              ⚖️
            </div>
            <h3 className="text-base font-extrabold text-landing-ink mb-2">
              Alineado a la normativa
            </h3>
            <p className="text-xs sm:text-sm text-landing-gris leading-relaxed">
              Pensado en torno a la Ley 16.744 y la Obligación de Informar (ODI), los mismos requisitos que ya te exige cada mandante.
            </p>
          </div>

          <div className="bg-white border border-landing-linea rounded-2xl p-7 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-landing-azul-claro flex items-center justify-center text-xl mb-4 text-landing-azul-d">
              🔒
            </div>
            <h3 className="text-base font-extrabold text-landing-ink mb-2">
              Datos protegidos
            </h3>
            <p className="text-xs sm:text-sm text-landing-gris leading-relaxed">
              Tus documentos viajan cifrados y se manejan conforme a la Ley 19.628 de protección de datos personales.
            </p>
          </div>

          <div className="bg-white border border-landing-linea rounded-2xl p-7 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-landing-azul-claro flex items-center justify-center text-xl mb-4 text-landing-azul-d">
              ⛏️
            </div>
            <h3 className="text-base font-extrabold text-landing-ink mb-2">
              Hecho por gente que conoce la faena
            </h3>
            <p className="text-xs sm:text-sm text-landing-gris leading-relaxed">
              Un equipo que trabaja de cerca con proveedores y mandantes de minería y energía en Chile, todos los días.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
