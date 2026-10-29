"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingNav — Barra de navegación fija con fidelidad al diseño alternativo (líneas 717-731).
 * - Cero URLs absolutas a acredittia.cl (R1)
 * - Sin selector de idioma (100% español) (R4, H-03)
 * - Enlace a login con prefetch para respuesta rápida (H-04)
 * - Anclas internas mapeadas a sections.ts
 */
export default function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 px-[4%] sm:px-[6%] py-3 sm:py-3.5 bg-white/95 backdrop-blur-[10px] border-b border-landing-linea">
      <div className="max-w-[1180px] mx-auto w-full flex items-center justify-between">
        <div className="logo flex items-center">
          <Link href="/" aria-label="Ir al inicio de Acredittia">
            <Image
              src="/acredittia-logo.svg"
              alt="ACREDITTIA"
              width={170}
              height={46}
              className="h-9 sm:h-[42px] w-auto"
              priority
            />
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-5 lg:gap-7 font-semibold text-[0.84rem] lg:text-[0.9rem] text-landing-ink">
          <a
            href={`#${LANDING_SECTIONS.FLUJO}`}
            className="opacity-75 hover:opacity-100 hover:text-landing-azul transition-all"
          >
            Cómo funciona
          </a>
          <a
            href={`#${LANDING_SECTIONS.PLATAFORMA}`}
            className="opacity-75 hover:opacity-100 hover:text-landing-azul transition-all"
          >
            Plataforma
          </a>
          <a
            href={`#${LANDING_SECTIONS.AGENTES}`}
            className="opacity-75 hover:opacity-100 hover:text-landing-azul transition-all"
          >
            Agentes
          </a>
          <a
            href={`#${LANDING_SECTIONS.FAENAS}`}
            className="opacity-75 hover:opacity-100 hover:text-landing-azul transition-all"
          >
            Faenas
          </a>
          <a
            href={`#${LANDING_SECTIONS.BENEFICIADOS}`}
            className="opacity-75 hover:opacity-100 hover:text-landing-azul transition-all"
          >
            Quién se beneficia
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* CTA Iniciar sesión (H-04, H-05, Tarea 7.3): prefetch + Link sin JS bloqueante, responde a la primera pulsación */}
          <Link
            href="/login"
            prefetch={true}
            className="inline-flex items-center justify-center font-bold text-[0.84rem] sm:text-[0.88rem] px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-full border-[1.5px] border-landing-linea text-landing-ink bg-transparent hover:border-landing-ink transition-all whitespace-nowrap active:scale-95 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-landing-azul cursor-pointer"
          >
            Iniciar sesión
          </Link>
          <a
            href={`#${LANDING_SECTIONS.CONTACT}`}
            className="inline-flex items-center justify-center gap-2 font-bold text-[0.84rem] sm:text-[0.88rem] px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-full bg-landing-azul text-white hover:bg-landing-azul-d transition-colors whitespace-nowrap shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-azul"
          >
            Agendar demo →
          </a>
        </div>
      </div>
    </nav>
  );
}
