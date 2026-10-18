"use client";

import React from "react";
import Link from "next/link";
import { LANDING_SECTIONS } from "./sections";
import LandingHeroMockup from "./LandingHeroMockup";
import { IconCheck } from "./LandingIcons";

/**
 * LandingHero — Sección Hero con fidelidad al diseño alternativo (líneas 733-746).
 * - Copy de faenas mineras y energéticas reales (H-06).
 * - CTAs sin demora con prefetch a /login y ancla a #flujo (H-05, H-04).
 * - Sin URLs absolutas a acredittia.cl (R1).
 */
export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-16 lg:pt-20 lg:pb-24 px-[6%] bg-[radial-gradient(ellipse_900px_600px_at_85%_0%,#EAF1FF_0%,#ffffff_60%)]">
      {/* Detalle visual de esquina técnica */}
      <div
        className="hidden md:block absolute top-8 left-[6%] w-[26px] h-[26px] border-l-2 border-t-2 border-dashed border-landing-linea"
        aria-hidden="true"
      >
        <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-landing-azul" />
      </div>

      <div className="max-w-[1180px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-14 items-center relative">
        {/* Columna izquierda: Información y CTAs */}
        <div className="flex flex-col items-start text-left">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-2.5 bg-landing-azul-claro text-[#1E3A8A] font-bold text-[0.8rem] py-2 px-4 rounded-full mb-6">
            <span className="w-[22px] h-[22px] rounded-full bg-landing-azul text-white flex items-center justify-center shrink-0">
              <IconCheck className="w-3 h-3 text-white" />
            </span>
            <span>Plataforma de acreditación con IA · minería, energía y más</span>
          </div>

          {/* Titular H1 principal */}
          <h1 className="text-4xl sm:text-5xl lg:text-[2.85rem] font-extrabold leading-[1.14] tracking-[-0.01em] text-landing-ink mb-5 font-landing-sans">
            Cualquier faena. Cualquier plataforma.
            <span className="text-landing-azul block">Un solo lugar.</span>
          </h1>

          {/* Copy descriptivo aterrizado */}
          <p className="text-landing-gris text-base sm:text-[1.05rem] leading-[1.65] max-w-[480px] mb-8 font-normal">
            Gestiona todos los contratos de acreditación de tu empresa, en cualquier faena, para ver todo en un mismo lugar. Sube cada documento una sola vez y deja que la IA lo exporte, avise antes de cada vencimiento y hable con tus trabajadores para pedirles lo que falta.
          </p>

          {/* Botones de acción (CTAs) */}
          <div className="flex flex-wrap items-center gap-3.5 w-full sm:w-auto">
            <Link
              href="/login"
              prefetch={true}
              className="inline-flex items-center justify-center gap-2 font-bold text-[0.88rem] px-7 py-3.5 rounded-full bg-landing-azul text-white hover:bg-landing-azul-d transition-all shadow-md hover:shadow-lg whitespace-nowrap"
            >
              Empezar gratis →
            </Link>
            <a
              href={`#${LANDING_SECTIONS.FLUJO}`}
              className="inline-flex items-center justify-center gap-2 font-bold text-[0.88rem] px-7 py-3.5 rounded-full border-[1.5px] border-landing-linea text-landing-ink bg-transparent hover:border-landing-ink transition-colors whitespace-nowrap"
            >
              Ver cómo funciona
            </a>
          </div>

          {/* Nota de garantía de confianza */}
          <p className="mt-4 text-[0.82rem] text-landing-gris">
            Sin tarjeta de crédito · ves tus propios datos antes de comprometerte
          </p>
        </div>

        {/* Columna derecha: Visual del panel ejecutivo */}
        <div className="w-full flex justify-center lg:justify-end">
          <LandingHeroMockup />
        </div>
      </div>
    </section>
  );
}
